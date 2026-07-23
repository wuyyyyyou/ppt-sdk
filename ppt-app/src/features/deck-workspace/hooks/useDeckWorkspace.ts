import { useEffect, useMemo, useRef, useState } from "react";
import { createAgentClient, type AgentClient } from "../../../agent/agentClient";
import { resolveAgentToolAccessPolicy } from "../../../agent/agentToolAccessPolicy";
import { createAiClient, type AiAttemptLog, type AiClient, type LlmContextRow } from "../../../ai/aiClient";
import {
  createAiInteractionLogger,
  type AiOperationLogContext,
} from "../../../ai/interactionLog";
import { createPptBackend, type PptBackend } from "../../../api/pptBackend";
import { hasActiveDownloadUrl } from "../downloadUrl";
import { connectAnnaRuntime } from "../../../runtime/annaRuntime";
import {
  createAppHostUploadClient,
  type AppHostUploadClient,
} from "../../../runtime/appHostUploadClient";
import type {
  ListWorkspacesResult,
  PageProgress,
  PresentationRequirements,
  PresentationRequirementsSelections,
  RestorePageSourceVersionResult,
  SaveManualPageRevisionResult,
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
  , GenerationRunTransaction
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
} from "../utils";
import {
  normalizeSlideCountContextValue,
  SLIDE_COUNT_CONTEXT_OPTIONS,
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
import {
  completedDeckIsAvailable,
  restoreDeckGenerationProgress,
} from "../workspaceRecovery";
import { resolveRefineSlideIndex } from "../refineNavigation";
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
  cloneOutlineItems,
  createEmptyOutlineItem,
  normalizeValidOutline,
  outlinesEqual,
} from "../../outline";
import { createWorkspaceReviewRenderKey } from "../workspaceReviewRenderKey";
import { createInitialWorkspaceSnapshot } from "../createdWorkspace";
import type {
  ContextRow,
  ConfirmationDialogRequest,
  DeckReviewRenderState,
  DeckWorkspaceState,
  ExportProgressState,
  ExportArtifact,
  ExportDownloadState,
  WorkspaceDiagnosticBundleState,
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
  navigationBlockedByActiveGeneration,
  type ActiveGenerationRun,
  type ActiveGenerationRunKind,
} from "../generationViewState";
import { createOperationScopedProgressHandler } from "../generationProgressGuard";
import { isSelectableTemplateGroup } from "../templateSelectionPolicy";
import {
  applyUploadedSourceAnalysisWorkflowEvent,
  createCompletedUploadedSourceAnalysisProgress,
  createSkippedUploadedSourceAnalysisProgress,
  createUploadedSourceAnalysisProgress,
  failUploadedSourceAnalysisProgress,
} from "../uploadedSourceAnalysisProgress";
import {
  confirmedRequirementsAllowOutline,
  createEmptyPresentationRequirements,
  createManualRequirementsDraft,
  createRequirementsDraft,
  requirementsOwnedRecoveryStage,
  requirementsAreComplete,
} from "../../requirements";
import { findVisualStylePreset, toVisualStylePresetSelection } from "../../templates/visualStylePresets";

const DEFAULT_TEMPLATE_GROUP_ID = "red-finance-canvas";
const AGENT_TOOL_ACCESS_POLICY = resolveAgentToolAccessPolicy(
  import.meta.env.VITE_AGENT_TOOL_ACCESS_POLICY,
  { warn: (message) => console.warn(message) },
);
const PPTX_EXPORT_POLL_INTERVAL_MS = 1500;
const PPTX_EXPORT_POLL_TIMEOUT_MS = 15 * 60 * 1000;
const AGENT_CANCELLATION_WAIT_MS = 3_000;

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
  void workspace;
  return undefined;
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
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  setResearchSearchControlSettings: (settings: ResearchSearchControlSettings) => Promise<void>;
  setDeckTitle: (value: string) => void;
  setCurrentSlide: (index: number) => void;
  setOutlineFeedback: (value: string) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRefineScope: (scope: RefineScope) => void;
  showToast: (message: string) => void;
  cancelGenerateDeck: () => Promise<void>;
  navigate: (page: PageId) => Promise<void>;
  navigateMain: (stage: MainStage) => Promise<void>;
  goBack: () => Promise<void>;
  resolveConfirmation: (confirmed: boolean) => void;
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  addStyleRow: () => void;
  generateDeck: () => Promise<void>;
  generatePresentationRequirements: () => Promise<void>;
  selectVisualStylePreset: (presetId: string | null) => Promise<void>;
  useManualPresentationRequirements: () => Promise<void>;
  selectPresentationRequirement: <K extends keyof PresentationRequirementsSelections>(
    field: K,
    value: PresentationRequirementsSelections[K],
  ) => void;
  returnToBriefFromRequirements: () => Promise<void>;
  savePresentationRequirements: () => Promise<void>;
  confirmPresentationRequirements: () => Promise<void>;
  createDeckFromOutline: () => Promise<void>;
  applyOutlineFeedback: () => Promise<void>;
  retryOutlineCreation: () => Promise<void>;
  returnToRequirementsFromOutline: () => void;
  saveOutlineDraft: () => Promise<void>;
  setOutlineDraftTitle: (value: string) => void;
  updateOutlineDraftItem: (index: number, patch: Partial<WorkspaceOutlineItem>) => void;
  addOutlineDraftItem: () => void;
  insertOutlineDraftItem: (index: number, item: OutlineDetail) => void;
  deleteOutlineDraftItem: (index: number) => void;
  moveOutlineDraftItem: (fromIndex: number, toIndex: number) => void;
  updateDeckTitle: (index: number, title: string) => void;
  moveSlide: (index: number, direction: -1 | 1) => Promise<void>;
  duplicateSlide: (index: number) => Promise<void>;
  deleteSlide: (index: number) => Promise<void>;
  addSlide: () => void;
  openLocalProject: (projectName: string) => void;
  openWorkspace: (workspaceDir: string) => Promise<void>;
  scanWorkspaces: () => Promise<void>;
  showWorkspacePicker: () => Promise<void>;
  startNewPresentation: () => Promise<void>;
  refreshMyWork: () => Promise<void>;
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
  renameWorkspace: (workspaceDir: string, title: string) => Promise<void>;
  deleteWorkspace: (workspaceDir: string) => Promise<void>;
  selectTemplate: (groupId: string) => Promise<void>;
  openRefineDeck: () => Promise<void>;
  openRefineSlide: (index?: number) => Promise<void>;
  refineDeck: (instruction: string) => Promise<void>;
  refineSlide: (instruction: string) => Promise<void>;
  rewriteCurrentSlide: () => Promise<void>;
  changeCurrentSlideLayout: (mode: "simpler" | "visual" | "comparison" | "process" | "report") => Promise<void>;
  renderDeckHtml: () => Promise<void>;
  applyManualPageUpdate: (result: SaveManualPageRevisionResult | RestorePageSourceVersionResult) => void;
  exportFile: (type: "PPTX" | "PDF") => Promise<void>;
  downloadExportArtifact: () => Promise<void>;
  prepareWorkspaceDiagnosticBundle: () => Promise<void>;
  resetWorkspaceDiagnosticBundle: () => void;
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
  const [pageReviewSettings, setPageReviewSettings] = useState<PageReviewSettings>(
    DEFAULT_PAGE_REVIEW_SETTINGS
  );
  const [globalSettings, setGlobalSettings] = useState<WorkspaceSettings>({});
  const [researchSearchControlSettings, setResearchSearchControlSettingsState] =
    useState<ResearchSearchControlSettings>(DEFAULT_RESEARCH_SEARCH_CONTROL_SETTINGS);
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [presentationRequirements, setPresentationRequirements] =
    useState<PresentationRequirements>(() => createEmptyPresentationRequirements());
  const [requirementsStatus, setRequirementsStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const [requirementsError, setRequirementsError] = useState("");
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [requirementsConfirming, setRequirementsConfirming] = useState(false);
  const [requirementsDirty, setRequirementsDirty] = useState(false);
  const [requirementsHasSavedDraft, setRequirementsHasSavedDraft] = useState(false);
  const [deckTitle, setDeckTitle] = useState(t.deck.title);
  const [deck, setDeck] = useState<Slide[]>(initialDeck);
  const [outline, setOutline] = useState(outlineDetails);
  const [outlineDraft, setOutlineDraft] = useState(outlineDetails);
  const [outlineDraftTitle, setOutlineDraftTitle] = useState(t.deck.title);
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [outlineError, setOutlineError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const outlineDirty = useMemo(
    () => !outlinesEqual(
      { title: deckTitle, items: outline },
      { title: outlineDraftTitle, items: outlineDraft },
    ),
    [deckTitle, outline, outlineDraft, outlineDraftTitle],
  );
  useEffect(() => {
    const dirty = (stage === "requirements" && requirementsDirty) || (stage === "outline" && outlineDirty);
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [outlineDirty, requirementsDirty, stage]);
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
  const [confirmationDialog, setConfirmationDialog] =
    useState<ConfirmationDialogRequest | null>(null);
  const [activeGenerationRun, setActiveGenerationRun] =
    useState<ActiveGenerationRun | null>(null);
  const [generationPreparing, setGenerationPreparing] = useState(false);
  const [generationTransaction, setGenerationTransaction] =
    useState<GenerationRunTransaction | null>(null);
  const [generationUnresumable, setGenerationUnresumable] = useState(false);
  const [generationResumeAllowed, setGenerationResumeAllowed] = useState(true);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(
    () => createIdleExportProgress(t)
  );
  const [exportArtifact, setExportArtifact] = useState<ExportArtifact | null>(null);
  const [exportDownload, setExportDownload] = useState<ExportDownloadState>({
    status: "idle",
    message: "",
  });
  const [workspaceDiagnosticBundle, setWorkspaceDiagnosticBundle] =
    useState<WorkspaceDiagnosticBundleState>({
      status: "idle",
      message: "",
    });
  const workspaceDiagnosticBundleRequestRef = useRef(0);
  const exportInFlightRef = useRef(false);
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [hostUploadClient, setHostUploadClient] = useState<AppHostUploadClient | null>(null);
  const [aiClient, setAiClient] = useState<AiClient | null>(null);
  const [agentClient, setAgentClient] = useState<AgentClient | null>(null);
  const cancelCreateDeckRef = useRef(false);
  const cancelCreateDeckAbortRef = useRef<AbortController | null>(null);
  const generationOperationRef = useRef(0);
  const generationSignalOperationsRef = useRef(new WeakMap<AbortSignal, number>());
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const pendingUploadedSourceAnalysisActionRef = useRef<(() => Promise<void>) | null>(null);
  const forceUploadedSourceAnalysisRefreshRef = useRef(false);
  const requirementsOperationRef = useRef(0);
  const [workspaceScan, setWorkspaceScan] = useState<ListWorkspacesResult | null>(null);
  const [workspaceCovers, setWorkspaceCovers] = useState<Record<string, string | undefined>>({});
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceResult | null>(null);
  const currentWorkspaceRef = useRef<WorkspaceResult | null>(currentWorkspace);
  currentWorkspaceRef.current = currentWorkspace;
  const [uploadedSources, setUploadedSources] = useState<UploadedSourceMaterial[]>([]);
  const [currentUploadedSourceAnalysis, setCurrentUploadedSourceAnalysis] =
    useState<UploadedSourceAnalysis | null>(null);
  const [uploadedSourceAnalysisError, setUploadedSourceAnalysisError] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSettingsSaving, setWorkspaceSettingsSaving] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<TemplateSummary[]>([]);
  const [selectedVisualStylePresetId, setSelectedVisualStylePresetId] = useState<string | null>(null);
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

  function invalidateWorkspaceDiagnosticBundle() {
    workspaceDiagnosticBundleRequestRef.current += 1;
    setWorkspaceDiagnosticBundle({ status: "idle", message: "" });
  }

  useEffect(() => {
    invalidateWorkspaceDiagnosticBundle();
  }, [currentWorkspace?.workspace_id]);

  function getDefaultWorkspaceTitle(date = new Date()) {
    return formatMessage(t.library.defaultWorkspaceTitle, {
      date: formatWorkspaceDate(date)
    });
  }

  function buildAiLogContext(
    workspace: WorkspaceResult,
    domain: "requirements" | "outline" | "page_plan" | "page_agent" | "theme",
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
        core_message: typeof item.core_message === "string" ? item.core_message : "",
        required_content: typeof item.required_content === "string" ? item.required_content : "",
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
        core_message: page.speaker_note,
        required_content: page.speaker_note ? `- ${page.speaker_note}` : "- Page content",
      }))
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

  function workspaceOutlineForDownstream(workspace: WorkspaceResult): WorkspaceOutline {
    const outline = workspace.outline as WorkspaceOutline;
    const outputLanguage = workspace.requirements.selections.output_language ?? "中文";
    return {
      ...outline,
      output_language: outputLanguage,
      source: {
        prompt: workspace.requirements.source?.brief ?? "",
        context: [],
        setting: {
          ...workspaceSettingsToState(workspace),
          output_language: outputLanguage,
        },
      },
    };
  }

  function workspacePageReviewSettings(workspace: WorkspaceResult | null) {
    return readPageReviewSettings(workspaceSettingsToState(workspace));
  }

  function workspaceResearchSearchControlSettings(workspace: WorkspaceResult | null) {
    return readResearchSearchControlSettings(workspaceSettingsToState(workspace));
  }

  function applyWorkspaceSetting(setting: WorkspaceSettings) {
    setGlobalSettings(setting);
    setCurrentWorkspace((workspace) => workspace ? { ...workspace, setting } : workspace);
    setPageReviewSettings(readPageReviewSettings(setting));
    setResearchSearchControlSettingsState(readResearchSearchControlSettings(setting));
  }

  function workspaceContextRowsToState(workspace: WorkspaceResult): {
    rows: ContextRow[];
    shouldSync: boolean;
  } {
    void workspace;
    return { rows: [], shouldSync: false };
  }

  const workspaceReviewRenderKey = createWorkspaceReviewRenderKey;

  function setExportArtifactWithProgress(artifact: ExportArtifact | null) {
    setExportArtifact(artifact);
    setExportProgress(createArtifactExportProgress(t, artifact));
    setExportDownload(artifact
      ? {
          status: "idle",
          message: t.exportPage.downloadNotPrepared,
        }
      : { status: "idle", message: "" });
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

  function applyRenderedDeck(
    result: Awaited<ReturnType<PptBackend["renderDeckHtml"]>>,
    outlineItems?: WorkspaceOutlineItem[],
    options: { activateDeck?: boolean } = {},
  ) {
    setGenerated(true);
    setDeckTitle(result.title);
    setDeck(
      result.slides.map((slide, index) => ({
        title: outlineItems?.[index]?.title ?? slide.title,
        subtitle: ""
      }))
    );
    if (outlineItems) setOutline(cloneOutlineItems(outlineItems));
    setCurrentSlide(0);
    if (options.activateDeck !== false) setStage("deck");
  }

  function applyWorkspace(
    workspace: WorkspaceResult,
    options: { syncEmptyContextRows?: boolean; preserveCurrentSlide?: boolean } = {}
  ) {
    setCurrentWorkspace(workspace);
    setPresentationRequirements(workspace.requirements);
    setSelectedVisualStylePresetId(workspace.requirements.selections.visual_style_preset?.id ?? null);
    setRequirementsStatus(workspace.requirements.status === "empty" ? "idle" : "ready");
    setRequirementsError("");
    setRequirementsDirty(false);
    setRequirementsHasSavedDraft(workspace.requirements.status !== "empty");
    if (workspace.requirements.source?.brief) {
      setPrompt(workspace.requirements.source.brief);
    }
    setPageReviewSettings(workspacePageReviewSettings(workspace));
    setResearchSearchControlSettingsState(workspaceResearchSearchControlSettings(workspace));
    if (!exportInFlightRef.current) {
      setExportArtifactWithProgress(readWorkspaceExportArtifactPath(workspace));
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
    const workspaceOutline = workspaceOutlineToState(workspace.outline);
    const outlineRecord = workspace.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
      ? workspace.outline as Partial<WorkspaceOutline>
      : null;
    const outlineStatus = outlineRecord?.status ?? "empty";
    const outlineTitle = typeof outlineRecord?.title === "string" && outlineRecord.title.trim()
      ? outlineRecord.title
      : getWorkspaceTitle(workspace);
    setOutlineDraftTitle(outlineTitle);
    setOutlineError("");
    if (workspaceOutline.length === 0) {
      setOutline([]);
      setOutlineDraft([]);
    }
    const staleDeck = isWorkspaceDeckStale(workspace);
    const workspacePageProgress = normalizeWorkspacePageProgress(workspace.page_progress);
    const completedDeckAvailable = completedDeckIsAvailable(staleDeck, workspacePageProgress);
    setPageProgress(workspacePageProgress);
    setCreateDeckProgress(
      restoreDeckGenerationProgress({
        staleDeck,
        pageProgress: workspacePageProgress,
        locale,
        outline: outlineRecord?.status === "confirmed" ? outlineRecord as WorkspaceOutline : null,
      })
    );
    if (completedDeckAvailable) {
      setDeck(workspaceOutline.map((item) => ({ title: item.title, subtitle: "" })));
      setReviewRender({
        status: "loading",
        result: null,
        error: "",
        renderKey,
      });
    }
    if (completedDeckAvailable && backend) {
      void backend.getRenderedDeckHtml({ workspace_dir: workspace.workspace_dir })
        .then((result) => {
          applyRenderedDeck(result, workspaceOutline, { activateDeck: false });
          setReviewRender({
            status: "ready",
            result,
            error: "",
            renderKey: workspaceReviewRenderKey(workspace),
          });
        })
        .catch((error) => {
          setReviewRender({
            status: "error",
            result: null,
            error: error instanceof Error ? error.message : t.review.renderFailed,
            renderKey,
          });
        });
    }
    setGenerated(completedDeckAvailable);
    setCurrentSlide(0);
    if (staleDeck) {
      setStage("outline");
    }
    if (workspaceOutline.length > 0) {
      setOutline(workspaceOutline);
      setOutlineDraft(cloneOutlineItems(workspaceOutline));
      if (completedDeckAvailable) {
        setStage("deck");
      } else if (workspacePageProgress && !staleDeck) {
        setStage("generating");
      } else {
        setStage("outline");
      }
      if (outlineStatus === "draft") setStage("outline");
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
      if (workspaceOutline.length === 0) {
        setStage(
          workspace.requirements.status === "empty"
            ? "brief"
            : workspace.requirements.status === "draft"
              ? "requirements"
              : "outline"
        );
      }
    }

    const requirementsRecoveryStage = requirementsOwnedRecoveryStage(workspace.requirements);
    if (requirementsRecoveryStage) setStage(requirementsRecoveryStage);

    const persistedContextRows = workspaceContextRowsToState(workspace);
    if (persistedContextRows.shouldSync || options.syncEmptyContextRows) {
      setContextRows(persistedContextRows.rows);
    }
  }

  function applyCreatedWorkspace(
    result: Awaited<ReturnType<PptBackend["createWorkspace"]>>,
    options: { preserveWorkflowState?: boolean } = {},
  ): WorkspaceResult {
    const preserveWorkflowState = options.preserveWorkflowState === true;
    const workspace = createInitialWorkspaceSnapshot(result);
    setCurrentWorkspace(workspace);
    setUploadedSources([]);
    setCurrentUploadedSourceAnalysis(null);
    setUploadedSourceAnalysisError("");
    setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
    setSelectedStyleProfile(null);
    setPageReviewSettings(readPageReviewSettings(result.setting));
    setResearchSearchControlSettingsState(readResearchSearchControlSettings(result.setting));
    setExportArtifactWithProgress(null);
    setReviewRender({
      status: "idle",
      result: null,
      error: "",
      renderKey: createWorkspaceReviewRenderKey(workspace),
    });
    if (!preserveWorkflowState) setPrompt("");
    setContextRows([]);
    if (!preserveWorkflowState) {
      setPresentationRequirements(workspace.requirements);
      setRequirementsStatus("idle");
      setRequirementsError("");
    }
    setRequirementsSaving(false);
    setRequirementsDirty(false);
    setRequirementsHasSavedDraft(false);
    setDeckTitle(result.title);
    setDeck([]);
    setOutline([]);
    setOutlineDraft([]);
    setOutlineDraftTitle(result.title);
    setOutlineError("");
    setOutlineFeedback("");
    setGenerated(false);
    setCurrentSlide(0);
    setPageProgress(null);
    setCreateDeckProgress(null);
    setGenerationHistory([]);
    setActiveGenerationRun(null);
    setSelectedTemplateGroupId(DEFAULT_TEMPLATE_GROUP_ID);
    if (!preserveWorkflowState) setStage("brief");
    resetGenerationUiState();

    return workspace;
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
        const nextHostUploadClient = createAppHostUploadClient(runtime, {
          appendWorkspaceLog: (event) => nextBackend.appendWorkspaceLog({
            workspace_dir: event.workspace_dir,
            channel: "storage-transport",
            entry: event.entry,
          }),
        });
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
        setGlobalSettings(defaults.setting);
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

  function generationProgressHandler(signal: AbortSignal) {
    return createOperationScopedProgressHandler(
      signal,
      ownsGenerationOperation,
      recordGenerationProgress,
    );
  }

  function resetGenerationUiState() {
    setGenerationPreparing(false);
    setGenerationUnresumable(false);
    setGenerationResumeAllowed(true);
  }

  function beginCancellableGeneration() {
    cancelCreateDeckRef.current = false;
    cancelCreateDeckAbortRef.current?.abort();
    const controller = new AbortController();
    cancelCreateDeckAbortRef.current = controller;
    const operationId = generationOperationRef.current + 1;
    generationOperationRef.current = operationId;
    generationSignalOperationsRef.current.set(controller.signal, operationId);
    return controller.signal;
  }

  function ownsGenerationOperation(signal: AbortSignal) {
    return generationSignalOperationsRef.current.get(signal) === generationOperationRef.current;
  }

  function beginActiveGenerationRun(kind: ActiveGenerationRunKind, transaction: GenerationRunTransaction) {
    setGenerationUnresumable(false);
    setGenerationResumeAllowed(kind === "deck-generation");
    setActiveGenerationRun({
      kind,
      runId: transaction.run_id,
      officialWorkspaceDir: transaction.official_workspace_dir,
      shadowWorkspaceDir: transaction.shadow_workspace_dir,
      stopping: false,
      committing: false,
    });
    setGenerationTransaction(transaction);
  }

  async function prepareShadowGenerationRun(
    workspace: WorkspaceResult,
    kind: ActiveGenerationRunKind,
    originPageId?: string | null,
    onStarted?: (transaction: GenerationRunTransaction) => void,
  ) {
    if (!backend) throw new Error("PptBackend is not available.");
    const transaction = await backend.beginGenerationRun({
      workspace_dir: workspace.workspace_dir,
      run_kind: kind,
      origin_page_id: originPageId,
    });
    onStarted?.(transaction);
    beginActiveGenerationRun(kind, transaction);
    let prepared;
    try {
      prepared = await backend.prepareGenerationRun({ run_id: transaction.run_id });
    } catch (error) {
      await backend.abandonGenerationRun({ run_id: transaction.run_id }).catch(() => undefined);
      void backend.cleanupGenerationRun({ run_id: transaction.run_id }).catch((cleanupError) =>
        console.warn("Failed to clean incomplete shadow Workspace", cleanupError)
      );
      setGenerationTransaction(null);
      throw error;
    }
    if (prepared.transaction.state === "abandoned" || !prepared.workspace) {
      throw new Error("本次生成已停止。");
    }
    setGenerationPreparing(false);
    return { transaction: prepared.transaction, workspace: prepared.workspace };
  }

  function rebaseCompletion<T>(value: T, from: string, to: string): T {
    return JSON.parse(JSON.stringify(value).split(from).join(to)) as T;
  }

  async function commitShadowGenerationRun(transaction: GenerationRunTransaction) {
    if (!backend) throw new Error("PptBackend is not available.");
    setGenerationTransaction({ ...transaction, state: "committing" });
    setActiveGenerationRun((current) => current ? { ...current, committing: true } : current);
    try {
      return await backend.commitGenerationRun({ run_id: transaction.run_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await requestConfirmation({
        title: locale === "zh" ? "生成结果提交失败" : "Failed to commit generation result",
        body: locale === "zh"
          ? `${message}\n\n系统已恢复生成前版本。`
          : `${message}\n\nThe version from before generation has been restored.`,
        confirmLabel: locale === "zh" ? "知道了" : "Got it",
        tone: "warning",
      });
      const official = await backend.openWorkspace({ workspace_dir: transaction.official_workspace_dir });
      applyWorkspace(official, { preserveCurrentSlide: true });
      setGenerationTransaction(null);
      throw error;
    }
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
        preparing: generationPreparing,
        unresumable: generationUnresumable,
        resumeAllowed: generationResumeAllowed,
        hasAbandonableRun: generationTransaction?.state === "preparing" || generationTransaction?.state === "active",
      }),
    [activeGenerationRun, createDeckProgress, generationPreparing, generationResumeAllowed, generationTransaction, generationUnresumable, loading],
  );

  const currentStatus = useMemo(() => {
    if (loading === "template") return t.template.loading;
    if (loading === "requirements") return t.requirements.loadingTitle;
    if (loading === "theme") {
      return locale === "zh" ? "正在定制主题" : "Customizing theme";
    }
    if (loading === "uploadedSourceAnalysis") return t.status.analyzingUploadedSource;
    if (loading === "outline") return t.status.creatingOutline;
    if (generationViewState.status === "preparing") {
      return t.generating.preparingTitle;
    }
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

  function resolveConfirmation(confirmed: boolean) {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setConfirmationDialog(null);
    resolve?.(confirmed);
  }

  function requestConfirmation(request: Omit<ConfirmationDialogRequest, "closeLabel">) {
    confirmationResolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve;
      setConfirmationDialog({
        ...request,
        closeLabel: locale === "zh" ? "关闭" : "Close",
      });
    });
  }

  useEffect(() => () => {
    confirmationResolverRef.current?.(false);
    confirmationResolverRef.current = null;
  }, []);

  async function canLeaveCurrentEditor() {
    const dirty = (stage === "requirements" && requirementsDirty) || (stage === "outline" && outlineDirty);
    if (!dirty) return true;
    return requestConfirmation({
      title: locale === "zh" ? "放弃未保存的修改？" : "Discard unsaved changes?",
      body: locale === "zh"
        ? "当前页面有未保存修改。离开后，这些修改将不会保留。"
        : "This page has unsaved changes. They will not be kept after you leave.",
      cancelLabel: locale === "zh" ? "继续编辑" : "Keep editing",
      confirmLabel: locale === "zh" ? "放弃修改" : "Discard changes",
      tone: "danger",
    });
  }

  async function navigate(nextPage: PageId) {
    if (navigationBlockedByActiveGeneration(activeGenerationRun)) return;
    if (nextPage !== page && !await canLeaveCurrentEditor()) return;
    if (!generated && nextPage !== "main" && nextPage !== "my-work" && nextPage !== "settings") {
      showToast(t.toasts.createDeckFirst);
      return;
    }

    setPage(nextPage);
    setHistory((items) =>
      items.at(-1) === nextPage ? items : [...items, nextPage]
    );
    if (nextPage === "my-work") {
      await refreshMyWork();
    }
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

  async function openRefineSlide(index: unknown = currentSlide) {
    if (!generated) {
      showToast(t.toasts.createDeckFirst);
      return;
    }

    const targetIndex = resolveRefineSlideIndex(index, currentSlide, deck.length);
    setCurrentSlide(targetIndex);
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
      Boolean(reviewRender.result.slides[targetIndex]?.screenshot_upload);
    if (hasCurrentSlidePreview) return;

    const rendered = await loadDeckHtmlForWorkspace(currentWorkspace, "review");
    if (rendered) {
      setCurrentSlide(targetIndex);
    }
  }

  async function navigateMain(nextStage: MainStage) {
    if (navigationBlockedByActiveGeneration(activeGenerationRun)) return;
    if (nextStage !== stage && !await canLeaveCurrentEditor()) return;
    if (stage === "requirements" && requirementsStatus === "loading" && nextStage !== "requirements") {
      requirementsOperationRef.current += 1;
      setLoading("none");
    }
    if (nextStage === "requirements" && presentationRequirements.status === "empty") {
      showToast(t.toasts.promptRequired);
      return;
    }
    if (nextStage === "uploaded-source-analysis" && uploadedSources.length === 0) {
      setUploadedSourceAnalysisProgress(createSkippedUploadedSourceAnalysisProgress(t));
    }
    if (nextStage === "outline") {
      if (!confirmedRequirementsAllowOutline(currentWorkspace?.requirements)) {
        showToast(t.toasts.confirmRequirementsFirst);
        return;
      }
      if (outline.length === 0) {
        showToast(t.toasts.createOutlineFirst);
        return;
      }
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

  async function goBack() {
    if (navigationBlockedByActiveGeneration(activeGenerationRun)) return;
    if (!await canLeaveCurrentEditor()) return;
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

  async function generatePresentationRequirements(presetIdOverride?: string | null) {
    if (!backend || !aiClient) return;
    const brief = prompt.trim();
    if (!brief) {
      showToast(t.toasts.promptRequired);
      return;
    }

    const operation = requirementsOperationRef.current + 1;
    requirementsOperationRef.current = operation;
    setPage("main");
    setStage("requirements");
    setRequirementsStatus("loading");
    setRequirementsError("");
    setLoading("requirements");

    try {
      const workspace = await ensureCurrentWorkspace({ preserveWorkflowState: true });
      if (!workspace || requirementsOperationRef.current !== operation) return;
      setPrompt(brief);
      const selectedPreset = findVisualStylePreset(presetIdOverride === undefined ? selectedVisualStylePresetId : presetIdOverride);
      const candidates = await aiClient.generatePresentationRequirements({
        brief,
        visualStylePreset: toVisualStylePresetSelection(selectedPreset),
        logContext: buildAiLogContext(workspace, "requirements", "generate_requirements"),
      });
      if (requirementsOperationRef.current !== operation) return;
      const draftCandidates = selectedPreset ? { ...candidates, visual_tone: [] } : candidates;
      const draft = createRequirementsDraft(brief, draftCandidates, toVisualStylePresetSelection(selectedPreset));
      const updatedWorkspace = await backend.updateWorkspaceRequirements({
        workspace_dir: workspace.workspace_dir,
        requirements: draft,
      });
      if (requirementsOperationRef.current !== operation) return;
      setPresentationRequirements(updatedWorkspace.requirements);
      setCurrentWorkspace(updatedWorkspace);
      setRequirementsStatus("ready");
      setRequirementsDirty(false);
      setRequirementsHasSavedDraft(true);
      await backend.appendWorkspaceLog({
        workspace_dir: workspace.workspace_dir,
        channel: "ai-requirements",
        entry: {
          event: "ai.requirements.generated",
          status: "succeeded",
          candidate_counts: Object.fromEntries(
            Object.entries(candidates).map(([field, values]) => [field, values.length]),
          ),
          updated_at: updatedWorkspace.requirements.updated_at,
        },
      }).catch(() => undefined);
    } catch (error) {
      if (requirementsOperationRef.current !== operation) return;
      setRequirementsError(error instanceof Error ? error.message : String(error));
      setRequirementsStatus("error");
    } finally {
      if (requirementsOperationRef.current === operation) setLoading("none");
    }
  }

  async function selectVisualStylePreset(presetId: string | null) {
    const previousId = selectedVisualStylePresetId;
    if (previousId === presetId) return;
    const hasExistingRequirements = Boolean(presentationRequirements.source?.brief);
    if (hasExistingRequirements && typeof window !== "undefined") {
      const confirmed = await requestConfirmation({
        title: locale === "zh" ? "需要重新生成演示需求" : "Presentation requirements need to be regenerated",
        body: locale === "zh"
          ? "模板已变更，需要重新生成演示需求。是否现在重新生成？"
          : "The style preset changed. Regenerate presentation requirements now?",
        cancelLabel: locale === "zh" ? "暂不生成" : "Not now",
        confirmLabel: locale === "zh" ? "重新生成" : "Regenerate",
        tone: "warning",
      });
      if (!confirmed) return;
    }
    setSelectedVisualStylePresetId(presetId);
    if (hasExistingRequirements) {
      const brief = presentationRequirements.source?.brief ?? prompt;
      setPrompt(brief);
      window.setTimeout(() => void generatePresentationRequirements(presetId), 0);
    }
  }

  async function useManualPresentationRequirements() {
    const brief = presentationRequirements.source?.brief ?? prompt.trim();
    if (!brief) return;
    requirementsOperationRef.current += 1;
    const draft = createManualRequirementsDraft(brief);
    draft.selections.visual_style_preset = toVisualStylePresetSelection(findVisualStylePreset(selectedVisualStylePresetId));
    setPresentationRequirements(draft);
    setRequirementsStatus("ready");
    setRequirementsError("");
    setRequirementsDirty(false);
    setRequirementsHasSavedDraft(false);
  }

  function selectPresentationRequirement<K extends keyof PresentationRequirementsSelections>(
    field: K,
    value: PresentationRequirementsSelections[K],
  ) {
    setPresentationRequirements((current) => {
      const next: PresentationRequirements = {
        ...current,
        status: "draft",
        selections: { ...current.selections, [field]: value },
        updated_at: new Date().toISOString(),
        confirmed_at: null,
      };
      setRequirementsDirty(true);
      return next;
    });
  }

  async function returnToBriefFromRequirements() {
    if (requirementsDirty && !await canLeaveCurrentEditor()) return;
    requirementsOperationRef.current += 1;
    setLoading("none");
    setPage("main");
    setStage("brief");
  }

  async function savePresentationRequirements() {
    if (!backend || !currentWorkspace || !presentationRequirements.source) return;
    const draft: PresentationRequirements = {
      ...presentationRequirements,
      status: "draft",
      updated_at: new Date().toISOString(),
      confirmed_at: null,
    };
    setRequirementsSaving(true);
    try {
      const workspace = await backend.updateWorkspaceRequirements({
        workspace_dir: currentWorkspace.workspace_dir,
        requirements: draft,
      });
      setPresentationRequirements(workspace.requirements);
      setCurrentWorkspace(workspace);
      setRequirementsDirty(false);
      setRequirementsHasSavedDraft(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRequirementsSaving(false);
    }
  }

  async function confirmPresentationRequirements() {
    if (!backend || !requirementsAreComplete(presentationRequirements)) return;
    const confirmed: PresentationRequirements = {
      ...presentationRequirements,
      status: "confirmed",
      updated_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    };
    setRequirementsConfirming(true);
    try {
      const workspace = currentWorkspace ?? await ensureCurrentWorkspace();
      if (!workspace) return;
      const preset = findVisualStylePreset(confirmed.selections.visual_style_preset?.id);
      let hostUpload;
      if (preset) {
        if (!hostUploadClient) throw new Error("Host Upload is required for a selected Visual Style Preset");
        const file = new File([preset.style_guide], "style-guide.md", { type: "text/markdown" });
        hostUpload = await hostUploadClient.uploadFile(file, {
          purpose: "user_artifact",
          filename: "style-guide.md",
          mimeType: "text/markdown",
          metadata: { workspace_dir: workspace.workspace_dir, artifact: "visual-style-preset-style-guide" },
        });
      }
      const result = await backend.confirmWorkspaceRequirements({
        workspace_dir: workspace.workspace_dir,
        requirements: confirmed,
        ...(hostUpload ? { size_bytes: hostUpload.size_bytes, host_upload: hostUpload } : {}),
        clear_style_guide: !preset && Boolean(workspace.requirements.selections.visual_style_preset),
      });
      const resetWorkspace = result.workspace;
      setPresentationRequirements(confirmed);
      setSelectedVisualStylePresetId(confirmed.selections.visual_style_preset?.id ?? null);
      setCurrentWorkspace(resetWorkspace);
      setRequirementsStatus("ready");
      setRequirementsDirty(false);
      setRequirementsHasSavedDraft(true);
      setDeckTitle(getWorkspaceTitle(resetWorkspace));
      setOutline([]);
      setOutlineDraft([]);
      setOutlineDraftTitle(getWorkspaceTitle(resetWorkspace));
      setOutlineError("");
      setPage("main");
      setStage("outline");
      await createOutlineFromConfirmedRequirements(resetWorkspace);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRequirementsConfirming(false);
    }
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
    applyRenderedDeck(completion.result.rendered, completion.result.outline.items);
    setReviewRender({
      status: "ready",
      result: completion.result.rendered,
      error: "",
      renderKey: workspaceReviewRenderKey(refreshedWorkspace),
    });
    setPage("main");
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
  }

  async function createOutlineFromConfirmedRequirements(
    workspaceOverride: WorkspaceResult | null = null,
  ) {
    if (!backend || !aiClient) return;
    let workspace: WorkspaceResult | null = workspaceOverride;
    setPage("main");
    setStage("outline");
    setLoading("outline");
    setOutlineError("");
    try {
      workspace = workspace ?? await refreshCurrentWorkspaceSnapshot();
      if (!workspace) return;
      if (workspace.requirements.status !== "confirmed") {
        throw new Error("请先确认演示需求，再创建大纲。");
      }
      setStage("outline");
      setLoading("outline");
      const outlineLogContext = buildAiLogContext(workspace, "outline", "generate_outline");
      const result = await aiClient.generateOutline({
        requirements: workspace.requirements,
        logContext: outlineLogContext,
      });
      await appendOutlineAiAttemptLogs(workspace, result.attempts, outlineLogContext);
      const normalized = normalizeValidOutline({
        title: result.outline.title,
        items: result.outline.items,
      });
      const updatedWorkspace = await backend.saveWorkspaceOutlineDraft({
        workspace_dir: workspace.workspace_dir,
        outline: normalized,
      });
      applyWorkspace(updatedWorkspace);
      setDeckTitle(normalized.title);
      setOutline(cloneOutlineItems(normalized.items));
      setOutlineDraft(cloneOutlineItems(normalized.items));
      setOutlineDraftTitle(normalized.title);
      setOutlineFeedback("");
      setOutlineError("");
      setStage("outline");
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.status.outlineReady);
    } catch (error) {
      await appendOutlineErrorLog(workspace, "generateOutline", error);
      const message = error instanceof Error ? error.message : t.toasts.createOutlineFirst;
      setOutlineError(message);
    } finally {
      setLoading("none");
    }
  }

  async function generateDeck() {
    await createOutlineFromConfirmedRequirements();
  }

  async function cancelGenerateDeck() {
    const targetRun = activeGenerationRun ?? (generationTransaction ? {
      kind: generationTransaction.run_kind,
      runId: generationTransaction.run_id,
      officialWorkspaceDir: generationTransaction.official_workspace_dir,
      shadowWorkspaceDir: generationTransaction.shadow_workspace_dir,
      stopping: false,
      committing: false,
    } : null);
    if (!backend || !targetRun) return;
    const isGeneration = targetRun.kind === "deck-generation";
    const confirmed = await requestConfirmation({
      title: isGeneration
        ? (locale === "zh" ? "停止生成？" : "Stop generation?")
        : (locale === "zh" ? "停止优化？" : "Stop refinement?"),
      body: isGeneration
        ? (locale === "zh"
            ? "停止后，本次生成的所有内容都不会保留，并返回生成前的大纲。"
            : "All content from this run will be discarded, and the Outline from before generation will be restored.")
        : (locale === "zh"
            ? "停止后，本次优化的所有内容都不会保留，并恢复优化前的演示文稿。"
            : "All changes from this refinement will be discarded, and the presentation from before refinement will be restored."),
      cancelLabel: isGeneration
        ? (locale === "zh" ? "继续生成" : "Continue generation")
        : (locale === "zh" ? "继续优化" : "Continue refinement"),
      confirmLabel: locale === "zh" ? "停止并放弃" : "Stop and discard",
      tone: "danger",
    });
    if (!confirmed) return;
    // Invalidate the old operation before any awaited backend work. The agent may
    // still emit a final progress frame while the run is being abandoned.
    generationOperationRef.current += 1;
    cancelCreateDeckRef.current = true;
    cancelCreateDeckAbortRef.current?.abort();
    setActiveGenerationRun((current) => current ? { ...current, stopping: true } : current);
    try {
      await backend.abandonGenerationRun({ run_id: targetRun.runId });
      if (agentClient) {
        let cancellationTimedOut = false;
        let cancellationTimeoutId: number | undefined;
        await Promise.race([
          agentClient.cancelActiveRuns().catch((error) => {
            console.warn("Failed to cancel active Agent Session runs", error);
          }),
          new Promise<void>((resolve) => {
            cancellationTimeoutId = window.setTimeout(() => {
              cancellationTimedOut = true;
              resolve();
            }, AGENT_CANCELLATION_WAIT_MS);
          }),
        ]);
        if (cancellationTimeoutId !== undefined) {
          window.clearTimeout(cancellationTimeoutId);
        }
        if (cancellationTimedOut) {
          console.warn("Timed out waiting for active Agent Session cancellation");
        }
      }
      const official = await backend.openWorkspace({ workspace_dir: targetRun.officialWorkspaceDir });
      applyWorkspace(official);
      setGenerationPreparing(false);
      setActiveGenerationRun(null);
      setGenerationTransaction(null);
      setLoading("none");
      setPage("main");
      setStage(isGeneration ? "outline" : "deck");
      showToast(isGeneration ? "已停止，本次生成未保留。" : "已停止，本次优化未保留。");
    } catch (error) {
      setActiveGenerationRun((current) => current ? { ...current, stopping: false } : current);
      showToast(error instanceof Error ? error.message : "停止失败，请重试。");
    }
  }

  async function createDeckFromOutline() {
    if (!backend || !aiClient || !hostUploadClient) return;
    if (!agentClient) {
      if (uploadedSources.length > 0) {
        showToast(t.errors.uploadedSourceAnalysisUnavailable);
      }
      return;
    }

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    let outlineConfirmed = false;
    let generationRun: GenerationRunTransaction | null = null;
    const cancelSignal = beginCancellableGeneration();
    resetGenerationProgress();
    try {
      const normalized = normalizeValidOutline({
        title: outlineDraftTitle,
        items: outlineDraft,
      });
      setLoading("deck");
      setCreateDeckProgress({
        step: "prepare",
        message: t.generating.confirmingOutline,
        currentPageIndex: null,
        totalPages: normalized.items.length,
        pages: [],
      });
      setGenerationPreparing(true);
      setStage("generating");
      setPage("main");

      const workspace = await refreshCurrentWorkspaceSnapshot();
      if (!workspace) {
        setStage("outline");
        return;
      }
      if (!confirmedRequirementsAllowOutline(workspace.requirements)) {
        showToast(t.toasts.confirmRequirementsFirst);
        setPage("main");
        setStage("requirements");
        return;
      }
      const draftWorkspace = await backend.saveWorkspaceOutlineDraft({
        workspace_dir: workspace.workspace_dir,
        outline: normalized,
      });
      setCurrentWorkspace(draftWorkspace);
      const shadowRun = await prepareShadowGenerationRun(draftWorkspace, "deck-generation", null, (transaction) => { generationRun = transaction; });
      generationRun = shadowRun.transaction;
      const confirmedWorkspace = await backend.confirmWorkspaceOutline({
        workspace_dir: shadowRun.workspace.workspace_dir,
        outline: normalized,
      });
      outlineConfirmed = true;
      setDeckTitle(normalized.title);
      setOutline(cloneOutlineItems(normalized.items));
      setOutlineDraft(cloneOutlineItems(normalized.items));
      setOutlineDraftTitle(normalized.title);
      activeRunWorkspaceDir = confirmedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;

      const completion = await runDeckGeneration({
        backend,
        aiClient,
        agentClient,
        hostUploadClient,
        aiLogger,
        workspace: confirmedWorkspace,
        confirmedOutline: workspaceOutlineForDownstream(confirmedWorkspace),
        locale,
        startMode: "new",
        onProgress: generationProgressHandler(cancelSignal),
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      if (!ownsGenerationOperation(cancelSignal)) return;
      if (completion.status === "completed") {
        const committed = await commitShadowGenerationRun(generationRun);
        setGenerationTransaction(null);
        const rebasedCompletion = rebaseCompletion(
          completion,
          generationRun.shadow_workspace_dir,
          generationRun.official_workspace_dir,
        );
        await applyDeckGenerationCompletion(rebasedCompletion, committed.workspace);
      } else if (!cancelCreateDeckRef.current) {
        await applyDeckGenerationCompletion(completion, confirmedWorkspace);
      }
      shouldReconcileActiveRun = false;
    } catch (error) {
      if (!ownsGenerationOperation(cancelSignal)) return;
      setGenerationPreparing(false);
      if (!outlineConfirmed) {
        setStage("outline");
        setPage("main");
      }
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      if (ownsGenerationOperation(cancelSignal)) {
        setGenerationPreparing(false);
        setLoading("none");
        await finishActiveGenerationRun({
          workspaceDir: activeRunWorkspaceDir,
          reconcileInterrupted: shouldReconcileActiveRun && !generationRun,
        });
      }
      if (generationRun) {
        void backend.cleanupGenerationRun({ run_id: generationRun.run_id }).catch((error) =>
          console.warn("Failed to clean generation run", error)
        );
      }
    }
  }

  async function applyOutlineFeedback() {
    if (!backend || !aiClient) return;
    if (!outlineFeedback.trim()) return;
    setLoading("outline");
    let workspace: WorkspaceResult | null = null;
    try {
      workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      if (workspace.requirements.status !== "confirmed") {
        throw new Error("请先确认演示需求，再改写大纲。");
      }
      setLoading("outline");
      const outlineLogContext = buildAiLogContext(workspace, "outline", "revise_outline");
      const result = await aiClient.reviseOutline({
        title: outlineDraftTitle,
        outline: outlineDraft,
        feedback: outlineFeedback,
        requirements: workspace.requirements,
        logContext: outlineLogContext,
      });
      await appendOutlineAiAttemptLogs(workspace, result.attempts, outlineLogContext);
      const normalized = normalizeValidOutline({
        title: result.outline.title,
        items: result.outline.items,
      });
      const updatedWorkspace = await backend.saveWorkspaceOutlineDraft({
        workspace_dir: workspace.workspace_dir,
        outline: normalized,
      });
      setCurrentWorkspace(updatedWorkspace);
      setDeckTitle(normalized.title);
      setOutline(cloneOutlineItems(normalized.items));
      setOutlineDraft(cloneOutlineItems(normalized.items));
      setOutlineDraftTitle(normalized.title);
      setOutlineFeedback("");
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.toasts.outlineUpdated);
    } catch (error) {
      await appendOutlineErrorLog(workspace, "reviseOutline", error);
      showToast(error instanceof Error ? error.message : t.toasts.createOutlineFirst);
    } finally {
      setLoading("none");
    }
  }

  async function saveOutlineDraft() {
    if (!backend) return;
    setOutlineSaving(true);
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      if (!confirmedRequirementsAllowOutline(workspace.requirements)) {
        setOutlineDraft(cloneOutlineItems(outline));
        setOutlineDraftTitle(deckTitle);
        setOutlineFeedback("");
        showToast(t.toasts.confirmRequirementsFirst);
        setPage("main");
        setStage("requirements");
        return;
      }
      setLoading("outline");
      const normalized = normalizeValidOutline({ title: outlineDraftTitle, items: outlineDraft });
      const updatedWorkspace = await backend.saveWorkspaceOutlineDraft({
        workspace_dir: workspace.workspace_dir,
        outline: normalized,
      });
      setCurrentWorkspace(updatedWorkspace);
      setDeckTitle(normalized.title);
      setOutline(cloneOutlineItems(normalized.items));
      setOutlineDraft(cloneOutlineItems(normalized.items));
      setOutlineDraftTitle(normalized.title);
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.toasts.outlineUpdated);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createOutlineFirst);
    } finally {
      setLoading("none");
      setOutlineSaving(false);
    }
  }

  function updateOutlineDraftItem(index: number, patch: Partial<WorkspaceOutlineItem>) {
    setOutlineDraft((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function addOutlineDraftItem() {
    setOutlineDraft((items) => [...items, createEmptyOutlineItem()]);
  }

  function insertOutlineDraftItem(index: number, item: OutlineDetail) {
    setOutlineDraft((items) => [
      ...items.slice(0, index),
      { ...item },
      ...items.slice(index),
    ]);
  }

  function deleteOutlineDraftItem(index: number) {
    setOutlineDraft((items) => items.length <= 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveOutlineDraftItem(fromIndex: number, toIndex: number) {
    setOutlineDraft((items) => {
      if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return items;
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function retryOutlineCreation() {
    await createOutlineFromConfirmedRequirements();
  }

  function returnToRequirementsFromOutline() {
    if (!confirmedRequirementsAllowOutline(currentWorkspace?.requirements)) {
      setOutlineDraft(cloneOutlineItems(outline));
      setOutlineDraftTitle(deckTitle);
      setOutlineFeedback("");
      setPage("main");
      setStage("requirements");
      return;
    }
    navigateMain("requirements");
  }

  function updateDeckTitle(index: number, title: string) {
    setDeck((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
    setOutline((items) => {
      return items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      );
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
        core_message: slide.speaker_note,
        required_content: slide.speaker_note ? `- ${slide.speaker_note}` : "- Page content",
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
      return [...items, {
        title,
        core_message: subtitle,
        required_content: `- ${subtitle}`,
      }];
    });
  }

  function openLocalProject(projectName: string) {
    const nextDeck = createLocalProjectDeck(projectName);
    setDeckTitle(projectName);
    setDeck(nextDeck);
    setOutline(
      nextDeck.map((slide) => ({
        title: slide.title,
        core_message: slide.subtitle,
        required_content: `- ${slide.subtitle}`,
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

  function readWorkspaceExportArtifactPath(workspace: WorkspaceResult): ExportArtifact | null {
    if (!workspace.task || typeof workspace.task !== "object" || Array.isArray(workspace.task)) {
      return null;
    }

    const task = workspace.task as {
      artifacts?: {
        pptx?: {
          path?: unknown;
          updated_at?: unknown;
          mirror?: unknown;
        };
        pdf?: { path?: unknown; updated_at?: unknown; mirror?: unknown };
      };
    };
    const pptx = task.artifacts?.pptx;
    const pdf = task.artifacts?.pdf;
    const candidates = [
      {
        type: "PPTX" as const,
        path: typeof pptx?.path === "string" ? pptx.path : "",
        updatedAt: typeof pptx?.updated_at === "string" ? pptx.updated_at : "",
        mirror: pptx?.mirror,
      },
      {
        type: "PDF" as const,
        path: typeof pdf?.path === "string" ? pdf.path : "",
        updatedAt: typeof pdf?.updated_at === "string" ? pdf.updated_at : "",
        mirror: pdf?.mirror,
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

    const mirror = latest.mirror && typeof latest.mirror === "object" && !Array.isArray(latest.mirror)
      ? latest.mirror as {
          provider?: unknown;
          scope?: unknown;
          content_disposition?: unknown;
          source_updated_at?: unknown;
        }
      : null;
    const mirrorStatus = !mirror ||
      mirror.provider !== "aps.files" ||
      mirror.scope !== "user" ||
      typeof mirror.content_disposition !== "string" ||
      !/^attachment(?:;|$)/i.test(mirror.content_disposition)
      ? "missing"
      : mirror.source_updated_at === latest.updatedAt
        ? "ready"
        : "stale";

    return {
      type: latest.type,
      path: latest.path,
      updatedAt: latest.updatedAt,
      mirrorStatus,
    };
  }

  function formatExportDownloadError(error: unknown) {
    const detail = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
    const fallback = locale === "zh"
      ? "导出文件下载准备失败。"
      : "Failed to prepare the export download.";
    if (!detail) return fallback;
    return locale === "zh"
      ? `导出文件下载准备失败：${detail}`
      : `Failed to prepare the export download: ${detail}`;
  }

  function artifactFromPublishedResult(result: Awaited<ReturnType<PptBackend["publishExportArtifact"]>>): ExportArtifact {
    return {
      type: result.artifact.artifact_type === "pptx" ? "PPTX" : "PDF",
      path: result.artifact.path,
      fileName: result.artifact.filename,
      updatedAt: result.artifact.updated_at,
      mirrorStatus: "ready",
    };
  }

  async function publishExportArtifact(workspace: WorkspaceResult, artifact: ExportArtifact): Promise<ExportArtifact> {
    if (!backend) {
      throw new Error("PptBackend is not available.");
    }
    const result = await backend.publishExportArtifact({
      workspace_dir: workspace.workspace_dir,
      artifact_type: artifact.type.toLowerCase() as "pptx" | "pdf",
    });
    const published = artifactFromPublishedResult(result);
    setExportArtifact(published);
    return published;
  }

  async function ensureCurrentWorkspace(
    options: { preserveWorkflowState?: boolean } = {},
  ) {
    if (!backend) return null;
    if (currentWorkspace) return currentWorkspace;

    const created = await backend.createWorkspace({
      title: getDefaultWorkspaceTitle()
    });
    const workspace = applyCreatedWorkspace(created, options);
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
      brief?: string;
    } = {},
  ) {
    if (!backend || !aiClient) return workspace;
    setLoading("theme");
    const result = await generateWorkspaceThemeToken({
      backend,
      aiClient,
      aiLogger,
      workspace,
      prompt: options.brief ?? prompt,
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

  async function refreshMyWork() {
    if (!backend) return;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const scan = await backend.listWorkspaces();
      setWorkspaceScan(scan);
      const completed = (scan.tasks ?? scan.workspaces ?? []).filter((item) => item.has_deck_html);
      const coverEntries = await Promise.all(completed.map(async (item) => {
        try {
          const rendered = await backend.getRenderedDeckHtml({
            workspace_dir: item.task_dir ?? item.workspace_dir,
          });
          return [item.workspace_id, rendered.slides[0]?.screenshot_upload?.url] as const;
        } catch {
          return [item.workspace_id, undefined] as const;
        }
      }));
      setWorkspaceCovers(Object.fromEntries(coverEntries));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to load projects.");
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
    requirementsOperationRef.current += 1;
    resetGenerationUiState();
    invalidateWorkspaceDiagnosticBundle();
    setCurrentWorkspace(null);
    setPage("main");
    setStage("brief");
    setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
    await scanWorkspaces();
  }

  async function startNewPresentation() {
    requirementsOperationRef.current += 1;
    resetGenerationUiState();
    invalidateWorkspaceDiagnosticBundle();
    setCurrentWorkspace(null);
    setPrompt("");
    setPresentationRequirements(createEmptyPresentationRequirements());
    setRequirementsStatus("idle");
    setRequirementsError("");
    setRequirementsDirty(false);
    setRequirementsHasSavedDraft(false);
    setSelectedVisualStylePresetId(null);
    setDeckTitle(t.deck.title);
    setDeck([]);
    setOutline([]);
    setOutlineDraft([]);
    setOutlineDraftTitle(t.deck.title);
    setOutlineError("");
    setOutlineFeedback("");
    setGenerated(false);
    setCurrentSlide(0);
    setPageProgress(null);
    setCreateDeckProgress(null);
    setGenerationHistory([]);
    setActiveGenerationRun(null);
    setStage("brief");
    setPage("main");
    setHistory(["main"]);
    await scanWorkspaces();
  }

  async function openWorkspace(workspaceDir: string) {
    if (!backend) return;

    requirementsOperationRef.current += 1;
    resetGenerationUiState();
    invalidateWorkspaceDiagnosticBundle();
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const openedWorkspace = await backend.openWorkspace({
        workspace_dir: workspaceDir
      });
      const workspace = await reconcileWorkspaceInterruptedPages(openedWorkspace);
      applyWorkspace(workspace, { syncEmptyContextRows: true });
      const transaction = await backend.getWorkspaceGenerationRun({ workspace_dir: workspace.workspace_dir });
      if (transaction?.state === "active" || transaction?.state === "preparing") {
        setGenerationTransaction(transaction);
        if (transaction.state === "active") {
          const shadowWorkspace = await backend.openWorkspace({ workspace_dir: transaction.shadow_workspace_dir });
          applyWorkspace(shadowWorkspace, { preserveCurrentSlide: true });
          setCurrentWorkspace(workspace);
        }
        setStage("generating");
        setPage("main");
      }
      setPage("main");
      setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
      showToast(formatMessage(t.toasts.workspaceOpened, { id: workspace.task_id ?? workspace.workspace_id }));
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
    invalidateWorkspaceDiagnosticBundle();
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const created = await backend.createWorkspace({
        title: getDefaultWorkspaceTitle()
      });
      const workspace = applyCreatedWorkspace(created);
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
    if (!backend) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const result = await backend.patchWorkspaceDefaults({ setting });
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

  async function setStrictReviewMode(enabled: boolean) {
    if (!backend) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const nextReviewSettings: PageReviewSettings = {
        ...pageReviewSettings,
        visualReviewEnabled: enabled,
      };
      const result = await backend.patchWorkspaceDefaults({
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

    const previousSettings = researchSearchControlSettings;
    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    setResearchSearchControlSettingsState(settings);
    try {
      const result = await backend.patchWorkspaceDefaults({
        setting: researchSearchControlSettingsToWorkspaceSettings(settings),
      });
      applyWorkspaceSetting(result.setting);
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
      setResearchSearchControlSettingsState(previousSettings);
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

  async function renameWorkspace(workspaceDir: string, title: string) {
    if (!backend) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.updateWorkspaceTitle({ workspace_dir: workspaceDir, title: trimmedTitle });
      if (currentWorkspaceRef.current?.workspace_dir === workspaceDir) {
        applyWorkspace(workspace);
        setDeckTitle(trimmedTitle);
      }
      await refreshMyWork();
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to rename project.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function deleteWorkspace(workspaceDir: string) {
    if (!backend) return;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      await backend.deleteWorkspace({ workspace_dir: workspaceDir });
      if (currentWorkspaceRef.current?.workspace_dir === workspaceDir) {
        await startNewPresentation();
      } else {
        await refreshMyWork();
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function refineDeck(instruction: string) {
    if (!backend || !aiClient || !agentClient) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    let generationRun: GenerationRunTransaction | null = null;
    const cancelSignal = beginCancellableGeneration();
    setLoading("refineDeck");
    resetGenerationProgress();
    try {
      const refreshedWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!refreshedWorkspace) return;
      const shadowRun = await prepareShadowGenerationRun(refreshedWorkspace, "deck-refinement", workspaceOutlineForDownstream(refreshedWorkspace).items[currentSlide]?.page_id, (transaction) => { generationRun = transaction; });
      generationRun = shadowRun.transaction;
      activeRunWorkspaceDir = shadowRun.workspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        hostUploadClient,
        aiLogger,
        workspace: shadowRun.workspace,
        confirmedOutline: workspaceOutlineForDownstream(shadowRun.workspace),
        locale,
        instruction: trimmedInstruction,
        scope: "deck",
        onProgress: generationProgressHandler(cancelSignal),
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      if (!ownsGenerationOperation(cancelSignal)) return;
      if (completion.status === "completed" && completion.noChange) {
        await backend.abandonGenerationRun({ run_id: generationRun.run_id });
        setGenerationTransaction(null);
        const official = await backend.openWorkspace({ workspace_dir: generationRun.official_workspace_dir });
        applyWorkspace(official, { preserveCurrentSlide: true });
        showToast("当前内容无需优化。");
      } else if (completion.status === "completed") {
        const committed = await commitShadowGenerationRun(generationRun);
        setGenerationTransaction(null);
        await applyDeckGenerationCompletion(rebaseCompletion(completion, generationRun.shadow_workspace_dir, generationRun.official_workspace_dir), committed.workspace);
      } else if (!cancelCreateDeckRef.current) {
        await applyDeckGenerationCompletion(completion, shadowRun.workspace, { resumeAllowedOnRecoverableStop: true });
      }
      shouldReconcileActiveRun = false;
      if (completion.status === "completed") {
        showToast(t.status.deckRefined);
      }
    } catch (error) {
      if (!ownsGenerationOperation(cancelSignal)) return;
      showToast(error instanceof Error ? error.message : t.status.refiningDeck);
    } finally {
      if (ownsGenerationOperation(cancelSignal)) {
        setLoading("none");
        await finishActiveGenerationRun({
          workspaceDir: activeRunWorkspaceDir,
          reconcileInterrupted: shouldReconcileActiveRun && !generationRun,
        });
      }
      if (generationRun) void backend.cleanupGenerationRun({ run_id: generationRun.run_id }).catch((error) => console.warn("Failed to clean generation run", error));
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
    let generationRun: GenerationRunTransaction | null = null;
    const cancelSignal = beginCancellableGeneration();
    setLoading("refineSlide");
    resetGenerationProgress();
    try {
      const refreshedWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!refreshedWorkspace) return;
      const originPageId = workspaceOutlineForDownstream(refreshedWorkspace).items[currentSlide]?.page_id;
      const shadowRun = await prepareShadowGenerationRun(refreshedWorkspace, "page-refinement", originPageId, (transaction) => { generationRun = transaction; });
      generationRun = shadowRun.transaction;
      activeRunWorkspaceDir = shadowRun.workspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        hostUploadClient,
        aiLogger,
        workspace: shadowRun.workspace,
        confirmedOutline: workspaceOutlineForDownstream(shadowRun.workspace),
        locale,
        instruction: trimmedInstruction,
        scope: "slide",
        pageId: originPageId,
        onProgress: generationProgressHandler(cancelSignal),
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      if (!ownsGenerationOperation(cancelSignal)) return;
      if (completion.status === "completed") {
        const committed = await commitShadowGenerationRun(generationRun);
        setGenerationTransaction(null);
        await applyDeckGenerationCompletion(rebaseCompletion(completion, generationRun.shadow_workspace_dir, generationRun.official_workspace_dir), committed.workspace);
      } else if (!cancelCreateDeckRef.current) {
        await applyDeckGenerationCompletion(completion, shadowRun.workspace, { resumeAllowedOnRecoverableStop: true });
      }
      shouldReconcileActiveRun = false;
      setCurrentSlide(currentSlide);
      if (completion.status === "completed") {
        showToast(t.status.slideRefined);
      }
    } catch (error) {
      if (!ownsGenerationOperation(cancelSignal)) return;
      showToast(error instanceof Error ? error.message : t.status.refiningSlide);
    } finally {
      if (ownsGenerationOperation(cancelSignal)) {
        setLoading("none");
        await finishActiveGenerationRun({
          workspaceDir: activeRunWorkspaceDir,
          reconcileInterrupted: shouldReconcileActiveRun && !generationRun,
        });
      }
      if (generationRun) void backend.cleanupGenerationRun({ run_id: generationRun.run_id }).catch((error) => console.warn("Failed to clean generation run", error));
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

  function applyManualPageUpdate(
    result: SaveManualPageRevisionResult | RestorePageSourceVersionResult,
  ) {
    const htmlPath = "manifest" in result
      ? result.manifest.current_html_path
      : result.html_path;
    const screenshotPath = "manifest" in result
      ? result.manifest.screenshot_path
      : result.screenshot_path;
    const manuallyEdited = "manifest" in result;
    const patchProgress = (current: PageProgress | null): PageProgress | null => {
      if (!current) return current;
      const existingFinalRender = current.final_deck_render;
      return {
        ...current,
        final_deck_render: result.final_deck_render_updated
          ? {
              status: "completed",
              message: null,
              error: null,
              output_dir: existingFinalRender?.output_dir ?? null,
              deck_html_path: result.deck_html_path,
              rendered_at: result.rendered_at,
              updated_at: result.page_progress_updated_at,
            }
          : {
              status: "idle",
              message: "Manual page saved; Final Deck Render requires a rebuild.",
              error: null,
              output_dir: null,
              deck_html_path: null,
              rendered_at: null,
              updated_at: result.page_progress_updated_at,
            },
        pages: current.pages.map((page) => page.page_id === result.page_id ? {
          ...page,
          last_html_path: htmlPath,
          last_screenshot_path: screenshotPath,
          updated_at: result.page_progress_updated_at,
        } : page),
        updated_at: result.page_progress_updated_at,
      };
    };
    const nextPageProgress = patchProgress(pageProgress);
    setPageProgress(nextPageProgress);
    setReviewRender((current) => ({
      ...current,
      result: current.result ? {
        ...current.result,
        deck_html_path: result.deck_html_path ?? current.result.deck_html_path,
        rendered_at: result.rendered_at ?? current.result.rendered_at,
        slides: current.result.slides.map((slide) => slide.slide_id === result.page_id ? {
          ...slide,
          html_path: htmlPath,
          screenshot_path: screenshotPath,
          screenshot_upload: result.screenshot_upload,
          manually_edited: manuallyEdited,
        } : slide),
      } : null,
    }));
    if (currentWorkspace && nextPageProgress) {
      const task = currentWorkspace.task && typeof currentWorkspace.task === "object" && !Array.isArray(currentWorkspace.task)
        ? currentWorkspace.task as Record<string, unknown>
        : {};
      const artifacts = task.artifacts && typeof task.artifacts === "object" && !Array.isArray(task.artifacts)
        ? { ...task.artifacts as Record<string, unknown> }
        : {};
      delete artifacts.pptx;
      delete artifacts.pdf;
      const nextWorkspace: WorkspaceResult = {
        ...currentWorkspace,
        task: { ...task, artifacts, updated_at: result.page_progress_updated_at },
        page_progress: nextPageProgress,
      };
      setCurrentWorkspace(nextWorkspace);
      setReviewRender((current) => ({
        ...current,
        renderKey: workspaceReviewRenderKey(nextWorkspace),
      }));
    }
    setExportArtifactWithProgress(null);
    setExportDownload({ status: "idle", message: "" });
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
    if (!backend || !aiClient || !agentClient || !hostUploadClient) return;
    if (loading === "deck" || loading === "deckFromOutline") return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    let generationRun: GenerationRunTransaction | null = null;
    const cancelSignal = beginCancellableGeneration();
    setLoading("deckFromOutline");
    try {
      const workspace = await refreshCurrentWorkspaceSnapshot();
      if (!workspace) return;
      generationRun = await backend.getWorkspaceGenerationRun({ workspace_dir: workspace.workspace_dir });
      const runWorkspace = generationRun
        ? await backend.openWorkspace({ workspace_dir: generationRun.shadow_workspace_dir })
        : workspace;
      const refreshedWorkspace = await reconcileWorkspaceInterruptedPages(runWorkspace);
      activeRunWorkspaceDir = refreshedWorkspace.workspace_dir;
      shouldReconcileActiveRun = true;
      setStage("generating");
      setPage("main");
      const recoveryProgress = await backend.getPageProgress({ workspace_dir: refreshedWorkspace.workspace_dir });
      const recoveryKind = recoveryProgress.recovery?.run_kind;
      const isRefinementResume = recoveryKind === "page-refinement" || recoveryKind === "deck-refinement";
      if (generationRun) beginActiveGenerationRun(isRefinementResume ? recoveryKind : "deck-generation", generationRun);
      const commonInput = {
            backend,
            aiClient,
            agentClient,
            hostUploadClient,
            aiLogger,
            workspace: refreshedWorkspace,
            confirmedOutline: workspaceOutlineForDownstream(refreshedWorkspace),
            locale,
            onProgress: generationProgressHandler(cancelSignal),
            isCancelled: () => cancelCreateDeckRef.current,
            cancelSignal,
          };
      const completion = isRefinementResume
        ? await runDeckRefinement({
            ...commonInput,
            instruction: recoveryProgress.recovery?.refinement_request ?? "Resume refinement",
            scope: recoveryKind === "page-refinement" ? "slide" : "deck",
            pageId: recoveryProgress.recovery?.target_page_ids[0],
            resumePageIds: recoveryProgress.recovery?.target_page_ids,
            skipIntentReview: true,
          })
        : await runDeckGeneration({ ...commonInput, startMode: "resume" });
      if (!ownsGenerationOperation(cancelSignal)) return;
      if (completion.status === "completed" && generationRun) {
        const committed = await commitShadowGenerationRun(generationRun);
        setGenerationTransaction(null);
        await applyDeckGenerationCompletion(rebaseCompletion(completion, generationRun.shadow_workspace_dir, generationRun.official_workspace_dir), committed.workspace);
      } else {
        await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      }
      shouldReconcileActiveRun = false;
    } catch (error) {
      if (!ownsGenerationOperation(cancelSignal)) return;
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      if (ownsGenerationOperation(cancelSignal)) {
        setLoading("none");
        await finishActiveGenerationRun({
          workspaceDir: activeRunWorkspaceDir,
          reconcileInterrupted: shouldReconcileActiveRun && !generationRun,
        });
      }
      if (generationRun) void backend.cleanupGenerationRun({ run_id: generationRun.run_id }).catch((error) => console.warn("Failed to clean generation run", error));
    }
  }

  async function retryPageGeneration(pageId: string) {
    if (!backend || !aiClient || !agentClient) return;
    if (loading === "deck" || loading === "deckFromOutline") return;

    let activeRunWorkspaceDir: string | undefined;
    let shouldReconcileActiveRun = false;
    let generationRun: GenerationRunTransaction | null = null;
    const cancelSignal = beginCancellableGeneration();
    setLoading("deckFromOutline");
    try {
      const officialWorkspace = await refreshCurrentWorkspaceSnapshot();
      if (!officialWorkspace) return;
      generationRun = await backend.getWorkspaceGenerationRun({ workspace_dir: officialWorkspace.workspace_dir });
      const refreshedWorkspace = generationRun
        ? await backend.openWorkspace({ workspace_dir: generationRun.shadow_workspace_dir })
        : officialWorkspace;
      if (generationRun) beginActiveGenerationRun(generationRun.run_kind, generationRun);
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
        confirmedOutline: workspaceOutlineForDownstream(refreshedWorkspace),
        locale,
        pageId,
        onProgress: generationProgressHandler(cancelSignal),
        isCancelled: () => cancelCreateDeckRef.current,
        cancelSignal,
      });
      if (!ownsGenerationOperation(cancelSignal)) return;
      if (completion.status === "completed" && generationRun) {
        const committed = await commitShadowGenerationRun(generationRun);
        setGenerationTransaction(null);
        await applyDeckGenerationCompletion(rebaseCompletion(completion, generationRun.shadow_workspace_dir, generationRun.official_workspace_dir), committed.workspace);
      } else {
        await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      }
      shouldReconcileActiveRun = false;
    } catch (error) {
      if (!ownsGenerationOperation(cancelSignal)) return;
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      if (ownsGenerationOperation(cancelSignal)) {
        setLoading("none");
        await finishActiveGenerationRun({
          workspaceDir: activeRunWorkspaceDir,
          reconcileInterrupted: shouldReconcileActiveRun && !generationRun,
        });
      }
      if (generationRun) void backend.cleanupGenerationRun({ run_id: generationRun.run_id }).catch((error) => console.warn("Failed to clean generation run", error));
    }
  }

  async function exportFile(type: "PPTX" | "PDF") {
    if (!backend) return;

    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;
    exportInFlightRef.current = true;

      setLoading("export");
    setExportProgress(createExportStartProgress(t, type));
    setExportArtifact(null);
    setExportDownload({ status: "idle", message: "" });
    try {
      if (type === "PDF" && (
        reviewRender.status !== "ready" ||
        reviewRender.result === null ||
        reviewRender.renderKey !== workspaceReviewRenderKey(workspace)
      )) {
        const rendered = await loadDeckHtmlForWorkspace(workspace, "export");
        if (!rendered) return;
        setLoading("export");
        setExportProgress(createExportStartProgress(t, type));
      }

      let updatedWorkspace: WorkspaceResult;
      if (type === "PPTX") {
        const started = await backend.startPptxExport({
          workspace_dir: workspace.workspace_dir
        });
        setExportProgress(createPptxJobExportProgress(t, started));

        const completed = await waitForPptxExportStatus(
          workspace.workspace_dir,
          (job) => job.status === "completed" || job.status === "failed"
        );
        if (completed.status === "failed") {
          throw new Error(getPptxExportErrorMessage(completed));
        }

        const pptxPath = completed.pptx_path;
        assertPptxExportPath(pptxPath, "pptx_path");
        updatedWorkspace = await backend.openWorkspace({
          workspace_dir: workspace.workspace_dir,
        });
        applyWorkspace(updatedWorkspace);
      } else {
        setExportProgress(createExportStartProgress(t, "PDF"));
        const pdfResult = await backend.exportPdf({
          workspace_dir: workspace.workspace_dir
        });
        const pdfPath = pdfResult.pdfPath;
        updatedWorkspace = await backend.recordPdfExport({
          workspace_dir: workspace.workspace_dir,
          pdfPath
        });
        applyWorkspace(updatedWorkspace);
      }

      const artifact = readWorkspaceExportArtifactPath(updatedWorkspace);
      if (!artifact) {
        throw new Error(`${type} export was recorded without an artifact path.`);
      }
      setExportArtifactWithProgress(artifact);
      setExportDownload({ status: "preparing", message: t.exportPage.downloadPreparing });
      try {
        await publishExportArtifact(updatedWorkspace, artifact);
        setExportDownload({ status: "idle", message: t.exportPage.downloadNotPrepared });
        showToast(type === "PPTX" ? t.toasts.pptxExported : t.toasts.pdfExported);
      } catch (error) {
        const message = formatExportDownloadError(error);
        console.warn("Failed to publish the Export Artifact Mirror", error);
        setExportDownload({ status: "error", message });
        showToast(message);
      }
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

  async function downloadCurrentExportArtifact() {
    if (!backend || !currentWorkspace || !exportArtifact || exportDownload.status === "preparing") {
      return;
    }
    if (hasActiveDownloadUrl(exportDownload)) {
      return;
    }
    setExportDownload({ status: "preparing", message: t.exportPage.downloadPreparing });
    try {
      let artifact = exportArtifact;
      if (artifact.mirrorStatus !== "ready") {
        artifact = await publishExportArtifact(currentWorkspace, artifact);
      }
      const result = await backend.getExportArtifactDownloadUrl({
        workspace_dir: currentWorkspace.workspace_dir,
        artifact_type: artifact.type.toLowerCase() as "pptx" | "pdf",
      });
      if (result.status !== "ready") {
        setExportArtifact((current) => current
          ? { ...current, mirrorStatus: result.status }
          : current);
        throw new Error(result.reason);
      }
      setExportArtifact({
        ...artifact,
        fileName: result.artifact.filename,
        mirrorStatus: "ready",
      });
      setExportDownload({
        status: "ready",
        message: t.exportPage.downloadReady,
        href: result.download_url,
        expiresAt: result.expires_at,
      });
    } catch (error) {
      const message = formatExportDownloadError(error);
      console.warn("Failed to download the Export Artifact Mirror", error);
      setExportDownload({ status: "error", message });
      showToast(message);
    }
  }

  async function prepareCurrentWorkspaceDiagnosticBundle() {
    if (!backend || !currentWorkspace) return;
    const workspaceId = currentWorkspace.workspace_id;
    const workspaceDir = currentWorkspace.workspace_dir;
    const requestId = workspaceDiagnosticBundleRequestRef.current + 1;
    workspaceDiagnosticBundleRequestRef.current = requestId;
    setWorkspaceDiagnosticBundle({
      status: "preparing",
      message: t.library.diagnosticBundlePreparing,
      workspaceId,
    });

    try {
      const result = await backend.prepareWorkspaceDiagnosticBundle({
        workspace_dir: workspaceDir,
      });
      if (
        workspaceDiagnosticBundleRequestRef.current !== requestId ||
        currentWorkspaceRef.current?.workspace_id !== workspaceId
      ) {
        return;
      }
      setWorkspaceDiagnosticBundle({
        status: "ready",
        message: t.library.diagnosticBundleReady,
        workspaceId,
        filename: result.filename,
        sizeBytes: result.size_bytes,
        href: result.download_url,
        expiresAt: result.expires_at,
      });
    } catch (error) {
      if (
        workspaceDiagnosticBundleRequestRef.current !== requestId ||
        currentWorkspaceRef.current?.workspace_id !== workspaceId
      ) {
        return;
      }
      const detail = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
      const message = detail
        ? `${t.library.diagnosticBundleFailedPrefix}${detail}`
        : t.library.diagnosticBundleFailed;
      console.warn("Failed to prepare the Workspace Diagnostic Bundle", error);
      setWorkspaceDiagnosticBundle({
        status: "error",
        message,
        workspaceId,
      });
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
      const ok = await requestConfirmation({
        title: locale === "zh" ? "更换风格画像？" : "Change the style profile?",
        body: locale === "zh"
          ? "更换风格画像后，当前成稿会标记为需要重新生成。是否继续？"
          : "Changing the style profile will mark the current deck for regeneration. Continue?",
        cancelLabel: locale === "zh" ? "取消" : "Cancel",
        confirmLabel: locale === "zh" ? "继续更换" : "Continue",
        tone: "warning",
      });
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
      const ok = await requestConfirmation({
        title: locale === "zh" ? "清除风格画像？" : "Clear the style profile?",
        body: locale === "zh"
          ? "清除风格画像后，当前成稿会标记为需要重新生成。是否继续？"
          : "Clearing the style profile will mark the current deck for regeneration. Continue?",
        cancelLabel: locale === "zh" ? "取消" : "Cancel",
        confirmLabel: locale === "zh" ? "继续清除" : "Continue",
        tone: "warning",
      });
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
    pageReviewSettings,
    globalSettings,
    researchSearchControlSettings,
    contextRows,
    presentationRequirements,
    requirementsStatus,
    requirementsError,
    requirementsSaving,
    requirementsConfirming,
    requirementsDirty,
    requirementsHasSavedDraft,
    deckTitle,
    deck,
    outline,
    outlineDraft,
    outlineDraftTitle,
    outlineDirty,
    outlineSaving,
    outlineError,
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
    exportDownload,
    workspaceDiagnosticBundle,
    currentStatus,
    workspaceScan,
    workspaceCovers,
    currentWorkspace,
    uploadedSources,
    uploadedSourceAnalysisState,
    workspaceLoading,
    workspaceError,
    workspaceSettingsSaving,
    templateGroups,
    selectedVisualStylePresetId,
    selectedTemplateGroupId,
    styleProfiles,
    styleProfilePreviews,
    selectedStyleProfile,
    styleProfileLibraryLoading,
    styleProfileLibraryError,
    styleProfileCreation,
    styleProfileDetail,
    confirmationDialog,
  };

  const actions: DeckWorkspaceActions = {
    setPanelMode,
    setPrompt,
    setStrictReviewMode,
    setResearchSearchControlSettings,
    setDeckTitle,
    setCurrentSlide,
    setOutlineFeedback,
    setPreviewMode,
    setRefineScope,
    showToast,
    resolveConfirmation,
    cancelGenerateDeck,
    navigate,
    navigateMain,
    goBack,
    addContextRow,
    updateContextRow,
    removeContextRow,
    addStyleRow,
    generateDeck: () => generateDeck(),
    generatePresentationRequirements,
    selectVisualStylePreset,
    useManualPresentationRequirements,
    selectPresentationRequirement,
    returnToBriefFromRequirements,
    savePresentationRequirements,
    confirmPresentationRequirements,
    createDeckFromOutline,
    applyOutlineFeedback,
    retryOutlineCreation,
    returnToRequirementsFromOutline,
    saveOutlineDraft,
    setOutlineDraftTitle,
    updateOutlineDraftItem,
    addOutlineDraftItem,
    insertOutlineDraftItem,
    deleteOutlineDraftItem,
    moveOutlineDraftItem,
    updateDeckTitle,
    moveSlide,
    duplicateSlide,
    deleteSlide,
    addSlide,
    openLocalProject,
    openWorkspace,
    scanWorkspaces,
    showWorkspacePicker,
    startNewPresentation,
    refreshMyWork,
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
    renameWorkspace,
    deleteWorkspace,
    selectTemplate,
    openRefineDeck,
    openRefineSlide,
    refineDeck,
    refineSlide,
    rewriteCurrentSlide,
    changeCurrentSlideLayout,
    renderDeckHtml,
    applyManualPageUpdate,
    exportFile,
    downloadExportArtifact: downloadCurrentExportArtifact,
    prepareWorkspaceDiagnosticBundle: prepareCurrentWorkspaceDiagnosticBundle,
    resetWorkspaceDiagnosticBundle: invalidateWorkspaceDiagnosticBundle,
    returnToOutlineFromGeneration,
    returnToBriefFromUploadedSourceAnalysis,
    regenerateDeck,
    resumeDeckGeneration,
    retryPageGeneration,
    retryUploadedSourceAnalysis
  };

  return { state, actions };
}
