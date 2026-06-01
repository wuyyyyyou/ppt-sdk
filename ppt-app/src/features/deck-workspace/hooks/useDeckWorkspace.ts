import { useEffect, useMemo, useRef, useState } from "react";
import { createAgentClient, type AgentClient } from "../../../agent/agentClient";
import { createAiClient, type AiAttemptLog, type AiClient } from "../../../ai/aiClient";
import { createPptBackend, type PptBackend } from "../../../api/pptBackend";
import { connectAnnaRuntime } from "../../../runtime/annaRuntime";
import type {
  ListWorkspacesResult,
  PageProgress,
  PptxExportJob,
  TemplateSummary,
  WorkspaceResult,
  WorkspaceOutline,
  WorkspaceOutlineItem,
  WorkspacePageItem,
  WorkspacePages,
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
import { deckReadyStatus } from "../utils";
import {
  createDeckGenerationStreamSnapshot,
  pageProgressToDeckGenerationProgress,
  runDeckGeneration,
  runDeckRefinement,
  runPageGenerationRetry,
  type DeckGenerationCompletion,
  type DeckGenerationProgress,
} from "../../deck-generation";
import type {
  ContextRow,
  DeckReviewRenderState,
  DeckWorkspaceState,
  ExportArtifact,
  GenerationStreamSnapshot,
  LoadingKind,
  MainStage,
  PageId,
  PanelMode,
  PreviewMode,
  RefineScope
} from "../types";

const DEFAULT_TEMPLATE_GROUP_ID = "red-finance-v3";
const PPTX_EXPORT_POLL_INTERVAL_MS = 1500;
const PPTX_EXPORT_POLL_TIMEOUT_MS = 15 * 60 * 1000;
const SLIDE_COUNT_CONTEXT_OPTIONS = ["auto", ...Array.from({ length: 20 }, (_, index) => String(index + 1))];
type ContextPatchId = "audience" | "goal" | "style" | "content" | "slides";

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

export interface DeckWorkspaceActions {
  setPanelMode: (mode: PanelMode) => void;
  setPrompt: (value: string) => void;
  setReviewOutlineFirst: (value: boolean) => void;
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
  generateDeck: () => Promise<void>;
  createDeckFromOutline: () => Promise<void>;
  applyOutlineFeedback: () => Promise<void>;
  beginOutlineEdit: () => void;
  cancelOutlineEdit: () => void;
  saveOutlineEdit: () => Promise<void>;
  updateOutlineDraftItem: (index: number, patch: Partial<WorkspaceOutlineItem>) => void;
  updateDeckTitle: (index: number, title: string) => void;
  moveSlide: (index: number, direction: -1 | 1) => Promise<void>;
  duplicateSlide: (index: number) => Promise<void>;
  deleteSlide: (index: number) => Promise<void>;
  addSlide: () => void;
  openLocalProject: (projectName: string) => void;
  openWorkspace: (workspaceDir: string) => Promise<void>;
  scanWorkspaces: () => Promise<void>;
  useLatestWorkspace: () => Promise<void>;
  createWorkspace: () => Promise<void>;
  saveWorkspaceSettings: (setting: WorkspaceSettings) => Promise<void>;
  saveWorkspaceTitle: (title: string) => Promise<void>;
  selectTemplate: (groupId: string) => Promise<void>;
  refineDeck: (instruction: string) => Promise<void>;
  refineSlide: (instruction: string) => Promise<void>;
  renderDeckHtml: () => Promise<void>;
  exportFile: (type: "PPTX" | "PDF") => Promise<void>;
  returnToOutlineFromGeneration: () => void;
  regenerateDeck: () => Promise<void>;
  retryPageGeneration: (pageId: string) => Promise<void>;
}

export function useDeckWorkspace(t: Messages, locale: Locale) {
  const [panelMode, setPanelMode] = useState<PanelMode>("visible");
  const [page, setPage] = useState<PageId>("main");
  const [stage, setStage] = useState<MainStage>("brief");
  const [history, setHistory] = useState<PageId[]>(["main"]);
  const [toast, setToast] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reviewOutlineFirst, setReviewOutlineFirst] = useState(false);
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [deckTitle, setDeckTitle] = useState(t.deck.title);
  const [deck, setDeck] = useState<Slide[]>(initialDeck);
  const [outline, setOutline] = useState(outlineDetails);
  const [outlineDraft, setOutlineDraft] = useState(outlineDetails);
  const [outlineDraftTitle, setOutlineDraftTitle] = useState(t.deck.title);
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
  const [generationHistory, setGenerationHistory] = useState<GenerationStreamSnapshot[]>([]);
  const [pageProgress, setPageProgress] = useState<PageProgress | null>(null);
  const [refineScope, setRefineScope] = useState<RefineScope>("deck");
  const [loading, setLoading] = useState<LoadingKind>("none");
  const [exportStatus, setExportStatus] = useState("");
  const [exportArtifact, setExportArtifact] = useState<ExportArtifact | null>(null);
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [aiClient, setAiClient] = useState<AiClient | null>(null);
  const [agentClient, setAgentClient] = useState<AgentClient | null>(null);
  const cancelCreateDeckRef = useRef(false);
  const outlineAutosaveTimerRef = useRef<number | null>(null);
  const [workspaceScan, setWorkspaceScan] = useState<ListWorkspacesResult | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceResult | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSettingsSaving, setWorkspaceSettingsSaving] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<TemplateSummary[]>([]);
  const [selectedTemplateGroupId, setSelectedTemplateGroupId] = useState<string | null>(DEFAULT_TEMPLATE_GROUP_ID);

  function getDefaultWorkspaceTitle(date = new Date()) {
    return formatMessage(t.library.defaultWorkspaceTitle, {
      date: formatWorkspaceDate(date)
    });
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
        subtitle: page.layout_id
      })),
      outline: pages.map((page) => ({
        title: page.title,
        outline: page.speaker_note || page.layout_id
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
      pages,
      updated_at:
        typeof progressRecord?.updated_at === "string" ? progressRecord.updated_at : null
    };
  }

  function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function formatPptxExportStatus(job: PptxExportJob) {
    if (job.error?.message) return job.error.message;
    if (job.message) return `${job.message} ${job.percent}%`;

    switch (job.status) {
      case "preparing_model":
        return locale === "zh" ? "正在准备 PPTX 模型..." : "Preparing PPTX model...";
      case "model_ready":
        return locale === "zh" ? "PPTX 模型已准备，正在生成文件..." : "PPTX model ready. Generating file...";
      case "generating_pptx":
        return locale === "zh" ? "正在生成 PPTX 文件..." : "Generating PPTX file...";
      case "completed":
        return locale === "zh" ? "PPTX 已生成" : "PPTX generated";
      case "failed":
        return locale === "zh" ? "PPTX 导出失败" : "PPTX export failed";
      case "idle":
      default:
        return t.exportPage.preparing;
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
      setExportStatus(formatPptxExportStatus(job));

      if (isDone(job)) {
        return job;
      }

      await sleep(PPTX_EXPORT_POLL_INTERVAL_MS);
    }

    throw new Error(locale === "zh" ? "PPTX 导出等待超时" : "Timed out waiting for PPTX export");
  }

  function readOutlineUpdatedAt(workspace: WorkspaceResult) {
    const outlineRecord =
      workspace.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
        ? (workspace.outline as { updated_at?: unknown })
        : null;
    return typeof outlineRecord?.updated_at === "string" ? outlineRecord.updated_at : "";
  }

  function hasDownstreamArtifacts(workspace: WorkspaceResult) {
    const pagePlanRecord =
      workspace.page_plan && typeof workspace.page_plan === "object" && !Array.isArray(workspace.page_plan)
        ? (workspace.page_plan as { pages?: unknown })
        : null;
    const progressRecord =
      workspace.page_progress && typeof workspace.page_progress === "object" && !Array.isArray(workspace.page_progress)
        ? (workspace.page_progress as { pages?: unknown })
        : null;
    const pagesRecord =
      workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
        ? (workspace.pages as { pages?: unknown })
        : null;

    return (
      (Array.isArray(pagePlanRecord?.pages) && pagePlanRecord.pages.length > 0) ||
      (Array.isArray(progressRecord?.pages) && progressRecord.pages.length > 0) ||
      (Array.isArray(pagesRecord?.pages) && pagesRecord.pages.length > 0)
    );
  }

  function isWorkspaceDeckStale(workspace: WorkspaceResult) {
    const outlineUpdatedAt = readOutlineUpdatedAt(workspace);
    const pagePlanRecord =
      workspace.page_plan && typeof workspace.page_plan === "object" && !Array.isArray(workspace.page_plan)
        ? (workspace.page_plan as { source?: { outline_updated_at?: unknown } })
        : null;
    const pagePlanOutlineUpdatedAt =
      typeof pagePlanRecord?.source?.outline_updated_at === "string"
        ? pagePlanRecord.source.outline_updated_at
        : "";
    const outlineRecord =
      workspace.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
        ? (workspace.outline as { status?: unknown })
        : null;

    if (outlineUpdatedAt && pagePlanOutlineUpdatedAt) {
      return outlineUpdatedAt !== pagePlanOutlineUpdatedAt;
    }

    return outlineRecord?.status === "draft" && hasDownstreamArtifacts(workspace);
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
          value: SLIDE_COUNT_CONTEXT_OPTIONS.includes(baseRow.value) ? baseRow.value : "auto",
          type: "select",
          options: SLIDE_COUNT_CONTEXT_OPTIONS,
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
    const rawContext = Array.isArray(source?.task_context)
      ? source.task_context
      : Array.isArray(source?.context)
      ? source.context
      : [];
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

  function workspaceReviewRenderKey(workspace: WorkspaceResult) {
    const templateRecord =
      workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
        ? (workspace.template as { manifest_path?: unknown; selected_at?: unknown })
        : null;
    const settingRecord =
      workspace.setting && typeof workspace.setting === "object" && !Array.isArray(workspace.setting)
        ? (workspace.setting as { updated_at?: unknown })
        : null;
    const outlineRecord =
      workspace.outline && typeof workspace.outline === "object" && !Array.isArray(workspace.outline)
        ? (workspace.outline as { updated_at?: unknown })
        : null;
    const pagePlanRecord =
      workspace.page_plan && typeof workspace.page_plan === "object" && !Array.isArray(workspace.page_plan)
        ? (workspace.page_plan as { updated_at?: unknown })
        : null;
    const pageProgressRecord =
      workspace.page_progress && typeof workspace.page_progress === "object" && !Array.isArray(workspace.page_progress)
        ? (workspace.page_progress as { updated_at?: unknown })
        : null;
    const pagesRecord =
      workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
        ? (workspace.pages as { updated_at?: unknown })
        : null;
    const manifestPath =
      typeof templateRecord?.manifest_path === "string" ? templateRecord.manifest_path : "";
    const selectedAt = typeof templateRecord?.selected_at === "string" ? templateRecord.selected_at : "";
    const updatedParts = [
      typeof settingRecord?.updated_at === "string" ? settingRecord.updated_at : "",
      typeof outlineRecord?.updated_at === "string" ? outlineRecord.updated_at : "",
      typeof pagePlanRecord?.updated_at === "string" ? pagePlanRecord.updated_at : "",
      typeof pageProgressRecord?.updated_at === "string" ? pageProgressRecord.updated_at : "",
      typeof pagesRecord?.updated_at === "string" ? pagesRecord.updated_at : "",
      selectedAt,
    ];
    return `${workspace.task_dir ?? workspace.workspace_dir}:${manifestPath}:${updatedParts.join(":")}`;
  }

  function buildOutlineArtifact(
    items = outline,
    title = deckTitle,
    status: "draft" | "confirmed" = "draft"
  ) {
    return {
      title,
      status,
      items,
      source: {
        prompt,
        task_context: contextRows,
        setting: workspaceSettingsToState(currentWorkspace)
      }
    };
  }

  function applyRenderedDeck(result: Awaited<ReturnType<PptBackend["renderDeckHtml"]>>) {
    setGenerated(true);
    setDeckTitle(result.title);
    setDeck(
      result.slides.map((slide) => ({
        title: slide.title,
        subtitle: slide.layout_id
      }))
    );
    setOutline(
      result.slides.map((slide) => ({
        title: slide.title,
        outline: slide.speaker_note || slide.layout_id
      }))
    );
    setCurrentSlide(0);
    setStage("deck");
  }

  function applyWorkspace(workspace: WorkspaceResult) {
    setCurrentWorkspace(workspace);
    setExportArtifact(readWorkspaceExportArtifactPath(workspace));
    void refreshWorkspaceExportArtifact(workspace);
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
    const staleDeck = isWorkspaceDeckStale(workspace);
    const workspacePages = staleDeck ? null : workspacePagesToState(workspace.pages);
    const workspacePageProgress = normalizeWorkspacePageProgress(workspace.page_progress);
    setPageProgress(workspacePageProgress);
    setCreateDeckProgress(
      !staleDeck && !workspacePages && workspacePageProgress
        ? pageProgressToDeckGenerationProgress(workspacePageProgress, locale)
        : null
    );
    if (workspacePages) {
      setGenerated(true);
      setDeckTitle(workspacePages.title || getWorkspaceTitle(workspace));
      setDeck(workspacePages.deck);
      setOutline(workspaceOutline.length > 0 ? workspaceOutline : workspacePages.outline);
      setCurrentSlide(0);
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
    if (persistedContextRows.shouldSync) {
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
        nextAgentClient = await createAgentClient(runtime);
        if (cancelled) return;
        setBackend(nextBackend);
        setAiClient(nextAiClient);
        setAgentClient(nextAgentClient);
        const scan = await nextBackend.listWorkspaces();
        if (cancelled) return;
        setWorkspaceScan(scan);
        const templates = await nextBackend.listTemplates();
        if (cancelled) return;
        setTemplateGroups(templates.templates);
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
  }

  const currentStatus = useMemo(() => {
    if (loading === "template") return t.template.loading;
    if (loading === "outline") return t.status.creatingOutline;
    if (loading === "deck" || loading === "deckFromOutline") {
      return t.status.creatingDeck;
    }
    if (loading === "review") return t.review.rendering;
    if (loading === "refineDeck") return t.status.refiningDeck;
    if (loading === "refineSlide") return t.status.refiningSlide;
    if (loading === "export") return t.status.exporting;
    if (stage === "generating") return createDeckProgress?.message ?? t.status.creatingDeck;
    if (stage === "outline") return t.status.outlineReady;
    if (generated) return deckReadyStatus(t, deck.length);
    return "";
  }, [createDeckProgress?.message, deck.length, generated, loading, stage, t]);

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
      if (!hasCurrentRender) {
        void renderDeckHtml();
      }
    }
    if (nextPage === "export" && currentWorkspace) {
      void refreshWorkspaceExportArtifact(currentWorkspace);
    }
  }

  function navigateMain(nextStage: MainStage) {
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

  function parseContextSlideCount(value: string): string | null {
    const digitMatch = value.match(/(?:^|[^\d])(\d{1,2})\s*(?:页|张|slides?|pages?)/i)
      ?? value.match(/(?:页数|slide\s*count|slides?|pages?)[^\d一二两三四五六七八九十]{0,12}(\d{1,2}|auto)/i);
    if (digitMatch) {
      const parsed = digitMatch[1].toLowerCase();
      return parsed === "auto" || SLIDE_COUNT_CONTEXT_OPTIONS.includes(parsed) ? parsed : null;
    }

    const digits: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    const chineseMatch = value.match(/([一二两三四五六七八九十]{1,3})\s*(?:页|张)/);
    if (!chineseMatch) return null;

    const text = chineseMatch[1];
    const parsed = text === "十"
      ? 10
      : text.startsWith("十")
        ? 10 + (digits[text.slice(1)] ?? 0)
        : text.endsWith("十")
          ? (digits[text.slice(0, -1)] ?? 0) * 10
          : text.includes("十")
            ? text.split("十").reduce((total, part, index) => {
                if (index === 0) return (digits[part] ?? 0) * 10;
                return total + (digits[part] ?? 0);
              }, 0)
            : digits[text];

    return parsed && SLIDE_COUNT_CONTEXT_OPTIONS.includes(String(parsed)) ? String(parsed) : null;
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

  function buildContextRowFromPatch(id: ContextPatchId, value: string): ContextRow {
    switch (id) {
      case "audience":
        return {
          id,
          label: t.brief.contextLabels.audience,
          value,
          placeholder: t.brief.contextPlaceholders.audience,
        };
      case "goal":
        return {
          id,
          label: t.brief.contextLabels.goal,
          value,
          placeholder: t.brief.contextPlaceholders.goal,
        };
      case "style":
        return {
          id,
          label: t.brief.contextLabels.styleNotes,
          value,
          placeholder: t.brief.contextPlaceholders.styleNotes,
        };
      case "content":
        return {
          id,
          label: t.brief.contextLabels.contentSource,
          value,
          placeholder: t.brief.contextPlaceholders.contentSource,
        };
      case "slides":
        return {
          id,
          label: t.brief.contextLabels.slides,
          value,
          type: "select",
          options: SLIDE_COUNT_CONTEXT_OPTIONS,
        };
    }
  }

  function deriveContextRowsFromOutlineFeedback(rows: ContextRow[], feedback: string): ContextRow[] {
    const patch: Partial<Record<ContextPatchId, string>> = {};
    const slideCount = parseContextSlideCount(feedback);
    if (slideCount) patch.slides = slideCount;

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

  async function applyDeckGenerationCompletion(
    completion: DeckGenerationCompletion,
    workspace: WorkspaceResult
  ) {
    if (completion.status === "cancelled") {
      return;
    }

    if (completion.status === "failed") {
      if (completion.progress) {
        setCreateDeckProgress(completion.progress);
      }
      showToast(completion.error.message);
      return;
    }

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
    setPage("review");
    setHistory((items) => (items.at(-1) === "review" ? items : [...items, "review"]));
  }

  async function generateDeck() {
    if (!backend || !aiClient || !agentClient) return;

    try {
      cancelCreateDeckRef.current = false;
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      if (!selectedTemplateGroupId) {
        showToast(t.template.helper);
        return;
      }
      const templateWorkspace = await ensureWorkspaceTemplate(workspace);

      const setting = workspaceSettingsToState(templateWorkspace);

      if (reviewOutlineFirst) {
        setLoading("outline");
        resetGenerationProgress();
        const result = await aiClient.generateOutline({
          prompt,
          contextRows,
          locale,
          setting,
        });
        setDeckTitle(result.outline.title);
        setOutline(result.outline.items);
        const updatedWorkspace = await saveOutlineArtifact(
          result.outline.items,
          result.outline.title,
          templateWorkspace,
          setting,
          "draft"
        );
        if (updatedWorkspace) {
          applyWorkspace(updatedWorkspace);
        }
        showToast(t.status.outlineReady);
        return;
      }

      setLoading("outline");
      resetGenerationProgress();
      const outlineResult = await aiClient.generateOutline({
        prompt,
        contextRows,
        locale,
        setting,
      });
      const confirmedWorkspace = await saveOutlineArtifact(
        outlineResult.outline.items,
        outlineResult.outline.title,
        templateWorkspace,
        setting,
        "confirmed"
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
      setLoading("deck");
      setStage("generating");
      setPage("main");
      const completion = await runDeckGeneration({
        backend,
        aiClient,
        agentClient,
        workspace: confirmedWorkspace,
        confirmedOutline: confirmedWorkspace.outline as WorkspaceOutline,
        locale,
        startMode: "restart",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
      });
      await applyDeckGenerationCompletion(completion, confirmedWorkspace);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
    }
  }

  function cancelGenerateDeck() {
    cancelCreateDeckRef.current = true;
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
    if (!backend || !aiClient || !agentClient) return;

    cancelCreateDeckRef.current = false;
    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;
    if (!selectedTemplateGroupId) {
      showToast(t.template.helper);
      return;
    }
    const templateWorkspace = await ensureWorkspaceTemplate(workspace);

    setLoading("deck");
    resetGenerationProgress();
    setStage("generating");
    setPage("main");
    try {
      const setting = workspaceSettingsToState(templateWorkspace);
      const confirmedWorkspace = await saveOutlineArtifact(
        outline,
        deckTitle,
        templateWorkspace,
        setting,
        "confirmed"
      );
      if (!confirmedWorkspace) return;
      setStage("generating");
      setPage("main");

      const completion = await runDeckGeneration({
        backend,
        aiClient,
        agentClient,
        workspace: confirmedWorkspace,
        confirmedOutline: confirmedWorkspace.outline as WorkspaceOutline,
        locale,
        startMode: "restart",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
      });
      await applyDeckGenerationCompletion(completion, confirmedWorkspace);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
    }
  }

  async function applyOutlineFeedback() {
    if (!aiClient) return;
    if (!outlineFeedback.trim()) return;
    setLoading("outline");
    let workspace: WorkspaceResult | null = null;
    try {
      workspace = await ensureCurrentWorkspace();
      const setting = workspaceSettingsToState(workspace);
      const baseTitle = outlineEditMode ? outlineDraftTitle : deckTitle;
      const baseOutline = outlineEditMode ? outlineDraft : outline;
      const nextContextRows = deriveContextRowsFromOutlineFeedback(contextRows, outlineFeedback);
      setContextRows(nextContextRows);
      const result = await aiClient.reviseOutline({
        title: baseTitle,
        outline: baseOutline,
        feedback: outlineFeedback,
        locale,
        setting,
        contextRows: nextContextRows
      });
      await appendOutlineAiAttemptLogs(workspace, result.attempts);
      await saveOutlineArtifact(
        result.outline.items,
        result.outline.title,
        workspace,
        setting,
        "draft",
        false,
        nextContextRows
      );
      if (backend) {
        setWorkspaceScan(await backend.listWorkspaces());
      }
      setOutlineDraftTitle(result.outline.title);
      setOutlineDraft(result.outline.items);
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
    setOutlineEditMode(true);
  }

  function cancelOutlineEdit() {
    setOutlineDraft(outline.map((item) => ({ ...item })));
    setOutlineDraftTitle(deckTitle);
    setOutlineFeedback("");
    setOutlineEditMode(false);
  }

  async function saveOutlineEdit() {
    if (!outlineEditMode) return;
    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;
    const setting = workspaceSettingsToState(workspace);
    const downstreamExists = hasDownstreamArtifacts(workspace);
    const updatedWorkspace = await saveOutlineArtifact(
      outlineDraft,
      outlineDraftTitle,
      workspace,
      setting,
      "draft"
    );
    if (updatedWorkspace) {
      setDeckTitle(outlineDraftTitle);
      setOutline(outlineDraft);
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
        outline: slide.speaker_note || slide.layout_id
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

  function readWorkspaceExportArtifactPath(workspace: WorkspaceResult): ExportArtifact | null {
    if (!workspace.task || typeof workspace.task !== "object" || Array.isArray(workspace.task)) {
      return null;
    }

    const task = workspace.task as {
      artifacts?: {
        pptx?: {
          path?: unknown;
          url?: unknown;
          updated_at?: unknown;
          generator_result?: { artifact_url?: unknown };
        };
        pdf?: { path?: unknown; url?: unknown; updated_at?: unknown };
      };
    };
    const pptx = task.artifacts?.pptx;
    const pdf = task.artifacts?.pdf;
    const candidates = [
      {
        type: "PPTX" as const,
        path: typeof pptx?.path === "string" ? pptx.path : "",
        href:
          typeof pptx?.url === "string" && pptx.url
            ? pptx.url
            : typeof pptx?.generator_result?.artifact_url === "string"
              ? pptx.generator_result.artifact_url
              : "",
        updatedAt: typeof pptx?.updated_at === "string" ? pptx.updated_at : ""
      },
      {
        type: "PDF" as const,
        path: typeof pdf?.path === "string" ? pdf.path : "",
        href: typeof pdf?.url === "string" ? pdf.url : "",
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

  async function buildWorkspaceExportArtifact(workspace: WorkspaceResult): Promise<ExportArtifact | null> {
    if (!backend) return readWorkspaceExportArtifactPath(workspace);

    const artifact = readWorkspaceExportArtifactPath(workspace);
    if (!artifact) return null;

    try {
      const result = await backend.getExportArtifactDownloadUrl({
        workspace_dir: workspace.workspace_dir,
        artifact_type: artifact.type.toLowerCase() as "pptx" | "pdf"
      });

      return {
        type: result.artifact_type === "pptx" ? "PPTX" : "PDF",
        path: result.path,
        href: result.download_url,
        fileName: result.filename
      };
    } catch (error) {
      console.warn(
        "Failed to register export artifact download URL",
        error instanceof Error ? error.message : error
      );
      return artifact;
    }
  }

  async function refreshWorkspaceExportArtifact(workspace: WorkspaceResult) {
    setExportArtifact(await buildWorkspaceExportArtifact(workspace));
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

  function readSelectedTemplateGroup(workspace: WorkspaceResult | null) {
    const templateRecord =
      workspace?.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
        ? (workspace.template as { selected_template_group?: unknown })
        : null;
    return typeof templateRecord?.selected_template_group === "string"
      ? templateRecord.selected_template_group
      : "";
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
    attempts: AiAttemptLog[]
  ) {
    for (const attempt of attempts) {
      await appendOutlineAiLog(workspace, {
        event: `ai.outline.${attempt.operation}.attempt`,
        ...attempt
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
    workspaceOverride: WorkspaceResult | null = null,
    settingOverride: WorkspaceSettings | null = null,
    status: "draft" | "confirmed" = "draft",
    applyWorkspaceState = true,
    contextRowsOverride: ContextRow[] | null = null
  ) {
    if (!backend) return null;
    const workspace = workspaceOverride ?? (await ensureCurrentWorkspace());
    if (!workspace) return null;

    const updatedWorkspace = await backend.updateWorkspaceOutline({
      workspace_dir: workspace.workspace_dir,
      outline: {
        ...buildOutlineArtifact(items, title, status),
        source: {
          prompt,
          task_context: contextRowsOverride ?? contextRows,
          setting: settingOverride ?? workspaceSettingsToState(workspace)
        }
      }
    });
    if (applyWorkspaceState) {
      applyWorkspace(updatedWorkspace);
      setWorkspaceScan(await backend.listWorkspaces());
    } else {
      setCurrentWorkspace(updatedWorkspace);
    }
    return updatedWorkspace;
  }

  function autosaveOutline(items: OutlineDetail[]) {
    if (outlineAutosaveTimerRef.current !== null) {
      window.clearTimeout(outlineAutosaveTimerRef.current);
    }

    outlineAutosaveTimerRef.current = window.setTimeout(() => {
      outlineAutosaveTimerRef.current = null;
      void saveOutlineArtifact(items, deckTitle, null, null, "draft", false).catch(
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

  async function openWorkspace(workspaceDir: string) {
    if (!backend) return;

    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.openWorkspace({
        workspace_dir: workspaceDir
      });
      const shouldOpenDeck = hasRenderedWorkspacePages(workspace);
      applyWorkspace(workspace);
      if (shouldOpenDeck) {
        setPage("main");
        setHistory((items) => (items.at(-1) === "main" ? items : [...items, "main"]));
        const rendered = await renderDeckHtmlForWorkspace(workspace, "review");
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

    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.createWorkspace({
        title: getDefaultWorkspaceTitle()
      });
      applyWorkspace(workspace);
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
      const workspace = await backend.updateWorkspaceSettings({
        workspace_dir: currentWorkspace.workspace_dir,
        setting: {
          ...setting,
          audience: "",
          goal: "",
          style_notes: "",
          slide_count: undefined
        }
      });
      applyWorkspace(workspace);
      setWorkspaceScan(await backend.listWorkspaces());
      showToast(t.status.settingsSaved);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setWorkspaceSettingsSaving(false);
    }
  }

  async function saveWorkspaceTitle(title: string) {
    if (!backend || !currentWorkspace) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.updateWorkspaceTitle({
        workspace_dir: currentWorkspace.workspace_dir,
        title
      });
      applyWorkspace(workspace);
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

    cancelCreateDeckRef.current = false;
    setLoading("refineDeck");
    resetGenerationProgress();
    setStage("generating");
    setPage("main");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const refreshedWorkspace = await backend.openWorkspace({
        workspace_dir: workspace.workspace_dir
      });
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        instruction: trimmedInstruction,
        scope: "deck",
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      if (completion.status === "completed") {
        showToast(t.status.deckRefined);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningDeck);
    } finally {
      setLoading("none");
    }
  }

  async function refineSlide(instruction: string) {
    if (!backend || !aiClient || !agentClient) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) return;
    const slide = deck[currentSlide];
    if (!slide) return;

    cancelCreateDeckRef.current = false;
    setLoading("refineSlide");
    resetGenerationProgress();
    setStage("generating");
    setPage("main");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const refreshedWorkspace = await backend.openWorkspace({
        workspace_dir: workspace.workspace_dir
      });
      const completion = await runDeckRefinement({
        backend,
        aiClient,
        agentClient,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        instruction: trimmedInstruction,
        scope: "slide",
        pageIndex: currentSlide,
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace);
      setCurrentSlide(currentSlide);
      if (completion.status === "completed") {
        showToast(t.status.slideRefined);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningSlide);
    } finally {
      setLoading("none");
    }
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

  async function renderDeckHtml() {
    if (!backend) return;

    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;

    await renderDeckHtmlForWorkspace(workspace, "review");
  }

  function returnToOutlineFromGeneration() {
    if (outline.length === 0) {
      navigateMain("brief");
      return;
    }
    setPage("main");
    setStage("outline");
  }

  async function regenerateDeck() {
    if (outline.length > 0) {
      await createDeckFromOutline();
      return;
    }
    await generateDeck();
  }

  async function retryPageGeneration(pageId: string) {
    if (!backend || !aiClient || !agentClient) return;
    if (loading === "deck" || loading === "deckFromOutline") return;

    cancelCreateDeckRef.current = false;
    setLoading("deckFromOutline");
    setStage("generating");
    setPage("main");
    try {
      const workspace = await ensureCurrentWorkspace();
      if (!workspace) return;
      const refreshedWorkspace = await backend.openWorkspace({
        workspace_dir: workspace.workspace_dir
      });
      const completion = await runPageGenerationRetry({
        backend,
        aiClient,
        agentClient,
        workspace: refreshedWorkspace,
        confirmedOutline: refreshedWorkspace.outline as WorkspaceOutline,
        locale,
        pageId,
        onProgress: recordGenerationProgress,
        isCancelled: () => cancelCreateDeckRef.current,
      });
      await applyDeckGenerationCompletion(completion, refreshedWorkspace);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
    }
  }

  async function exportFile(type: "PPTX" | "PDF") {
    if (!backend) return;

    const workspace = await ensureCurrentWorkspace();
    if (!workspace) return;

    const needsFreshRender =
      reviewRender.status !== "ready" ||
      reviewRender.result === null ||
      reviewRender.renderKey !== workspaceReviewRenderKey(workspace);

    setLoading("export");
    setExportStatus(t.exportPage.preparing);
    setExportArtifact(null);
    try {
      if (needsFreshRender) {
        const rendered = await renderDeckHtmlForWorkspace(workspace, "export");
        if (!rendered) return;
        setLoading("export");
        setExportStatus(t.exportPage.preparing);
      }

      if (type === "PPTX") {
        const startedModel = await backend.startPptxExportModel({
          workspace_dir: workspace.workspace_dir
        });
        setExportStatus(formatPptxExportStatus(startedModel));

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
        setExportStatus(formatPptxExportStatus(startedPptx));

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
        await refreshWorkspaceExportArtifact(updatedWorkspace);
      } else {
        const pdfResult = await backend.exportPdf({
          workspace_dir: workspace.workspace_dir
        });
        const pdfPath = pdfResult.pdfPath;
        const updatedWorkspace = await backend.recordPdfExport({
          workspace_dir: workspace.workspace_dir,
          pdfPath
        });
        applyWorkspace(updatedWorkspace);
        await refreshWorkspaceExportArtifact(updatedWorkspace);
      }

      setExportStatus(formatMessage(t.exportPage.ready, { type }));
      showToast(type === "PPTX" ? t.toasts.pptxExported : t.toasts.pdfExported);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.status.exporting;
      setExportStatus(message);
      showToast(message);
    } finally {
      setLoading("none");
    }
  }

  const state: DeckWorkspaceState = {
    panelMode,
    page,
    stage,
    toast,
    prompt,
    reviewOutlineFirst,
    contextRows,
    deckTitle,
    deck,
    outline,
    outlineDraft,
    outlineEditMode,
    generated,
    currentSlide,
    outlineFeedback,
    previewMode,
    reviewRender,
    createDeckProgress,
    generationHistory,
    pageProgress,
    refineScope,
    loading,
    exportStatus,
    exportArtifact,
    currentStatus,
    workspaceScan,
    currentWorkspace,
    workspaceLoading,
    workspaceError,
    workspaceSettingsSaving,
    templateGroups,
    selectedTemplateGroupId
  };

  const actions: DeckWorkspaceActions = {
    setPanelMode,
    setPrompt,
    setReviewOutlineFirst,
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
    generateDeck,
    createDeckFromOutline,
    applyOutlineFeedback,
    beginOutlineEdit,
    cancelOutlineEdit,
    saveOutlineEdit,
    updateOutlineDraftItem,
    updateDeckTitle,
    moveSlide,
    duplicateSlide,
    deleteSlide,
    addSlide,
    openLocalProject,
    openWorkspace,
    scanWorkspaces,
    useLatestWorkspace,
    createWorkspace,
    saveWorkspaceSettings,
    saveWorkspaceTitle,
    selectTemplate,
    refineDeck,
    refineSlide,
    renderDeckHtml,
    exportFile,
    returnToOutlineFromGeneration,
    regenerateDeck,
    retryPageGeneration
  };

  return { state, actions };
}
