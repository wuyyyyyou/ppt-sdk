import { useEffect, useMemo, useState } from "react";
import { createAiClient, type AiAttemptLog, type AiClient } from "../../../ai/aiClient";
import { createPptBackend, type PptBackend } from "../../../api/pptBackend";
import type {
  ListWorkspacesResult,
  WorkspaceResult,
  WorkspaceOutline,
  WorkspaceOutlineItem,
  WorkspaceSettings
} from "../../../api/types";
import {
  createLocalProjectDeck,
  initialDeck,
  outlineDetails,
  type Slide
} from "../../../data/mockDeck";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";
import { deckReadyStatus, sleep } from "../utils";
import type {
  ContextRow,
  DeckWorkspaceState,
  LoadingKind,
  MainStage,
  PageId,
  PanelMode,
  PreviewMode,
  RefineScope
} from "../types";

export interface DeckWorkspaceActions {
  setPanelMode: (mode: PanelMode) => void;
  setPrompt: (value: string) => void;
  setReviewOutlineFirst: (value: boolean) => void;
  setLookPickerOpen: (value: boolean) => void;
  setDeckTitle: (value: string) => void;
  setCurrentSlide: (index: number) => void;
  setExpandedOutline: (index: number | null) => void;
  setOutlineFeedback: (value: string) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRefineScope: (scope: RefineScope) => void;
  showToast: (message: string) => void;
  navigate: (page: PageId) => void;
  navigateMain: (stage: MainStage) => void;
  goBack: () => void;
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  addStyleRow: () => void;
  addMoreRows: () => void;
  selectLook: (id: string) => void;
  generateDeck: () => Promise<void>;
  createDeckFromOutline: () => Promise<void>;
  applyOutlineFeedback: () => Promise<void>;
  updateOutlineItem: (index: number, title: string) => void;
  updateDeckTitle: (index: number, title: string) => void;
  moveSlide: (index: number, direction: -1 | 1) => void;
  deleteSlide: (index: number) => void;
  addSlide: () => void;
  openLocalProject: (projectName: string) => void;
  openWorkspace: (workspaceDir: string) => Promise<void>;
  scanWorkspaces: () => Promise<void>;
  useLatestWorkspace: () => Promise<void>;
  createWorkspace: () => Promise<void>;
  saveWorkspaceSettings: (setting: WorkspaceSettings) => Promise<void>;
  saveWorkspaceTitle: (title: string) => Promise<void>;
  refineDeck: () => Promise<void>;
  refineSlide: () => Promise<void>;
  exportFile: (type: "PPTX" | "PDF") => Promise<void>;
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
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null);
  const [lookPickerOpen, setLookPickerOpen] = useState(false);
  const [deckTitle, setDeckTitle] = useState(t.deck.title);
  const [deck, setDeck] = useState<Slide[]>(initialDeck);
  const [outline, setOutline] = useState(outlineDetails);
  const [generated, setGenerated] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedOutline, setExpandedOutline] = useState<number | null>(null);
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("grid");
  const [refineScope, setRefineScope] = useState<RefineScope>("deck");
  const [loading, setLoading] = useState<LoadingKind>("none");
  const [exportStatus, setExportStatus] = useState("");
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [aiClient, setAiClient] = useState<AiClient | null>(null);
  const [workspaceScan, setWorkspaceScan] = useState<ListWorkspacesResult | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceResult | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSettingsSaving, setWorkspaceSettingsSaving] = useState(false);

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

  function workspaceSettingsToState(workspace: WorkspaceResult | null): WorkspaceSettings {
    return workspace?.setting && typeof workspace.setting === "object" && !Array.isArray(workspace.setting)
      ? (workspace.setting as WorkspaceSettings)
      : {};
  }

  function buildOutlineArtifact(items = outline, title = deckTitle) {
    return {
      title,
      status: "draft" as const,
      items,
      source: {
        prompt,
        context: contextRows,
        setting: workspaceSettingsToState(currentWorkspace)
      }
    };
  }

  function applyWorkspace(workspace: WorkspaceResult) {
    setCurrentWorkspace(workspace);
    setDeckTitle(getWorkspaceTitle(workspace));
    const workspaceOutline = workspaceOutlineToState(workspace.outline);
    if (workspaceOutline.length > 0) {
      setOutline(workspaceOutline);
      setStage("outline");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeClients() {
      try {
        const [nextBackend, nextAiClient] = await Promise.all([
          createPptBackend(),
          createAiClient()
        ]);
        if (cancelled) return;
        setBackend(nextBackend);
        setAiClient(nextAiClient);
        const scan = await nextBackend.listWorkspaces();
        if (cancelled) return;
        setWorkspaceScan(scan);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error ? error.message : "Failed to scan workspaces."
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
    };
  }, []);

  const currentStatus = useMemo(() => {
    if (loading === "outline") return t.status.creatingOutline;
    if (loading === "deck" || loading === "deckFromOutline") {
      return t.status.creatingDeck;
    }
    if (loading === "refineDeck") return t.status.refiningDeck;
    if (loading === "refineSlide") return t.status.refiningSlide;
    if (loading === "export") return t.status.exporting;
    if (stage === "outline") return t.status.outlineReady;
    if (generated) return deckReadyStatus(t, deck.length);
    return "";
  }, [deck.length, generated, loading, stage, t]);

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
  }

  function navigateMain(nextStage: MainStage) {
    if (nextStage === "outline" && outline.length === 0) {
      showToast(t.toasts.createOutlineFirst);
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
    if (id === "look") setSelectedLookId(null);
  }

  function addStyleRow() {
    addContextRow({
      id: "style",
      label: t.brief.contextLabels.styleNotes,
      value: t.brief.contextDefaults.styleNotes
    });
  }

  function addMoreRows() {
    addContextRow({
      id: "slides",
      label: t.brief.contextLabels.slides,
      value: "7",
      type: "select",
      options: ["Auto", "5", "7", "10"]
    });
    addContextRow({
      id: "density",
      label: t.brief.contextLabels.textPerSlide,
      value: "Balanced",
      type: "select",
      options: ["Light", "Balanced", "Detailed"]
    });
    addContextRow({
      id: "language",
      label: t.brief.contextLabels.outputLanguage,
      value: t.brief.contextDefaults.outputLanguage
    });
    addContextRow({
      id: "ratio",
      label: t.brief.contextLabels.aspectRatio,
      value: "16:9",
      type: "select",
      options: ["16:9", "4:3"]
    });
  }

  function selectLook(id: string) {
    const look = t.looks.find((item) => item.id === id);
    if (!look) return;

    setSelectedLookId(id);
    setLookPickerOpen(false);
    setContextRows((rows) => {
      const nextRow = {
        id: "look",
        label: t.brief.contextLabels.look,
        value: `${look.name} · ${look.description}`
      };
      return rows.some((item) => item.id === "look")
        ? rows.map((item) => (item.id === "look" ? nextRow : item))
        : [...rows, nextRow];
    });
  }

  async function generateDeck() {
    if (!aiClient) return;

    if (reviewOutlineFirst) {
      setLoading("outline");
      let workspace: WorkspaceResult | null = null;
      try {
        workspace = await ensureCurrentWorkspace();
        const setting = workspaceSettingsToState(workspace);
        const result = await aiClient.generateOutline({
          prompt,
          contextRows,
          locale,
          setting
        });
        await appendOutlineAiAttemptLogs(workspace, result.attempts);
        setDeckTitle(result.outline.title);
        setOutline(result.outline.items);
        await saveOutlineArtifact(result.outline.items, result.outline.title, workspace, setting);
        setStage("outline");
      } catch (error) {
        await appendOutlineErrorLog(workspace, "generateOutline", error);
        showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
      } finally {
        setLoading("none");
      }
      return;
    }

    setLoading("deck");
    try {
      const workspace = await ensureCurrentWorkspace();
      const result = await aiClient.generateDeck({
        prompt,
        contextRows,
        locale,
        outlineFirst: false,
        setting: workspaceSettingsToState(workspace)
      });
      setGenerated(true);
      setOutline(result.outline);
      await saveOutlineArtifact(result.outline, result.title, workspace);
      setDeck(result.slides);
      setCurrentSlide(0);
      setStage("deck");
      setDeckTitle(result.title);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.toasts.createDeckFirst);
    } finally {
      setLoading("none");
    }
  }

  async function createDeckFromOutline() {
    if (!aiClient) return;

    setLoading("deckFromOutline");
    try {
      await saveOutlineArtifact(outline);
      setDeck(
        await aiClient.generateSlidesFromOutline({
          outline,
          locale
        })
      );
      setGenerated(true);
      setCurrentSlide(0);
      setStage("deck");
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
      const result = await aiClient.reviseOutline({
        title: deckTitle,
        outline,
        feedback: outlineFeedback,
        locale,
        setting
      });
      await appendOutlineAiAttemptLogs(workspace, result.attempts);
      setDeckTitle(result.outline.title);
      setOutline(result.outline.items);
      await saveOutlineArtifact(result.outline.items, result.outline.title, workspace, setting);
      setOutlineFeedback("");
      showToast(t.toasts.outlineUpdated);
    } catch (error) {
      await appendOutlineErrorLog(workspace, "reviseOutline", error);
      showToast(error instanceof Error ? error.message : t.toasts.createOutlineFirst);
    } finally {
      setLoading("none");
    }
  }

  function updateOutlineItem(index: number, title: string) {
    setOutline((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
  }

  function updateDeckTitle(index: number, title: string) {
    setDeck((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
    updateOutlineItem(index, title);
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= deck.length) return;

    setDeck((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setOutline((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function deleteSlide(index: number) {
    setDeck((items) => items.filter((_, itemIndex) => itemIndex !== index));
    setOutline((items) => items.filter((_, itemIndex) => itemIndex !== index));
    setCurrentSlide((value) => Math.max(0, Math.min(value, deck.length - 2)));
  }

  function addSlide() {
    const title = locale === "zh" ? "新页面" : "New Slide";
    const subtitle = locale === "zh" ? "新的页面内容" : "New slide content";
    setDeck((items) => [...items, { title, subtitle }]);
    setOutline((items) => [
      ...items,
      { title, outline: t.outline.fallbackSummary }
    ]);
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
      : workspace.workspace_id;
  }

  async function ensureCurrentWorkspace() {
    if (!backend) return null;
    if (currentWorkspace) return currentWorkspace;

    const workspace = await backend.createWorkspace({});
    applyWorkspace(workspace);
    setWorkspaceScan(await backend.listWorkspaces());
    return workspace;
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
    settingOverride: WorkspaceSettings | null = null
  ) {
    if (!backend) return null;
    const workspace = workspaceOverride ?? (await ensureCurrentWorkspace());
    if (!workspace) return null;

    const updatedWorkspace = await backend.updateWorkspaceOutline({
      workspace_dir: workspace.workspace_dir,
      outline: {
        ...buildOutlineArtifact(items, title),
        source: {
          prompt,
          context: contextRows,
          setting: settingOverride ?? workspaceSettingsToState(workspace)
        }
      }
    });
    applyWorkspace(updatedWorkspace);
    setWorkspaceScan(await backend.listWorkspaces());
    return updatedWorkspace;
  }

  async function scanWorkspaces() {
    if (!backend) return;

    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      setWorkspaceScan(await backend.listWorkspaces());
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to scan workspaces."
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function useLatestWorkspace() {
    if (!backend || !workspaceScan?.latest_workspace) return;

    await openWorkspace(workspaceScan.latest_workspace.workspace_dir);
  }

  async function openWorkspace(workspaceDir: string) {
    if (!backend) return;

    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.openWorkspace({
        workspace_dir: workspaceDir
      });
      applyWorkspace(workspace);
      setPage("main");
      showToast(`已打开工作区 ${workspace.workspace_id}`);
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
      const workspace = await backend.createWorkspace({});
      applyWorkspace(workspace);
      setWorkspaceScan(await backend.listWorkspaces());
      setPage("main");
      showToast(`已创建工作区 ${workspace.workspace_id}`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to create workspace."
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function saveWorkspaceSettings(setting: WorkspaceSettings) {
    if (!backend || !currentWorkspace) return;

    setWorkspaceSettingsSaving(true);
    setWorkspaceError("");
    try {
      const workspace = await backend.updateWorkspaceSettings({
        workspace_dir: currentWorkspace.workspace_dir,
        setting
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

  async function refineDeck() {
    if (!aiClient) return;

    setLoading("refineDeck");
    try {
      setDeck(await aiClient.refineDeck({ slides: deck, locale }));
      setPage("main");
      showToast(t.status.deckRefined);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningDeck);
    } finally {
      setLoading("none");
    }
  }

  async function refineSlide() {
    if (!aiClient) return;
    const slide = deck[currentSlide];
    if (!slide) return;

    setLoading("refineSlide");
    try {
      const refinedSlide = await aiClient.refineSlide({
        slide,
        slideIndex: currentSlide,
        locale
      });
      setDeck((items) =>
        items.map((item, index) => (index === currentSlide ? refinedSlide : item))
      );
      setPage("main");
      showToast(t.status.slideRefined);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t.status.refiningSlide);
    } finally {
      setLoading("none");
    }
  }

  async function exportFile(type: "PPTX" | "PDF") {
    setLoading("export");
    setExportStatus(t.exportPage.preparing);
    await sleep(900);
    setLoading("none");
    setExportStatus(formatMessage(t.exportPage.ready, { type }));
    showToast(type === "PPTX" ? t.toasts.pptxExported : t.toasts.pdfExported);
  }

  const state: DeckWorkspaceState = {
    panelMode,
    page,
    stage,
    toast,
    prompt,
    reviewOutlineFirst,
    contextRows,
    selectedLookId,
    lookPickerOpen,
    deckTitle,
    deck,
    outline,
    generated,
    currentSlide,
    expandedOutline,
    outlineFeedback,
    previewMode,
    refineScope,
    loading,
    exportStatus,
    currentStatus,
    workspaceScan,
    currentWorkspace,
    workspaceLoading,
    workspaceError,
    workspaceSettingsSaving
  };

  const actions: DeckWorkspaceActions = {
    setPanelMode,
    setPrompt,
    setReviewOutlineFirst,
    setLookPickerOpen,
    setDeckTitle,
    setCurrentSlide,
    setExpandedOutline,
    setOutlineFeedback,
    setPreviewMode,
    setRefineScope,
    showToast,
    navigate,
    navigateMain,
    goBack,
    addContextRow,
    updateContextRow,
    removeContextRow,
    addStyleRow,
    addMoreRows,
    selectLook,
    generateDeck,
    createDeckFromOutline,
    applyOutlineFeedback,
    updateOutlineItem,
    updateDeckTitle,
    moveSlide,
    deleteSlide,
    addSlide,
    openLocalProject,
    openWorkspace,
    scanWorkspaces,
    useLatestWorkspace,
    createWorkspace,
    saveWorkspaceSettings,
    saveWorkspaceTitle,
    refineDeck,
    refineSlide,
    exportFile
  };

  return { state, actions };
}
