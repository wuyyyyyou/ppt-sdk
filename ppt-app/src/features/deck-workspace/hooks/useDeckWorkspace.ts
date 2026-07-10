import { useEffect, useMemo, useRef, useState } from "react";
import { createAgentClient, type AgentClient } from "../../../agent/agentClient";
import { resolveAgentToolAccessPolicy } from "../../../agent/agentToolAccessPolicy";
import { createAiClient, type AiAttemptLog, type AiClient, type LlmContextRow } from "../../../ai/aiClient";
import {
  createAiInteractionLogger,
  type AiOperationLogContext,
} from "../../../ai/interactionLog";
import { createPptBackend, type PptBackend } from "../../../api/pptBackend";
import { connectAnnaRuntime } from "../../../runtime/annaRuntime";
import {
  createAppHostUploadClient,
  type AppHostUploadClient,
} from "../../../runtime/appHostUploadClient";
import {
  AUTO_OUTPUT_LANGUAGE,
  normalizeOutputLanguage,
  readSettingOutputLanguage,
} from "../../../ai/outputLanguage";
import type {
  ListWorkspacesResult,
  PageProgress,
  GetStyleProfilePreviewResult,
  PptxExportJob,
  StyleProfileIndexEntry,
  TemplateSummary,
  UploadedSourceAnalysisDependency,
  UploadedSourceIndex,
  UploadedSourceMaterial,
  WorkspaceResult,
  WorkspaceOutline,
  WorkspaceOutlineItem,
  WorkspacePageItem,
  WorkspacePages,
  WorkspaceStyleProfileSelection,
  WorkspaceSettings
} from "../../../api/types";
import {
  createLocalProjectDeck,
  initialDeck,
  outlineDetails,
  type OutlineDetail,
  type Slide
} from "../../../data/mockDeck";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";
import {
  deckReadyStatus,
  hasDownstreamArtifacts,
  isWorkspaceDeckStale,
  syncSlideCountContextRow,
} from "../utils";
import {
  buildContextRowFromPatch as buildContextRowFromPatchBase,
  buildContextRowsFromSuggestion,
  mergeSuggestedContextRows,
  normalizeSlideCountContextValue,
  shouldSuggestContextBeforeGeneration,
  SLIDE_COUNT_CONTEXT_OPTIONS,
  type ContextPatchId,
} from "../contextSuggestion";
import {
  createDeckGenerationStreamSnapshot,
  runDeckGeneration,
  runDeckRefinement,
  runPageGenerationRetry,
  type DeckGenerationCompletion,
  type DeckGenerationError,
  type DeckGenerationProgress,
} from "../../deck-generation";
import { ensureWorkspaceThemeToken as generateWorkspaceThemeToken } from "../../deck-generation/themeTokenWorkflow";
import {
  ensureFreshUploadedSourceAnalysis,
  type UploadedSourceAnalysisWorkflowEvent,
} from "../../deck-generation/uploadedSourceAnalysisWorkflow";
import {
  compactUploadedSourceAnalysisForPrompt,
  createUploadedSourceAnalysisDependency,
  uploadedSourceAnalysisMatchesActiveSet,
  uploadedSourceDependencyMatchesAnalysis,
  type UploadedSourceAnalysis,
} from "../../deck-generation/uploadedSourceAnalysis";
import {
  createStyleProfile,
  isStyleProfileCreationCancelledError,
  type CreateStyleProfileWorkflowEvent,
} from "../../deck-generation/styleProfileWorkflow";
import { reconcileInterruptedPageProgress } from "../../deck-generation/interruptedReconciliation";
import {
  createArtifactExportProgress,
  createExportErrorProgress,
  createExportStartProgress,
  createIdleExportProgress,
  createPptxJobExportProgress,
} from "../exportProgressDisplay";
import { restoreDeckGenerationProgress } from "../workspaceRecovery";
import {
  DEFAULT_PAGE_REVIEW_SETTINGS,
  pageReviewSettingsToWorkspaceSettings,
  readPageReviewSettings,
  type PageReviewSettings,
} from "../reviewSettings";
import {
  DEFAULT_RESEARCH_SEARCH_CONTROL_SETTINGS,
  readResearchSearchControlSettings,
  researchSearchControlSettingsToWorkspaceSettings,
  type ResearchSearchControlSettings,
} from "../researchSearchControl";
import {
  outlineReviewPreferenceToWorkspaceSettings,
  readOutlineReviewPreference,
} from "../outlineReviewPreference";
import { createWorkspaceReviewRenderKey } from "../workspaceReviewRenderKey";
import type {
  ContextRow,
  DeckReviewRenderState,
  DeckWorkspaceState,
  ExportProgressState,
  ExportArtifact,
  GenerationStreamSnapshot,
  LoadingKind,
  MainStage,
  PageId,
  PanelMode,
  PreviewMode,
  RefineScope,
  UploadedSourceAnalysisProgress,
  StyleProfileCreationStageRecord,
  StyleProfileCreationViewState,
  StyleProfileDetailState,
  UploadedSourceAnalysisViewState
} from "../types";
import {
  buildGenerationViewState,
  type ActiveGenerationRun,
  type ActiveGenerationRunKind,
} from "../generationViewState";
import { isSelectableTemplateGroup } from "../templateSelectionPolicy";
import {
  applyUploadedSourceAnalysisWorkflowEvent,
  createCompletedUploadedSourceAnalysisProgress,
  createSkippedUploadedSourceAnalysisProgress,
  createUploadedSourceAnalysisProgress,
  failUploadedSourceAnalysisProgress,
} from "../uploadedSourceAnalysisProgress";
import { shouldAutoSyncWorkspaceTitleFromOutline } from "../workspaceTitleSync";

const DEFAULT_TEMPLATE_GROUP_ID = "red-finance-canvas";
const AGENT_TOOL_ACCESS_POLICY = resolveAgentToolAccessPolicy(
  import.meta.env.VITE_AGENT_TOOL_ACCESS_POLICY,
  { warn: (message) => console.warn(message) },
);
const PPTX_EXPORT_POLL_INTERVAL_MS = 1500;
const PPTX_EXPORT_POLL_TIMEOUT_MS = 15 * 60 * 1000;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatWorkspaceDate(date = new Date()) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function clampSlideIndex(index: number, slideCount: number) {
  const maxIndex = Math.max(0, slideCount - 1);
  return Math.min(Math.max(0, index), maxIndex);
}

function uploadedSourceDependencyMatchesActiveSources(input: {
  dependency?: UploadedSourceAnalysisDependency;
  uploadedSources: UploadedSourceMaterial[];
}) {
  const { dependency, uploadedSources } = input;
  if (!dependency) return false;
  if (dependency.active_uploaded_sources.length !== uploadedSources.length) return false;
  const dependencyById = new Map(
    dependency.active_uploaded_sources.map((source) => [source.uploaded_source_id, source])
  );
  return uploadedSources.every((source) => {
    const dependencySource = dependencyById.get(source.uploaded_source_id);
    return dependencySource !== undefined &&
      dependencySource.sha256 === source.sha256 &&
      dependencySource.size_bytes === source.size_bytes;
  });
}

function readWorkspaceUploadedSourceDependency(
  workspace: WorkspaceResult | null,
): UploadedSourceAnalysisDependency | undefined {
  const outline = workspace?.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
    ? workspace.outline as Partial<WorkspaceOutline>
    : null;
  return outline?.source?.uploaded_source_analysis;
}

function createEmptyUploadedSourceAnalysisViewState(): UploadedSourceAnalysisViewState {
  return {
    status: "hidden",
    sourceCount: 0,
    factCount: null,
    visualAssetCount: null,
    gapCount: null,
  };
}

function defaultStyleProfileName(date = new Date()) {
  return `风格画像-${formatWorkspaceDate(date)}`;
}

function createStyleProfileCreationStages(): StyleProfileCreationStageRecord[] {
  return [
    { id: "prepare", label: "准备参考资料", state: "pending", summaryLines: [], activities: [], lines: [] },
    { id: "analyze", label: "分析视觉风格", state: "pending", summaryLines: [], activities: [], lines: [] },
    { id: "publish", label: "发布风格画像", state: "pending", summaryLines: [], activities: [], lines: [] },
  ];
}

function createIdleStyleProfileCreationState(): StyleProfileCreationViewState {
  return {
    status: "idle",
    displayName: defaultStyleProfileName(),
    files: [],
    creationId: "",
    canRetryAnalysis: false,
    message: "上传 PPTX 或图片参考资料后开始分析。",
    stages: createStyleProfileCreationStages(),
    createdStyleProfileId: "",
    error: "",
  };
}

function updateStyleProfileStage(
  stages: StyleProfileCreationStageRecord[],
  id: StyleProfileCreationStageRecord["id"],
  patch: Partial<StyleProfileCreationStageRecord>,
) {
  return stages.map((stage) => stage.id === id ? { ...stage, ...patch } : stage);
}

function appendBounded(items: string[], value: string, limit: number) {
  const trimmed = value.trim();
  if (!trimmed) return items;
  return [...items, trimmed].slice(-limit);
}

function appendStreamText(lines: string[], text: string) {
  if (!text) return lines;
  const current = lines.length > 0 ? lines.slice() : [""];
  const parts = text.split(/\r?\n/);
  current[current.length - 1] = `${current[current.length - 1]}${parts[0] ?? ""}`;
  for (const part of parts.slice(1)) current.push(part);
  return current.slice(-80);
}

function applyStyleProfileCreationEvent(
  current: StyleProfileCreationViewState,
  event: CreateStyleProfileWorkflowEvent,
): StyleProfileCreationViewState {
  if (event.type === "creation-prepared") {
    return {
      ...current,
      creationId: event.creationId,
      displayName: event.displayName,
    };
  }
  if (event.type === "phase-start") {
    return {
      ...current,
      message: event.message,
      stages: updateStyleProfileStage(current.stages, event.phase, {
        state: "active",
        error: "",
        summaryLines: appendBounded(
          current.stages.find((stage) => stage.id === event.phase)?.summaryLines ?? [],
          event.message,
          6,
        ),
      }),
    };
  }
  if (event.type === "phase-complete") {
    return {
      ...current,
      message: event.message,
      stages: updateStyleProfileStage(current.stages, event.phase, {
        state: "completed",
        summaryLines: appendBounded(
          current.stages.find((stage) => stage.id === event.phase)?.summaryLines ?? [],
          event.message,
          6,
        ),
      }),
    };
  }
  if (event.type === "phase-error") {
    return {
      ...current,
      status: "failed",
      canRetryAnalysis: event.phase === "analyze" || event.phase === "publish",
      message: event.message,
      error: event.message,
      stages: updateStyleProfileStage(current.stages, event.phase, {
        state: "failed",
        error: event.message,
      }),
    };
  }
  if (event.type === "attempt") {
    const analyze = current.stages.find((stage) => stage.id === "analyze");
    return {
      ...current,
      message: event.message,
      stages: updateStyleProfileStage(current.stages, "analyze", {
        state: "active",
        activities: appendBounded(analyze?.activities ?? [], `${event.message}（第 ${event.attempt} 次）`, 20),
      }),
    };
  }
  const analyze = current.stages.find((stage) => stage.id === "analyze");
  if (event.event.type === "content") {
    return {
      ...current,
      stages: updateStyleProfileStage(current.stages, "analyze", {
        lines: appendStreamText(analyze?.lines ?? [], event.event.text),
      }),
    };
  }
  if (event.event.type === "activity") {
    return {
      ...current,
      stages: updateStyleProfileStage(current.stages, "analyze", {
        activities: appendBounded(analyze?.activities ?? [], event.event.message, 20),
      }),
    };
  }
  if (event.event.type === "error") {
    return {
      ...current,
      stages: updateStyleProfileStage(current.stages, "analyze", {
        activities: appendBounded(analyze?.activities ?? [], event.event.message, 20),
      }),
    };
  }
  return {
    ...current,
    stages: updateStyleProfileStage(current.stages, "analyze", {
      activities: appendBounded(analyze?.activities ?? [], "Agent run completed", 20),
    }),
  };
}

export interface DeckWorkspaceActions {
  setPanelMode: (mode: PanelMode) => void;
  setPrompt: (value: string) => void;
  setReviewOutlineFirst: (value: boolean) => Promise<void>;
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  setResearchSearchControlSettings: (settings: ResearchSearchControlSettings) => Promise<void>;
  setDeckTitle: (value: string) => void;
  setCurrentSlide: (index: number) => void;
  setOutlineFeedback: (value: string) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRefineScope: (scope: RefineScope) => void;
  showToast: (message: string) => void;
  cancelGenerateDeck: () => void;
  navigate: (page: PageId) => void;
  navigateMain: (stage: MainStage) => void;
  goBack: () => void;
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  addStyleRow: () => void;
  suggestContextFromPrompt: () => Promise<void>;
  generateDeck: () => Promise<void>;
  createDeckFromOutline: () => Promise<void>;
  applyOutlineFeedback: () => Promise<void>;
  beginOutlineEdit: () => void;
  cancelOutlineEdit: () => void;
  saveOutlineEdit: () => Promise<void>;
  updateOutlineDraftItem: (index: number, patch: Partial<WorkspaceOutlineItem>) => void;
  setOutlineDraftOutputLanguage: (value: string) => void;
  updateDeckTitle: (index: number, title: string) => void;
  moveSlide: (index: number, direction: -1 | 1) => Promise<void>;
  duplicateSlide: (index: number) => Promise<void>;
  deleteSlide: (index: number) => Promise<void>;
  addSlide: () => void;
  openLocalProject: (projectName: string) => void;
  openWorkspace: (workspaceDir: string) => Promise<void>;
  scanWorkspaces: () => Promise<void>;
  showWorkspacePicker: () => Promise<void>;
  useLatestWorkspace: () => Promise<void>;
  createWorkspace: () => Promise<void>;
  uploadUploadedSource: (file: File) => Promise<void>;
  removeUploadedSource: (uploadedSourceId: string) => Promise<void>;
  openStyleProfileCreation: () => void;
  setStyleProfileCreationName: (value: string) => void;
  setStyleProfileCreationFiles: (files: File[]) => void;
  startStyleProfileCreation: () => Promise<void>;
  retryStyleProfileAnalysis: () => Promise<void>;
  stopStyleProfileCreation: () => void;
  resetStyleProfileCreation: () => void;
  refreshStyleProfiles: () => Promise<void>;
  loadStyleProfilePreview: (styleProfileId: string) => Promise<void>;
  openStyleProfileDetail: (styleProfileId: string) => Promise<void>;
  closeStyleProfileDetail: () => void;
  selectStyleProfile: (styleProfileId: string) => Promise<void>;
  clearStyleProfile: () => Promise<void>;
  saveWorkspaceSettings: (setting: WorkspaceSettings) => Promise<void>;
  saveWorkspaceTitle: (title: string) => Promise<void>;
  selectTemplate: (groupId: string) => Promise<void>;
  openRefineDeck: () => Promise<void>;
  openRefineSlide: (index?: number) => Promise<void>;
  refineDeck: (instruction: string) => Promise<void>;
  refineSlide: (instruction: string) => Promise<void>;
  rewriteCurrentSlide: () => Promise<void>;
  changeCurrentSlideLayout: (mode: "simpler" | "visual" | "comparison" | "process" | "report") => Promise<void>;
  renderDeckHtml: () => Promise<void>;
  exportFile: (type: "PPTX" | "PDF") => Promise<void>;
  returnToOutlineFromGeneration: () => void;
  returnToBriefFromUploadedSourceAnalysis: () => void;
  regenerateDeck: () => Promise<void>;
  resumeDeckGeneration: () => Promise<void>;
  retryPageGeneration: (pageId: string) => Promise<void>;
  retryUploadedSourceAnalysis: () => Promise<void>;
}

export function useDeckWorkspace(t: Messages, locale: Locale) {
  const [panelMode, setPanelMode] = useState<PanelMode>("visible");
  const [page, setPage] = useState<PageId>("main");
  const [stage, setStage] = useState<MainStage>("brief");
  const [history, setHistory] = useState<PageId[]>(["main"]);
  const [toast, setToast] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reviewOutlineFirst, setReviewOutlineFirstState] = useState(false);
  const [pageReviewSettings, setPageReviewSettings] = useState<PageReviewSettings>(
    DEFAULT_PAGE_REVIEW_SETTINGS
  );
  const [researchSearchControlSettings, setResearchSearchControlSettingsState] =
    useState<ResearchSearchControlSettings>(DEFAULT_RESEARCH_SEARCH_CONTROL_SETTINGS);
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [deckTitle, setDeckTitle] = useState(t.deck.title);
  const [deck, setDeck] = useState<Slide[]>(initialDeck);
  const [outline, setOutline] = useState(outlineDetails);
  const [outlineDraft, setOutlineDraft] = useState(outlineDetails);
  const [outlineDraftTitle, setOutlineDraftTitle] = useState(t.deck.title);
  const [outlineOutputLanguage, setOutlineOutputLanguage] =
    useState<string>(AUTO_OUTPUT_LANGUAGE);
  const [outlineDraftOutputLanguage, setOutlineDraftOutputLanguage] =
    useState<string>(AUTO_OUTPUT_LANGUAGE);
  const [outlineEditMode, setOutlineEditMode] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("grid");
  const [reviewRender, setReviewRender] = useState<DeckReviewRenderState>({
    status: "idle",
    result: null,
    error: "",
    renderKey: ""
  });
  const [createDeckProgress, setCreateDeckProgress] =
    useState<DeckGenerationProgress | null>(null);
  const [uploadedSourceAnalysisProgress, setUploadedSourceAnalysisProgress] =
    useState<UploadedSourceAnalysisProgress>(() => createUploadedSourceAnalysisProgress(t));
  const [generationHistory, setGenerationHistory] = useState<GenerationStreamSnapshot[]>([]);
  const [pageProgress, setPageProgress] = useState<PageProgress | null>(null);
  const [refineScope, setRefineScope] = useState<RefineScope>("deck");
  const [loading, setLoading] = useState<LoadingKind>("none");
  const [activeGenerationRun, setActiveGenerationRun] =
    useState<ActiveGenerationRun | null>(null);
  const [generationUnresumable, setGenerationUnresumable] = useState(false);
  const [generationResumeAllowed, setGenerationResumeAllowed] = useState(true);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(
    () => createIdleExportProgress(t)
  );
  const [exportArtifact, setExportArtifact] = useState<ExportArtifact | null>(null);
  const exportRefreshVersionRef = useRef(0);
  const exportInFlightRef = useRef(false);
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [hostUploadClient, setHostUploadClient] = useState<AppHostUploadClient | null>(null);
  const [aiClient, setAiClient] = useState<AiClient | null>(null);
  const [agentClient, setAgentClient] = useState<AgentClient | null>(null);
  const cancelCreateDeckRef = useRef(false);
  const cancelCreateDeckAbortRef = useRef<AbortController | null>(null);
  const pendingUploadedSourceAnalysisActionRef = useRef<(() => Promise<void>) | null>(null);
  const forceUploadedSourceAnalysisRefreshRef = useRef(false);
  const outlineAutosaveTimerRef = useRef<number | null>(null);
  const [workspaceScan, setWorkspaceScan] = useState<ListWorkspacesResult | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceResult | null>(null);
  const [uploadedSources, setUploadedSources] = useState<UploadedSourceMaterial[]>([]);
  const [currentUploadedSourceAnalysis, setCurrentUploadedSourceAnalysis] =
    useState<UploadedSourceAnalysis | null>(null);
  const [uploadedSourceAnalysisError, setUploadedSourceAnalysisError] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSettingsSaving, setWorkspaceSettingsSaving] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<TemplateSummary[]>([]);
  const [selectedTemplateGroupId, setSelectedTemplateGroupId] = useState<string | null>(DEFAULT_TEMPLATE_GROUP_ID);
  const [styleProfiles, setStyleProfiles] = useState<StyleProfileIndexEntry[]>([]);
  const [styleProfilePreviews, setStyleProfilePreviews] =
    useState<Record<string, GetStyleProfilePreviewResult | undefined>>({});
  const [selectedStyleProfile, setSelectedStyleProfile] =
    useState<WorkspaceStyleProfileSelection | null>(null);
  const [styleProfileLibraryLoading, setStyleProfileLibraryLoading] = useState(false);
  const [styleProfileLibraryError, setStyleProfileLibraryError] = useState("");
  const [styleProfileCreation, setStyleProfileCreation] =
    useState<StyleProfileCreationViewState>(() => createIdleStyleProfileCreationState());
  const [styleProfileDetail, setStyleProfileDetail] = useState<StyleProfileDetailState>({
    status: "closed",
    styleProfileId: "",
    detail: null,
    error: "",
  });
  const styleProfileCreationAbortRef = useRef<AbortController | null>(null);
  const aiLogger = useMemo(() => backend ? createAiInteractionLogger(backend) : null, [backend]);

  function getDefaultWorkspaceTitle(date = new Date()) {
    return formatMessage(t.library.defaultWorkspaceTitle, {
      date: formatWorkspaceDate(date)
    });
  }

  function buildAiLogContext(
    workspace: WorkspaceResult,
    domain: "outline" | "page_plan" | "page_agent" | "theme",
    operation: string,
    extra: {
      page_id?: string;
      page_index?: number;
      kind?: string;
      operation_id?: string;
    } = {}
  ) {
    if (!aiLogger) return undefined;
    return {
      logger: aiLogger,
      workspace_dir: workspace.workspace_dir,
      domain,
      operation,
      provider: "anna",
      runtime_mode: "anna",
      ...extra,
    };
  }

  function workspaceOutlineToState(workspaceOutline: unknown) {
    const outlineRecord =
      workspaceOutline && typeof workspaceOutline === "object" && !Array.isArray(workspaceOutline)
        ? (workspaceOutline as Partial<WorkspaceOutline>)
        : null;
    const items = Array.isArray(outlineRecord?.items) ? outlineRecord.items : [];

    return items
      .filter(
        (item): item is WorkspaceOutlineItem =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as WorkspaceOutlineItem).title === "string"
      )
      .map((item) => ({
        title: item.title,
        outline: typeof item.outline === "string" ? item.outline : ""
      }));
  }

  function normalizeWorkspacePage(value: unknown): WorkspacePageItem | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Partial<WorkspacePageItem>;
    const pageId = typeof record.page_id === "string" ? record.page_id : "";
    const title = typeof record.title === "string" ? record.title : pageId;
    const layoutId = typeof record.layout_id === "string" ? record.layout_id : "";
    const htmlPath = typeof record.html_path === "string" ? record.html_path : "";
    const screenshotPath =
      typeof record.screenshot_path === "string" ? record.screenshot_path : "";
    const speakerNote =
      typeof record.speaker_note === "string" ? record.speaker_note : "";
    const index = typeof record.index === "number" ? record.index : 0;

    if (!pageId && !title && !layoutId && !htmlPath) {
      return null;
    }

    return {
      page_id: pageId,
      index,
      title,
      layout_id: layoutId,
      html_path: htmlPath,
      screenshot_path: screenshotPath,
      speaker_note: speakerNote
    };
  }

  function workspacePagesToState(workspacePages: unknown) {
    const pagesRecord =
      workspacePages && typeof workspacePages === "object" && !Array.isArray(workspacePages)
        ? (workspacePages as Partial<WorkspacePages>)
        : null;
    const pages = Array.isArray(pagesRecord?.pages)
      ? pagesRecord.pages
          .map(normalizeWorkspacePage)
          .filter((page): page is WorkspacePageItem => page !== null)
          .sort((left, right) => left.index - right.index)
      : [];

    if (pages.length === 0) return null;

    return {
      title: typeof pagesRecord?.title === "string" ? pagesRecord.title : "",
      deck: pages.map((page) => ({
        title: page.title,
        subtitle: ""
      })),
      outline: pages.map((page) => ({
        title: page.title,
        outline: page.speaker_note
      }))
    };
  }

  function workspaceOutlineOutputLanguage(workspace: WorkspaceResult | null) {
    const outlineRecord =
      workspace?.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
        ? (workspace.outline as { output_language?: unknown })
        : null;
    const outlineLanguage = normalizeOutputLanguage(outlineRecord?.output_language);
    if (outlineLanguage !== AUTO_OUTPUT_LANGUAGE) return outlineLanguage;

    return readSettingOutputLanguage(workspaceSettingsToState(workspace));
  }

  function withOutputLanguage(
    setting: WorkspaceSettings,
    outputLanguage: string
  ): WorkspaceSettings {
    return {
      ...setting,
      output_language: normalizeOutputLanguage(outputLanguage),
    };
  }

  async function persistWorkspaceOutputLanguage(
    workspace: WorkspaceResult,
    outputLanguage: string,
    settingOverride: WorkspaceSettings | null = null
  ) {
    if (!backend) return workspace;
    const result = await backend.updateWorkspaceSettings({
      workspace_dir: workspace.workspace_dir,
      setting: withOutputLanguage(
        settingOverride ?? workspaceSettingsToState(workspace),
        outputLanguage
      ),
    });
    return {
      ...workspace,
      setting: result.setting,
    };
  }

  async function resolveOutputLanguageForOutline(input: {
    workspace: WorkspaceResult;
    setting: WorkspaceSettings;
    title: string;
    items: OutlineDetail[];
  }) {
    const currentLanguage = normalizeOutputLanguage(input.setting.output_language);
    if (currentLanguage !== AUTO_OUTPUT_LANGUAGE || !aiClient) {
      return {
        workspace: input.workspace,
        setting: withOutputLanguage(input.setting, currentLanguage),
        outputLanguage: currentLanguage,
      };
    }

    const result = await aiClient.detectOutputLanguage({
      prompt,
      contextRows: buildLlmContextRows(),
      locale,
      setting: input.setting,
      title: input.title,
      outline: input.items,
      logContext: buildAiLogContext(input.workspace, "outline", "detect_output_language"),
    });
    const outputLanguage = normalizeOutputLanguage(result.output_language);
    const workspace = await persistWorkspaceOutputLanguage(
      input.workspace,
      outputLanguage,
      input.setting
    );

    return {
      workspace,
      setting: withOutputLanguage(input.setting, outputLanguage),
      outputLanguage,
    };
  }

  function normalizeWorkspacePageProgress(value: unknown): PageProgress | null {
    const progressRecord =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Partial<PageProgress>)
        : null;
    const pages = Array.isArray(progressRecord?.pages)
      ? progressRecord.pages.filter(
          (page): page is PageProgress["pages"][number] =>
            page !== null &&
            typeof page === "object" &&
            typeof (page as PageProgress["pages"][number]).page_id === "string"
        )
      : [];

    if (pages.length === 0) return null;

    return {
      version: 1,
      status: typeof progressRecord?.status === "string" ? progressRecord.status : "prepared",
      recovery: progressRecord?.recovery,
      final_deck_render: progressRecord?.final_deck_render,
      research_discovery: progressRecord?.research_discovery,
      pages,
      updated_at:
        typeof progressRecord?.updated_at === "string" ? progressRecord.updated_at : null
    };
  }

  async function reconcileWorkspaceInterruptedPages(workspace: WorkspaceResult): Promise<WorkspaceResult> {
    if (!backend) return workspace;
    const progress = normalizeWorkspacePageProgress(workspace.page_progress);
    if (!progress) return workspace;

    const reconciliation = reconcileInterruptedPageProgress(progress);
    if (reconciliation.patches.length === 0) return workspace;

    let persistedProgress = reconciliation.progress;
    for (const patch of reconciliation.patches) {
      persistedProgress = await backend.recordPageProgress({
        workspace_dir: workspace.workspace_dir,
        page_id: patch.pageId,
        patch: patch.patch,
      });
    }

    return {
      ...workspace,
      page_progress: persistedProgress,
    };
  }

  function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function uploadUploadedSourceFile(workspace: WorkspaceResult, file: File) {
    if (!backend || !hostUploadClient) {
      throw new Error("Host Upload is not available.");
    }
    const hostUpload = await hostUploadClient.uploadFile(file, {
      purpose: "user_artifact",
      filename: file.name,
      mimeType: file.type || undefined,
      metadata: {
        source: "ppt-app.uploaded-source",
        workspace_dir: workspace.workspace_dir,
      },
    });
    return backend.commitUploadedSourceHostUpload({
      workspace_dir: workspace.workspace_dir,
      filename: file.name,
      mime_type: hostUpload.mime_type,
      size_bytes: file.size,
      host_upload: hostUpload,
    });
  }

  async function refreshUploadedSources(workspace: WorkspaceResult | null = currentWorkspace) {
    if (!backend || !workspace) {
      setUploadedSources([]);
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisError("");
      setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
      return;
    }
    try {
      const result = await backend.listUploadedSources({
        workspace_dir: workspace.workspace_dir,
        include_removed: false,
      });
      setUploadedSources(result.active);
      await refreshUploadedSourceAnalysisSnapshot(workspace, result.index);
    } catch (error) {
      console.warn(
        "Failed to refresh uploaded sources",
        error instanceof Error ? error.message : error
      );
      setUploadedSources([]);
      setCurrentUploadedSourceAnalysis(null);
    }
  }

  async function refreshUploadedSourceAnalysisSnapshot(
    workspace: WorkspaceResult,
    uploadedSourceIndex: UploadedSourceIndex,
  ) {
    if (uploadedSourceIndex.materials.filter((item) => item.status === "active").length === 0) {
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisError("");
      setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
      return;
    }
    try {
      const analysis = await backend!.getUploadedSourceAnalysis({
        workspace_dir: workspace.workspace_dir,
      });
      const status = typeof analysis.status === "string" ? analysis.status : "";
      if (
        (status === "ready" || status === "gap" || status === "blocked") &&
        uploadedSourceAnalysisMatchesActiveSet({ analysis, uploadedSourceIndex })
      ) {
        const typedAnalysis = analysis as unknown as UploadedSourceAnalysis;
        setCurrentUploadedSourceAnalysis(typedAnalysis);
        setUploadedSourceAnalysisProgress(createCompletedUploadedSourceAnalysisProgress(
          t,
          uploadedSourceIndex.materials.filter((item) => item.status === "active").length,
          typedAnalysis,
        ));
        setUploadedSourceAnalysisError("");
        return;
      }
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisProgress(createUploadedSourceAnalysisProgress(t, {
        sourceCount: uploadedSourceIndex.materials.filter((item) => item.status === "active").length,
      }));
    } catch (error) {
      console.warn(
        "Failed to refresh uploaded source analysis",
        error instanceof Error ? error.message : error
      );
      setCurrentUploadedSourceAnalysis(null);
    }
  }

  function getPptxExportErrorMessage(job: PptxExportJob) {
    return job.error?.message || job.message || (locale === "zh" ? "PPTX 导出失败" : "PPTX export failed");
  }

  function assertPptxExportPath(value: string, name: string) {
    if (!value) {
      throw new Error(
        locale === "zh"
          ? `PPTX 导出状态缺少 ${name}`
          : `PPTX export status is missing ${name}`
      );
    }
  }

  async function waitForPptxExportStatus(
    workspaceDir: string,
    isDone: (job: PptxExportJob) => boolean
  ) {
    if (!backend) {
      throw new Error("PptBackend is not available.");
    }

    const startedAt = Date.now();

    while (Date.now() - startedAt < PPTX_EXPORT_POLL_TIMEOUT_MS) {
      const job = await backend.getPptxExportStatus({
        workspace_dir: workspaceDir
      });
      setExportProgress(createPptxJobExportProgress(t, job));

      if (isDone(job)) {
        return job;
      }

      await sleep(PPTX_EXPORT_POLL_INTERVAL_MS);
    }

    throw new Error(locale === "zh" ? "PPTX 导出等待超时" : "Timed out waiting for PPTX export");
  }

  function hasRenderedWorkspacePages(workspace: WorkspaceResult) {
    return !isWorkspaceDeckStale(workspace) && workspacePagesToState(workspace.pages) !== null;
  }

  function workspaceSettingsToState(workspace: WorkspaceResult | null): WorkspaceSettings {
    if (!workspace?.setting || typeof workspace.setting !== "object" || Array.isArray(workspace.setting)) {
      return {};
    }

    const setting = { ...(workspace.setting as WorkspaceSettings) };
    delete setting.audience;
    delete setting.goal;
    delete setting.style_notes;
    delete setting.slide_count;
    return setting;
  }

  function workspacePageReviewSettings(workspace: WorkspaceResult | null) {
    return readPageReviewSettings(workspaceSettingsToState(workspace));
  }

  function workspaceResearchSearchControlSettings(workspace: WorkspaceResult | null) {
    return readResearchSearchControlSettings(workspaceSettingsToState(workspace));
  }

  function applyWorkspaceSetting(setting: WorkspaceSettings) {
    setCurrentWorkspace((workspace) => workspace ? { ...workspace, setting } : workspace);
    setReviewOutlineFirstState(readOutlineReviewPreference(setting));
    setPageReviewSettings(readPageReviewSettings(setting));
    setResearchSearchControlSettingsState(readResearchSearchControlSettings(setting));
  }

  function normalizePersistedContextRow(value: unknown): ContextRow | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Partial<ContextRow>;
    if (typeof record.id !== "string" || !record.id) {
      return null;
    }

    const baseRow: ContextRow = {
      id: record.id,
      label: typeof record.label === "string" && record.label ? record.label : record.id,
      value: typeof record.value === "string" ? record.value : "",
      placeholder: typeof record.placeholder === "string" ? record.placeholder : undefined,
      type:
        record.type === "select" || record.type === "attachment" || record.type === "text"
          ? record.type
          : undefined,
      options: Array.isArray(record.options)
        ? record.options.filter((option): option is string => typeof option === "string")
        : undefined,
      allowCustomValue: record.allowCustomValue === true,
    };

    switch (baseRow.id) {
      case "audience":
        return {
          ...baseRow,
          label: t.brief.contextLabels.audience,
          placeholder: t.brief.contextPlaceholders.audience,
        };
      case "goal":
        return {
          ...baseRow,
          label: t.brief.contextLabels.goal,
          placeholder: t.brief.contextPlaceholders.goal,
        };
      case "style":
        return {
          ...baseRow,
          label: t.brief.contextLabels.styleNotes,
          placeholder: t.brief.contextPlaceholders.styleNotes,
        };
      case "content":
        return {
          ...baseRow,
          label: t.brief.contextLabels.contentSource,
          placeholder: t.brief.contextPlaceholders.contentSource,
        };
      case "attachment":
        return {
          ...baseRow,
          label: t.brief.contextLabels.attachment,
          type: "attachment",
        };
      case "slides":
      case "slide_count":
        return {
          ...baseRow,
          id: "slides",
          label: t.brief.contextLabels.slides,
          value: normalizeSlideCountContextValue(baseRow.value),
          type: "select",
          options: SLIDE_COUNT_CONTEXT_OPTIONS,
          allowCustomValue: true,
        };
      default:
        return baseRow;
    }
  }

  function workspaceContextRowsToState(workspace: WorkspaceResult): {
    rows: ContextRow[];
    shouldSync: boolean;
  } {
    const outlineRecord =
      workspace.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
        ? (workspace.outline as { items?: unknown; source?: { prompt?: unknown; context?: unknown; task_context?: unknown } })
        : null;
    const source = outlineRecord?.source;
    const rawContext = Array.isArray(source?.context) ? source.context : [];
    const rows = rawContext
      .map(normalizePersistedContextRow)
      .filter((row): row is ContextRow => row !== null);
    return {
      rows,
      shouldSync:
        rows.length > 0 ||
        (Array.isArray(outlineRecord?.items) && outlineRecord.items.length > 0) ||
        (typeof source?.prompt === "string" && source.prompt.length > 0),
    };
  }

  const workspaceReviewRenderKey = createWorkspaceReviewRenderKey;

  function setExportArtifactWithProgress(artifact: ExportArtifact | null) {
    setExportArtifact(artifact);
    setExportProgress(createArtifactExportProgress(t, artifact));
  }

  function buildLlmContextRows(
    rows: Array<{ id: string; value: string }> = contextRows
  ): LlmContextRow[] {
    return rows
      .map((row) => {
        const id = row.id.trim();
        const value =
          id === "slides" ? normalizeSlideCountContextValue(row.value) : row.value.trim();
        return id && value ? { id, value } : null;
      })
      .filter((row): row is LlmContextRow => row !== null);
  }

  function syncContextRowsToOutlineCount(
    rows: Array<ContextRow | LlmContextRow>,
    items: OutlineDetail[]
  ): ContextRow[] {
    return syncSlideCountContextRow(
      rows,
      items.length,
      t.brief.contextLabels.slides
    );
  }

  function buildOutlineArtifact(
    items = outline,
    title = deckTitle,
    outputLanguage = outlineOutputLanguage,
    status: "draft" | "confirmed" = "draft"
  ) {
    return {
      title,
      output_language: normalizeOutputLanguage(outputLanguage),
      status,
      items,
      source: {
        prompt,
        context: buildLlmContextRows(),
        setting: workspaceSettingsToState(currentWorkspace)
      }
    };
  }

  async function ensureUploadedSourceAnalysisForOutline(
    workspace: WorkspaceResult,
    pendingAction?: () => Promise<void>
  ): Promise<UploadedSourceAnalysis | null> {
    if (!backend) return null;
    if (pendingAction) {
      pendingUploadedSourceAnalysisActionRef.current = pendingAction;
    }
    const uploadedSourceList = await backend.listUploadedSources({
      workspace_dir: workspace.workspace_dir,
      include_removed: false,
    });
    setUploadedSources(uploadedSourceList.active);
    if (uploadedSourceList.active.length === 0) {
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisError("");
      setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
      pendingUploadedSourceAnalysisActionRef.current = null;
      forceUploadedSourceAnalysisRefreshRef.current = false;
      return null;
    }
    setPage("main");
    setStage("uploaded-source-analysis");
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
    setUploadedSourceAnalysisProgress(createUploadedSourceAnalysisProgress(t, {
      status: "running",
      sourceCount: uploadedSourceList.active.length,
      message: t.uploadedSourceAnalysis.messages.prepare,
    }));
    if (!agentClient) {
      const message = t.errors.uploadedSourceAnalysisUnavailable;
      setUploadedSourceAnalysisError(message);
      setUploadedSourceAnalysisProgress((current) =>
        failUploadedSourceAnalysisProgress(t, current, message)
      );
      throw new Error(message);
    }
    setLoading("uploadedSourceAnalysis");
    setUploadedSourceAnalysisError("");
    const forceRefresh = forceUploadedSourceAnalysisRefreshRef.current;
    forceUploadedSourceAnalysisRefreshRef.current = false;
    function recordUploadedSourceAnalysisProgress(event: UploadedSourceAnalysisWorkflowEvent) {
      setUploadedSourceAnalysisProgress((current) =>
        applyUploadedSourceAnalysisWorkflowEvent(t, current, event)
      );
    }
    try {
      const analysis = await ensureFreshUploadedSourceAnalysis({
        backend,
        agentClient,
        aiLogger,
        workspace,
        forceRefresh,
        onProgress: recordUploadedSourceAnalysisProgress,
      });
      if (!analysis) {
        setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
        pendingUploadedSourceAnalysisActionRef.current = null;
        return null;
      }
      setCurrentUploadedSourceAnalysis(analysis);
      if (analysis.status === "blocked" || !analysis.continuation_decision.can_continue) {
        const message = `${t.errors.uploadedSourceAnalysisBlocked}: ${analysis.continuation_decision.reason}`;
        setUploadedSourceAnalysisError(message);
        setUploadedSourceAnalysisProgress((current) => ({
          ...failUploadedSourceAnalysisProgress(t, current, message),
          status: "blocked",
          resultSummary: current.resultSummary,
        }));
        throw new Error(message);
      }
      pendingUploadedSourceAnalysisActionRef.current = null;
      return analysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadedSourceAnalysisError(message);
      setUploadedSourceAnalysisProgress((current) =>
        current.status === "blocked"
          ? current
          : failUploadedSourceAnalysisProgress(t, current, message)
      );
      throw error;
    }
  }

  function applyRenderedDeck(result: Awaited<ReturnType<PptBackend["renderDeckHtml"]>>) {
    setGenerated(true);
    setDeckTitle(result.title);
    setDeck(
      result.slides.map((slide) => ({
        title: slide.title,
        subtitle: ""
      }))
    );
    setOutline(
      result.slides.map((slide) => ({
        title: slide.title,
        outline: slide.speaker_note
      }))
    );
    setCurrentSlide(0);
    setStage("deck");
  }

  function applyWorkspace(
    workspace: WorkspaceResult,
    options: { syncEmptyContextRows?: boolean; preserveCurrentSlide?: boolean } = {}
  ) {
    setCurrentWorkspace(workspace);
    void refreshUploadedSources(workspace);
    if (backend) {
      void backend.getWorkspaceStyleProfile({ workspace_dir: workspace.workspace_dir })
        .then((result) => setSelectedStyleProfile(result.selection))
        .catch(() => setSelectedStyleProfile(null));
    }
    setPageReviewSettings(workspacePageReviewSettings(workspace));
    setResearchSearchControlSettingsState(workspaceResearchSearchControlSettings(workspace));
    setReviewOutlineFirstState(readOutlineReviewPreference(workspaceSettingsToState(workspace)));
    if (!exportInFlightRef.current) {
      setExportArtifactWithProgress(readWorkspaceExportArtifactPath(workspace));
      void refreshWorkspaceExportArtifact(workspace, exportRefreshVersionRef.current);
    }
    const renderKey = workspaceReviewRenderKey(workspace);
    setReviewRender((current) =>
      current.renderKey === renderKey
        ? current
        : {
            status: "idle",
            result: null,
            error: "",
            renderKey
          }
    );
    setDeckTitle(getWorkspaceTitle(workspace));
    const workspaceOutputLanguage = workspaceOutlineOutputLanguage(workspace);
    setOutlineOutputLanguage(workspaceOutputLanguage);
    setOutlineDraftOutputLanguage(workspaceOutputLanguage);
    const workspaceOutline = workspaceOutlineToState(workspace.outline);
    const staleDeck = isWorkspaceDeckStale(workspace);
    const workspacePages = staleDeck ? null : workspacePagesToState(workspace.pages);
    const workspacePageProgress = normalizeWorkspacePageProgress(workspace.page_progress);
    setPageProgress(workspacePageProgress);
    setCreateDeckProgress(
      restoreDeckGenerationProgress({
        staleDeck,
        pageProgress: workspacePageProgress,
        locale,
      })
    );
    if (workspacePages) {
      setGenerated(true);
      setDeckTitle(getWorkspaceTitle(workspace));
      setDeck(workspacePages.deck);
      setOutline(workspaceOutline.length > 0 ? workspaceOutline : workspacePages.outline);
      setOutlineDraft(workspaceOutline.length > 0 ? workspaceOutline : workspacePages.outline);
      setCurrentSlide((index) =>
        options.preserveCurrentSlide ? clampSlideIndex(index, workspacePages.deck.length) : 0
      );
      setStage("deck");
    } else {
      setGenerated(false);
      setCurrentSlide(0);
      if (staleDeck) {
        setStage("outline");
      }
    }
    if (workspaceOutline.length > 0) {
      setOutline(workspaceOutline);
      setOutlineDraft(workspaceOutline);
      if (!workspacePages && workspacePageProgress && !staleDeck) {
        setStage("generating");
      } else if (!workspacePages) {
        setStage("outline");
      }
    }
    const templateRecord =
      workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
        ? (workspace.template as { selected_template_group?: unknown })
        : null;
    const selectedTemplate =
      typeof templateRecord?.selected_template_group === "string" && templateRecord.selected_template_group
        ? templateRecord.selected_template_group
        : DEFAULT_TEMPLATE_GROUP_ID;
    if (selectedTemplate) {
      setSelectedTemplateGroupId(selectedTemplate);
      if (!workspacePages && workspaceOutline.length === 0) {
        setStage("brief");
      }
    }

    const persistedContextRows = workspaceContextRowsToState(workspace);
    if (persistedContextRows.shouldSync || options.syncEmptyContextRows) {
      setContextRows(persistedContextRows.rows);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let nextAgentClient: AgentClient | null = null;

    async function initializeClients() {
      try {
        const [nextBackend, nextAiClient, runtime] = await Promise.all([
          createPptBackend(),
          createAiClient(),
          connectAnnaRuntime()
        ]);
        nextAgentClient = await createAgentClient(runtime, {
          toolAccessPolicy: AGENT_TOOL_ACCESS_POLICY,
        });
        const nextHostUploadClient = createAppHostUploadClient(runtime);
        if (cancelled) return;
        setBackend(nextBackend);
        setHostUploadClient(nextHostUploadClient);
        setAiClient(nextAiClient);
        setAgentClient(nextAgentClient);
        const scan = await nextBackend.listWorkspaces();
        if (cancelled) return;
        setWorkspaceScan(scan);
        const defaults = await nextBackend.getWorkspaceDefaults();
        if (cancelled) return;
        setPageReviewSettings(readPageReviewSettings(defaults.setting));
        setResearchSearchControlSettingsState(readResearchSearchControlSettings(defaults.setting));
        setReviewOutlineFirstState(readOutlineReviewPreference(defaults.setting));
        const templates = await nextBackend.listTemplates();
        if (cancelled) return;
        setTemplateGroups(templates.templates);
        const profileList = await nextBackend.listStyleProfiles();
        if (cancelled) return;
        setStyleProfiles(profileList.profiles);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error ? error.message : "Failed to scan tasks."
          );
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    }

    void initializeClients();

    return () => {
      cancelled = true;
      if (outlineAutosaveTimerRef.current !== null) {
        window.clearTimeout(outlineAutosaveTimerRef.current);
      }
      void nextAgentClient?.close();
    };
  }, []);

  function recordGenerationProgress(progress: DeckGenerationProgress) {
    setCreateDeckProgress(progress);
    const snapshot: GenerationStreamSnapshot =
      createDeckGenerationStreamSnapshot(progress, locale);
    setGenerationHistory((items) => {
      const existingIndex = items.findIndex((item) => item.id === snapshot.id);
      if (existingIndex === -1) return [...items, snapshot];
      return items.map((item, index) => (index === existingIndex ? snapshot : item));
    });
  }

  function resetGenerationProgress() {
    setCreateDeckProgress(null);
    setGenerationHistory([]);
    resetGenerationUiState();
  }

  function resetGenerationUiState() {
    setGenerationUnresumable(false);
    setGenerationResumeAllowed(true);
  }

  function beginCancellableGeneration() {
    cancelCreateDeckRef.current = false;
    cancelCreateDeckAbortRef.current?.abort();
    const controller = new AbortController();
    cancelCreateDeckAbortRef.current = controller;
    return controller.signal;
  }

  function beginActiveGenerationRun(kind: ActiveGenerationRunKind) {
    setGenerationUnresumable(false);
    setGenerationResumeAllowed(kind === "deck-generation");
    setActiveGenerationRun({ kind, stopping: false });
  }

  async function finishActiveGenerationRun(options: {
    workspaceDir?: string;
    reconcileInterrupted?: boolean;
  } = {}) {
    setActiveGenerationRun(null);
    if (!options.reconcileInterrupted || !backend) return;
    const workspaceDir = options.workspaceDir ?? currentWorkspace?.workspace_dir;
    if (!workspaceDir) return;
    try {
      const refreshedWorkspace = await backend.openWorkspace({
        workspace_dir: workspaceDir,
      });
      const reconciledWorkspace = await reconcileWorkspaceInterruptedPages(refreshedWorkspace);
      applyWorkspace(reconciledWorkspace);
    } catch (error) {
      console.warn(
        "Failed to reconcile interrupted pages after generation finished",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const generationViewState = useMemo(
    () =>
      buildGenerationViewState({
        loading,
        progress: createDeckProgress,
        activeRun: activeGenerationRun,
        unresumable: generationUnresumable,
        resumeAllowed: generationResumeAllowed,
      }),
    [activeGenerationRun, createDeckProgress, generationResumeAllowed, generationUnresumable, loading],
  );

  const currentStatus = useMemo(() => {
    if (loading === "template") return t.template.loading;
    if (loading === "theme") {
      return locale === "zh" ? "正在定制主题" : "Customizing theme";
    }
    if (loading === "uploadedSourceAnalysis") return t.status.analyzingUploadedSource;
    if (loading === "outline") return t.status.creatingOutline;
    if (generationViewState.status === "running") {
      return t.status.creatingDeck;
    }
    if (generationViewState.status === "stopping") return t.generating.cancelling;
    if (stage === "generating" && generationViewState.status === "interrupted") {
      return t.generating.interruptedTitle;
    }
    if (stage === "generating" && generationViewState.status === "unresumable") {
      return t.generating.unresumableTitle;
    }
    if (loading === "review") return t.review.rendering;
    if (loading === "refineDeck") return t.status.refiningDeck;
    if (loading === "refineSlide") return t.status.refiningSlide;
    if (loading === "export") return t.status.exporting;
    if (stage === "uploaded-source-analysis") return uploadedSourceAnalysisProgress.message;
    if (stage === "generating") return createDeckProgress?.message ?? t.status.creatingDeck;
    if (stage === "outline") return t.status.outlineReady;
    if (generated) return deckReadyStatus(t, deck.length);
    return "";
  }, [createDeckProgress?.message, deck.length, generated, generationViewState.status, loading, locale, stage, t, uploadedSourceAnalysisProgress.message]);

  const uploadedSourceAnalysisState = useMemo<UploadedSourceAnalysisViewState>(() => {
    if (uploadedSources.length === 0) {
      return createEmptyUploadedSourceAnalysisViewState();
    }
    if (loading === "uploadedSourceAnalysis") {
      return {
        status: "analyzing",
        sourceCount: uploadedSources.length,
        factCount: null,
        visualAssetCount: null,
        gapCount: null,
      };
    }
    if (uploadedSourceAnalysisError) {
      return {
        status: "error",
        sourceCount: uploadedSources.length,
        factCount: null,
        visualAssetCount: null,
        gapCount: null,
        reason: uploadedSourceAnalysisError,
      };
    }

    if (currentUploadedSourceAnalysis) {
      const currentDependency = createUploadedSourceAnalysisDependency(currentUploadedSourceAnalysis);
      if (uploadedSourceDependencyMatchesActiveSources({
        dependency: currentDependency,
        uploadedSources,
      })) {
        const blocked =
          currentUploadedSourceAnalysis.status === "blocked" ||
          !currentUploadedSourceAnalysis.continuation_decision.can_continue;
        return {
          status: blocked ? "blocked" : currentUploadedSourceAnalysis.status,
          sourceCount: uploadedSources.length,
          factCount: currentUploadedSourceAnalysis.facts.length,
          visualAssetCount: currentUploadedSourceAnalysis.visual_assets.length,
          gapCount: currentUploadedSourceAnalysis.gaps.length,
          reason: blocked ? currentUploadedSourceAnalysis.continuation_decision.reason : undefined,
        };
      }
      return {
        status: "stale",
        sourceCount: uploadedSources.length,
        factCount: null,
        visualAssetCount: null,
        gapCount: null,
      };
    }

    const outlineDependency = readWorkspaceUploadedSourceDependency(currentWorkspace);
    if (outlineDependency) {
      return {
        status: uploadedSourceDependencyMatchesActiveSources({
          dependency: outlineDependency,
          uploadedSources,
        }) ? outlineDependency.status : "stale",
        sourceCount: uploadedSources.length,
        factCount: null,
        visualAssetCount: null,
        gapCount: null,
      };
    }

    return {
      status: "pending",
      sourceCount: uploadedSources.length,
      factCount: null,
      visualAssetCount: null,
      gapCount: null,
    };
  }, [
    currentUploadedSourceAnalysis,
    currentWorkspace,
    loading,
    uploadedSourceAnalysisError,
    uploadedSources,
  ]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function navigate(nextPage: PageId) {
    if (!generated && nextPage !== "main" && nextPage !== "library") {
      showToast(t.toasts.createDeckFirst);
      return;
    }

    setPage(nextPage);
    setHistory((items) =>
      items.at(-1) === nextPage ? items : [...items, nextPage]
    );
    if (nextPage === "review") {
      const renderKey = currentWorkspace ? workspaceReviewRenderKey(currentWorkspace) : "";
      const hasCurrentRender =
        reviewRender.status === "ready" &&
        reviewRender.result !== null &&
        reviewRender.renderKey === renderKey;
      if (!hasCurrentRender && currentWorkspace) {
        void loadDeckHtmlForWorkspace(currentWorkspace, "review");
      }
    }
    if (nextPage === "export" && currentWorkspace) {
      void refreshWorkspaceExportArtifact(currentWorkspace, exportRefreshVersionRef.current);
    }
  }

  async function openRefineDeck() {
    if (!generated) {
      showToast(t.toasts.createDeckFirst);
      return;
    }

    setRefineScope("deck");
    setPage("refine");
    setHistory((items) =>
      items.at(-1) === "refine" ? items : [...items, "refine"]
    );

    if (!currentWorkspace) return;
    const renderKey = workspaceReviewRenderKey(currentWorkspace);
    const hasCurrentRender =
      reviewRender.status === "ready" &&
      reviewRender.result !== null &&
      reviewRender.renderKey === renderKey;
    if (hasCurrentRender) return;
    await loadDeckHtmlForWorkspace(currentWorkspace, "review");
  }

  async function openRefineSlide(index = currentSlide) {
    if (!generated) {
      showToast(t.toasts.createDeckFirst);
      return;
    }

    setCurrentSlide(index);
    setRefineScope("slide");
    setPage("refine");
    setHistory((items) =>
      items.at(-1) === "refine" ? items : [...items, "refine"]
    );

    if (!currentWorkspace) return;

    const renderKey = workspaceReviewRenderKey(currentWorkspace);
    const hasCurrentSlidePreview =
      reviewRender.status === "ready" &&
      reviewRender.result !== null &&
      reviewRender.renderKey === renderKey &&
      Boolean(reviewRender.result.slides[index]?.screenshot_upload);
    if (hasCurrentSlidePreview) return;

    const rendered = await loadDeckHtmlForWorkspace(currentWorkspace, "review");
    if (rendered) {
      setCurrentSlide(index);
    }
  }

  function navigateMain(nextStage: MainStage) {
    if (nextStage === "uploaded-source-analysis" && uploadedSources.length === 0) {
      setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
    }
    if (nextStage === "outline" && outline.length === 0) {
      showToast(t.toasts.createOutlineFirst);
      return;
    }
    if (nextStage === "generating" && !createDeckProgress) {
      showToast(t.toasts.createDeckFirst);
      return;
    }
    if (nextStage === "deck" && !generated) {
      showToast(t.toasts.createDeckFirst);
      return;
    }
    setPage("main");
    setStage(nextStage);
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
  }

  function goBack() {
    setHistory((items) => {
      const next = items.slice(0, -1);
      const previous = next.at(-1) ?? "main";
      setPage(previous);
      return next.length > 0 ? next : ["main"];
    });
  }

  function addContextRow(row: ContextRow) {
    setContextRows((rows) => {
      if (rows.some((item) => item.id === row.id)) return rows;
      return [...rows, row];
    });
  }

  function updateContextRow(id: string, value: string) {
    setContextRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, value } : row))
    );
  }

  function removeContextRow(id: string) {
    setContextRows((rows) => rows.filter((row) => row.id !== id));
  }

  function addStyleRow() {
    addContextRow({
      id: "style",
      label: t.brief.contextLabels.styleNotes,
      value: "",
      placeholder: t.brief.contextPlaceholders.styleNotes
    });
  }

  function buildContextRowFromPatch(id: ContextPatchId, value: string): ContextRow {
    return buildContextRowFromPatchBase(id, value, t);
  }

  function upsertSuggestedContextRows(rows: ContextRow[]) {
    if (rows.length === 0) return;
    setContextRows((currentRows) => mergeSuggestedContextRows(currentRows, rows));
  }

  async function suggestContextFromPrompt() {
    if (!aiClient) return;
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      showToast(t.toasts.promptRequired);
      return;
    }

    setLoading("context");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const result = await aiClient.suggestContext({
        prompt: trimmedPrompt,
        locale,
        logContext: buildAiLogContext(workspace, "outline", "suggest_context"),
      });
      const rows = buildContextRowsFromSuggestion(result, t);

      if (rows.length === 0) {
        showToast(t.toasts.contextSuggestionEmpty);
        return;
      }

      upsertSuggestedContextRows(rows);
      showToast(t.toasts.contextSuggested);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.contextSuggestionEmpty);
    } finally {
      setLoading("none");
    }
  }

  async function suggestContextRowsForGeneration(
    workspace: WorkspaceResult,
    currentRows: ContextRow[]
  ): Promise<ContextRow[]> {
    if (!aiClient || !shouldSuggestContextBeforeGeneration(currentRows)) {
      return currentRows;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error(t.toasts.promptRequired);
    }

    setLoading("context");
    const result = await aiClient.suggestContext({
      prompt: trimmedPrompt,
      locale,
      logContext: buildAiLogContext(workspace, "outline", "suggest_context"),
    });
    const suggestedRows = buildContextRowsFromSuggestion(result, t);
    if (suggestedRows.length === 0) {
      return currentRows;
    }

    const nextRows = mergeSuggestedContextRows(currentRows, suggestedRows);
    setContextRows(nextRows);
    return nextRows;
  }

  function readFeedbackContextValue(feedback: string, labels: string[]): string | null {
    const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(
      `(?:${escapedLabels.join("|")})\\s*(?:改成|调整为|设为|设置为|是|为|:|：|to|as)?\\s*([^。；;，,\\n]+)`,
      "i",
    );
    const match = pattern.exec(feedback);
    const value = match?.[1]?.trim().replace(/[，,]$/, "");
    return value && value.length > 0 ? value : null;
  }

  function deriveContextRowsFromOutlineFeedback(rows: ContextRow[], feedback: string): ContextRow[] {
    const patch: Partial<Record<ContextPatchId, string>> = {};

    const audience = readFeedbackContextValue(feedback, ["受众", "面向对象", "面向", "audience"]);
    if (audience) patch.audience = audience;

    const goal = readFeedbackContextValue(feedback, ["目标", "目的", "goal"]);
    if (goal) patch.goal = goal;

    const style = readFeedbackContextValue(feedback, ["风格", "视觉风格", "语气", "style", "tone"]);
    if (style) patch.style = style;

    const content = readFeedbackContextValue(feedback, ["内容来源", "参考材料", "材料", "content source", "source"]);
    if (content) patch.content = content;

    const patchEntries = Object.entries(patch) as Array<[ContextPatchId, string]>;
    if (patchEntries.length === 0) return rows;

    const patchedIds = new Set(patchEntries.map(([id]) => id));
    const nextRows = rows.map((row) =>
      patchedIds.has(row.id as ContextPatchId)
        ? buildContextRowFromPatch(row.id as ContextPatchId, patch[row.id as ContextPatchId] ?? row.value)
        : row
    );

    for (const [id, value] of patchEntries) {
      if (!nextRows.some((row) => row.id === id)) {
        nextRows.push(buildContextRowFromPatch(id, value));
      }
    }

    return nextRows;
  }

  function isUnresumableDeckGenerationError(error: DeckGenerationError) {
    return error.type === "stale_artifacts" || error.type === "invalid_confirmed_outline";
  }

  async function applyDeckGenerationCompletion(
    completion: DeckGenerationCompletion,
    workspace: WorkspaceResult,
    options: { resumeAllowedOnRecoverableStop?: boolean } = {},
  ) {
    const resumeAllowedOnRecoverableStop =
      options.resumeAllowedOnRecoverableStop !== false;

    if (completion.status === "cancelled") {
      setGenerationResumeAllowed(resumeAllowedOnRecoverableStop);
      const latestWorkspace = backend
        ? await backend.openWorkspace({ workspace_dir: workspace.workspace_dir })
        : workspace;
      const reconciledWorkspace = await reconcileWorkspaceInterruptedPages(latestWorkspace);
      applyWorkspace(reconciledWorkspace);
      setStage("generating");
      setPage("main");
      return;
    }

    if (completion.status === "failed") {
      if (completion.progress) {
        setCreateDeckProgress(completion.progress);
      }
      setGenerationUnresumable(isUnresumableDeckGenerationError(completion.error));
      setGenerationResumeAllowed(
        resumeAllowedOnRecoverableStop &&
          !isUnresumableDeckGenerationError(completion.error)
      );
      setStage("generating");
      setPage("main");
      showToast(completion.error.message);
      return;
    }

    setGenerationUnresumable(false);
    setGenerationResumeAllowed(false);
    const refreshedWorkspace = backend
      ? await backend.openWorkspace({ workspace_dir: workspace.workspace_dir })
      : workspace;
    applyWorkspace(refreshedWorkspace);
    setDeckTitle(completion.result.outline.title);
    setOutline(completion.result.outline.items);
    setPageProgress(completion.result.progress);
    applyRenderedDeck(completion.result.rendered);
    setReviewRender({
      status: "ready",
      result: completion.result.rendered,
      error: "",
      renderKey: workspaceReviewRenderKey(refreshedWorkspace),
    });
    setPage("main");
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
  }

  async function generateDeck() {
    if (!backend || !aiClient) return;
    if (!agentClient) {
      if (uploadedSources.length > 0) {
        showToast(t.errors.uploadedSourceAnalysisUnavailable);
      }
      return;
    }

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    try {
      const cancelSignal = beginCancellableGeneration();
      setLoading(shouldSuggestContextBeforeGeneration(contextRows) ? "context" : "outline");
      resetGenerationProgress();
      const workspace = await refreshCurrentWorkspaceSnapshot();
      if (!workspace) return;
      if (!selectedTemplateGroupId) {
        showToast(t.template.helper);
        return;
      }
      const templateWorkspace = await ensureWorkspaceTemplate(workspace);
      const generationContextRows = await suggestContextRowsForGeneration(
        templateWorkspace,
        contextRows
      );
      const themedWorkspace = await ensureWorkspaceThemeTokenForGeneration(
        templateWorkspace,
        generationContextRows
      );
      const uploadedSourceAnalysis = await ensureUploadedSourceAnalysisForOutline(
        themedWorkspace,
        generateDeck,
      );
      const uploadedSourceAnalysisContext = compactUploadedSourceAnalysisForPrompt(uploadedSourceAnalysis);

      const setting = workspaceSettingsToState(themedWorkspace);

      if (reviewOutlineFirst) {
        setLoading("outline");
        const llmContextRows = buildLlmContextRows(generationContextRows);
        const outlineLogContext = buildAiLogContext(themedWorkspace, "outline", "generate_outline");
        const result = await aiClient.generateOutline({
          prompt,
          contextRows: llmContextRows,
          locale,
          setting,
          uploadedSourceAnalysisContext,
          logContext: outlineLogContext,
        });
        await appendOutlineAiAttemptLogs(themedWorkspace, result.attempts, outlineLogContext);
        const syncedContextRows = syncContextRowsToOutlineCount(
          generationContextRows,
          result.outline.items
        );
        const outputLanguage = normalizeOutputLanguage(result.outline.output_language);
        const languageWorkspace = await persistWorkspaceOutputLanguage(
          themedWorkspace,
          outputLanguage,
          setting
        );
        const languageSetting = withOutputLanguage(setting, outputLanguage);
        setContextRows(syncedContextRows);
        setDeckTitle(result.outline.title);
        setOutline(result.outline.items);
        setOutlineOutputLanguage(outputLanguage);
        const updatedWorkspace = await saveOutlineArtifact(
          result.outline.items,
          result.outline.title,
          outputLanguage,
          languageWorkspace,
          languageSetting,
          "draft",
          true,
          syncedContextRows,
          uploadedSourceAnalysis
        );
        if (updatedWorkspace) {
          applyWorkspace(updatedWorkspace);
        }
        showToast(t.status.outlineReady);
        return;
      }

      setLoading("outline");
      const llmContextRows = buildLlmContextRows(generationContextRows);
      const outlineLogContext = buildAiLogContext(themedWorkspace, "outline", "generate_outline");
      const outlineResult = await aiClient.generateOutline({
        prompt,
        contextRows: llmContextRows,
        locale,
        setting,
        uploadedSourceAnalysisContext,
        logContext: outlineLogContext,
      });
      await appendOutlineAiAttemptLogs(themedWorkspace, outlineResult.attempts, outlineLogContext);
      const syncedContextRows = syncContextRowsToOutlineCount(
        generationContextRows,
        outlineResult.outline.items
      );
      const outputLanguage = normalizeOutputLanguage(outlineResult.outline.output_language);
      const languageWorkspace = await persistWorkspaceOutputLanguage(
        themedWorkspace,
        outputLanguage,
        setting
      );
      const languageSetting = withOutputLanguage(setting, outputLanguage);
      setContextRows(syncedContextRows);
      const confirmedWorkspace = await saveOutlineArtifact(
        outlineResult.outline.items,
        outlineResult.outline.title,
        outputLanguage,
        languageWorkspace,
        languageSetting,
        "confirmed",
        true,
        syncedContextRows,
        uploadedSourceAnalysis
      );
      if (!confirmedWorkspace) return;
      if (cancelCreateDeckRef.current) {
        setCreateDeckProgress({
          step: "cancelled",
          message: t.generating.cancelled,
          currentPageIndex: null,
          totalPages: outlineResult.outline.items.length,
          pages: [],
        });
        return;
      }

      setDeckTitle(outlineResult.outline.title);
      setOutline(outlineResult.outline.items);
      setOutlineOutputLanguage(outputLanguage);
      beginActiveGenerationRun("deck-generation");
      activeRunWorkspaceDir = confirmedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setLoading("deck");
      setStage("generating");
      setPage("main");
      const completion = await runDeckGeneration({
        backend,
        aiClient,
        agentClient,
        aiLogger,
        workspace: confirmedWorkspace,
        confirmedOutline: confirmedWorkspace.outline as WorkspaceOutline,
        locale,
        startMode: "restart",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      await applyDeckGenerationCompletion(completion, confirmedWorkspace);
      shouldReconcileActiveRun = false;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  function cancelGenerateDeck() {
    cancelCreateDeckRef.current = true;
    cancelCreateDeckAbortRef.current?.abort();
    setActiveGenerationRun((current) =>
      current ? { ...current, stopping: true } : current
    );
    setCreateDeckProgress((current) =>
      current
        ? {
            ...current,
            step: "cancelled",
            message: t.generating.cancelling,
          }
        : current
    );
  }

  async function createDeckFromOutline() {
    if (!backend || !aiClient) return;
    if (!agentClient) {
      if (uploadedSources.length > 0) {
        showToast(t.errors.uploadedSourceAnalysisUnavailable);
      }
      return;
    }

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    resetGenerationProgress();
    try {
      const cancelSignal = beginCancellableGeneration();
      const workspace = await refreshCurrentWorkspaceSnapshot();
      if (!workspace) return;
      if (!selectedTemplateGroupId) {
        showToast(t.template.helper);
        return;
      }
      const templateWorkspace = await ensureWorkspaceThemeTokenForGeneration(
        await ensureWorkspaceTemplate(workspace)
      );
      setLoading("outline");
      const setting = workspaceSettingsToState(templateWorkspace);
      const uploadedSourceAnalysis = await ensureUploadedSourceAnalysisForOutline(
        templateWorkspace,
        createDeckFromOutline,
      );
      setLoading("outline");
      const resolved = await resolveOutputLanguageForOutline({
        workspace: templateWorkspace,
        setting,
        title: deckTitle,
        items: outline,
      });
      const confirmedWorkspace = await saveOutlineArtifact(
        outline,
        deckTitle,
        resolved.outputLanguage,
        resolved.workspace,
        resolved.setting,
        "confirmed",
        true,
        null,
        uploadedSourceAnalysis
      );
      if (!confirmedWorkspace) return;
      beginActiveGenerationRun("deck-generation");
      activeRunWorkspaceDir = confirmedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setOutlineOutputLanguage(resolved.outputLanguage);
      setLoading("deck");
      setStage("generating");
      setPage("main");

      const completion = await runDeckGeneration({
        backend,
        aiClient,
        agentClient,
        aiLogger,
        workspace: confirmedWorkspace,
        confirmedOutline: confirmedWorkspace.outline as WorkspaceOutline,
        locale,
        startMode: "restart",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      await applyDeckGenerationCompletion(completion, confirmedWorkspace);
      shouldReconcileActiveRun = false;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  async function applyOutlineFeedback() {
    if (!aiClient) return;
    if (!outlineFeedback.trim()) return;
    setLoading("outline");
    let workspace: WorkspaceResult | null = null;
    try {
      workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      let setting = workspaceSettingsToState(workspace);
      const baseTitle = outlineEditMode ? outlineDraftTitle : deckTitle;
      const baseOutline = outlineEditMode ? outlineDraft : outline;
      const nextContextRows = deriveContextRowsFromOutlineFeedback(contextRows, outlineFeedback);
      setContextRows(nextContextRows);
      const llmContextRows = buildLlmContextRows(nextContextRows);
      const uploadedSourceAnalysis = backend
        ? await ensureUploadedSourceAnalysisForOutline(workspace, applyOutlineFeedback)
        : null;
      setLoading("outline");
      const uploadedSourceAnalysisContext = compactUploadedSourceAnalysisForPrompt(uploadedSourceAnalysis);
      const outlineLogContext = buildAiLogContext(workspace, "outline", "revise_outline");
      const result = await aiClient.reviseOutline({
        title: baseTitle,
        outline: baseOutline,
        feedback: outlineFeedback,
        locale,
        setting,
        contextRows: llmContextRows,
        uploadedSourceAnalysisContext,
        logContext: outlineLogContext,
      });
      await appendOutlineAiAttemptLogs(workspace, result.attempts, outlineLogContext);
      const syncedContextRows = syncContextRowsToOutlineCount(
        nextContextRows,
        result.outline.items
      );
      const outputLanguage = normalizeOutputLanguage(result.outline.output_language);
      workspace = await persistWorkspaceOutputLanguage(workspace, outputLanguage, setting);
      setting = withOutputLanguage(setting, outputLanguage);
      setContextRows(syncedContextRows);
      await saveOutlineArtifact(
        result.outline.items,
        result.outline.title,
        outputLanguage,
        workspace,
        setting,
        "draft",
        false,
        syncedContextRows,
        uploadedSourceAnalysis
      );
      if (backend) {
        setWorkspaceScan(await backend.listWorkspaces());
      }
      setOutlineDraftTitle(result.outline.title);
      setOutlineDraft(result.outline.items);
      setOutlineDraftOutputLanguage(outputLanguage);
      setOutlineEditMode(true);
      setOutlineFeedback("");
      showToast(t.toasts.outlineUpdated);
    } catch (error) {
      await appendOutlineErrorLog(workspace, "reviseOutline", error);
      showToast(error instanceof Error ? error.message : t.toasts.createOutlineFirst);
    } finally {
      setLoading("none");
    }
  }

  function beginOutlineEdit() {
    if (loading === "deck" || loading === "deckFromOutline") {
      showToast(t.status.creatingDeck);
      return;
    }
    setOutlineDraft(outline.map((item) => ({ ...item })));
    setOutlineDraftTitle(deckTitle);
    setOutlineDraftOutputLanguage(outlineOutputLanguage);
    setOutlineEditMode(true);
  }

  function cancelOutlineEdit() {
    setOutlineDraft(outline.map((item) => ({ ...item })));
    setOutlineDraftTitle(deckTitle);
    setOutlineDraftOutputLanguage(outlineOutputLanguage);
    setOutlineFeedback("");
    setOutlineEditMode(false);
  }

  async function saveOutlineEdit() {
    if (!outlineEditMode) return;
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const setting = workspaceSettingsToState(workspace);
      const outputLanguage = normalizeOutputLanguage(outlineDraftOutputLanguage);
      const languageWorkspace = await persistWorkspaceOutputLanguage(
        workspace,
        outputLanguage,
        setting
      );
      const languageSetting = withOutputLanguage(setting, outputLanguage);
      const uploadedSourceAnalysis = await ensureUploadedSourceAnalysisForOutline(
        languageWorkspace,
        saveOutlineEdit,
      );
      setLoading("outline");
      const downstreamExists = hasDownstreamArtifacts(workspace);
      const syncedContextRows = syncContextRowsToOutlineCount(contextRows, outlineDraft);
      setContextRows(syncedContextRows);
      const updatedWorkspace = await saveOutlineArtifact(
        outlineDraft,
        outlineDraftTitle,
        outputLanguage,
        languageWorkspace,
        languageSetting,
        "draft",
        true,
        syncedContextRows,
        uploadedSourceAnalysis
      );
      if (updatedWorkspace) {
        setDeckTitle(outlineDraftTitle);
        setOutline(outlineDraft);
        setOutlineOutputLanguage(outputLanguage);
        setOutlineEditMode(false);
        if (downstreamExists) {
          setGenerated(false);
          setReviewRender({
            status: "idle",
            result: null,
            error: "",
            renderKey: workspaceReviewRenderKey(updatedWorkspace)
          });
          resetGenerationProgress();
          setStage("outline");
          setPage("main");
        }
        showToast(t.toasts.outlineUpdated);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createOutlineFirst);
    } finally {
      setLoading("none");
    }
  }

  function updateOutlineDraftItem(index: number, patch: Partial<WorkspaceOutlineItem>) {
    if (!outlineEditMode) return;
    setOutlineDraft((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function updateDeckTitle(index: number, title: string) {
    setDeck((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
    setOutline((items) => {
      const next = items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      );
      autosaveOutline(next);
      return next;
    });
  }

  async function persistRenderedPages(
    nextDeck: Slide[],
    nextRenderedSlides: NonNullable<DeckReviewRenderState["result"]>["slides"],
    nextCurrentSlide: number
  ) {
    if (
      !backend ||
      !currentWorkspace ||
      !reviewRender.result ||
      nextRenderedSlides.length !== nextDeck.length
    ) {
      setDeck(nextDeck);
      setCurrentSlide(nextCurrentSlide);
      return;
    }

    const updatedWorkspace = await backend.updateWorkspacePages({
      workspace_dir: currentWorkspace.workspace_dir,
      pages: nextRenderedSlides.map((slide, index) => ({
        page_id: slide.slide_id,
        title: nextDeck[index]?.title ?? slide.title
      }))
    });

    setDeck(nextDeck);
    setOutline(
      nextRenderedSlides.map((slide, index) => ({
        title: nextDeck[index]?.title ?? slide.title,
        outline: slide.speaker_note
      }))
    );
    setCurrentSlide(nextCurrentSlide);
    applyWorkspace(updatedWorkspace);
    setWorkspaceScan(await backend.listWorkspaces());
    await renderDeckHtmlForWorkspace(updatedWorkspace, "review");
    setCurrentSlide(nextCurrentSlide);
  }

  async function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= deck.length) return;

    const nextDeck = [...deck];
    [nextDeck[index], nextDeck[target]] = [nextDeck[target], nextDeck[index]];

    const renderedSlides = reviewRender.result?.slides ?? [];
    const nextRenderedSlides = [...renderedSlides];
    if (nextRenderedSlides.length === deck.length) {
      [nextRenderedSlides[index], nextRenderedSlides[target]] = [
        nextRenderedSlides[target],
        nextRenderedSlides[index]
      ];
    }

    const nextCurrentSlide =
      currentSlide === index ? target : currentSlide === target ? index : currentSlide;

    try {
      await persistRenderedPages(nextDeck, nextRenderedSlides, nextCurrentSlide);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to move slide.");
    }
  }

  async function deleteSlide(index: number) {
    if (deck.length <= 1) return;

    const nextDeck = deck.filter((_, itemIndex) => itemIndex !== index);
    const nextRenderedSlides = (reviewRender.result?.slides ?? []).filter(
      (_, itemIndex) => itemIndex !== index
    );
    const nextCurrentSlide =
      index < currentSlide
        ? currentSlide - 1
        : Math.max(0, Math.min(currentSlide, nextDeck.length - 1));

    try {
      await persistRenderedPages(nextDeck, nextRenderedSlides, nextCurrentSlide);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete slide.");
    }
  }

  async function duplicateSlide(index: number) {
    const slide = deck[index];
    if (!slide) return;

    const duplicateTitle =
      locale === "zh" ? `${slide.title} 副本` : `${slide.title} Copy`;
    const nextCurrentSlide = index + 1;

    if (!backend || !currentWorkspace || !reviewRender.result) {
      const nextDeck = [
        ...deck.slice(0, nextCurrentSlide),
        { ...slide, title: duplicateTitle },
        ...deck.slice(nextCurrentSlide)
      ];
      setDeck(nextDeck);
      setCurrentSlide(nextCurrentSlide);
      return;
    }

    const renderedSlide = reviewRender.result.slides[index];
    if (!renderedSlide) return;

    try {
      const updatedWorkspace = await backend.duplicateWorkspacePage({
        workspace_dir: currentWorkspace.workspace_dir,
        page_id: renderedSlide.slide_id,
        title: duplicateTitle
      });
      applyWorkspace(updatedWorkspace);
      setWorkspaceScan(await backend.listWorkspaces());
      await renderDeckHtmlForWorkspace(updatedWorkspace, "review");
      setCurrentSlide(nextCurrentSlide);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to duplicate slide.");
    }
  }

  function addSlide() {
    const title = locale === "zh" ? "新页面" : "New Slide";
    const subtitle = locale === "zh" ? "新的页面内容" : "New slide content";
    setDeck((items) => [...items, { title, subtitle }]);
    setOutline((items) => {
      const next = [...items, { title, outline: t.outline.fallbackSummary }];
      autosaveOutline(next);
      return next;
    });
  }

  function openLocalProject(projectName: string) {
    const nextDeck = createLocalProjectDeck(projectName);
    setDeckTitle(projectName);
    setDeck(nextDeck);
    setOutline(
      nextDeck.map((slide) => ({
        title: slide.title,
        outline: slide.subtitle
      }))
    );
    setGenerated(true);
    setCurrentSlide(0);
    setStage("deck");
    setPage("main");
  }

  function getWorkspaceTitle(workspace: WorkspaceResult) {
    return typeof workspace.task === "object" &&
      workspace.task !== null &&
      typeof (workspace.task as { title?: unknown }).title === "string"
      ? (workspace.task as { title: string }).title
      : workspace.task_id ?? workspace.workspace_id;
  }

  async function autoSyncWorkspaceTitleFromOutline(
    previousWorkspace: WorkspaceResult,
    updatedWorkspace: WorkspaceResult,
    title: string
  ) {
    if (!backend) return updatedWorkspace;

    const nextTitle = title.trim();
    if (!nextTitle || !shouldAutoSyncWorkspaceTitleFromOutline(previousWorkspace, nextTitle)) {
      return updatedWorkspace;
    }

    try {
      return await backend.updateWorkspaceTitle({
        workspace_dir: updatedWorkspace.workspace_dir,
        title: nextTitle
      });
    } catch (error) {
      console.warn(
        "Failed to sync workspace title from outline",
        error instanceof Error ? error.message : error
      );
      return updatedWorkspace;
    }
  }

  function readWorkspaceExportArtifactPath(workspace: WorkspaceResult): ExportArtifact | null {
    if (!workspace.task || typeof workspace.task !== "object" || Array.isArray(workspace.task)) {
      return null;
    }

    const task = workspace.task as {
      artifacts?: {
        pptx?: {
          path?: unknown;
          updated_at?: unknown;
        };
        pdf?: { path?: unknown; updated_at?: unknown };
      };
    };
    const pptx = task.artifacts?.pptx;
    const pdf = task.artifacts?.pdf;
    const candidates = [
      {
        type: "PPTX" as const,
        path: typeof pptx?.path === "string" ? pptx.path : "",
        updatedAt: typeof pptx?.updated_at === "string" ? pptx.updated_at : ""
      },
      {
        type: "PDF" as const,
        path: typeof pdf?.path === "string" ? pdf.path : "",
        updatedAt: typeof pdf?.updated_at === "string" ? pdf.updated_at : ""
      }
    ].filter((item) => item.path);

    if (candidates.length === 0) {
      return null;
    }

    const latest = [...candidates].sort((left, right) => {
      if (left.updatedAt === right.updatedAt) return 0;
      if (!left.updatedAt) return 1;
      if (!right.updatedAt) return -1;
      return right.updatedAt.localeCompare(left.updatedAt);
    })[0];

    return {
      type: latest.type,
      path: latest.path,
      href: ""
    };
  }

  function formatExportHostUploadError(error: unknown) {
    const detail = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
    const fallback = locale === "zh"
      ? "Host Upload 下载链接生成失败。"
      : "Failed to create a Host Upload download link.";
    if (!detail) return fallback;
    return locale === "zh"
      ? `Host Upload 下载链接生成失败：${detail}`
      : `Failed to create a Host Upload download link: ${detail}`;
  }

  async function buildWorkspaceExportArtifact(workspace: WorkspaceResult): Promise<ExportArtifact | null> {
    const artifact = readWorkspaceExportArtifactPath(workspace);
    if (!artifact) return null;

    if (!backend) {
      throw new Error("PptBackend is not available.");
    }

    const result = await backend.getExportArtifactDownloadUrl({
      workspace_dir: workspace.workspace_dir,
      artifact_type: artifact.type.toLowerCase() as "pptx" | "pdf"
    });
    if (
      !result.download_upload ||
      result.download_upload.transport !== "host_upload" ||
      typeof result.download_upload.url !== "string" ||
      result.download_upload.url.length === 0
    ) {
      throw new Error("Export artifact response did not include a valid HostUploadRef.");
    }

    return {
      type: result.artifact_type === "pptx" ? "PPTX" : "PDF",
      path: result.path,
      href: result.download_upload.url,
      fileName: result.filename
    };
  }

  async function refreshWorkspaceExportArtifact(
    workspace: WorkspaceResult,
    refreshVersion = exportRefreshVersionRef.current,
    options: { rethrow?: boolean } = {},
  ) {
    try {
      const artifact = await buildWorkspaceExportArtifact(workspace);
      if (refreshVersion !== exportRefreshVersionRef.current) {
        return;
      }
      setExportArtifactWithProgress(artifact);
    } catch (error) {
      if (refreshVersion !== exportRefreshVersionRef.current) {
        return;
      }
      const artifact = readWorkspaceExportArtifactPath(workspace);
      const message = formatExportHostUploadError(error);
      console.warn("Failed to create Host Upload download link", error);
      setExportArtifact(artifact);
      setExportProgress((current) =>
        createExportErrorProgress(message, artifact?.type ?? current.type, current.percent)
      );
      if (options.rethrow) {
        throw new Error(message);
      }
    }
  }

  async function ensureCurrentWorkspace() {
    if (!backend) return null;
    if (currentWorkspace) return currentWorkspace;

    const workspace = await backend.createWorkspace({
      title: getDefaultWorkspaceTitle()
    });
    applyWorkspace(workspace);
    setWorkspaceScan(await backend.listWorkspaces());
    return workspace;
  }

  async function uploadUploadedSource(file: File) {
    if (!backend) return;
    setLoading("upload");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const result = await uploadUploadedSourceFile(workspace, file);
      await backend.appendWorkspaceLog({
        workspace_dir: workspace.workspace_dir,
        channel: "ai-research",
        entry: {
          event: "uploaded_source.uploaded",
          schema_version: 1,
          uploaded_source_id: result.material.uploaded_source_id,
          filename: result.material.original_filename,
          extension: result.material.extension,
          size_bytes: result.material.size_bytes,
          sha256: result.material.sha256,
          duplicate_of: result.material.duplicate_of ?? null,
          warnings: result.warnings,
          updated_at: new Date().toISOString(),
        },
      }).catch((error) => {
        console.warn("Failed to append uploaded source upload log", error);
      });
      const activeSources = result.index.materials.filter((item) => item.status === "active");
      setUploadedSources(activeSources);
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisError("");
      setUploadedSourceAnalysisProgress(createUploadedSourceAnalysisProgress(t, {
        sourceCount: activeSources.length,
      }));
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(
        result.warnings.length > 0
          ? result.warnings[0]
          : t.toasts.attachmentAdded
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.attachmentAdded);
    } finally {
      setLoading("none");
    }
  }

  async function removeUploadedSource(uploadedSourceId: string) {
    if (!backend) return;
    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;
    setLoading("upload");
    try {
      const result = await backend.removeUploadedSource({
        workspace_dir: workspace.workspace_dir,
        uploaded_source_id: uploadedSourceId,
      });
      await backend.appendWorkspaceLog({
        workspace_dir: workspace.workspace_dir,
        channel: "ai-research",
        entry: {
          event: "uploaded_source.removed",
          schema_version: 1,
          uploaded_source_id: uploadedSourceId,
          filename: result.material.original_filename,
          active_count: result.index.materials.filter((item) => item.status === "active").length,
          updated_at: new Date().toISOString(),
        },
      }).catch((error) => {
        console.warn("Failed to append uploaded source remove log", error);
      });
      const activeSources = result.index.materials.filter((item) => item.status === "active");
      setUploadedSources(activeSources);
      setCurrentUploadedSourceAnalysis(null);
      setUploadedSourceAnalysisError("");
      setUploadedSourceAnalysisProgress(
        activeSources.length === 0
          ? createSkippedUploadedSourceAnalysisProgress(t)
          : createUploadedSourceAnalysisProgress(t, { sourceCount: activeSources.length })
      );
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.toasts.attachmentRemoved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.attachmentRemoved);
    } finally {
      setLoading("none");
    }
  }

  async function refreshCurrentWorkspaceSnapshot() {
    if (!backend) return null;
    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return null;

    const refreshedWorkspace = await backend.openWorkspace({
      workspace_dir: workspace.workspace_dir,
    });
    const workspaceSnapshot = activeGenerationRun
      ? refreshedWorkspace
      : await reconcileWorkspaceInterruptedPages(refreshedWorkspace);
    setCurrentWorkspace(workspaceSnapshot);
    setPageReviewSettings(workspacePageReviewSettings(workspaceSnapshot));
    return workspaceSnapshot;
  }

  function readSelectedTemplateGroup(workspace: WorkspaceResult | null) {
    const templateRecord =
      workspace?.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
        ? (workspace.template as { selected_template_group?: unknown })
        : null;
    return typeof templateRecord?.selected_template_group === "string"
      ? templateRecord.selected_template_group
      : "";
  }

  async function ensureWorkspaceThemeTokenForGeneration(
    workspace: WorkspaceResult,
    rows: ContextRow[] = contextRows,
    options: {
      runKind?: "deck-generation" | "deck-refinement";
      refinementRequest?: string;
    } = {},
  ) {
    if (!backend || !aiClient) return workspace;
    setLoading("theme");
    const result = await generateWorkspaceThemeToken({
      backend,
      aiClient,
      aiLogger,
      workspace,
      prompt,
      contextRows: buildLlmContextRows(rows),
      locale,
      runKind: options.runKind ?? "deck-generation",
      refinementRequest: options.refinementRequest,
    });
    applyWorkspace(result.workspace);
    setWorkspaceScan(await backend.listWorkspaces());
    if (result.fallbackUsed) {
      showToast(
        locale === "zh"
          ? "主题定制失败，已使用模板默认主题继续生成。"
          : "Theme customization failed. Continuing with the template default theme."
      );
    }
    return result.workspace;
  }

  async function ensureWorkspaceTemplate(workspace: WorkspaceResult) {
    if (!backend) return workspace;

    const groupId = selectedTemplateGroupId ?? DEFAULT_TEMPLATE_GROUP_ID;
    if (readSelectedTemplateGroup(workspace) === groupId) {
      return workspace;
    }

    const result = await backend.selectTemplate({
      workspace_dir: workspace.workspace_dir,
      template_group: groupId
    });
    applyWorkspace(result.workspace);
    setSelectedTemplateGroupId(result.selection.selected_template_group);
    setWorkspaceScan(await backend.listWorkspaces());
    return result.workspace;
  }

  async function appendOutlineAiLog(
    workspace: WorkspaceResult | null,
    entry: Record<string, unknown>
  ) {
    if (!backend || !workspace) return;

    try {
      await backend.appendWorkspaceLog({
        workspace_dir: workspace.workspace_dir,
        channel: "ai-outline",
        entry
      });
    } catch (error) {
      console.warn(
        "Failed to append outline AI log",
        error instanceof Error ? error.message : error
      );
    }
  }

  async function appendOutlineAiAttemptLogs(
    workspace: WorkspaceResult | null,
    attempts: AiAttemptLog[],
    logContext?: AiOperationLogContext
  ) {
    for (const attempt of attempts) {
      await appendOutlineAiLog(workspace, {
        event: `ai.outline.${attempt.operation}.attempt`,
        schema_version: 1,
        operation_id: logContext?.operation_id,
        interaction_ids: logContext?.interaction_ids ?? [],
        operation: attempt.operation,
        attempt: attempt.attempt,
        status: attempt.status,
        validation: attempt.validation,
        error: attempt.error,
      });
    }
  }

  async function appendOutlineErrorLog(
    workspace: WorkspaceResult | null,
    operation: AiAttemptLog["operation"],
    error: unknown
  ) {
    const attempts =
      error &&
      typeof error === "object" &&
      "attempts" in error &&
      Array.isArray((error as { attempts?: unknown }).attempts)
        ? ((error as { attempts: AiAttemptLog[] }).attempts)
        : [];

    if (attempts.length > 0) {
      await appendOutlineAiAttemptLogs(workspace, attempts);
      return;
    }

    await appendOutlineAiLog(workspace, {
      event: `ai.outline.${operation}.error`,
      operation,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }

  async function saveOutlineArtifact(
    items = outline,
    title = deckTitle,
    outputLanguage = outlineOutputLanguage,
    workspaceOverride: WorkspaceResult | null = null,
    settingOverride: WorkspaceSettings | null = null,
    status: "draft" | "confirmed" = "draft",
    applyWorkspaceState = true,
    contextRowsOverride: Array<ContextRow | LlmContextRow> | null = null,
    uploadedSourceAnalysis: UploadedSourceAnalysis | null = null
  ) {
    if (!backend) return null;
    const workspace = workspaceOverride ?? (await ensureCurrentWorkspace());
    if (!workspace) return null;

    const outlineTitle = title.trim();
    const updatedWorkspace = await backend.updateWorkspaceOutline({
      workspace_dir: workspace.workspace_dir,
      outline: {
        ...buildOutlineArtifact(items, outlineTitle || title, outputLanguage, status),
        source: {
          prompt,
          context: buildLlmContextRows(contextRowsOverride ?? contextRows),
          setting: withOutputLanguage(
            settingOverride ?? workspaceSettingsToState(workspace),
            outputLanguage
          ),
          ...(uploadedSourceAnalysis
            ? { uploaded_source_analysis: createUploadedSourceAnalysisDependency(uploadedSourceAnalysis) }
            : {})
        }
      }
    });
    const syncedWorkspace = await autoSyncWorkspaceTitleFromOutline(
      workspace,
      updatedWorkspace,
      outlineTitle
    );
    if (applyWorkspaceState) {
      applyWorkspace(syncedWorkspace);
      setWorkspaceScan(await backend.listWorkspaces());
    } else {
      setCurrentWorkspace(syncedWorkspace);
    }
    return syncedWorkspace;
  }

  function autosaveOutline(items: OutlineDetail[]) {
    if (outlineAutosaveTimerRef.current !== null) {
      window.clearTimeout(outlineAutosaveTimerRef.current);
    }

    outlineAutosaveTimerRef.current = window.setTimeout(() => {
      outlineAutosaveTimerRef.current = null;
      void saveOutlineArtifact(
        items,
        deckTitle,
        outlineOutputLanguage,
        null,
        null,
        "draft",
        false
      ).catch(
        (error) => {
          console.warn(
            "Failed to autosave outline",
            error instanceof Error ? error.message : error
          );
        }
      );
    }, 500);
  }

  async function scanWorkspaces() {
    if (!backend) return;

    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      setWorkspaceScan(await backend.listWorkspaces());
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to scan tasks."
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function useLatestWorkspace() {
    const latestTask = workspaceScan?.latest_task ?? workspaceScan?.latest_workspace;
    if (!backend || !latestTask) return;

    await openWorkspace(latestTask.task_dir ?? latestTask.workspace_dir);
  }

  async function showWorkspacePicker() {
    resetGenerationUiState();
    setCurrentWorkspace(null);
    setPage("main");
    setStage("brief");
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
    await scanWorkspaces();
  }

  async function openWorkspace(workspaceDir: string) {
    if (!backend) return;

    resetGenerationUiState();
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const openedWorkspace = await backend.openWorkspace({
        workspace_dir: workspaceDir
      });
      const workspace = await reconcileWorkspaceInterruptedPages(openedWorkspace);
      const shouldOpenDeck = hasRenderedWorkspacePages(workspace);
      applyWorkspace(workspace, { syncEmptyContextRows: true });
      if (shouldOpenDeck) {
        setPage("main");
        setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
        const rendered = await loadDeckHtmlForWorkspace(workspace, "review");
        if (rendered) {
          showToast(formatMessage(t.toasts.workspaceOpened, { id: workspace.task_id ?? workspace.workspace_id }));
        }
      } else {
        setPage("main");
        showToast(formatMessage(t.toasts.workspaceOpened, { id: workspace.task_id ?? workspace.workspace_id }));
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to open workspace."
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function createWorkspace() {
    if (!backend) return;

    resetGenerationUiState();
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.createWorkspace({
        title: getDefaultWorkspaceTitle()
      });
      applyWorkspace(workspace, { syncEmptyContextRows: true });
      setWorkspaceScan(await backend.listWorkspaces());
      setPage("main");
      showToast(formatMessage(t.toasts.workspaceCreated, { id: workspace.task_id ?? workspace.workspace_id }));
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to create workspace."
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function selectTemplate(groupId: string) {
    if (!backend) return;
    if (!isSelectableTemplateGroup(groupId)) {
      showToast(t.template.empty);
      return;
    }

    setLoading("template");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const result = await backend.selectTemplate({
        workspace_dir: workspace.workspace_dir,
        template_group: groupId
      });
      applyWorkspace(result.workspace);
      setSelectedTemplateGroupId(result.selection.selected_template_group);
      setWorkspaceScan(await backend.listWorkspaces());
      setStage("brief");
      showToast(t.template.selected);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.template.empty);
    } finally {
      setLoading("none");
    }
  }

  async function saveWorkspaceSettings(setting: WorkspaceSettings) {
    if (!backend || !currentWorkspace) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const result = await backend.updateWorkspaceSettings({
        workspace_dir: currentWorkspace.workspace_dir,
        persist_as_default: true,
        setting
      });
      applyWorkspaceSetting(result.setting);
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function setReviewOutlineFirst(enabled: boolean) {
    if (!backend) return;

    const previous = reviewOutlineFirst;
    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    setReviewOutlineFirstState(enabled);
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) {
        setReviewOutlineFirstState(previous);
        return;
      }
      const result = await backend.updateWorkspaceSettings({
        workspace_dir: workspace.workspace_dir,
        persist_as_default: true,
        setting: outlineReviewPreferenceToWorkspaceSettings(enabled),
      });
      applyWorkspaceSetting(result.setting);
      showToast(t.status.settingsSaved);
    } catch (error) {
      setReviewOutlineFirstState(previous);
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function setStrictReviewMode(enabled: boolean) {
    if (!backend) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const setting = workspaceSettingsToState(workspace);
      const currentReviewSettings = readPageReviewSettings(setting);
      const nextReviewSettings: PageReviewSettings = {
        ...currentReviewSettings,
        visualReviewEnabled: enabled,
      };
      const result = await backend.updateWorkspaceSettings({
        workspace_dir: workspace.workspace_dir,
        persist_as_default: true,
        setting: pageReviewSettingsToWorkspaceSettings(nextReviewSettings),
      });
      applyWorkspaceSetting(result.setting);
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function setResearchSearchControlSettings(settings: ResearchSearchControlSettings) {
    if (!backend) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    setResearchSearchControlSettingsState(settings);
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const result = await backend.updateWorkspaceSettings({
        workspace_dir: workspace.workspace_dir,
        persist_as_default: true,
        setting: researchSearchControlSettingsToWorkspaceSettings(settings),
      });
      applyWorkspaceSetting(result.setting);
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
      setResearchSearchControlSettingsState(
        workspaceResearchSearchControlSettings(currentWorkspace)
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function saveWorkspaceTitle(title: string) {
    if (!backend || !currentWorkspace) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle === getWorkspaceTitle(currentWorkspace)) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.updateWorkspaceTitle({
        workspace_dir: currentWorkspace.workspace_dir,
        title: trimmedTitle
      });
      applyWorkspace(workspace);
      setDeckTitle(trimmedTitle);
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save workspace title."
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function refineDeck(instruction: string) {
    if (!backend || !aiClient || !agentClient) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    const cancelSignal = beginCancellableGeneration();
    setLoading("refineDeck");
    resetGenerationProgress();
    try {
      const refreshedWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!refreshedWorkspace) return;
      beginActiveGenerationRun("deck-refinement");
      activeRunWorkspaceDir = refreshedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        aiLogger,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        instruction: trimmedInstruction,
        scope: "deck",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace, {
        resumeAllowedOnRecoverableStop: true,
      });
      shouldReconcileActiveRun = false;
      if (completion.status === "completed") {
        showToast(t.status.deckRefined);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningDeck);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  async function refineSlide(instruction: string) {
    if (!backend || !aiClient || !agentClient) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) return;
    const slide = deck[currentSlide];
    if (!slide) return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    const cancelSignal = beginCancellableGeneration();
    setLoading("refineSlide");
    resetGenerationProgress();
    try {
      const refreshedWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!refreshedWorkspace) return;
      beginActiveGenerationRun("page-refinement");
      activeRunWorkspaceDir = refreshedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        aiLogger,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        instruction: trimmedInstruction,
        scope: "slide",
        pageIndex: currentSlide,
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace, {
        resumeAllowedOnRecoverableStop: true,
      });
      shouldReconcileActiveRun = false;
      setCurrentSlide(currentSlide);
      if (completion.status === "completed") {
        showToast(t.status.slideRefined);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningSlide);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  function buildRewriteCurrentSlideInstruction() {
    return [
      "Rewrite only the current slide for clarity, impact, and executive readability.",
      "Keep the current slide purpose, key message, factual content, and evidence.",
      "Do not add unsupported facts, numbers, dates, names, citations, examples, or claims.",
      "Prefer concise wording, stronger hierarchy, and cleaner slide-level narrative.",
      "Do not change other pages.",
    ].join("\n");
  }

  function buildChangeCurrentSlideLayoutInstruction(
    mode: "simpler" | "visual" | "comparison" | "process" | "report",
  ) {
    const modeInstruction = {
      simpler:
        "Make the slide simpler: reduce density, clarify the hierarchy, and keep only the essential message and support.",
      visual:
        "Make the slide more visual: use stronger visual grouping, callouts, metrics, or diagram-like structure where appropriate.",
      comparison:
        "Make the slide better for comparison: organize content into clear side-by-side dimensions, tradeoffs, or benchmark structure.",
      process:
        "Make the slide better for process explanation: organize content into stages, sequence, flow, or roadmap structure.",
      report:
        "Make the slide better for an executive report: emphasize conclusion-first structure, concise evidence, and decision-ready framing.",
    }[mode];

    return [
      "Change only the current slide layout direction while preserving its factual content and key message.",
      modeInstruction,
      "You may restructure the current slide TSX and data, and you may reference available blueprints/components for layout ideas.",
      "Do not modify page-plan.json, manifest slide ids, other pages, or unrelated shared files.",
      "Do not add unsupported facts, numbers, dates, names, citations, examples, or claims.",
      "If content does not fit the requested layout, prioritize truthful omission or TBD over invention.",
    ].join("\n");
  }

  async function rewriteCurrentSlide() {
    await refineSlide(buildRewriteCurrentSlideInstruction());
  }

  async function changeCurrentSlideLayout(
    mode: "simpler" | "visual" | "comparison" | "process" | "report",
  ) {
    await refineSlide(buildChangeCurrentSlideLayoutInstruction(mode));
  }

  async function renderDeckHtmlForWorkspace(
    workspace: WorkspaceResult,
    loadingKind: LoadingKind
  ): Promise<Awaited<ReturnType<PptBackend["renderDeckHtml"]>> | null> {
    if (!backend) return null;

    setLoading(loadingKind);
    setReviewRender((current) => ({
      ...current,
      status: "loading",
      result: null,
      error: ""
    }));

    try {
      const result = await backend.renderDeckHtml({
        workspace_dir: workspace.workspace_dir
      });
      const refreshedWorkspace = await backend.openWorkspace({
        workspace_dir: workspace.workspace_dir
      });
      const renderKey = workspaceReviewRenderKey(refreshedWorkspace);
      applyWorkspace(refreshedWorkspace);
      applyRenderedDeck(result);
      setReviewRender({
        status: "ready",
        result,
        error: "",
        renderKey
      });
      void backend.listWorkspaces().then(setWorkspaceScan).catch((error) => {
        console.warn(
          "Failed to refresh tasks after render",
          error instanceof Error ? error.message : error
        );
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to render deck HTML.";
      const renderKey = workspaceReviewRenderKey(workspace);
      setReviewRender({
        status: "error",
        result: null,
        error: message,
        renderKey
      });
      showToast(message);
      return null;
    } finally {
      setLoading("none");
    }
  }

  async function loadDeckHtmlForWorkspace(
    workspace: WorkspaceResult,
    loadingKind: LoadingKind
  ): Promise<Awaited<ReturnType<PptBackend["renderDeckHtml"]>> | null> {
    if (!backend) return null;

    setLoading(loadingKind);
    setReviewRender((current) => ({
      ...current,
      status: "loading",
      result: null,
      error: ""
    }));

    try {
      const result = await backend.getRenderedDeckHtml({
        workspace_dir: workspace.workspace_dir
      });
      const renderKey = workspaceReviewRenderKey(workspace);
      applyRenderedDeck(result);
      setReviewRender({
        status: "ready",
        result,
        error: "",
        renderKey
      });
      setLoading("none");
      return result;
    } catch {
      return renderDeckHtmlForWorkspace(workspace, loadingKind);
    }
  }

  async function renderDeckHtml() {
    if (!backend) return;

    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;

    await renderDeckHtmlForWorkspace(workspace, "review");
  }

  function returnToOutlineFromGeneration() {
    setGenerationUnresumable(false);
    if (outline.length === 0) {
      navigateMain("brief");
      return;
    }
    setPage("main");
    setStage("outline");
  }

  function returnToBriefFromUploadedSourceAnalysis() {
    setPage("main");
    setStage("brief");
    pendingUploadedSourceAnalysisActionRef.current = null;
  }

  async function retryUploadedSourceAnalysis() {
    const action = pendingUploadedSourceAnalysisActionRef.current;
    if (action) {
      forceUploadedSourceAnalysisRefreshRef.current = true;
      try {
        await action();
      } finally {
        forceUploadedSourceAnalysisRefreshRef.current = false;
      }
      return;
    }
    if (!currentWorkspace) return;
    forceUploadedSourceAnalysisRefreshRef.current = true;
    try {
      await ensureUploadedSourceAnalysisForOutline(currentWorkspace);
    } finally {
      forceUploadedSourceAnalysisRefreshRef.current = false;
    }
  }

  async function regenerateDeck() {
    if (outline.length > 0) {
      await createDeckFromOutline();
      return;
    }
    await generateDeck();
  }

  async function resumeDeckGeneration() {
    if (!backend || !aiClient || !agentClient) return;
    if (loading === "deck" || loading === "deckFromOutline") return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    const cancelSignal = beginCancellableGeneration();
    setLoading("deckFromOutline");
    try {
      const workspace = await refreshCurrentWorkspaceSnapshot();
      if (!workspace) return;
      const refreshedWorkspace = await reconcileWorkspaceInterruptedPages(workspace);
      applyWorkspace(refreshedWorkspace);
      activeRunWorkspaceDir = refreshedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const progress = normalizeWorkspacePageProgress(refreshedWorkspace.page_progress);
      const recovery = progress?.recovery;
      const isPageRefinementResume = recovery?.run_kind === "page-refinement";
      const isDeckRefinementResume = recovery?.run_kind === "deck-refinement";
      const isRefinementResume = isPageRefinementResume || isDeckRefinementResume;
      const resumePageIndex = progress?.pages.find((page) =>
        recovery?.target_page_ids?.includes(page.page_id)
      )?.index;
      beginActiveGenerationRun(
        isDeckRefinementResume ? "deck-refinement" : isPageRefinementResume ? "page-refinement" : "deck-generation"
      );
      const completion = isRefinementResume
        ? await runDeckRefinement({
            backend,
            aiClient,
            agentClient,
            aiLogger,
            workspace: refreshedWorkspace,
            confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
            locale,
            instruction:
              recovery.page_refinement_request ||
              Object.values(recovery.page_refinement_requests ?? {})[0] ||
              "",
            scope: isDeckRefinementResume ? "deck" : "slide",
            pageIndex: isPageRefinementResume ? resumePageIndex : undefined,
            resumePageIds: recovery.target_page_ids,
            skipIntentReview: true,
            onProgress: recordGenerationProgress,
            isCancelled: () => cancelCreateDeckRef.current,
            cancelSignal,
          })
        : await runDeckGeneration({
            backend,
            aiClient,
            agentClient,
            aiLogger,
            workspace: refreshedWorkspace,
            confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
            locale,
            startMode: "resume",
            onProgress: recordGenerationProgress,
            isCancelled: () => cancelCreateDeckRef.current,
            cancelSignal,
          });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      shouldReconcileActiveRun = false;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  async function retryPageGeneration(pageId: string) {
    if (!backend || !aiClient || !agentClient) return;
    if (loading === "deck" || loading === "deckFromOutline") return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    const cancelSignal = beginCancellableGeneration();
    setLoading("deckFromOutline");
    try {
      const refreshedWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!refreshedWorkspace) return;
      beginActiveGenerationRun("deck-generation");
      activeRunWorkspaceDir = refreshedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const completion = await runPageGenerationRetry({
        backend,
        aiClient,
        agentClient,
        aiLogger,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        pageId,
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      shouldReconcileActiveRun = false;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
      await finishActiveGenerationRun({
        workspaceDir: activeRunWorkspaceDir,
        reconcileInterrupted: shouldReconcileActiveRun,
      });
    }
  }

  async function exportFile(type: "PPTX" | "PDF") {
    if (!backend) return;

    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;
    const exportVersion = exportRefreshVersionRef.current + 1;
    exportRefreshVersionRef.current = exportVersion;
    exportInFlightRef.current = true;

    const needsFreshRender =
      reviewRender.status !== "ready" ||
      reviewRender.result === null ||
      reviewRender.renderKey !== workspaceReviewRenderKey(workspace);

    setLoading("export");
    setExportProgress(createExportStartProgress(t, type));
    setExportArtifact(null);
    try {
      if (needsFreshRender) {
        const rendered = await loadDeckHtmlForWorkspace(workspace, "export");
        if (!rendered) return;
        setLoading("export");
        setExportProgress(createExportStartProgress(t, type));
      }

      if (type === "PPTX") {
        const startedModel = await backend.startPptxExportModel({
          workspace_dir: workspace.workspace_dir
        });
        setExportProgress(createPptxJobExportProgress(t, startedModel));

        const modelReady = await waitForPptxExportStatus(
          workspace.workspace_dir,
          (job) => job.status === "model_ready" || job.status === "failed"
        );
        if (modelReady.status === "failed") {
          throw new Error(getPptxExportErrorMessage(modelReady));
        }
        assertPptxExportPath(modelReady.model_path, "model_path");
        assertPptxExportPath(modelReady.pptx_path, "pptx_path");

        const startedPptx = await backend.startGeneratePptx({
          workspace_dir: workspace.workspace_dir,
          job_id: modelReady.job_id,
          modelPath: modelReady.model_path,
          outputPath: modelReady.pptx_path
        });
        setExportProgress(createPptxJobExportProgress(t, startedPptx));

        const completed = await waitForPptxExportStatus(
          workspace.workspace_dir,
          (job) => job.status === "completed" || job.status === "failed"
        );
        if (completed.status === "failed") {
          throw new Error(getPptxExportErrorMessage(completed));
        }

        const pptxPath = completed.pptx_path;
        assertPptxExportPath(pptxPath, "pptx_path");
        const updatedWorkspace = await backend.recordPptxExport({
          workspace_dir: workspace.workspace_dir,
          pptxPath,
          generatorResult: completed.generator_result ?? completed
        });
        applyWorkspace(updatedWorkspace);
        await refreshWorkspaceExportArtifact(updatedWorkspace, exportVersion, { rethrow: true });
      } else {
        setExportProgress(createExportStartProgress(t, "PDF"));
        const pdfResult = await backend.exportPdf({
          workspace_dir: workspace.workspace_dir
        });
        const pdfPath = pdfResult.pdfPath;
        const updatedWorkspace = await backend.recordPdfExport({
          workspace_dir: workspace.workspace_dir,
          pdfPath
        });
        applyWorkspace(updatedWorkspace);
        await refreshWorkspaceExportArtifact(updatedWorkspace, exportVersion, { rethrow: true });
      }

      showToast(type === "PPTX" ? t.toasts.pptxExported : t.toasts.pdfExported);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.status.exporting;
      setExportProgress((current) =>
        createExportErrorProgress(message, type, current.percent)
      );
      showToast(message);
    } finally {
      exportInFlightRef.current = false;
      setLoading("none");
    }
  }

  function openStyleProfileCreation() {
    setPage("style-profile-creation");
    setHistory((items) => (items.at(-1) === "style-profile-creation" ? items : [...items, "style-profile-creation"]));
    void refreshStyleProfiles();
  }

  function resetStyleProfileCreation() {
    styleProfileCreationAbortRef.current?.abort();
    styleProfileCreationAbortRef.current = null;
    setStyleProfileCreation(createIdleStyleProfileCreationState());
  }

  function setStyleProfileCreationName(value: string) {
    setStyleProfileCreation((current) => ({ ...current, displayName: value }));
  }

  function setStyleProfileCreationFiles(files: File[]) {
    setStyleProfileCreation((current) => ({
      ...current,
      files,
      error: "",
      message: files.length > 0 ? `已选择 ${files.length} 个参考资料。` : "上传 PPTX 或图片参考资料后开始分析。",
    }));
  }

  async function refreshStyleProfiles() {
    if (!backend) return;
    setStyleProfileLibraryLoading(true);
    setStyleProfileLibraryError("");
    try {
      const result = await backend.listStyleProfiles();
      setStyleProfiles(result.profiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : "风格画像库加载失败。";
      setStyleProfileLibraryError(message);
    } finally {
      setStyleProfileLibraryLoading(false);
    }
  }

  async function loadStyleProfilePreview(styleProfileId: string) {
    if (!backend || styleProfilePreviews[styleProfileId]) return;
    try {
      const preview = await backend.getStyleProfilePreview({ style_profile_id: styleProfileId });
      setStyleProfilePreviews((current) => ({ ...current, [styleProfileId]: preview }));
    } catch (error) {
      console.warn("Failed to load Style Profile preview", error);
    }
  }

  async function openStyleProfileDetail(styleProfileId: string) {
    if (!backend) return;
    setStyleProfileDetail({ status: "loading", styleProfileId, detail: null, error: "" });
    try {
      const detail = await backend.getStyleProfile({ style_profile_id: styleProfileId });
      setStyleProfileDetail({ status: "ready", styleProfileId, detail, error: "" });
    } catch (error) {
      setStyleProfileDetail({
        status: "error",
        styleProfileId,
        detail: null,
        error: error instanceof Error ? error.message : "风格画像详情加载失败。",
      });
    }
  }

  function closeStyleProfileDetail() {
    setStyleProfileDetail({ status: "closed", styleProfileId: "", detail: null, error: "" });
  }

  async function runStyleProfileCreation(options: { retryAnalysis: boolean }) {
    if (!backend || !hostUploadClient || !agentClient) {
      showToast("风格画像创建能力尚未就绪。");
      return;
    }
    const displayName = styleProfileCreation.displayName.trim();
    if (!displayName) {
      showToast("请填写风格画像名称。");
      return;
    }
    if (!options.retryAnalysis && styleProfileCreation.files.length === 0) {
      showToast("请先上传 PPTX 或图片参考资料。");
      return;
    }
    const abortController = new AbortController();
    styleProfileCreationAbortRef.current = abortController;
    setStyleProfileCreation((current) => ({
      ...current,
      status: "running",
      displayName,
      error: "",
      canRetryAnalysis: false,
      createdStyleProfileId: "",
      message: options.retryAnalysis ? "正在重试分析视觉风格。" : "正在准备参考资料。",
      stages: options.retryAnalysis
        ? current.stages.map((stage) => (
            stage.id === "analyze" || stage.id === "publish"
              ? { ...stage, state: "pending", error: "", activities: [], lines: [], summaryLines: [] }
              : stage
          ))
        : createStyleProfileCreationStages(),
    }));
    try {
      const result = await createStyleProfile({
        backend,
        hostUploadClient,
        agentClient,
        displayName,
        files: options.retryAnalysis ? [] : styleProfileCreation.files,
        creationId: options.retryAnalysis ? styleProfileCreation.creationId : undefined,
        skipUpload: options.retryAnalysis,
        signal: abortController.signal,
        isCancelled: () => abortController.signal.aborted,
        onProgress: (event) => {
          setStyleProfileCreation((current) => applyStyleProfileCreationEvent(current, event));
        },
      });
      setStyleProfileCreation((current) => ({
        ...current,
        status: "completed",
        creationId: result.creationContext.creation_id,
        createdStyleProfileId: result.publishResult.style_profile.style_profile_id,
        canRetryAnalysis: false,
        message: "创建成功。",
        stages: current.stages.map((stage) => ({ ...stage, state: stage.state === "pending" ? "completed" : stage.state })),
      }));
      setStyleProfiles(result.publishResult.index.profiles);
      setStyleProfilePreviews((current) => {
        const next = { ...current };
        delete next[result.publishResult.style_profile.style_profile_id];
        return next;
      });
      void loadStyleProfilePreview(result.publishResult.style_profile.style_profile_id);
      showToast("风格画像创建成功。");
    } catch (error) {
      if (isStyleProfileCreationCancelledError(error) || abortController.signal.aborted) {
        setStyleProfileCreation((current) => ({
          ...current,
          status: "stopped",
          message: "已停止。",
          stages: current.stages.map((stage) =>
            stage.state === "active" ? { ...stage, state: "stopped" } : stage
          ),
        }));
        return;
      }
      const message = error instanceof Error ? error.message : "风格画像创建失败。";
      setStyleProfileCreation((current) => ({
        ...current,
        status: "failed",
        error: message,
        message,
        canRetryAnalysis: Boolean(current.creationId),
      }));
      showToast(message);
    } finally {
      if (styleProfileCreationAbortRef.current === abortController) {
        styleProfileCreationAbortRef.current = null;
      }
    }
  }

  async function startStyleProfileCreation() {
    await runStyleProfileCreation({ retryAnalysis: false });
  }

  async function retryStyleProfileAnalysis() {
    await runStyleProfileCreation({ retryAnalysis: true });
  }

  function stopStyleProfileCreation() {
    styleProfileCreationAbortRef.current?.abort();
  }

  async function selectStyleProfile(styleProfileId: string) {
    if (!backend || !currentWorkspace) return;
    if (hasDownstreamArtifacts(currentWorkspace)) {
      const ok = window.confirm("更换风格画像后，当前成稿会标记为需要重新生成。是否继续？");
      if (!ok) return;
    }
    try {
      const result = await backend.selectWorkspaceStyleProfile({
        workspace_dir: currentWorkspace.workspace_dir,
        style_profile_id: styleProfileId,
      });
      setSelectedStyleProfile(result.selection);
      applyWorkspace(result.workspace);
      showToast("已选择风格画像，当前成稿需要重新生成。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "风格画像选择失败。");
    }
  }

  async function clearStyleProfile() {
    if (!backend || !currentWorkspace || !selectedStyleProfile) return;
    if (hasDownstreamArtifacts(currentWorkspace)) {
      const ok = window.confirm("清除风格画像后，当前成稿会标记为需要重新生成。是否继续？");
      if (!ok) return;
    }
    try {
      const result = await backend.clearWorkspaceStyleProfile({
        workspace_dir: currentWorkspace.workspace_dir,
      });
      setSelectedStyleProfile(null);
      applyWorkspace(result.workspace);
      showToast("已清除风格画像，当前成稿需要重新生成。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "风格画像清除失败。");
    }
  }

  const state: DeckWorkspaceState = {
    panelMode,
    page,
    stage,
    toast,
    prompt,
    reviewOutlineFirst,
    pageReviewSettings,
    researchSearchControlSettings,
    contextRows,
    deckTitle,
    deck,
    outline,
    outlineDraft,
    outlineOutputLanguage,
    outlineDraftOutputLanguage,
    outlineEditMode,
    generated,
    currentSlide,
    outlineFeedback,
    previewMode,
    reviewRender,
    createDeckProgress,
    uploadedSourceAnalysisProgress,
    generationHistory,
    pageProgress,
    refineScope,
    loading,
    activeGenerationRun,
    generationViewState,
    exportProgress,
    exportArtifact,
    currentStatus,
    workspaceScan,
    currentWorkspace,
    uploadedSources,
    uploadedSourceAnalysisState,
    workspaceLoading,
    workspaceError,
    workspaceSettingsSaving,
    templateGroups,
    selectedTemplateGroupId,
    styleProfiles,
    styleProfilePreviews,
    selectedStyleProfile,
    styleProfileLibraryLoading,
    styleProfileLibraryError,
    styleProfileCreation,
    styleProfileDetail,
  };

  const actions: DeckWorkspaceActions = {
    setPanelMode,
    setPrompt,
    setReviewOutlineFirst,
    setStrictReviewMode,
    setResearchSearchControlSettings,
    setDeckTitle,
    setCurrentSlide,
    setOutlineFeedback,
    setPreviewMode,
    setRefineScope,
    showToast,
    cancelGenerateDeck,
    navigate,
    navigateMain,
    goBack,
    addContextRow,
    updateContextRow,
    removeContextRow,
    addStyleRow,
    suggestContextFromPrompt,
    generateDeck,
    createDeckFromOutline,
    applyOutlineFeedback,
    beginOutlineEdit,
    cancelOutlineEdit,
    saveOutlineEdit,
    updateOutlineDraftItem,
    setOutlineDraftOutputLanguage,
    updateDeckTitle,
    moveSlide,
    duplicateSlide,
    deleteSlide,
    addSlide,
    openLocalProject,
    openWorkspace,
    scanWorkspaces,
    showWorkspacePicker,
    useLatestWorkspace,
    createWorkspace,
    uploadUploadedSource,
    removeUploadedSource,
    openStyleProfileCreation,
    setStyleProfileCreationName,
    setStyleProfileCreationFiles,
    startStyleProfileCreation,
    retryStyleProfileAnalysis,
    stopStyleProfileCreation,
    resetStyleProfileCreation,
    refreshStyleProfiles,
    loadStyleProfilePreview,
    openStyleProfileDetail,
    closeStyleProfileDetail,
    selectStyleProfile,
    clearStyleProfile,
    saveWorkspaceSettings,
    saveWorkspaceTitle,
    selectTemplate,
    openRefineDeck,
    openRefineSlide,
    refineDeck,
    refineSlide,
    rewriteCurrentSlide,
    changeCurrentSlideLayout,
    renderDeckHtml,
    exportFile,
    returnToOutlineFromGeneration,
    returnToBriefFromUploadedSourceAnalysis,
    regenerateDeck,
    resumeDeckGeneration,
    retryPageGeneration,
    retryUploadedSourceAnalysis
  };

  return { state, actions };
}
