import {
  AgentRunCancelledError,
  isAgentInfrastructureError,
  isAgentRunCancelledError,
  type AgentInfrastructureError,
  type AgentClient,
  type AgentPageContentReviewResult,
  type AgentRunSummary,
  type AgentPageVisualReviewResult,
  type AgentStreamEvent,
} from "../../agent/agentClient";
import {
  AUTO_OUTPUT_LANGUAGE,
  normalizeOutputLanguage,
  readOutlineOutputLanguage,
} from "../../ai/outputLanguage";
import { assertResearchPlanAligned } from "../../ai/researchPlanPrompt";
import type { AiClient } from "../../ai/aiClient";
import type { AiInteractionLogger, AiOperationLogContext } from "../../ai/interactionLog";
import type { DeckRefinementIntentReviewResult, PageRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PagePlanItem,
  PageProgress,
  ResearchEvidenceIndex,
  ResearchCurationDraftFingerprint,
  ResearchPlan,
  ResearchRequirement,
  VisualResearchCurationDraft,
  WebResearchCurationDraft,
  GetWorkspacePageFileFingerprintsResult,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";
import type { Locale } from "../../i18n/messages";
import { readPageReviewSettings } from "../deck-workspace/reviewSettings";
import {
  isActivePageGenerationStatus,
  isGenuinelyFailedPageGenerationStatus,
  isResumablePageGenerationStatus,
  shouldResumePageGenerationStatus,
} from "./pageStatusPolicy";
import {
  createVisualResearchCurationGapDraft,
  createWebResearchCurationGapDraft,
  mergeResearchCurationDrafts,
  validateVisualResearchCurationDraft,
  validateWebResearchCurationDraft,
} from "./researchCurationDrafts";
import {
  applyTargetOutlineRevision,
  computeResearchQueryDelta,
  mergeTargetResearchRequirement,
  recordResearchCollectionLedger,
  reviseTargetPagePlanEntry,
} from "./pageRefinementWorkflow";
import {
  alignDeckRefinementPagePlanToOutline,
  applyDeckRefinementSettingUpdates,
  mergeDeckRefinementResearchPlan,
  reconcileDeckRefinement,
} from "./deckRefinementWorkflow";

const ATTEMPT_LIMITS = {
  render: 10,
  visualReview: 5,
  contentReview: 5,
  agent: 5,
};
const PAGE_GENERATION_CONCURRENCY = 3;
const LOCAL_GATE_REPAIR_LIMIT = 3;

type RenderFailurePhase = "pre-render-typecheck" | "render";

interface RenderFailureHistoryItem {
  attempt: number;
  phase: RenderFailurePhase;
  error: string;
  timestamp: string;
}

interface NoChangeAuthoringRetry {
  retryCount: number;
  previousSummary: string;
  previousChangedFiles: string[];
}

export type DeckGenerationStep =
  | "page-plan"
  | "research-planning"
  | "research-collection"
  | "research-curation"
  | "prepare"
  | "page-authoring"
  | "page-content-review"
  | "page-render"
  | "page-visual-review"
  | "final-render"
  | "complete"
  | "interrupted"
  | "cancelled"
  | "failed";

export type DeckGenerationStartMode = "restart" | "resume";

export interface DeckGenerationProgressPage {
  page_id: string;
  index: number;
  title: string;
  status: string;
  render_attempts: number;
  render_attempt_limit: number;
  visual_review_attempts: number;
  visual_review_attempt_limit: number;
  content_review_attempts: number;
  content_review_attempt_limit: number;
  agent_failures: number;
  agent_failure_limit: number;
  agent_infrastructure_failures: number;
  last_error?: string;
  last_screenshot_path?: string;
}

export interface DeckGenerationStream {
  run_id?: string;
  kind?: string;
  page_id: string;
  page_index: number;
  status: string;
  lines: string[];
  activities: string[];
  started_at?: string;
  updated_at?: string;
}

export interface DeckGenerationProgress {
  step: DeckGenerationStep;
  message: string;
  currentPageIndex: number | null;
  totalPages: number;
  pages: DeckGenerationProgressPage[];
  recoveryRunKind?: NonNullable<PageProgress["recovery"]>["run_kind"];
  stream?: DeckGenerationStream;
  activeStreams?: DeckGenerationStream[];
}

export interface DeckGenerationStreamSnapshot {
  id: string;
  phase: string;
  kind?: string;
  label: string;
  page_id?: string;
  page_index?: number;
  status: string;
  message: string;
  lines: string[];
  activities: string[];
  updated_at: string;
}

export interface DeckGenerationResult {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  progress: PageProgress;
  rendered: RenderDeckHtmlResult;
}

export interface DeckGenerationError {
  type:
    | "page_failed"
    | "agent_infrastructure"
    | "final_render_failed"
    | "stale_artifacts"
    | "cancelled"
    | "invalid_confirmed_outline";
  message: string;
  page_id?: string;
  page_index?: number;
  page_status?: string;
}

export type DeckGenerationCompletion =
  | { status: "completed"; result: DeckGenerationResult }
  | { status: "cancelled"; progress: DeckGenerationProgress | null }
  | {
      status: "failed";
      error: DeckGenerationError;
      progress: DeckGenerationProgress | null;
    };

export interface RunDeckGenerationInput {
  backend: PptBackend;
  aiClient: AiClient;
  agentClient: AgentClient;
  aiLogger?: AiInteractionLogger | null;
  workspace: WorkspaceResult;
  confirmedOutline: WorkspaceOutline;
  locale: Locale;
  startMode?: DeckGenerationStartMode;
  onProgress: (progress: DeckGenerationProgress) => void;
  isCancelled: () => boolean;
  cancelSignal?: AbortSignal;
  pageRefinementRequests?: Record<string, string>;
  pageRefinementVisualContexts?: Record<string, PageRefinementVisualContext>;
  refinementRunKind?: "page-refinement" | "deck-refinement";
}

export interface RunDeckRefinementInput extends RunDeckGenerationInput {
  instruction: string;
  scope: "deck" | "slide";
  pageIndex?: number;
  resumePageIds?: string[];
  skipIntentReview?: boolean;
}

export interface RunPageGenerationRetryInput extends RunDeckGenerationInput {
  pageId: string;
}

type DeckGenerationContext = Omit<RunDeckGenerationInput, "startMode">;
type PageTerminalReason = "accepted" | "page_failed" | "agent_infrastructure" | "cancelled";

interface PageGenerationResult {
  page: PagePlanItem;
  reason: PageTerminalReason;
  progress: PageProgress;
  error?: DeckGenerationError;
}

interface DeckGenerationRuntime extends DeckGenerationContext {
  activeStreams: Map<string, DeckGenerationStream>;
  getProgress: () => PageProgress | null;
  setProgress: (progress: PageProgress) => void;
}

interface PageRefinementVisualContext {
  screenshotPath?: string;
  source: "progress" | "fresh-render" | "unavailable";
  unavailableReason?: string;
}

function generationText(locale: Locale) {
  const zh = locale === "zh";
  return {
    pagePlan: zh ? "正在规划页面和模板蓝图" : "Planning pages and template blueprints",
    researchPlanning: zh ? "正在规划检索需求" : "Planning research needs",
    collectingSources: (page: PagePlanItem) =>
      zh ? `正在搜索并抓取第 ${page.index + 1} 页资料` : `Collecting sources for page ${page.index + 1}`,
    curatingEvidence: (page: PagePlanItem) =>
      zh ? `正在筛选第 ${page.index + 1} 页证据` : `Curating evidence for page ${page.index + 1}`,
    curatingFacts: (page: PagePlanItem) =>
      zh ? `正在筛选第 ${page.index + 1} 页事实证据` : `Curating facts for page ${page.index + 1}`,
    curatingImages: (page: PagePlanItem) =>
      zh ? `正在筛选第 ${page.index + 1} 页图片素材` : `Curating images for page ${page.index + 1}`,
    prepare: zh ? "正在准备页面文件" : "Preparing page files",
    complete: zh ? "生成完成" : "Generation complete",
    resumed: zh ? "已恢复上次生成进度" : "Resumed previous generation progress",
    interrupted: zh ? "生成已中断，可继续生成" : "Generation interrupted. You can resume.",
    invalidOutline: zh ? "Deck Generation 需要 Confirmed Outline。" : "Deck Generation requires a confirmed outline.",
    staleArtifacts: zh
      ? "无法续跑：现有 Page Plan 或 Page Progress 已过期。"
      : "Unable to resume: the existing page plan or page progress is stale.",
    pageFailed: (page: PageProgress["pages"][number]) =>
      page.last_error ||
      (zh
        ? `第 ${page.index + 1} 页未通过：${page.status}`
        : `Page ${page.index + 1} did not pass: ${page.status}`),
    pagePassed: (page: PagePlanItem) =>
      zh
        ? `第 ${page.index + 1} 页已通过，继续下一页`
        : `Page ${page.index + 1} passed; continuing to the next page`,
    generatingPage: (page: PagePlanItem, total: number) =>
      zh
        ? `正在生成第 ${page.index + 1} / ${total} 页`
        : `Generating page ${page.index + 1} / ${total}`,
    authoringPage: (page: PagePlanItem) =>
      zh ? `正在思考第 ${page.index + 1} 页的表达` : `Thinking through page ${page.index + 1}`,
    renderingPage: (page: PagePlanItem) =>
      zh ? `正在渲染第 ${page.index + 1} 页` : `Rendering page ${page.index + 1}`,
    reviewingContent: (page: PagePlanItem) =>
      zh ? `正在检查第 ${page.index + 1} 页内容` : `Reviewing page ${page.index + 1} content`,
    fixingContent: (page: PagePlanItem) =>
      zh ? `正在修正第 ${page.index + 1} 页内容问题` : `Fixing content issues on page ${page.index + 1}`,
    reviewingVisuals: (page: PagePlanItem) =>
      zh ? `正在检查第 ${page.index + 1} 页视觉效果` : `Reviewing page ${page.index + 1} visuals`,
    cancelled: zh ? "已停止生成" : "Generation stopped",
    agentSessionCacheMissExhausted: zh
      ? "Agent 会话重试后仍失败，请重跑这一页。"
      : "Agent session failed after retrying. Please retry this page.",
    agentToolsUnavailable: zh
      ? "Agent 会话没有可执行工具权限，无法读取或编辑本地 PPT 工作区文件。请在 app grants drawer 中开启 “Let agent sessions use my tools”，然后重试本页或继续生成。"
      : "Agent sessions cannot use executable tools, so they cannot read or edit local PPT workspace files. Enable “Let agent sessions use my tools” in the app grants drawer, then retry this page or resume generation.",
    finalRender: zh ? "正在生成最终预览" : "Generating final preview",
    deckReady: zh ? "演示文稿已生成" : "Deck generated",
    activeSummary: (input: { active: number; accepted: number; failed: number; total: number }) => {
      if (input.failed > 0) {
        return zh
          ? `${input.failed} 页生成失败，${input.accepted}/${input.total} 页已通过`
          : `${input.failed} pages failed, ${input.accepted}/${input.total} accepted`;
      }
      if (input.active > 0) {
        return zh
          ? `正在生成 ${input.active} 页，${input.accepted}/${input.total} 页已通过`
          : `Generating ${input.active} pages, ${input.accepted}/${input.total} accepted`;
      }
      return zh
        ? `${input.accepted}/${input.total} 页已通过`
        : `${input.accepted}/${input.total} pages accepted`;
    },
    failedSummary: (failedCount: number) =>
      zh
        ? `${failedCount} 页生成失败，请重跑失败页`
        : `${failedCount} pages failed. Retry the failed pages.`,
    streamLabel: (pageIndex: number, kind: string) =>
      zh ? `第 ${pageIndex + 1} 页 · ${kind}` : `Page ${pageIndex + 1} · ${kind}`,
  };
}

function isResearchAgentKind(kind: string) {
  return kind === "research-curation"
    || kind === "web-research-curation"
    || kind === "visual-research-curation";
}

function mapProgress(
  progress: PageProgress | null,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
): DeckGenerationProgressPage[] {
  return progress?.pages.map((page) => ({
    page_id: page.page_id,
    index: page.index,
    title: page.title,
    status: page.status,
    render_attempts: page.render_attempts,
    render_attempt_limit: attemptLimits.render,
    visual_review_attempts: page.visual_review_attempts,
    visual_review_attempt_limit: attemptLimits.visualReview,
    content_review_attempts: page.content_review_attempts ?? 0,
    content_review_attempt_limit: attemptLimits.contentReview,
    agent_failures: page.agent_failures,
    agent_failure_limit: attemptLimits.agent,
    agent_infrastructure_failures: page.agent_infrastructure_failures,
    last_error: page.last_error,
    last_screenshot_path: page.last_screenshot_path,
  })) ?? [];
}

function readWorkspaceSetting(workspace: WorkspaceResult): Record<string, unknown> {
  return workspace.setting && typeof workspace.setting === "object" && !Array.isArray(workspace.setting)
    ? (workspace.setting as Record<string, unknown>)
    : {};
}

function readRenderedDeckFromWorkspace(workspace: WorkspaceResult): RenderDeckHtmlResult | null {
  const pages = workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
    ? workspace.pages as Record<string, unknown>
    : null;
  const rawSlides = Array.isArray(pages?.pages) ? pages.pages : [];
  if (!pages || rawSlides.length === 0) return null;
  const slides = rawSlides.map((item) => {
    const slide = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    return {
      slide_id: typeof slide.page_id === "string" ? slide.page_id : typeof slide.slide_id === "string" ? slide.slide_id : "",
      layout_id: typeof slide.layout_id === "string" ? slide.layout_id : "",
      title: typeof slide.title === "string" ? slide.title : "",
      html_path: typeof slide.html_path === "string" ? slide.html_path : "",
      preview_url: typeof slide.preview_url === "string" ? slide.preview_url : "",
      screenshot_path: typeof slide.screenshot_path === "string" ? slide.screenshot_path : undefined,
      screenshot_url: typeof slide.screenshot_url === "string" ? slide.screenshot_url : undefined,
      speaker_note: typeof slide.speaker_note === "string" ? slide.speaker_note : "",
    };
  });
  if (slides.some((slide) => !slide.html_path)) return null;
  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: typeof pages.manifest_path === "string" ? pages.manifest_path : "",
    output_dir: typeof pages.output_dir === "string" ? pages.output_dir : "",
    preview_url: typeof pages.preview_url === "string" ? pages.preview_url : null,
    slides,
    slide_count: slides.length,
    title: typeof pages.title === "string" ? pages.title : "",
    rendered_at: typeof pages.rendered_at === "string" ? pages.rendered_at : new Date().toISOString(),
  };
}

function getAttemptLimits(input: { workspace: WorkspaceResult }) {
  const settings = readPageReviewSettings(readWorkspaceSetting(input.workspace));
  return {
    ...ATTEMPT_LIMITS,
    contentReview: settings.contentReviewFailureLimit,
    visualReview: settings.visualReviewFailureLimit,
  };
}

function getReviewSettings(input: { workspace: WorkspaceResult }) {
  return readPageReviewSettings(readWorkspaceSetting(input.workspace));
}

function createProgress(
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
): DeckGenerationProgress {
  const activeStreamList = activeStreams
    ? Array.from(activeStreams).sort((left, right) => left.page_index - right.page_index)
    : [];
  return {
    ...value,
    pages: mapProgress(progress, attemptLimits),
    stream: stream ?? undefined,
    activeStreams: activeStreamList.length > 0 ? activeStreamList.map((item) => ({
      ...item,
      lines: [...item.lines],
      activities: [...item.activities],
    })) : undefined,
  };
}

function emit(
  input: Pick<DeckGenerationContext, "onProgress"> & Partial<Pick<DeckGenerationContext, "workspace">>,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
) {
  input.onProgress(createProgress(
    value,
    progress,
    stream,
    activeStreams,
    input.workspace ? getAttemptLimits({ workspace: input.workspace }) : ATTEMPT_LIMITS,
  ));
}

async function recordProgress(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  page: PagePlanItem,
  patch: Record<string, unknown>,
) {
  return input.backend.recordPageProgress({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
    patch,
  });
}

async function recordDeckRecovery(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  patch: {
    status?: NonNullable<PageProgress["recovery"]>["status"];
    run_kind?: NonNullable<PageProgress["recovery"]>["run_kind"];
    step?: string | null;
    target_page_ids?: string[];
    page_refinement_request?: string | null;
    page_refinement_requests?: Record<string, string>;
    deck_refinement_review?: DeckRefinementIntentReviewResult | null;
    error?: string | null;
    final_deck_render?: Partial<NonNullable<PageProgress["final_deck_render"]>>;
    deck_status?: string;
  },
) {
  const { final_deck_render: finalDeckRender, deck_status: deckStatus, ...recovery } = patch;
  return input.backend.recordPageProgress({
    workspace_dir: input.workspace.workspace_dir,
    patch: {
      ...(deckStatus ? { deck_status: deckStatus } : {}),
      recovery,
      ...(finalDeckRender ? { final_deck_render: finalDeckRender } : {}),
    },
  });
}

function throwIfCancelled(input: Pick<DeckGenerationContext, "isCancelled">): void {
  if (input.isCancelled()) {
    throw new AgentRunCancelledError();
  }
}

function extractRenderFailureDiagnosticSummary(error: string): string {
  const diagnosticLine = error
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /:\d+:\d+\s+TS\d+:/.test(line));
  if (diagnosticLine) return diagnosticLine;
  return error.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || error;
}

function extractRenderFailureDiagnosticKey(summary: string): string {
  const match = summary.match(/^(.+?:\d+:\d+)\s+(TS\d+):/);
  return match ? `${match[1]} ${match[2]}` : summary;
}

function summarizeRenderFailureHistory(history: RenderFailureHistoryItem[]) {
  const grouped = new Map<string, {
    attempts: number[];
    phases: Set<RenderFailurePhase>;
    diagnostic: string;
  }>();

  for (const item of history) {
    const diagnostic = extractRenderFailureDiagnosticSummary(item.error);
    const key = extractRenderFailureDiagnosticKey(diagnostic);
    const existing = grouped.get(key);
    if (existing) {
      existing.attempts.push(item.attempt);
      existing.phases.add(item.phase);
      continue;
    }
    grouped.set(key, {
      attempts: [item.attempt],
      phases: new Set([item.phase]),
      diagnostic,
    });
  }

  return Array.from(grouped.values()).map((item) => ({
    attempts: item.attempts,
    phases: Array.from(item.phases),
    repeated_count: item.attempts.length,
    diagnostic: item.diagnostic,
  }));
}

function buildAuthoringPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
  attemptKind: "initial" | "page-refinement" | "render-fix" | "visual-review-fix" | "content-review-fix";
  pageRefinementRequest?: string;
  renderError?: string;
  renderFailureHistory?: RenderFailureHistoryItem[];
  visualReview?: AgentPageVisualReviewResult | null;
  contentReview?: AgentPageContentReviewResult | null;
  pageRefinementVisualContext?: PageRefinementVisualContext;
  noChangeRetry?: NoChangeAuthoringRetry | null;
}) {
  const hasFailureFix = Boolean(input.renderError || input.visualReview || input.contentReview);
  const pageRefinementRequest = input.pageRefinementRequest?.trim() ?? "";
  const renderFailureHistory = (input.renderFailureHistory ?? []).slice(-10);
  const relativeSlidePath = `template/${input.page.slide_path.replace(/^\.\//, "")}`;
  const relativeDataPath = `template/${input.page.data_path.replace(/^\.\//, "")}`;
  const slidePath = `${input.workspaceDir}/${relativeSlidePath}`;
  const dataPath = `${input.workspaceDir}/${relativeDataPath}`;
  const blueprintSourcePath = `${input.workspaceDir}/template/${input.page.blueprint_source.replace(/^\.\//, "")}`;
  const currentPageEvidencePath = `${input.workspaceDir}/research/evidence/pages/${input.page.page_id}.md`;
  const evidenceIndexPath = `${input.workspaceDir}/research/evidence-index.json`;
  const neighborPageTitles = input.pagePlan.pages
    .filter((page) => page.page_id !== input.page.page_id && Math.abs(page.index - input.page.index) <= 1)
    .sort((left, right) => left.index - right.index)
    .map((page) => `- Page ${page.index + 1}: ${page.title}`)
    .join("\n") || "- No neighbor pages";
  const modeSpecificPriority = input.renderError
    ? [
        "This is a render-fix pass. Fix the render error first, and make only design or code changes that support that fix.",
        "For TypeScript diagnostics, fix the exact expression at file:line:column first.",
        "If a source excerpt with a caret is present, treat the caret target as the primary suspect.",
        "Do not infer the failing API from the generic TypeScript message alone.",
        "Do not introduce unrelated redesigns, new content, or broad refactors during render-fix.",
      ].join("\n")
    : input.contentReview
      ? [
          "This is a content-review-fix pass. Fix the language, alignment, or grounding issues reported by Page Content Review first.",
          "Do not perform broad page-structure redesigns during render-fix, visual-review-fix, or content-review-fix.",
          "Prefer editing the current page data JSON. Do not modify outline.json, page-plan.json, other pages, or unrelated shared files.",
          "Do not replace unsupported claims with new unsupported claims. If source support is missing, remove, generalize, or mark the content as TBD / 待补充.",
          "Never satisfy a rewrite request by inventing or approximating real-world numbers.",
        ].join("\n")
      : input.visualReview
        ? [
            "This is a visual-review-fix pass. Fix the visual issue reported by Page Visual Review first.",
            "Make only necessary visual and layout changes, and do not add new factual claims.",
          ].join("\n")
        : pageRefinementRequest
          ? [
              "This is a refinement pass. Apply the user's refinement request to this Page Generation Unit.",
              "For Deck Refinement requests, preserve useful existing page work while applying the whole-deck change and the page-level reason.",
              "You may adjust page structure, component composition, TSX, and data when needed to satisfy the refinement request.",
              "Preserve the Confirmed Outline, Page Plan, and Template boundaries. Treat only facts, numbers, dates, names, and claims explicitly stated in the request as grounding for this refinement run.",
            ].join("\n")
          : "This is an initial authoring pass. Create the best version of this page from the current page plan, template components, and available grounded evidence.";

  return [
    "You are a local file-editing Agent authoring one TSX-first PPT slide.",
    "You are a local file-editing Agent generating one PPT slide.",
    "Edit files directly on disk. Work only on the current page unless a shared component or theme change is truly necessary.",
    "",
    `Authoring mode: ${input.attemptKind}`,
    "",
    "Highest priority:",
    modeSpecificPriority,
    "",
    hasFailureFix
      ? [
          "Failure-fix input:",
          input.renderError && renderFailureHistory.length > 1
            ? [
                "Repeated render failure summary:",
                "The following compressed JSON groups prior render or pre-render check failures for this page in the current run. Use it to avoid repeating the same failed fix.",
                "Each item groups identical diagnostics by file:line:column and TS code when available.",
                JSON.stringify(summarizeRenderFailureHistory(renderFailureHistory), null, 2),
              ].join("\n")
            : "",
          input.renderError ? `Render error to fix:\n${input.renderError}` : "",
          input.visualReview ? `Visual review failed. Fix request:\n${JSON.stringify(input.visualReview)}` : "",
          input.contentReview
            ? [
                "Page Content Review failed. Rewrite request:",
                JSON.stringify(input.contentReview),
                "If the review asks for real facts, numbers, dates, or source-backed data that are not present in workspace files, do not add those facts. Remove, generalize, or mark them as TBD / 待补充.",
              ].join("\n")
            : "",
        ].filter(Boolean).join("\n")
      : "",
    pageRefinementRequest
      ? [
          "Refinement Request:",
          pageRefinementRequest,
          "This is a user-requested refinement for the current Page Generation Unit, not a Page Visual Review failure and not a Page Generation Retry.",
          "Adjust only the current page files. Preserve existing grounded content unless the request explicitly changes it.",
          "Do not infer adjacent facts, complete missing time series, derive unstated metrics, or treat existing generated content as grounding.",
        ].join("\n")
      : "",
    pageRefinementRequest
      ? [
          "Page Refinement Visual Context:",
          input.pageRefinementVisualContext?.screenshotPath
            ? [
                `Screenshot path: ${input.pageRefinementVisualContext.screenshotPath}`,
                `Screenshot source: ${input.pageRefinementVisualContext.source}`,
                "Before editing, first call `upload_local_file` with the screenshot path, then call `analyze_image` on the uploaded image.",
                "Use the image analysis for visual and layout decisions only: hierarchy, density, whitespace, overlap, readability, and visual emphasis.",
                "The screenshot is not factual grounding evidence. Text, numbers, charts, logos, dates, claims, or source names visible in the screenshot are not grounded unless separately present in allowed grounding sources.",
                "If upload or image analysis fails, continue without visual context and mention the degradation in the final JSON notes.",
              ].join("\n")
            : [
                `No screenshot visual context is available: ${input.pageRefinementVisualContext?.unavailableReason ?? "not resolved"}.`,
                "Continue the refinement without visual context. Do not treat any screenshot as factual evidence.",
              ].join("\n"),
        ].join("\n")
      : "",
    input.noChangeRetry
      ? [
          "Previous authoring attempt did not modify the target page files.",
          `No-change retry count: ${input.noChangeRetry.retryCount}`,
          "The previous run completed, but both the current slide TSX and current data JSON had identical file hashes before and after the run.",
          "You must make a real edit to at least one of these target files when the authoring request requires a change:",
          `- ${slidePath}`,
          `- ${dataPath}`,
          input.noChangeRetry.previousChangedFiles.length > 0
            ? `Previous changed_files claim: ${JSON.stringify(input.noChangeRetry.previousChangedFiles)}`
            : "Previous changed_files claim: []",
          input.noChangeRetry.previousSummary
            ? `Previous summary: ${input.noChangeRetry.previousSummary}`
            : "",
          "Do not only return a summary claiming changes.",
        ].filter(Boolean).join("\n")
      : "",
    "",
    "Current page context:",
    `- Workspace directory: ${input.workspaceDir}`,
    `- Deck title: ${input.outline.title || input.pagePlan.title}`,
    `- Output content language: ${readOutlineOutputLanguage(input.outline)}`,
    `- Current page index: ${input.page.index}`,
    `- Current page id: ${input.page.page_id}`,
    `- Current page title: ${input.page.title}`,
    `- Current page outline: ${input.page.outline}`,
    `- Current page Page Plan reason: ${input.page.reason}`,
    `- Current slide TSX path: ${slidePath}`,
    `- Current data JSON path: ${dataPath}`,
    `- Selected blueprint id: ${input.page.blueprint_id}`,
    `- Selected blueprint source: ${blueprintSourcePath}`,
    "",
    [
      "Neighbor pages:",
      neighborPageTitles,
    ].join("\n"),
    "",
    [
      "Before editing, read these files in order:",
      `1. Current slide TSX: ${slidePath}`,
      `2. Current data JSON: ${dataPath}`,
      `3. Current blueprint source: ${blueprintSourcePath}`,
      `4. Workspace outline: ${input.workspaceDir}/outline.json`,
      `5. Workspace page plan: ${input.workspaceDir}/page-plan.json`,
      `6. Template component guide: ${input.workspaceDir}/template/components/README.md`,
      `7. Slide authoring guide: ${input.workspaceDir}/template/slides/README.md`,
      `8. REQUIRED when present, current-page Research Evidence: ${currentPageEvidencePath}`,
      `9. REQUIRED when present, deck-level Research Evidence index: ${evidenceIndexPath}`,
      `Also read ${currentPageEvidencePath} if it exists.`,
      `Also read ${evidenceIndexPath} if it exists.`,
      "10. Before using any component from template/components, read that component's source file.",
    ].join("\n"),
    "",
    [
      "Authoring composition strategy:",
      "- The current slide TSX/data you receive is based on the selected blueprint. Treat it as a starting canvas, not a finished slide.",
      "- Build the page primarily by composing existing template components.",
      "- Do not hand-code bespoke page sections, cards, KPI blocks, charts, or decorative structures when existing template components can express the same intent.",
      "- Add, remove, reorder, resize, or reconfigure components when needed to fit the page message and evidence.",
      "- Avoid mechanically cloning the selected blueprint structure across pages.",
    ].join("\n"),
    "",
    [
      "Grounding rules:",
      "- Treat the current slide TSX and current data JSON as editable draft content, not as factual sources.",
      "Authoring grounding source rules:",
      "- Treat the current slide TSX and current data JSON as editable draft content, not as sources of truth.",
      "- Current generated content must not be used as evidence for new factual claims, numbers, dates, chart data, KPIs, rankings, citations, or source-backed details.",
      "- Allowed grounding sources are only: the user's original prompt; context rows; task_context; uploaded or source material represented in workspace artifacts; Confirmed Outline source prompt/context/task_context; Confirmed Outline text; current Page Plan title/outline/reason when they restate or directly derive from the Confirmed Outline; current-page Research Evidence; Shared Research Evidence; and, in page-refinement mode, facts, numbers, dates, names, and claims explicitly stated in the current Page Refinement Request.",
      "- Not grounding sources: current generated data JSON or slide TSX; generated pages; rendered HTML; screenshots; visual review output; Agent summaries; Raw Research Material; and other pages' Research Evidence unless it is explicitly Shared Research Evidence.",
      "- Do not use Raw Research Material as evidence unless it has been curated into Research Evidence.",
      "- Do not call search tools during Page Authoring.",
      "- If source support is missing, remove the detail, generalize it, or mark it as TBD / 待补充 / 待确认.",
      "- Do not invent facts, numbers, years, rankings, citations, URLs, organization names, market data, customer cases, or chart data for completeness, polish, or realism.",
      "- Analytical conclusions must be clearly derived from provided facts.",
      "- If the requested content requires external knowledge and no source material is available, omit it, generalize it, or mark it as TBD / 待补充 / 待确认.",
    ].join("\n"),
    "",
    [
      "Research Evidence rules:",
      "- Current-page Research Evidence markdown may contain these sections:",
      "  - ## Facts: factual claims you may use on this page.",
      "  - ## Derived Insights: conclusions you may use only when they trace back to supporting fact ids.",
      "  - ## Visual Assets: curated local image assets for this page. Each asset usually includes an id and file_path.",
      "  - ## Gaps: missing or insufficient evidence. Do not fill these gaps yourself.",
      "- Use only content promoted into Research Evidence. Do not read or use raw research files by default.",
      "- If Research Evidence contains gaps, the corresponding concrete details must be omitted, generalized, or marked as TBD / 待补充.",
    ].join("\n"),
    "",
    [
      "Visual asset decision rules:",
      "- If the current-page Research Evidence contains ## Visual Assets, evaluate those assets before deciding the layout.",
      "- If the current page outline or Page Plan asks for photos, logos, cities, stadiums, products, people, places, or other real-world visuals, use at least one relevant Visual Asset by default.",
      "- When using an image, prefer the Visual Asset local file_path. Use image_url only when no file_path is available.",
      "- When writing a local Visual Asset path into slide data or an <img src>, convert the local filesystem path to a file:// URL, for example file:///Users/name/workspace/research/evidence/images/asset.png. Do not write raw relative paths or bare absolute filesystem paths into image URL fields unless the component explicitly expects a filesystem path.",
      "- Skip all Visual Assets only when they are irrelevant to the page intent, visually unusable, unavailable by path, or likely to mislead.",
      "- If you skip Visual Assets, explain why in final JSON visual_assets_skipped_reason.",
      "- Visual Assets are visual evidence only. Text, charts, rankings, numbers, or claims visible inside an image are not grounded facts unless separately listed under ## Facts.",
      "- Image captions, labels, and surrounding explanations must be grounded in ## Facts, Confirmed Outline, or Page Plan.",
    ].join("\n"),
    "",
    [
      "Authoring process:",
      "1. Read the required files.",
      "2. Extract usable facts, derived insights, visual assets, and gaps from current-page Research Evidence.",
      "3. Decide the page-specific message from the current page title, outline, Page Plan reason, available evidence, and output language.",
      "4. Choose 2-4 suitable components or component families from template/components.",
      "5. Judge whether the selected blueprint's default structure fits the current page. If it does not, restructure the current page TSX instead of mechanically filling blueprint fields.",
      "6. Edit the current data JSON and slide TSX.",
      "7. Keep content grounded, layout stable, and export-friendly.",
      "8. Return the required final JSON.",
    ].join("\n"),
    "",
    [
      "Component rules:",
      "- Prefer composing existing template components and blueprint-local patterns.",
      "- Do not hand-code new cards, KPIs, tables, matrices, charts, or decorative structures when an existing component can express the same intent.",
      "- Read the component source file, not only components/README.md.",
      "- Before using or modifying any component from template/components, read the component source file, not only README.",
      "- Treat exported TypeScript props as the component API contract.",
      "- Do not invent prop names from component names or README descriptions.",
      "- Every JSX component call must provide required props with the correct shape.",
      "- Modify shared components or theme only when multiple pages need the same new visual unit or another clear reason exists.",
    ].join("\n"),
    "",
    [
      "TSX hard rules:",
      "- Each slide must be a fixed 1280x720 canvas, with no scrolling and no required interaction.",
      "- Every slide TSX must export Schema, default React component, layoutId, layoutName, and layoutDescription.",
      "- Use zod Schema defaults and parse data before rendering.",
      "- Keep business content in the current data JSON where practical. Use TSX mainly for layout, component composition, hierarchy, data mapping, and stable visual structure.",
      "- Manifest entries must point to ./slides/*.tsx and ./data/*.json.",
      "- Local component imports must use the .js suffix, for example ../components/Foo.js.",
      "- Do not modify blueprints/ or reference-slides/. They are read-only references.",
      "- Keep key titles, body copy, labels, KPIs, and chart explanations as real DOM text, not images or canvas.",
      "- Chart-heavy or graphic-heavy regions may use data-pptx-export=\"screenshot\"; keep surrounding titles and explanations as normal text.",
      "- Follow template/slides/README.md for PPTX export stability guidance.",
      "- Edit only the current page TSX/data by default. Change shared components or theme only when clearly necessary.",
    ].join("\n"),
    "",
    [
      "Numeric and chart rules:",
      "Numeric and chart authoring rules:",
      "- Do not invent, estimate, approximate, or complete plausible-looking numbers. This includes revenue, cash flow, profit, margins, ROE, growth rates, percentages, target ranges, rankings, market share, store counts, user counts, customer counts, years, currency values, chart series values, and table data.",
      "- Do not invent, estimate, approximate, or make up plausible-looking numbers.",
      "- If an evidence source does not provide a concrete number, do not create one for polish, realism, visual balance, or blueprint field needs.",
      "- If a chart, table, or KPI layout is useful but source data is missing, use explicit placeholders: KPI values should be TBD / 待补充 / 待确认; chart series values may be all zero; chart titles, notes, or nearby text must clearly say 数据待补充 / 示意 / 待确认.",
      "- If source data is missing, set chart series values to all zeros and label the chart as 数据待补充 / 示意 / 待确认.",
      "- Without source data, do not use realistic-looking time or metric labels such as FY20-FY23, recent years, quarterly labels, or target lines. Prefer neutral labels such as Phase 1, Phase 2, Phase 3 or Item 1, Item 2.",
      "- Without source data, do not use real-looking time labels such as FY20-FY23.",
      "- chart ticks, minValue, and maxValue may be visual scale controls, but they must not imply real measured ranges unless evidence explicitly supports them.",
      "- Do not describe placeholder numbers as design decisions in final summary notes. If placeholders are used, say that source data is pending.",
    ].join("\n"),
    "",
    [
      "Final response must be a JSON object and must include these fields:",
      JSON.stringify({
        status: "ready_for_render",
        changed_files: [relativeSlidePath, relativeDataPath],
        summary: "...",
        needs_render: true,
        research_evidence_read: true,
        visual_assets_used: ["image-id"],
        visual_assets_skipped_reason: "",
        components_used: ["ComponentName"],
        notes: [],
      }, null, 2),
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveReviewExpectedOutputLanguage(
  outline: WorkspaceOutline,
): string | null {
  const outlineLanguage = normalizeOutputLanguage(outline.output_language);
  if (outlineLanguage !== AUTO_OUTPUT_LANGUAGE) {
    return outlineLanguage;
  }

  const settingLanguage = normalizeOutputLanguage(outline.source?.setting?.output_language);
  return settingLanguage !== AUTO_OUTPUT_LANGUAGE ? settingLanguage : null;
}

function targetPageFilesChanged(
  before: GetWorkspacePageFileFingerprintsResult,
  after: GetWorkspacePageFileFingerprintsResult,
) {
  return before.slide.sha256 !== after.slide.sha256 ||
    before.data.sha256 !== after.data.sha256;
}

function targetPageNoChangeMessage(locale: Locale, page: PagePlanItem) {
  return locale === "zh"
    ? `页面生成失败：Agent 多次完成响应但没有实际修改当前页 TSX 或 data 文件（${page.title || page.page_id}）。`
    : `Page generation failed: the Agent completed multiple times without modifying the current page TSX or data file (${page.title || page.page_id}).`;
}

function targetPageFingerprintReadErrorMessage(locale: Locale, page: PagePlanItem, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return locale === "zh"
    ? `页面生成失败：无法读取当前页 TSX 或 data 文件用于 hash 校验（${page.title || page.page_id}）：${detail}`
    : `Page generation failed: unable to read the current page TSX or data file for hash validation (${page.title || page.page_id}): ${detail}`;
}

async function getTargetPageFileFingerprints(input: RunDeckGenerationInput, page: PagePlanItem) {
  return input.backend.getWorkspacePageFileFingerprints({
    workspace_dir: input.workspace.workspace_dir,
    slide_path: page.slide_path,
    data_path: page.data_path,
  });
}

function buildPageContentReviewPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
  pageRefinementRequest?: string;
}) {
  const expectedOutputLanguage = resolveReviewExpectedOutputLanguage(input.outline);
  const pageRefinementRequest = input.pageRefinementRequest?.trim() ?? "";
  const languageInstruction = expectedOutputLanguage
    ? [
        `Expected output language: ${expectedOutputLanguage}`,
        "Fail with a language issue when the current page's main visible textual content is not in the expected output language.",
      ].join("\n")
    : "No explicit expected output language is available. Language check passes by default; do not fail this review for language.";

  return [
    "You are a Page Content Review agent for one generated PPT slide.",
    "Review only the current page's user-facing textual content: visible slide text plus speaker notes when they are part of the generated page data. Do not judge visual layout quality.",
    "Read these files before judging, in this order:",
    `1. Current data JSON: ${input.workspaceDir}/template/${input.page.data_path.replace(/^\.\//, "")}`,
    `2. Current slide TSX for visibility/schema interpretation: ${input.workspaceDir}/template/${input.page.slide_path.replace(/^\.\//, "")}`,
    `3. Workspace outline: ${input.workspaceDir}/outline.json`,
    `4. Workspace page plan: ${input.workspaceDir}/page-plan.json`,
    `5. Workspace research evidence index if present: ${input.workspaceDir}/research/evidence-index.json`,
    `6. Current page research evidence markdown if present: ${input.workspaceDir}/research/evidence/pages/${input.page.page_id}.md`,
    `7. Workspace setting: ${input.workspaceDir}/setting.json`,
    `8. Workspace task metadata: ${input.workspaceDir}/task.json`,
    "",
    "Data field scope:",
    "- Judge user-visible string values in the current data JSON.",
    "- Judge user-visible numeric values in the current data JSON, including KPI values, percentages, years, ranges, target values, chart labels, chart series values, and table cell values.",
    "- Judge speaker note string values when they are present in the current data JSON.",
    "- Also judge visible hardcoded strings in the current slide TSX when they render as user-facing slide content.",
    "- Use the current slide TSX to distinguish visible content fields from control/configuration fields.",
    "- Do not judge JSON keys, internal _plan fields, enum/control values, file paths, ids, booleans, or non-visible template configuration as language/content issues.",
    "- Allow proper nouns, brand names, product names, organization names, acronyms, numbers, dates, units, and user-provided source terms.",
    "",
    "Language check:",
    languageInstruction,
    "",
    "Outline alignment check is intentionally disabled for this review pass.",
    "Do not return outline_alignment issues. Use the current page title, current page outline, and Page Plan only to understand which page is being reviewed.",
    "",
    "Fact grounding and anti-hallucination check:",
    "Do not use your own world knowledge to approve a claim.",
    "Separate review targets from evidence sources:",
    "- Review targets: current data JSON and current slide TSX visible content. These are the claims being checked.",
    pageRefinementRequest
      ? "- Evidence sources: user prompt, context rows, task_context, uploaded/source material represented in workspace artifacts, Confirmed Outline source prompt/context/task_context, Confirmed Outline text, current-page Research Evidence, Shared Research Evidence, current Page Refinement Request facts explicitly stated below, and the current Page Plan title/outline/reason only when they restate or derive from the Confirmed Outline."
      : "- Evidence sources: user prompt, context rows, task_context, uploaded/source material represented in workspace artifacts, Confirmed Outline source prompt/context/task_context, Confirmed Outline text, current-page Research Evidence, Shared Research Evidence, and the current Page Plan title/outline/reason only when they restate or derive from the Confirmed Outline.",
    "- Not evidence sources: current page data JSON, current page slide TSX, Raw Research Material, stale Research Evidence, other pages' Research Evidence, rendered HTML, screenshots, generated pages, generated slide data, Agent summaries, visual review output, or any content created during the current page authoring run.",
    "A claim is grounded only when it can be traced to an evidence source above. The fact that a value appears in current data JSON or current slide TSX never makes it grounded by itself.",
    pageRefinementRequest
      ? [
          "",
          "Current Page Refinement Request evidence:",
          pageRefinementRequest,
          "For this review pass, only facts, numbers, dates, names, and claims explicitly stated in this Page Refinement Request are grounded by it.",
          "Do not treat the Page Refinement Request as permission to infer adjacent facts, complete missing time series, derive unstated metrics, fabricate related data, or approve generated page content that the request did not explicitly state.",
          "A vague request such as 'use real data' or 'make the numbers accurate' is not evidence for any concrete number.",
        ].join("\n")
      : "",
    "",
    "Anti-hallucination rules:",
    "- Do not approve invented facts, numbers, dates, names, case studies, market sizes, citations, URLs, quotes, rankings, regulatory claims, product capabilities, company/customer details, or chart/table data.",
    "- If a concrete detail is not provided by an evidence source, it must be omitted, generalized, or visibly marked as TBD / 待补充 / 待确认 / 暂无数据.",
    "- Analytical conclusions must be clearly derived from evidence sources. Do not present assumptions, examples, estimates, or illustrative placeholders as real facts.",
    "- Do not approve fabricated evidence just because it makes the slide look complete.",
    "- If the requested content requires external knowledge and no source material is available, the slide should say that source material is needed or use a neutral placeholder.",
    "",
    "Treat these as unsupported unless explicitly present in the evidence sources: numbers, dates, market sizes, growth rates, customer names, case studies, product capabilities, URLs, citations, quotes, rankings, regulatory/legal claims, geography-specific facts, and claims about competitors or named organizations.",
    "Numeric and chart data rules:",
    "- Pay special attention to chart and table data: labels, year labels, category labels, series[].values, percentages, currency values, KPI values, target values, ranges, rankings, growth rates, min/max values when they imply real scale, and chart titles/subtitles that claim a real trend.",
    "- Chart data is not grounded merely because the selected blueprint expects a chart or because the page outline mentions performance, growth, revenue, cash flow, customers, or digital transformation.",
    "- Do not approve plausible-looking placeholder numbers such as FY values, percentages, revenue, cash flow, ROE, store counts, market share, or growth rates unless an evidence source provides them.",
    "- Chart ticks, minValue, and maxValue can be treated as visual scale controls only when they do not assert a real value range. If they combine with real labels or titles to imply actual data, review them as numeric claims.",
    "- All-zero chart/table series can pass only when the visible chart title, subtitle, note, or nearby text clearly marks the data as TBD / 待补充 / 示意.",
    "Clear placeholders such as TBD, 待补充, 待确认, 暂无数据, or 数据待补充 are acceptable grounding treatments when the workspace lacks source material. Do not report them as grounding issues solely because the page openly marks a fact or chart as pending.",
    "Chart or table placeholder values such as all-zero series can pass grounding when the visible chart title, subtitle, note, or nearby text clearly marks the data as TBD / 待补充 / 示意. If you need to mention them, use type placeholder_quality with low severity, not type grounding.",
    "Unsupported concrete facts, numbers, dates, years, chart data, or named-organization claims that are not present in workspace artifacts must be reported as type grounding, must set pass=false, and must include a concrete rewrite_request. Never downgrade unsupported concrete facts to placeholder_quality or low-severity advisory issues.",
    "Never ask the authoring agent to replace placeholders with real facts, numbers, dates, or chart data unless you can point to the exact workspace artifact that provides those facts. Without such a source, rewrite_request must ask to remove, soften, generalize, or mark the content as TBD / 待补充.",
    "Generic business phrasing can pass if it is clearly not presented as a concrete fact.",
    "For each grounding issue, evidence should quote the problematic text or value and include the data field path or TSX location when available.",
    "For each grounding issue, reason must state which evidence sources were checked and that none provide the claim.",
    "rewrite_request must be actionable for the authoring agent, scoped to the current page, and should name the exact text or field to change when possible.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[{"type":"language","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"grounding","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"placeholder_quality","severity":"low","evidence":"...","reason":"...","fix_hint":"..."}],"rewrite_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    "Use score 0-10. pass=true requires score >= 7, confidence not low, no language or grounding issues.",
    "placeholder_quality issues are advisory and may pass when score and confidence are sufficient. language and grounding issues require pass=false and a concrete rewrite_request.",
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Full outline JSON: ${JSON.stringify(input.outline)}`,
    `Full page plan JSON: ${JSON.stringify(input.pagePlan)}`,
  ].join("\n");
}

function buildPageVisualReviewPrompt(input: {
  page: PagePlanItem;
  screenshotPath: string;
  preview: RenderWorkspacePagePreviewResult;
}) {
  return [
    "You are a Page Visual Review agent for one generated PPT slide.",
    "Review only the generated PPT slide screenshot for visual quality.",
    "Do not judge output language, outline alignment, factual grounding, unsupported claims, or content correctness.",
    "Do not fail a slide merely because some content is explicitly marked TBD / 待补充; judge only whether the placeholder is visually clear, readable, and does not break the layout.",
    "First use `upload_local_file` on the screenshot path, then inspect that uploaded image with `analyze_image` before making a visual judgment.",
    "If image analysis is unavailable or inconclusive, use the rendered HTML path as fallback context and still return a JSON review.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[],"revision_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    `Screenshot path: ${input.screenshotPath}`,
    `Page title for identification only: ${input.page.title}`,
    `Rendered HTML path: ${input.preview.html_path}`,
    "",
    "Pass only if the slide looks like a complete PPT page, has no obvious overlap/cutoff/blank errors, uses readable text, renders all intended visual regions, and fits the selected template style.",
    "Use score 0-10. pass=true requires score >= 7.",
  ].join("\n");
}

function visualReviewPassed(review: AgentPageVisualReviewResult) {
  return review.pass && review.score >= 7 && review.confidence !== "low";
  // return true; // 先关闭自评结果中的置信度判断，后续根据实际情况再调整
}

function contentReviewIssueBlocksPass(issue: AgentPageContentReviewResult["issues"][number]) {
  return issue.type !== "placeholder_quality";
}

function contentReviewPassed(review: AgentPageContentReviewResult) {
  const hasFailingIssue = review.issues.some(contentReviewIssueBlocksPass);
  return review.pass && review.score >= 7 && review.confidence !== "low" && !hasFailingIssue;
}

function getProgressPage(progress: PageProgress | null, pageId: string) {
  return progress?.pages.find((page) => page.page_id === pageId) ?? null;
}

function getStoredVisualReview(
  page: PageProgress["pages"][number] | null | undefined,
): AgentPageVisualReviewResult | null {
  return (page?.visual_review ?? page?.review ?? null) as AgentPageVisualReviewResult | null;
}

function getStoredContentReview(
  page: PageProgress["pages"][number] | null | undefined,
): AgentPageContentReviewResult | null {
  return (page?.content_review ?? page?.review ?? null) as AgentPageContentReviewResult | null;
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function pushBounded(list: string[], value: string, limit: number) {
  const cleanValue = value.trim();
  if (!cleanValue) return;
  list.push(cleanValue);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function appendTextToLines(lines: string[], chunk: string, limit: number) {
  if (!chunk) return;
  const parts = chunk.split(/\n/);
  if (lines.length === 0) lines.push("");
  lines[lines.length - 1] += parts[0];
  for (const part of parts.slice(1)) {
    lines.push(part);
  }
  if (lines.length > limit) {
    lines.splice(0, lines.length - limit);
  }
}

function classifyRenderFailurePhase(message: string): RenderFailurePhase {
  return message.includes("Pre-render TypeScript check failed")
    ? "pre-render-typecheck"
    : "render";
}

function createAgentRunTracker(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  step: DeckGenerationStep;
  message: string;
  totalPages: number;
  progress: () => PageProgress | null;
  prompt: string;
  kind: string;
  operationId?: string;
  logContext?: AiOperationLogContext;
}) {
  const startedAt = new Date().toISOString();
  const isResearchOperation = isResearchAgentKind(input.kind);
  const operationId = input.logContext?.operation_id ?? input.operationId ?? (
    input.flowInput.aiLogger
      ? input.flowInput.aiLogger.createOperationId(
          isResearchOperation ? "research" : "page_agent",
          input.kind,
        )
      : `${input.page.page_id}-${input.kind}-${Date.now().toString(36)}`
  );
  const logContext: AiOperationLogContext | undefined = input.flowInput.aiLogger
    ? input.logContext ?? {
        logger: input.flowInput.aiLogger,
        workspace_dir: input.flowInput.workspace.workspace_dir,
        domain: (isResearchOperation ? "research" : "page_agent") as AiOperationLogContext["domain"],
        operation: input.kind,
        operation_id: operationId,
        page_id: input.page.page_id,
        page_index: input.page.index,
        kind: input.kind,
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
  const stream: DeckGenerationStream = {
    run_id: operationId,
    kind: input.kind,
    page_id: input.page.page_id,
    page_index: input.page.index,
    status: input.message,
    lines: [],
    activities: [],
    started_at: startedAt,
    updated_at: startedAt,
  };
  const activities: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  const streamEvents: Array<Record<string, unknown>> = [];
  let flushedStreamEventCount = 0;
  let usage: unknown = null;

  function emitStream() {
    stream.updated_at = new Date().toISOString();
    input.flowInput.activeStreams.set(operationId, stream);
    emit(
      input.flowInput,
      {
        step: input.step,
        message: buildDeckGenerationSummary(input.flowInput, input.progress(), input.totalPages),
        currentPageIndex: input.page.index,
        totalPages: input.totalPages,
      },
      input.progress(),
      stream,
      input.flowInput.activeStreams.values(),
    );
  }

  async function flushStreamBatch(force = false) {
    if (!input.flowInput.aiLogger || !logContext) return;
    const pending = streamEvents.slice(flushedStreamEventCount);
    if (pending.length === 0) return;
    if (!force && pending.length < 10) return;
    flushedStreamEventCount = streamEvents.length;
    await input.flowInput.aiLogger.appendStreamBatch(logContext, {
      operation_id: operationId,
      interaction_id: logContext.interaction_ids?.at(-1),
      events: pending,
    });
  }

  function recordStreamEvent(event: AgentStreamEvent) {
    streamEvents.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    if (streamEvents.length - flushedStreamEventCount >= 10) {
      void flushStreamBatch();
    }
  }

  return {
    onStreamEvent(event: AgentStreamEvent) {
      recordStreamEvent(event);
      if (event.type === "content") {
        appendTextToLines(stream.lines, event.text, 30);
      } else if (event.type === "activity") {
        activities.push(event);
        pushBounded(stream.activities, event.message, 12);
      } else if (event.type === "error") {
        errors.push(event);
        pushBounded(stream.activities, event.message, 12);
      } else if (event.type === "complete") {
        usage = event.usage ?? usage;
        pushBounded(stream.activities, "Agent run completed", 12);
      }
      emitStream();
    },
    logContext,
    operationId,
    async flush(status: "completed" | "error", extra: Record<string, unknown>) {
      const endedAt = new Date().toISOString();
      const baseEntry = {
        event: isResearchOperation
          ? "ai.research.curation.operation.finished"
          : "ai.page_agent.operation.finished",
        schema_version: 1,
        operation_id: operationId,
        interaction_ids: logContext?.interaction_ids ?? [],
        page_id: input.page.page_id,
        page_index: input.page.index,
        kind: input.kind,
        status,
        prompt_hash: shortHash(input.prompt),
        started_at: startedAt,
        ended_at: endedAt,
        usage,
        ...extra,
      };
      try {
        await input.flowInput.backend.appendWorkspaceLog({
          workspace_dir: input.flowInput.workspace.workspace_dir,
          channel: isResearchOperation ? "ai-research" : "ai-page-agent",
          entry: baseEntry,
        });
        await flushStreamBatch(true);
      } catch {
        // Logging must never fail Deck Generation.
      } finally {
        stream.status = status;
        stream.updated_at = endedAt;
        emitStream();
        input.flowInput.activeStreams.delete(operationId);
        emit(
          input.flowInput,
          {
            step: input.step,
            message: buildDeckGenerationSummary(input.flowInput, input.progress(), input.totalPages),
            currentPageIndex: input.page.index,
            totalPages: input.totalPages,
          },
          input.progress(),
          null,
          input.flowInput.activeStreams.values(),
        );
      }
    },
  };
}

async function appendWorkspaceLogSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  channel: "ai-page-plan" | "ai-page-agent" | "ai-page-agent-stream",
  entry: Record<string, unknown>,
) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspace.workspace_dir,
      channel,
      entry,
    });
  } catch {
    // Logging must never fail Deck Generation.
  }
}

function readWorkspaceTemplate(workspace: WorkspaceResult) {
  return workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
    ? (workspace.template as { selected_template_group?: unknown; manifest_path?: unknown })
    : null;
}

function progressMatchesPlan(pagePlan: PagePlan, progress: PageProgress) {
  const progressIds = new Set(progress.pages.map((page) => page.page_id));
  return pagePlan.pages.every((page) => progressIds.has(page.page_id));
}

function pagePlanMatchesOutlineItems(pagePlan: PagePlan, outline: WorkspaceOutline) {
  return pagePlan.pages.every((page, index) => {
    const item = outline.items[index];
    return (
      item &&
      page.title.trim() === item.title.trim() &&
      page.outline.trim() === item.outline.trim()
    );
  });
}

function pagePlanMatchesOutlineAndTemplate(
  workspace: WorkspaceResult,
  pagePlan: PagePlan,
  progress: PageProgress | null,
  outline: WorkspaceOutline,
) {
  if (
    pagePlan.source.outline_updated_at &&
    outline.updated_at &&
    pagePlan.source.outline_updated_at !== outline.updated_at
  ) {
    if (!pagePlanMatchesOutlineItems(pagePlan, outline)) {
      return false;
    }
  }

  if (pagePlan.pages.length !== outline.items.length) {
    return false;
  }

  const template = readWorkspaceTemplate(workspace);
  const selectedTemplate =
    typeof template?.selected_template_group === "string" ? template.selected_template_group : "";
  const manifestPath = typeof template?.manifest_path === "string" ? template.manifest_path : "";
  if (manifestPath && pagePlan.source.template_manifest_path !== manifestPath) {
    return false;
  }
  if (!manifestPath && selectedTemplate && pagePlan.source.template_group !== selectedTemplate) {
    return false;
  }

  return progress ? progressMatchesPlan(pagePlan, progress) : true;
}

function createEmptyResearchPlan(input: {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  generatedBy: string;
}): ResearchPlan {
  return {
    version: 1,
    status: "planned",
    title: input.pagePlan.title,
    source: {
      outline_updated_at: input.outline.updated_at,
      page_plan_updated_at: input.pagePlan.updated_at,
      template_group: input.pagePlan.source.template_group,
      generated_by: input.generatedBy,
    },
    pages: input.pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
      image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
      reason: "Research Planning unavailable or no external research needed.",
    })),
    shared: {
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
    },
    updated_at: new Date().toISOString(),
  };
}

function getResearchRequirement(researchPlan: ResearchPlan | null, page: PagePlanItem): ResearchRequirement | null {
  return researchPlan?.pages.find((item) => item.page_id === page.page_id) ?? null;
}

function researchNeeded(requirement: ResearchRequirement | null): boolean {
  return Boolean(requirement?.web_research_needed || requirement?.image_research_needed);
}

function normalizeResearchEvidenceIndex(value: ResearchEvidenceIndex | null | undefined): ResearchEvidenceIndex {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
  const shared = record?.shared && typeof record.shared === "object" && !Array.isArray(record.shared)
    ? record.shared
    : null;
  return {
    version: 1,
    status:
      record?.status === "partial" || record?.status === "curated"
        ? record.status
        : "empty",
    pages: Array.isArray(record?.pages) ? record.pages : [],
    shared: {
      facts: Array.isArray(shared?.facts) ? shared.facts : [],
      visual_assets: Array.isArray(shared?.visual_assets) ? shared.visual_assets : [],
      gaps: Array.isArray(shared?.gaps) ? shared.gaps : [],
    },
    updated_at: typeof record?.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

function buildWebResearchCurationPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawWebIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  return [
    "You are a Web Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw web material, select only useful facts, source judgments, derived insights, rejected material, and gaps, then write a Web Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    `Raw web index paths: ${JSON.stringify(input.rawWebIndexPaths)}`,
    `Web draft JSON path to write: ${input.draftPath}`,
    "",
    "Source quality rules:",
    "- Prefer official websites, company reports, government/regulatory sources, industry associations, recognized research institutions, authoritative media, and documentation.",
    "- Reject obvious SEO, source-less, low-quality, forum-like, or unrelated material as factual evidence.",
    "- If sources conflict, record the conflict instead of guessing.",
    "- Material without a publication date must not be presented as latest.",
    "",
    "Tool boundary:",
    "- Do not call search, browser, or network tools during Web Research Curation.",
    "- Do not use nats_ddg_search, browser_create_instance, web search, image search, or ad-hoc network access.",
    "- Curate only from the Raw web index paths listed above and existing workspace/user-provided artifacts.",
    "- If the listed raw index paths are empty, missing, or insufficient, write a Research Evidence Gap instead of searching yourself.",
    "",
    input.previousGateFailure
      ? [
          "Previous deterministic gate failure:",
          input.previousGateFailure,
          "Rerun Web Research Curation from the same Raw web index paths and write a valid current draft.",
        ].join("\n")
      : "",
    "",
    "Write exactly one JSON object to the Web draft JSON path. Draft JSON shape:",
    '{"version":1,"page_id":"...","curation_run_id":"...","draft_type":"web","status":"curated","facts":[{"id":"fact-1","claim":"...","source_type":"web_source","source_title":"...","source_url":"...","source_file":"...","excerpt":"...","confidence":"medium"}],"derived_insights":[{"id":"insight-1","insight":"...","supporting_fact_ids":["fact-1"]}],"gaps":["..."],"rejected_material":[{"source":"...","reason":"..."}],"source_summary":"...","updated_at":"..."}',
    "Fact source_type must be exactly one of: user_provided, web_source, image_source.",
    "Do not include visual_assets in this draft.",
    "If factual evidence is insufficient, write status gap and explain gaps. Page Generation will continue.",
    "Final response must be a short JSON object: {\"status\":\"curated\",\"summary\":\"...\",\"gaps\":[\"...\"]}",
  ].join("\n");
}

function buildVisualResearchCurationPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawImageIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  return [
    "You are a Visual Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw image material, select only useful visual assets, visual judgments, rejected material, and gaps, then write a Visual Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    `Raw image index paths: ${JSON.stringify(input.rawImageIndexPaths)}`,
    `Visual draft JSON path to write: ${input.draftPath}`,
    "",
    "Image rules:",
    "- For downloaded image candidates, first use upload_local_file on the local image path, then analyze_image before selecting it.",
    "- Select an image only if it fits the current page intent and is visually usable.",
    "- Text, chart data, rankings, or claims visible inside a selected image are not grounded facts.",
    "- Do not emit facts or derived_insights in this draft.",
    "",
    "Tool boundary:",
    "- Do not call search, browser, or network tools during Visual Research Curation.",
    "- Do not use nats_ddg_search, browser_create_instance, web search, image search, or ad-hoc network access.",
    "- Curate only from the Raw image index paths listed above and existing workspace/user-provided artifacts.",
    "- If the listed raw index paths are empty, missing, or insufficient, write a Research Evidence Gap instead of searching yourself.",
    "",
    input.previousGateFailure
      ? [
          "Previous deterministic gate failure:",
          input.previousGateFailure,
          "Rerun Visual Research Curation from the same Raw image index paths and write a valid current draft.",
        ].join("\n")
      : "",
    "",
    "Write exactly one JSON object to the Visual draft JSON path. Draft JSON shape:",
    '{"version":1,"page_id":"...","curation_run_id":"...","draft_type":"visual","status":"curated","visual_assets":[{"id":"image-1","file_path":"...","original_raw_path":"...","image_url":"...","page_url":"...","sha256":"...","reason":"...","visual_summary":"..."}],"gaps":["..."],"rejected_material":[{"source":"...","reason":"..."}],"visual_summary":"...","updated_at":"..."}',
    "Image analysis may support visual_assets.reason or visual_assets.visual_summary, but it is not a valid fact source_type.",
    "If visual evidence is insufficient, write status gap and explain gaps. Page Generation will continue.",
    "Final response must be a short JSON object: {\"status\":\"curated\",\"summary\":\"...\",\"gaps\":[\"...\"]}",
  ].join("\n");
}

function createResearchCurationRunId(page: PagePlanItem, kind: "web" | "visual"): string {
  return `research-${kind}-${page.page_id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeNonEmptyStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleanValue = value.trim();
    if (!cleanValue || seen.has(cleanValue)) continue;
    seen.add(cleanValue);
    result.push(cleanValue);
  }
  return result;
}

function researchDraftFingerprintChanged(
  before: ResearchCurationDraftFingerprint,
  after: ResearchCurationDraftFingerprint,
): boolean {
  if (!after.exists) return false;
  if (!before.exists) return true;
  return before.sha256 !== after.sha256 || before.size_bytes !== after.size_bytes;
}

function summarizeResearchDraftGateFailure(input: {
  kind: "web" | "visual";
  curationRunId: string;
  beforeFingerprint: ResearchCurationDraftFingerprint;
  afterFingerprint: ResearchCurationDraftFingerprint;
  validationGaps: string[];
}): string {
  const label = input.kind === "web" ? "Web" : "Visual";
  const reasons: string[] = [];
  if (!input.afterFingerprint.exists) {
    reasons.push(`${label} Research Curation draft was not written.`);
  } else if (!researchDraftFingerprintChanged(input.beforeFingerprint, input.afterFingerprint)) {
    reasons.push(`${label} Research Curation draft fingerprint did not change.`);
  }
  for (const gap of input.validationGaps) {
    reasons.push(gap);
  }
  if (reasons.length === 0) {
    reasons.push(`${label} Research Curation draft did not pass deterministic validation.`);
  }
  return dedupeNonEmptyStrings(reasons).join("\n");
}

async function appendResearchLogSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  entry: Record<string, unknown>,
) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspace.workspace_dir,
      channel: "ai-research",
      entry,
    });
  } catch {
    // Research logging must never fail Deck Generation.
  }
}

async function recordResearchGapForPage(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  evidenceMarkdownPath: string;
  gaps: string[];
}) {
  await input.flowInput.backend.recordResearchEvidencePage({
    workspace_dir: input.flowInput.workspace.workspace_dir,
    page_evidence: {
      page_id: input.page.page_id,
      status: "gap",
      facts: [],
      visual_assets: [],
      derived_insights: [],
      gaps: input.gaps,
      rejected_material: [],
      markdown_path: input.evidenceMarkdownPath,
    },
  });
  await input.flowInput.backend.recordResearchStatusPage({
    workspace_dir: input.flowInput.workspace.workspace_dir,
    page_status: {
      page_id: input.page.page_id,
      status: "gap",
      message: input.gaps.join("\n"),
      evidence_path: input.evidenceMarkdownPath,
    },
  });
}

async function runResearchDraftAgent(input: {
  flowInput: DeckGenerationRuntime;
  pagePlan: PagePlan;
  page: PagePlanItem;
  kind: "web" | "visual";
  curationRunId: string;
  buildPrompt: (previousGateFailure?: string) => string;
  draftPath: string;
  currentGaps: string[];
}): Promise<WebResearchCurationDraft | VisualResearchCurationDraft | null> {
  const { flowInput, page, pagePlan, kind } = input;
  const text = generationText(flowInput.locale);
  const agentKind = kind === "web" ? "web-research-curation" : "visual-research-curation";
  const curationRunId = input.curationRunId;
  const initialPrompt = input.buildPrompt();
  const tracker = createAgentRunTracker({
    flowInput,
    page,
    kind: agentKind,
    step: "research-curation",
    message: kind === "web" ? text.curatingFacts(page) : text.curatingImages(page),
    prompt: initialPrompt,
    totalPages: pagePlan.pages.length,
    progress: flowInput.getProgress,
  });
  const attemptLog: Array<{
    attempt: number;
    prompt_kind: "initial" | "retry";
    before_fingerprint: ResearchCurationDraftFingerprint;
    after_fingerprint: ResearchCurationDraftFingerprint;
    validation_gaps: string[];
    gate_passed: boolean;
    retry_prompt_reason?: string;
  }> = [];
  let attempt = 0;

  try {
    let currentPrompt = initialPrompt;
    let beforeFingerprint: ResearchCurationDraftFingerprint;
    try {
      beforeFingerprint = await flowInput.backend.getResearchCurationDraftFingerprint({
        workspace_dir: flowInput.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: kind,
      });
    } catch {
      beforeFingerprint = {
        workspace_dir: flowInput.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: kind,
        draft_path: input.draftPath,
        exists: false,
      };
    }

    while (!flowInput.isCancelled()) {
      attempt += 1;
      const logPrompt = attempt === 1 ? initialPrompt : currentPrompt;
      const attemptKind = attempt === 1 ? "initial" : "retry";
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.attempt`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        curation_run_id: curationRunId,
        attempt,
        attempt_kind: attemptKind,
        updated_at: new Date().toISOString(),
      });
      await flowInput.agentClient.runAuthoringPrompt(
        logPrompt,
        buildAgentRunOptions(flowInput, tracker.onStreamEvent, tracker.logContext),
      );
      throwIfCancelled(flowInput);

      let afterFingerprint: ResearchCurationDraftFingerprint;
      try {
        afterFingerprint = await flowInput.backend.getResearchCurationDraftFingerprint({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
        });
      } catch {
        afterFingerprint = {
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft_path: input.draftPath,
          exists: false,
        };
      }

      const rawDraft = await flowInput.backend.getResearchCurationDraft({
        workspace_dir: flowInput.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: kind,
      });
      throwIfCancelled(flowInput);
      const validation = kind === "web"
        ? validateWebResearchCurationDraft(rawDraft, page.page_id, {
            curationRunId,
            draftType: kind,
          })
        : validateVisualResearchCurationDraft(rawDraft, page.page_id, {
            curationRunId,
            draftType: kind,
          });
      const fingerprintChanged = researchDraftFingerprintChanged(beforeFingerprint, afterFingerprint);
      const gatePassed = Boolean(validation.draft) && afterFingerprint.exists && fingerprintChanged;
      const failureSummary = summarizeResearchDraftGateFailure({
        kind,
        curationRunId,
        beforeFingerprint,
        afterFingerprint,
        validationGaps: validation.gaps,
      });
      attemptLog.push({
        attempt,
        prompt_kind: attemptKind,
        before_fingerprint: beforeFingerprint,
        after_fingerprint: afterFingerprint,
        validation_gaps: validation.gaps,
        gate_passed: gatePassed,
        retry_prompt_reason: gatePassed ? undefined : failureSummary,
      });

      if (gatePassed && validation.draft) {
        await flowInput.backend.recordResearchCurationDraft({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft: validation.draft as never,
        });
        throwIfCancelled(flowInput);
        await tracker.flush("completed", {
          draft_type: kind,
          curation_run_id: curationRunId,
          attempts: attemptLog,
          final_gate: "passed",
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.finished`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          curation_run_id: curationRunId,
          status: validation.draft.status,
          gaps: validation.draft.gaps,
          updated_at: new Date().toISOString(),
        });
        return validation.draft;
      }

      input.currentGaps.push(failureSummary);
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.invalid`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        curation_run_id: curationRunId,
        attempt,
        gaps: validation.gaps,
        fingerprint_changed: fingerprintChanged,
        updated_at: new Date().toISOString(),
      });

      if (attempt >= LOCAL_GATE_REPAIR_LIMIT + 1) {
        const gapDraft = kind === "web"
          ? createWebResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: dedupeNonEmptyStrings([...input.currentGaps, failureSummary]),
              curationRunId,
            })
          : createVisualResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: dedupeNonEmptyStrings([...input.currentGaps, failureSummary]),
              curationRunId,
            });
        await flowInput.backend.recordResearchCurationDraft({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft: gapDraft as never,
        });
        await tracker.flush("completed", {
          draft_type: kind,
          curation_run_id: curationRunId,
          attempts: attemptLog,
          final_gate: "gap",
          final_gap_count: gapDraft.gaps.length,
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.gap`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          curation_run_id: curationRunId,
          gaps: gapDraft.gaps,
          updated_at: new Date().toISOString(),
        });
        return gapDraft;
      }

      currentPrompt = input.buildPrompt(failureSummary);
      beforeFingerprint = afterFingerprint;
      throwIfCancelled(flowInput);
    }

    throw new AgentRunCancelledError();
  } catch (error) {
    if (isAgentRunCancelledError(error)) {
      await tracker.flush("error", { draft_type: kind, cancelled: true, curation_run_id: curationRunId, attempts: attemptLog });
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.cancelled`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        curation_run_id: curationRunId,
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
    await tracker.flush("error", { draft_type: kind, error: error instanceof Error ? error.message : String(error), curation_run_id: curationRunId, attempts: attemptLog });
    const message = `${kind === "web" ? "Web" : "Visual"} Research Curation failed: ${error instanceof Error ? error.message : String(error)}`;
    input.currentGaps.push(message);
    await appendResearchLogSafe(flowInput, {
      event: `ai.research.${kind}_curation.failed`,
      schema_version: 1,
      page_id: page.page_id,
      page_index: page.index,
      draft_path: input.draftPath,
      curation_run_id: curationRunId,
      error: message,
      updated_at: new Date().toISOString(),
    });
    return null;
  }
}

async function generateAndRecordResearchPlan(
  input: RunDeckGenerationInput,
  pagePlan: PagePlan,
): Promise<ResearchPlan> {
  const text = generationText(input.locale);
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "research-planning",
    target_page_ids: pagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "research-planning",
      message: text.researchPlanning,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    null,
  );

  await input.backend.prepareResearchWorkspace({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  const logContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "generate_research_plan",
        operation_id: input.aiLogger.createOperationId("page_plan", "generate_research_plan"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;

  let researchPlan: ResearchPlan;
  try {
    researchPlan = assertResearchPlanAligned({
      researchPlan: await input.aiClient.generateResearchPlan({
        outline: input.confirmedOutline,
        pagePlan,
        locale: input.locale,
        logContext,
      }),
      pagePlan,
    });
    throwIfCancelled(input);
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    researchPlan = createEmptyResearchPlan({
      outline: input.confirmedOutline,
      pagePlan,
      generatedBy: "fallback",
    });
    await appendResearchLogSafe(input, {
      event: "ai.research.planning.failed",
      schema_version: 1,
      status: "gap",
      error: error instanceof Error ? error.message : String(error),
      fallback: "empty_research_plan",
      updated_at: new Date().toISOString(),
    });
  }

  const recorded = await input.backend.recordResearchPlan({
    workspace_dir: input.workspace.workspace_dir,
    research_plan: researchPlan,
  });
  throwIfCancelled(input);
  await input.backend.recordResearchStatus({
    workspace_dir: input.workspace.workspace_dir,
    status: {
      version: 1,
      status: "ready",
      pages: recorded.pages.map((page) => ({
        page_id: page.page_id,
        status: researchNeeded(page) ? "planned" : "skipped",
        message: page.reason,
        updated_at: new Date().toISOString(),
      })),
      updated_at: new Date().toISOString(),
    },
  });
  throwIfCancelled(input);
  return recorded;
}

async function collectAndCurateResearchForPage(
  input: DeckGenerationRuntime,
  pagePlan: PagePlan,
  page: PagePlanItem,
): Promise<void> {
  throwIfCancelled(input);
  const researchPlan = await input.backend.getResearchPlan({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const requirement = getResearchRequirement(researchPlan, page);
  if (!researchNeeded(requirement)) return;
  const pageRequirement = requirement as ResearchRequirement;
  const currentEvidence = normalizeResearchEvidenceIndex(
    await input.backend.getResearchEvidence({
      workspace_dir: input.workspace.workspace_dir,
    }),
  );
  throwIfCancelled(input);
  const existingEvidence = currentEvidence.pages.find((item) => item.page_id === page.page_id);
  const isPageRefinement = Boolean(input.pageRefinementRequests?.[page.page_id]?.trim());
  const initialResearchStatus = await input.backend.getResearchStatus({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const deltaQueries = computeResearchQueryDelta({
    status: initialResearchStatus,
    pageId: page.page_id,
    requirement: pageRequirement,
  });
  if (
    existingEvidence?.status === "curated" &&
    (!isPageRefinement || (
      deltaQueries.webQueries.length === 0 &&
      deltaQueries.imageQueries.length === 0
    ))
  ) {
    await appendResearchLogSafe(input, {
      event: "ai.research.page.reused",
      schema_version: 1,
      page_id: page.page_id,
      page_index: page.index,
      evidence_path: existingEvidence.markdown_path,
      status: "curated",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const text = generationText(input.locale);
  const paths = await input.backend.prepareResearchWorkspace({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  let progress = await recordProgress(input, page, { status: "research_collecting" });
  input.setProgress(progress);
  emitRuntime(
    input,
    {
      step: "research-collection",
      message: text.collectingSources(page),
      currentPageIndex: page.index,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  const rawWebIndexPaths: string[] = [];
  const rawImageIndexPaths: string[] = [];
  const webCollections: Array<{ query: string; raw_index_path?: string }> = [];
  const imageCollections: Array<{ query: string; raw_index_path?: string }> = [];
  const gaps: string[] = [];

  if (pageRequirement.web_research_needed) {
    for (const query of deltaQueries.webQueries) {
      throwIfCancelled(input);
      try {
        const search = await input.backend.webSearch({
          query,
          max_results: 6,
          safesearch: "moderate",
        });
        throwIfCancelled(input);
        const urls = search.results.map((item) => item.url).filter(Boolean).slice(0, 5);
        if (urls.length === 0) {
          gaps.push(`No web search results for: ${query}`);
          webCollections.push({ query });
          continue;
        }
        const fetched = await input.backend.webFetch({
          urls,
          output_dir: paths.raw_web_dir,
          format: "text_markdown",
          max_chars: 12000,
        });
        throwIfCancelled(input);
        if (fetched.index_path) {
          rawWebIndexPaths.push(fetched.index_path);
          webCollections.push({ query, raw_index_path: fetched.index_path });
        } else {
          gaps.push(`Web fetch did not return an index path for: ${query}`);
          webCollections.push({ query });
        }
      } catch (error) {
        if (isAgentRunCancelledError(error)) throw error;
        gaps.push(`Web research failed for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (pageRequirement.image_research_needed) {
    for (const query of deltaQueries.imageQueries) {
      throwIfCancelled(input);
      try {
        const search = await input.backend.imageSearch({
          query,
          max_results: 8,
          safesearch: "moderate",
        });
        throwIfCancelled(input);
        const urls = search.results
          .filter((item) => !item.width || !item.height || (item.width >= 480 && item.height >= 270))
          .map((item) => item.image_url)
          .filter(Boolean)
          .slice(0, 4);
        if (urls.length === 0) {
          gaps.push(`No image search results for: ${query}`);
          imageCollections.push({ query });
          continue;
        }
        const fetched = await input.backend.imageFetch({
          urls,
          output_dir: paths.raw_images_dir,
        });
        throwIfCancelled(input);
        if (fetched.index_path) {
          rawImageIndexPaths.push(fetched.index_path);
          imageCollections.push({ query, raw_index_path: fetched.index_path });
        } else {
          gaps.push(`Image fetch did not return an index path for: ${query}`);
          imageCollections.push({ query });
        }
      } catch (error) {
        if (isAgentRunCancelledError(error)) throw error;
        gaps.push(`Image research failed for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const evidenceMarkdownPath = `${paths.evidence_pages_dir}/${page.page_id}.md`;
  const webDraftPath = `${paths.evidence_drafts_dir}/${page.page_id}-web.json`;
  const visualDraftPath = `${paths.evidence_drafts_dir}/${page.page_id}-visual.json`;
  if (deltaQueries.webQueries.length > 0 && rawWebIndexPaths.length === 0) {
    gaps.push("No raw web material was collected for this page.");
  }
  if (deltaQueries.imageQueries.length > 0 && rawImageIndexPaths.length === 0) {
    gaps.push("No raw image material was collected for this page.");
  }

  progress = await recordProgress(input, page, { status: "research_curating" });
  input.setProgress(progress);
  emitRuntime(
    input,
    {
      step: "research-curation",
      message: text.curatingEvidence(page),
      currentPageIndex: page.index,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  let webDraft: WebResearchCurationDraft | null = null;
  let visualDraft: VisualResearchCurationDraft | null = null;

  if (pageRequirement.web_research_needed && deltaQueries.webQueries.length > 0) {
    if (rawWebIndexPaths.length > 0) {
      const curationRunId = createResearchCurationRunId(page, "web");
      webDraft = await runResearchDraftAgent({
        flowInput: input,
        pagePlan,
        page,
        kind: "web",
        curationRunId,
        buildPrompt: (previousGateFailure) =>
          buildWebResearchCurationPrompt({
            workspaceDir: input.workspace.workspace_dir,
            page,
            requirement: pageRequirement,
            rawWebIndexPaths,
            draftPath: webDraftPath,
            curationRunId,
            previousGateFailure,
          }),
        draftPath: webDraftPath,
        currentGaps: gaps,
      }) as WebResearchCurationDraft | null;
    } else {
      webDraft = createWebResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw web material was collected for this page."],
      });
      await input.backend.recordResearchCurationDraft({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: "web",
        draft: webDraft,
      });
      throwIfCancelled(input);
    }
  }

  if (pageRequirement.image_research_needed && deltaQueries.imageQueries.length > 0) {
    if (rawImageIndexPaths.length > 0) {
      const curationRunId = createResearchCurationRunId(page, "visual");
      visualDraft = await runResearchDraftAgent({
        flowInput: input,
        pagePlan,
        page,
        kind: "visual",
        curationRunId,
        buildPrompt: (previousGateFailure) =>
          buildVisualResearchCurationPrompt({
            workspaceDir: input.workspace.workspace_dir,
            page,
            requirement: pageRequirement,
            rawImageIndexPaths,
            draftPath: visualDraftPath,
            curationRunId,
            previousGateFailure,
          }),
        draftPath: visualDraftPath,
        currentGaps: gaps,
      }) as VisualResearchCurationDraft | null;
    } else {
      visualDraft = createVisualResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw image material was collected for this page."],
      });
      await input.backend.recordResearchCurationDraft({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: "visual",
        draft: visualDraft,
      });
      throwIfCancelled(input);
    }
  }

  throwIfCancelled(input);
  const merged = mergeResearchCurationDrafts({
    currentEvidence,
    page,
    requirement: pageRequirement,
    evidenceMarkdownPath,
    webDraft,
    visualDraft,
    gaps,
  });

  await input.backend.recordResearchEvidencePageMarkdown({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
    markdown: merged.markdown,
  });
  throwIfCancelled(input);
  await input.backend.recordResearchEvidencePage({
    workspace_dir: input.workspace.workspace_dir,
    page_evidence: merged.pageEvidence,
  });
  throwIfCancelled(input);

  await appendResearchLogSafe(input, {
    event: "ai.research.page.finished",
    schema_version: 1,
    page_id: page.page_id,
    page_index: page.index,
    raw_web_index_paths: rawWebIndexPaths,
    raw_image_index_paths: rawImageIndexPaths,
    gaps: merged.pageEvidence.gaps,
    status: merged.pageEvidence.status,
    updated_at: new Date().toISOString(),
  });
  await input.backend.recordResearchStatusPage({
    workspace_dir: input.workspace.workspace_dir,
    page_status: {
      page_id: page.page_id,
      status: merged.pageEvidence.status,
      message: merged.pageEvidence.gaps.join("\n"),
      evidence_path: evidenceMarkdownPath,
    },
  });
  throwIfCancelled(input);

  if (webCollections.length > 0 || imageCollections.length > 0) {
    const latestResearchStatus = await input.backend.getResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
    });
    throwIfCancelled(input);
    await input.backend.recordResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
      status: recordResearchCollectionLedger({
        status: latestResearchStatus,
        pageId: page.page_id,
        webCollections,
        imageCollections,
        now: new Date().toISOString(),
      }),
    });
    throwIfCancelled(input);
  }
}

async function loadResumeArtifacts(input: RunDeckGenerationInput) {
  try {
    let pagePlan = await input.backend.getPagePlan({
      workspace_dir: input.workspace.workspace_dir,
    });
    let progress = await input.backend.getPageProgress({
      workspace_dir: input.workspace.workspace_dir,
    });
    const hasUsablePagePlan = pagePlan.pages.length === input.confirmedOutline.items.length && pagePlan.pages.length > 0;
    if (!hasUsablePagePlan) {
      if (pagePlan.pages.length > 0) return null;
      return await createRestartArtifacts(input);
    }
    if (!pagePlanMatchesOutlineAndTemplate(input.workspace, pagePlan, null, input.confirmedOutline)) {
      return null;
    }

    const researchPlan = await readResearchPlanSafe(input);
    if (!researchPlan || researchPlan.pages.length !== pagePlan.pages.length) {
      await generateAndRecordResearchPlan(input, pagePlan);
    }

    if (!progressMatchesPlan(pagePlan, progress)) {
      await recordDeckRecovery(input, {
        status: "running",
        run_kind: "deck-generation",
        step: "prepare",
        target_page_ids: pagePlan.pages.map((page) => page.page_id),
        error: null,
        deck_status: "running",
      });
      await input.backend.preparePageFiles({
        workspace_dir: input.workspace.workspace_dir,
      });
      progress = await input.backend.getPageProgress({
        workspace_dir: input.workspace.workspace_dir,
      });
    }

    pagePlan = alignPagePlanWithOutline(pagePlan, input.confirmedOutline);
    return { pagePlan, progress };
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    return null;
  }
}

async function readResearchPlanSafe(input: Pick<DeckGenerationContext, "backend" | "workspace">): Promise<ResearchPlan | null> {
  try {
    return await input.backend.getResearchPlan({
      workspace_dir: input.workspace.workspace_dir,
    });
  } catch {
    return null;
  }
}

async function readResearchEvidenceSafe(input: Pick<DeckGenerationContext, "backend" | "workspace">): Promise<ResearchEvidenceIndex | null> {
  try {
    return normalizeResearchEvidenceIndex(
      await input.backend.getResearchEvidence({
        workspace_dir: input.workspace.workspace_dir,
      }),
    );
  } catch {
    return null;
  }
}

async function resolvePageRefinementVisualContext(input: {
  backend: PptBackend;
  workspace: WorkspaceResult;
  page: PagePlanItem;
  progress: PageProgress;
}): Promise<PageRefinementVisualContext> {
  const progressPage = getProgressPage(input.progress, input.page.page_id);
  const screenshotPath = progressPage?.last_screenshot_path?.trim();
  if (screenshotPath) {
    return {
      screenshotPath,
      source: "progress",
    };
  }

  try {
    const preview = await input.backend.renderWorkspacePagePreview({
      workspace_dir: input.workspace.workspace_dir,
      page_index: input.page.index,
    });
    if (preview.screenshot_path?.trim()) {
      return {
        screenshotPath: preview.screenshot_path.trim(),
        source: "fresh-render",
      };
    }
    return {
      source: "unavailable",
      unavailableReason: "fresh render did not return a screenshot path",
    };
  } catch (error) {
    return {
      source: "unavailable",
      unavailableReason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createRestartArtifacts(input: RunDeckGenerationInput) {
  const text = generationText(input.locale);
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "page-plan",
    target_page_ids: [],
    page_refinement_request: null,
    page_refinement_requests: {},
    error: null,
    final_deck_render: {
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      pages_path: null,
      rendered_at: null,
    },
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "page-plan",
      message: text.pagePlan,
      currentPageIndex: null,
      totalPages: input.confirmedOutline.items.length,
    },
    null,
  );

  const planningContext = await input.backend.getTemplatePlanningContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const pagePlanLogContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "generate_page_plan",
        operation_id: input.aiLogger.createOperationId("page_plan", "generate_page_plan"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
  const pagePlan = await input.aiClient.generatePagePlan({
    outline: input.confirmedOutline,
    planningContext,
    locale: input.locale,
    logContext: pagePlanLogContext,
  });
  throwIfCancelled(input);
  const alignedPagePlan = alignPagePlanWithOutline(pagePlan, input.confirmedOutline);
  if (input.aiLogger && pagePlanLogContext) {
    await input.aiLogger.appendSemanticLog(pagePlanLogContext, {
      event: "ai.page_plan.operation.finished",
      status: "succeeded",
      title: alignedPagePlan.title,
      page_count: alignedPagePlan.pages.length,
      template_group: alignedPagePlan.source.template_group,
      interaction_ids: pagePlanLogContext.interaction_ids ?? [],
      artifact: {
        kind: "page_plan",
        path: "page-plan.json",
      },
    });
  } else {
    await appendWorkspaceLogSafe(input, "ai-page-plan", {
      event: "ai.page_plan.operation.finished",
      schema_version: 1,
      operation: "generate_page_plan",
      status: "succeeded",
      title: alignedPagePlan.title,
      page_count: alignedPagePlan.pages.length,
      template_group: alignedPagePlan.source.template_group,
      artifact: {
        kind: "page_plan",
        path: "page-plan.json",
      },
    });
  }
  await input.backend.recordPagePlan({
    workspace_dir: input.workspace.workspace_dir,
    page_plan: alignedPagePlan,
  });
  throwIfCancelled(input);

  await generateAndRecordResearchPlan(input, alignedPagePlan);
  throwIfCancelled(input);

  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "prepare",
    target_page_ids: alignedPagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "prepare",
      message: text.prepare,
      currentPageIndex: null,
      totalPages: alignedPagePlan.pages.length,
    },
    null,
  );

  await input.backend.preparePageFiles({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  let progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  for (const page of alignedPagePlan.pages) {
    progress = await recordProgress(input, page, {
      status: "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      content_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_error: "",
      last_html_path: "",
      last_screenshot_path: "",
      content_review: null,
      visual_review: null,
      review: null,
    });
  }

  return { pagePlan: alignedPagePlan, progress };
}

function failedCompletion(input: {
  error: DeckGenerationError;
  progress: DeckGenerationProgress | null;
}): DeckGenerationCompletion {
  return {
    status: "failed",
    error: input.error,
    progress: input.progress,
  };
}

function localizeAgentInfrastructureMessage(
  error: AgentInfrastructureError,
  locale: Locale,
): string {
  const text = generationText(locale);
  if (error.sessionCacheMiss) return text.agentSessionCacheMissExhausted;
  if (error.noToolsAvailable) return text.agentToolsUnavailable;
  return error.message;
}

async function preflightAgentToolAccess(input: {
  agentClient: AgentClient;
  locale: Locale;
  onProgress: (progress: DeckGenerationProgress) => void;
  progress: PageProgress | null;
  attemptLimits?: typeof ATTEMPT_LIMITS;
  totalPages: number;
  currentPageIndex: number | null;
}): Promise<DeckGenerationCompletion | null> {
  try {
    await input.agentClient.checkToolAccess();
    return null;
  } catch (error) {
    if (!isAgentInfrastructureError(error)) throw error;
    const message = localizeAgentInfrastructureMessage(error, input.locale);
    const progress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: input.currentPageIndex,
        totalPages: input.totalPages,
      },
      input.progress,
      undefined,
      undefined,
      input.attemptLimits,
    );
    input.onProgress(progress);
    return failedCompletion({
      progress,
      error: {
        type: "agent_infrastructure",
        message,
      },
    });
  }
}

function createFailedPageError(
  page: PageProgress["pages"][number],
  locale: Locale,
): DeckGenerationError {
  const type =
    page.status === "agent_infrastructure_failed"
      ? "agent_infrastructure"
      : "page_failed";
  return {
    type,
    message: generationText(locale).pageFailed(page),
    page_id: page.page_id,
    page_index: page.index,
    page_status: page.status,
  };
}

function alignPagePlanWithOutline(pagePlan: PagePlan, outline: WorkspaceOutline): PagePlan {
  return {
    ...pagePlan,
    title: outline.title,
    source: {
      ...pagePlan.source,
      outline_updated_at: outline.updated_at,
    },
    pages: pagePlan.pages.map((page, index) => {
      const outlineItem = outline.items[index];
      if (!outlineItem) return page;

      return {
        ...page,
        title: outlineItem.title,
        outline: outlineItem.outline,
      };
    }),
  };
}

export function pageProgressToDeckGenerationProgress(
  storedProgress: PageProgress,
  locale: Locale = "zh",
): DeckGenerationProgress {
  const pages = [...storedProgress.pages].sort((left, right) => left.index - right.index);
  const resumablePage = pages.find((item) => isResumablePageGenerationStatus(item.status));
  const failedPage = pages.find((item) => isGenuinelyFailedPageGenerationStatus(item.status));
  const activePageCandidate = pages.find((item) => isActivePageGenerationStatus(item.status));
  const unfinishedPage = pages.find((item) => item.status !== "accepted");
  const activePage =
    unfinishedPage ??
    resumablePage ??
    failedPage ??
    activePageCandidate ??
    [...pages].reverse().find((item) => item.status !== "pending") ??
    pages[0] ??
    null;
  const acceptedCount = pages.filter((item) => item.status === "accepted").length;
  const allAccepted = pages.length > 0 && acceptedCount === pages.length;
  const finalDeckRender = storedProgress.final_deck_render;
  const finalDeckRenderCompleted =
    !finalDeckRender || finalDeckRender.status === "completed";
  const step: DeckGenerationStep = allAccepted && finalDeckRenderCompleted
      ? "complete"
      : allAccepted
        ? "final-render"
        : unfinishedPage
        ? "interrupted"
        : "page-authoring";
  const message = step === "complete"
      ? generationText(locale).complete
      : step === "final-render"
        ? finalDeckRender?.error || finalDeckRender?.message || generationText(locale).finalRender
      : step === "interrupted"
        ? failedPage?.last_error || generationText(locale).interrupted
        : generationText(locale).resumed;

  return {
    step,
    message,
    currentPageIndex: activePage ? activePage.index : null,
    totalPages: pages.length,
    recoveryRunKind: storedProgress.recovery?.run_kind ?? (
      step === "final-render" ? "final-deck-render" : undefined
    ),
    pages: mapProgress({
      ...storedProgress,
      pages,
    }),
  };
}

export function createDeckGenerationStreamSnapshot(
  progress: DeckGenerationProgress,
  locale: Locale = "zh",
): DeckGenerationStreamSnapshot {
  const id = progress.stream
    ? `${progress.step}:${progress.stream.page_id}:${progress.stream.run_id ?? progress.stream.kind ?? progress.stream.status}`
    : `${progress.step}:global`;
  return {
    id,
    phase: progress.step,
    label: progress.stream
      ? generationText(locale).streamLabel(
          progress.stream.page_index,
          progress.stream.kind ?? progress.step
        )
      : progress.message || progress.step,
    kind: progress.stream?.kind,
    page_id: progress.stream?.page_id,
    page_index: progress.stream?.page_index,
    status: progress.stream?.status ?? progress.message,
    message: progress.message,
    lines: progress.stream ? [...progress.stream.lines] : [],
    activities: progress.stream ? [...progress.stream.activities] : [],
    updated_at: new Date().toISOString(),
  };
}

function buildDeckGenerationSummary(
  input: Pick<DeckGenerationContext, "locale">,
  progress: PageProgress | null,
  totalPages: number,
) {
  const pages = progress?.pages ?? [];
  const accepted = pages.filter((page) => page.status === "accepted").length;
  const failed = pages.filter((page) => isGenuinelyFailedPageGenerationStatus(page.status)).length;
  const active = pages.filter((page) => isActivePageGenerationStatus(page.status)).length;
  return generationText(input.locale).activeSummary({
    active,
    accepted,
    failed,
    total: totalPages,
  });
}

function emitRuntime(
  input: DeckGenerationRuntime,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
) {
  emit(input, value, progress, stream, input.activeStreams.values());
}

function getActiveGenerationRunKind(input: RunDeckGenerationInput): NonNullable<PageProgress["recovery"]>["run_kind"] {
  return input.refinementRunKind ?? (input.pageRefinementRequests ? "page-refinement" : "deck-generation");
}

function buildAgentRunOptions(
  input: DeckGenerationRuntime,
  onStreamEvent: (event: AgentStreamEvent) => void,
  logContext?: AiOperationLogContext,
) {
  return {
    onStreamEvent,
    signal: input.cancelSignal,
    isCancelled: input.isCancelled,
    logContext,
  };
}

async function runPageGeneration(
  input: DeckGenerationRuntime,
  pagePlan: PagePlan,
  page: PagePlanItem,
): Promise<PageGenerationResult> {
  const text = generationText(input.locale);
  const totalPages = pagePlan.pages.length;
  const reviewSettings = getReviewSettings(input);
  const attemptLimits = getAttemptLimits(input);
  let progress = input.getProgress();
  const existingPageProgress = getProgressPage(progress, page.page_id);
  const pageRefinementRequest =
    input.pageRefinementRequests?.[page.page_id]?.trim() || "";

  if (existingPageProgress?.status === "accepted" && !pageRefinementRequest) {
    emitRuntime(
      input,
      {
        step: "page-authoring",
        message: buildDeckGenerationSummary(input, progress, totalPages),
        currentPageIndex: page.index,
        totalPages,
      },
      progress,
    );
    return {
      page,
      reason: "accepted",
      progress: progress ?? {
        version: 1,
        status: "running",
        pages: [],
        updated_at: null,
      },
    };
  }

  try {
    await collectAndCurateResearchForPage(input, pagePlan, page);
  } catch (error) {
    if (isAgentRunCancelledError(error)) {
      return {
        page,
        reason: "cancelled",
        progress: input.getProgress() ?? progress ?? {
          version: 1,
          status: "running",
          pages: [],
          updated_at: null,
        },
      };
    }
    throw error;
  }
  if (input.isCancelled()) {
    return {
      page,
      reason: "cancelled",
      progress: input.getProgress() ?? progress ?? {
        version: 1,
        status: "running",
        pages: [],
        updated_at: null,
      },
    };
  }

  progress = await recordProgress(input, page, { status: "authoring" });
  input.setProgress(progress);
  emitRuntime(
    input,
    {
      step: "page-authoring",
      message: buildDeckGenerationSummary(input, progress, totalPages),
      currentPageIndex: page.index,
      totalPages,
    },
    progress,
  );

  let renderAttempts = existingPageProgress?.render_attempts ?? 0;
  let visualReviewAttempts = existingPageProgress?.visual_review_attempts ?? 0;
  let contentReviewAttempts = existingPageProgress?.content_review_attempts ?? 0;
  let agentFailures = existingPageProgress?.agent_failures ?? 0;
  let agentInfrastructureFailures =
    existingPageProgress?.agent_infrastructure_failures ?? 0;
  let renderError =
    existingPageProgress?.status === "render_fixing"
      ? existingPageProgress.last_error
      : "";
  let renderFailureHistory: RenderFailureHistoryItem[] = renderError
    ? [{
        attempt: renderAttempts,
        phase: classifyRenderFailurePhase(renderError),
        error: renderError,
        timestamp: existingPageProgress?.updated_at ?? new Date().toISOString(),
      }]
    : [];
  let visualReview =
    reviewSettings.visualReviewEnabled && existingPageProgress?.status === "visual_review_fixing"
      ? getStoredVisualReview(existingPageProgress)
      : null;
  let contentReview =
    reviewSettings.contentReviewEnabled && existingPageProgress?.status === "content_review_fixing"
      ? getStoredContentReview(existingPageProgress)
      : null;
  let noChangeRetryCount = 0;
  let noChangeRetry: NoChangeAuthoringRetry | null = null;
  let renderRepairCount = 0;
  let authoringOperationId: string | null = null;
  let authoringLogContext: AiOperationLogContext | undefined;
  const localGateRepairLimit = LOCAL_GATE_REPAIR_LIMIT;

  function resetAuthoringOperation() {
    authoringOperationId = null;
    authoringLogContext = undefined;
  }

  while (!input.isCancelled()) {
    const attemptKind = renderError
      ? "render-fix"
      : contentReview
        ? "content-review-fix"
        : visualReview
          ? "visual-review-fix"
          : pageRefinementRequest
            ? "page-refinement"
            : "initial";
    const authoringPrompt = buildAuthoringPrompt({
      workspaceDir: input.workspace.workspace_dir,
      page,
      pagePlan,
      outline: input.confirmedOutline,
      attemptKind,
      pageRefinementRequest,
      renderError,
      renderFailureHistory,
      visualReview,
      contentReview,
      pageRefinementVisualContext: pageRefinementRequest
        ? input.pageRefinementVisualContexts?.[page.page_id]
        : undefined,
      noChangeRetry,
    });
    const authoringKind = attemptKind === "initial"
      ? "authoring"
      : attemptKind === "page-refinement" && input.refinementRunKind === "deck-refinement"
        ? "deck-refinement"
        : attemptKind;
    const authoringTracker = createAgentRunTracker({
      flowInput: input,
      page,
      step: "page-authoring",
      message: text.authoringPage(page),
      totalPages,
      progress: input.getProgress,
      prompt: authoringPrompt,
      kind: authoringKind,
      operationId: authoringOperationId ?? undefined,
      logContext: authoringLogContext,
    });
    if (!authoringOperationId) {
      authoringOperationId = authoringTracker.operationId;
      authoringLogContext = authoringTracker.logContext;
    }

    try {
      let beforeFingerprints: GetWorkspacePageFileFingerprintsResult;
      try {
        beforeFingerprints = await getTargetPageFileFingerprints(input, page);
      } catch (fingerprintError) {
        const message = targetPageFingerprintReadErrorMessage(input.locale, page, fingerprintError);
        progress = await recordProgress(input, page, {
          status: "agent_failed",
          last_error: message,
        });
        input.setProgress(progress);
        break;
      }

      const authoringResult: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
        authoringPrompt,
        buildAgentRunOptions(input, authoringTracker.onStreamEvent, authoringTracker.logContext),
      );
      let afterFingerprints: GetWorkspacePageFileFingerprintsResult | null = null;
      let targetFilesChanged = false;
      let fingerprintErrorMessage = "";
      try {
        afterFingerprints = await getTargetPageFileFingerprints(input, page);
        targetFilesChanged = targetPageFilesChanged(beforeFingerprints, afterFingerprints);
      } catch (fingerprintError) {
        fingerprintErrorMessage = targetPageFingerprintReadErrorMessage(input.locale, page, fingerprintError);
      }
      await authoringTracker.flush("completed", {
        parsed_summary: authoringResult.parsed_json === true,
        summary: authoringResult.summary,
        changed_files: authoringResult.changed_files,
        needs_render: authoringResult.needs_render,
        target_file_fingerprints: {
          before: beforeFingerprints,
          after: afterFingerprints,
        },
        target_files_changed: targetFilesChanged,
        target_file_fingerprint_error: fingerprintErrorMessage || undefined,
        no_change_retry_count: noChangeRetryCount,
        session_retries: authoringResult.session_retries ?? 0,
        session_cache_miss_retries:
          authoringResult.session_cache_miss_retries ?? 0,
        render_repair_count: renderRepairCount,
        local_gate_repair_limit: localGateRepairLimit,
      });
      if (input.isCancelled()) {
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
      if (fingerprintErrorMessage) {
        progress = await recordProgress(input, page, {
          status: "agent_failed",
          last_error: fingerprintErrorMessage,
        });
        input.setProgress(progress);
        break;
      }
      if (!targetFilesChanged) {
        const noChangeRepairExhausted = noChangeRetryCount >= localGateRepairLimit;
        const message = targetPageNoChangeMessage(input.locale, page);
        const nextAgentFailures = noChangeRepairExhausted
          ? agentFailures + 1
          : agentFailures;
        progress = await recordProgress(input, page, {
          status:
            nextAgentFailures >= attemptLimits.agent
              ? "agent_failed"
              : "authoring",
          agent_failures: nextAgentFailures,
          last_error: message,
        });
        input.setProgress(progress);
        if (noChangeRepairExhausted) {
          agentFailures = nextAgentFailures;
          noChangeRetryCount = 0;
          noChangeRetry = null;
          resetAuthoringOperation();
          if (agentFailures >= attemptLimits.agent) break;
          continue;
        }
        noChangeRetryCount += 1;
        noChangeRetry = {
          retryCount: noChangeRetryCount,
          previousSummary: authoringResult.summary,
          previousChangedFiles: authoringResult.changed_files,
        };
        continue;
      }
      noChangeRetryCount = 0;
      noChangeRetry = null;
      renderError = "";
      visualReview = null;
      contentReview = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAgentRunCancelledError(error)) {
        await authoringTracker.flush("error", { cancelled: true });
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
      if (isAgentInfrastructureError(error)) {
        const displayMessage = localizeAgentInfrastructureMessage(error, input.locale);
        agentInfrastructureFailures += 1;
        await authoringTracker.flush("error", {
          error: displayMessage,
          raw_error: error.rawMessage,
          agent_session_cache_miss: error.sessionCacheMiss,
          session_cache_miss_retries: error.sessionCacheMissRetries,
          agent_infrastructure_failures: agentInfrastructureFailures,
          active_session_limit: error.activeSessionLimit,
        });
        progress = await recordProgress(input, page, {
          status: "agent_infrastructure_failed",
          agent_infrastructure_failures: agentInfrastructureFailures,
          last_error: displayMessage,
        });
        input.setProgress(progress);
        return {
          page,
          reason: "agent_infrastructure",
          progress,
          error: {
            type: "agent_infrastructure",
            message: displayMessage,
            page_id: page.page_id,
            page_index: page.index,
            page_status: "agent_infrastructure_failed",
          },
        };
      }

      agentFailures += 1;
      await authoringTracker.flush("error", {
        error: message,
        agent_failures: agentFailures,
      });
      progress = await recordProgress(input, page, {
        status: agentFailures >= attemptLimits.agent ? "agent_failed" : "authoring",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= attemptLimits.agent) break;
      resetAuthoringOperation();
      continue;
    }

    if (reviewSettings.contentReviewEnabled) {
      progress = await recordProgress(input, page, {
        status: "content_review",
        last_error: "",
      });
      input.setProgress(progress);
      emitRuntime(
        input,
        {
          step: "page-content-review",
          message: buildDeckGenerationSummary(input, progress, totalPages),
          currentPageIndex: page.index,
          totalPages,
        },
        progress,
      );
      const contentReviewPrompt = buildPageContentReviewPrompt({
        workspaceDir: input.workspace.workspace_dir,
        page,
        pagePlan,
        outline: input.confirmedOutline,
        pageRefinementRequest,
      });
      const contentReviewTracker = createAgentRunTracker({
        flowInput: input,
        page,
        step: "page-content-review",
        message: text.reviewingContent(page),
        totalPages,
        progress: input.getProgress,
        prompt: contentReviewPrompt,
        kind: "page-content-review",
      });
      try {
        contentReview = await input.agentClient.runPageContentReviewPrompt(
          contentReviewPrompt,
          buildAgentRunOptions(input, contentReviewTracker.onStreamEvent, contentReviewTracker.logContext),
        );
        await contentReviewTracker.flush("completed", {
          parsed_review: true,
          review: contentReview,
        });
        if (input.isCancelled()) {
          return {
            page,
            reason: "cancelled",
            progress: input.getProgress() ?? progress,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isAgentRunCancelledError(error)) {
          await contentReviewTracker.flush("error", { cancelled: true });
          return {
            page,
            reason: "cancelled",
            progress: input.getProgress() ?? progress,
          };
        }
        if (isAgentInfrastructureError(error)) {
          const displayMessage = localizeAgentInfrastructureMessage(error, input.locale);
          agentInfrastructureFailures += 1;
          await contentReviewTracker.flush("error", {
            error: displayMessage,
            agent_infrastructure_failures: agentInfrastructureFailures,
            active_session_limit: error.activeSessionLimit,
          });
          progress = await recordProgress(input, page, {
            status: "agent_infrastructure_failed",
            agent_infrastructure_failures: agentInfrastructureFailures,
            last_error: displayMessage,
          });
          input.setProgress(progress);
          return {
            page,
            reason: "agent_infrastructure",
            progress,
            error: {
              type: "agent_infrastructure",
              message: displayMessage,
              page_id: page.page_id,
              page_index: page.index,
              page_status: "agent_infrastructure_failed",
            },
          };
        }

        agentFailures += 1;
        await contentReviewTracker.flush("error", {
          error: message,
          agent_failures: agentFailures,
        });
        progress = await recordProgress(input, page, {
          status: agentFailures >= attemptLimits.agent ? "agent_failed" : "content_review",
          agent_failures: agentFailures,
          last_error: message,
        });
        input.setProgress(progress);
        if (agentFailures >= attemptLimits.agent) break;
        continue;
      }

      progress = await recordProgress(input, page, {
        content_review: contentReview,
        review: contentReview,
      });
      input.setProgress(progress);

      if (!contentReviewPassed(contentReview)) {
        contentReviewAttempts += 1;
        const rewriteRequest =
          contentReview.rewrite_request ||
          contentReview.issues
            .map((issue) => `${issue.type}: ${issue.evidence}: ${issue.reason}`)
            .join("\n") ||
          "Page Content Review failed; fix language, outline alignment, or grounding issues.";
        progress = await recordProgress(input, page, {
          status:
            contentReviewAttempts >= attemptLimits.contentReview
              ? "needs_user_review"
              : "content_review_fixing",
          content_review_attempts: contentReviewAttempts,
          content_review: contentReview,
          review: contentReview,
          last_error: rewriteRequest,
        });
        input.setProgress(progress);
        emitRuntime(
          input,
          {
            step: "page-content-review",
            message: buildDeckGenerationSummary(input, progress, totalPages),
            currentPageIndex: page.index,
            totalPages,
          },
          progress,
        );
        resetAuthoringOperation();
        if (contentReviewAttempts >= attemptLimits.contentReview) break;
        continue;
      }

      contentReview = null;
    } else {
      progress = await recordProgress(input, page, {
        content_review: null,
        review: null,
        last_error: "",
      });
      input.setProgress(progress);
    }
    let preview: RenderWorkspacePagePreviewResult;
    try {
      progress = await recordProgress(input, page, { status: "rendering" });
      input.setProgress(progress);
      emitRuntime(
        input,
        {
          step: "page-render",
          message: buildDeckGenerationSummary(input, progress, totalPages),
          currentPageIndex: page.index,
          totalPages,
        },
        progress,
      );
      preview = await input.backend.renderWorkspacePagePreview({
        workspace_dir: input.workspace.workspace_dir,
        page_index: page.index,
      });
      if (input.isCancelled()) {
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
      progress = await recordProgress(input, page, {
        status: "visual_review",
        last_html_path: preview.html_path,
        last_screenshot_path: preview.screenshot_path,
        last_error: "",
      });
      input.setProgress(progress);
      renderFailureHistory = [];
      renderRepairCount = 0;
      resetAuthoringOperation();
    } catch (error) {
      if (input.isCancelled()) {
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
      renderAttempts += 1;
      renderError = error instanceof Error ? error.message : String(error);
      renderFailureHistory.push({
        attempt: renderAttempts,
        phase: classifyRenderFailurePhase(renderError),
        error: renderError,
        timestamp: new Date().toISOString(),
      });
      const renderRepairExhausted = renderRepairCount >= localGateRepairLimit;
      progress = await recordProgress(input, page, {
        status:
          renderAttempts >= attemptLimits.render
            ? "render_failed"
            : "render_fixing",
        render_attempts: renderAttempts,
        last_error: renderError,
      });
      input.setProgress(progress);
      if (renderAttempts >= attemptLimits.render) break;
      if (renderRepairExhausted) {
        renderRepairCount = 0;
        resetAuthoringOperation();
        continue;
      }
      renderRepairCount += 1;
      continue;
    }

    if (!reviewSettings.visualReviewEnabled) {
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review: null,
        last_error: "",
      });
      input.setProgress(progress);
      return {
        page,
        reason: "accepted",
        progress,
      };
    }

    emitRuntime(
      input,
      {
        step: "page-visual-review",
        message: buildDeckGenerationSummary(input, progress, totalPages),
        currentPageIndex: page.index,
        totalPages,
      },
      progress,
    );
    const visualReviewPrompt = buildPageVisualReviewPrompt({
      page,
      screenshotPath: preview.screenshot_path,
      preview,
    });
    const visualReviewTracker = createAgentRunTracker({
      flowInput: input,
      page,
      step: "page-visual-review",
      message: text.reviewingVisuals(page),
      totalPages,
      progress: input.getProgress,
      prompt: visualReviewPrompt,
      kind: "page-visual-review",
    });
    try {
      visualReview = await input.agentClient.runPageVisualReviewPrompt(
        visualReviewPrompt,
        buildAgentRunOptions(input, visualReviewTracker.onStreamEvent, visualReviewTracker.logContext),
      );
      await visualReviewTracker.flush("completed", {
        parsed_review: true,
        review: visualReview,
        session_cache_miss_retries:
          visualReview.session_cache_miss_retries ?? 0,
      });
      if (input.isCancelled()) {
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAgentRunCancelledError(error)) {
        await visualReviewTracker.flush("error", { cancelled: true });
        return {
          page,
          reason: "cancelled",
          progress: input.getProgress() ?? progress,
        };
      }
      if (isAgentInfrastructureError(error)) {
        const displayMessage = localizeAgentInfrastructureMessage(error, input.locale);
        agentInfrastructureFailures += 1;
        await visualReviewTracker.flush("error", {
          error: displayMessage,
          raw_error: error.rawMessage,
          agent_session_cache_miss: error.sessionCacheMiss,
          session_cache_miss_retries: error.sessionCacheMissRetries,
          agent_infrastructure_failures: agentInfrastructureFailures,
          active_session_limit: error.activeSessionLimit,
        });
        progress = await recordProgress(input, page, {
          status: "agent_infrastructure_failed",
          agent_infrastructure_failures: agentInfrastructureFailures,
          last_error: displayMessage,
        });
        input.setProgress(progress);
        return {
          page,
          reason: "agent_infrastructure",
          progress,
          error: {
            type: "agent_infrastructure",
            message: displayMessage,
            page_id: page.page_id,
            page_index: page.index,
            page_status: "agent_infrastructure_failed",
          },
        };
      }

      agentFailures += 1;
      await visualReviewTracker.flush("error", {
        error: message,
        agent_failures: agentFailures,
      });
      progress = await recordProgress(input, page, {
        status: agentFailures >= attemptLimits.agent ? "agent_failed" : "visual_review",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= attemptLimits.agent) break;
      continue;
    }
    progress = await recordProgress(input, page, {
      visual_review: visualReview,
      review: visualReview,
    });
    input.setProgress(progress);

    if (visualReviewPassed(visualReview)) {
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review: visualReview,
        review: visualReview,
      });
      input.setProgress(progress);
      return {
        page,
        reason: "accepted",
        progress,
      };
    }

    visualReviewAttempts += 1;
    progress = await recordProgress(input, page, {
      status:
        visualReviewAttempts >= attemptLimits.visualReview
          ? "needs_user_review"
          : "visual_review_fixing",
      visual_review_attempts: visualReviewAttempts,
      visual_review: visualReview,
      review: visualReview,
      last_error: visualReview.revision_request,
    });
    input.setProgress(progress);
    if (visualReviewAttempts >= attemptLimits.visualReview) break;
  }

  progress = input.getProgress() ?? await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });

  if (input.isCancelled()) {
    return {
      page,
      reason: "cancelled",
      progress,
    };
  }

  const failedPage = getProgressPage(progress, page.page_id);
  const error = failedPage
    ? createFailedPageError(failedPage, input.locale)
    : {
        type: "page_failed" as const,
        message: text.pageFailed({
          page_id: page.page_id,
          index: page.index,
          title: page.title,
          status: "failed",
          render_attempts: 0,
          visual_review_attempts: 0,
          content_review_attempts: 0,
          agent_failures: 0,
          agent_infrastructure_failures: 0,
          slide_path: page.slide_path,
          data_path: page.data_path,
          last_html_path: "",
          last_screenshot_path: "",
          last_error: "",
          content_review: null,
          visual_review: null,
          review: null,
          updated_at: null,
        }),
        page_id: page.page_id,
        page_index: page.index,
        page_status: "failed",
      };

  return {
    page,
    reason: "page_failed",
    progress,
    error,
  };
}

async function runPagesConcurrently(
  runtime: DeckGenerationRuntime,
  pagePlan: PagePlan,
): Promise<PageGenerationResult[]> {
  const pagesToRun = pagePlan.pages.filter((page) => {
    const pageProgress = getProgressPage(runtime.getProgress(), page.page_id);
    return Boolean(runtime.pageRefinementRequests?.[page.page_id]) ||
      shouldResumePageGenerationStatus(pageProgress?.status ?? "pending");
  });
  const results: PageGenerationResult[] = [];
  let nextIndex = 0;
  let stopScheduling = false;

  async function worker() {
    while (!stopScheduling && !runtime.isCancelled()) {
      const page = pagesToRun[nextIndex];
      nextIndex += 1;
      if (!page) return;

      const progress = await recordProgress(runtime, page, {
        status: "pending",
        render_attempts: 0,
        visual_review_attempts: 0,
        content_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        last_error: "",
        content_review: null,
        visual_review: null,
        review: null,
      });
      runtime.setProgress(progress);
      if (runtime.isCancelled()) {
        results.push({ page, reason: "cancelled", progress });
        return;
      }

      const result = await runPageGeneration(runtime, pagePlan, page);
      results.push(result);
      if (result.reason === "agent_infrastructure") {
        stopScheduling = true;
      }
    }
  }

  const workerCount = Math.min(PAGE_GENERATION_CONCURRENCY, pagesToRun.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.sort((left, right) => left.page.index - right.page.index);
}

export async function runDeckGeneration(
  input: RunDeckGenerationInput,
): Promise<DeckGenerationCompletion> {
  const text = generationText(input.locale);
  const attemptLimits = getAttemptLimits(input);
  if (input.confirmedOutline.status !== "confirmed") {
    const progress = createProgress(
      {
        step: "failed",
        message: text.invalidOutline,
        currentPageIndex: null,
        totalPages: 0,
      },
      null,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(progress);
    return failedCompletion({
      progress,
      error: {
        type: "invalid_confirmed_outline",
        message: progress.message,
      },
    });
  }

  const startMode = input.startMode ?? "restart";
  let artifacts: { pagePlan: PagePlan; progress: PageProgress };

  try {
    if (startMode === "resume") {
      const resumeArtifacts = await loadResumeArtifacts(input);
      if (!resumeArtifacts) {
        const progress = createProgress(
          {
            step: "failed",
            message: text.staleArtifacts,
            currentPageIndex: null,
            totalPages: input.confirmedOutline.items.length,
          },
          null,
          undefined,
          undefined,
          attemptLimits,
        );
        input.onProgress(progress);
        return failedCompletion({
          progress,
          error: {
            type: "stale_artifacts",
            message: progress.message,
          },
        });
      }
      const preflightFailure = await preflightAgentToolAccess({
        agentClient: input.agentClient,
        locale: input.locale,
        onProgress: input.onProgress,
        progress: resumeArtifacts.progress,
        attemptLimits,
        totalPages: resumeArtifacts.pagePlan.pages.length,
        currentPageIndex: null,
      });
      if (preflightFailure) return preflightFailure;
      artifacts = resumeArtifacts;
    } else {
      const preflightFailure = await preflightAgentToolAccess({
        agentClient: input.agentClient,
        locale: input.locale,
        onProgress: input.onProgress,
        progress: null,
        attemptLimits,
        totalPages: input.confirmedOutline.items.length,
        currentPageIndex: null,
      });
      if (preflightFailure) return preflightFailure;
      artifacts = await createRestartArtifacts(input);
    }
  } catch (error) {
    if (isAgentRunCancelledError(error) || input.isCancelled()) {
      const progress = createProgress(
        {
          step: "cancelled",
          message: text.cancelled,
          currentPageIndex: null,
          totalPages: input.confirmedOutline.items.length,
        },
        null,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(progress);
      await recordDeckRecovery(input, {
        status: "interrupted",
        run_kind: "deck-generation",
        step: "interrupted",
        error: null,
        deck_status: "interrupted",
      });
      return {
        status: "cancelled",
        progress,
      };
    }
    throw error;
  }

  let { pagePlan, progress } = artifacts;
  const runtime: DeckGenerationRuntime = {
    ...input,
    activeStreams: new Map(),
    getProgress: () => progress,
    setProgress: (nextProgress) => {
      progress = nextProgress;
    },
  };

  const results = await runPagesConcurrently(runtime, pagePlan);
  const infrastructureFailure = results.find((result) => result.reason === "agent_infrastructure");
  if (infrastructureFailure?.error) {
    const failedProgress = createProgress(
      {
        step: "failed",
        message: infrastructureFailure.error.message,
        currentPageIndex: infrastructureFailure.page.index,
        totalPages: pagePlan.pages.length,
      },
      infrastructureFailure.progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
    );
    input.onProgress(failedProgress);
    await recordDeckRecovery(input, {
      status: "failed",
      run_kind: "deck-generation",
      step: "page-authoring",
      error: infrastructureFailure.error.message,
      deck_status: "failed",
    });
    return failedCompletion({
      progress: failedProgress,
      error: infrastructureFailure.error,
    });
  }

  if (input.isCancelled() || results.some((result) => result.reason === "cancelled")) {
    const cancelledProgress = createProgress(
      {
        step: "cancelled",
        message: text.cancelled,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
    );
    input.onProgress(cancelledProgress);
    await recordDeckRecovery(input, {
      status: "interrupted",
      run_kind: getActiveGenerationRunKind(input),
      step: "interrupted",
      target_page_ids: input.pageRefinementRequests
        ? Object.keys(input.pageRefinementRequests)
        : pagePlan.pages.filter((page) => getProgressPage(progress, page.page_id)?.status !== "accepted").map((page) => page.page_id),
      page_refinement_request: input.pageRefinementRequests
        ? Object.values(input.pageRefinementRequests)[0] ?? null
        : null,
      page_refinement_requests: input.pageRefinementRequests ?? {},
      error: null,
      deck_status: "interrupted",
    });
    return {
      status: "cancelled",
      progress: cancelledProgress,
    };
  }

  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  const failedPage = progress.pages.find((page) => page.status !== "accepted");
  if (failedPage) {
    const error = createFailedPageError(failedPage, input.locale);
    const failedCount = progress.pages.filter((page) => page.status !== "accepted").length;
    const failedProgress = createProgress(
      {
        step: "failed",
        message: failedCount > 1 ? text.failedSummary(failedCount) : error.message,
        currentPageIndex: failedPage.index,
        totalPages: pagePlan.pages.length,
      },
      progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
    );
    input.onProgress(failedProgress);
    await recordDeckRecovery(input, {
      status: "failed",
      run_kind: getActiveGenerationRunKind(input),
      step: "page-authoring",
      target_page_ids: input.pageRefinementRequests
        ? Object.keys(input.pageRefinementRequests)
        : [failedPage.page_id],
      page_refinement_request: input.pageRefinementRequests
        ? Object.values(input.pageRefinementRequests)[0] ?? null
        : null,
      page_refinement_requests: input.pageRefinementRequests ?? {},
      error: error.message,
      deck_status: "failed",
    });
    return failedCompletion({
      progress: failedProgress,
      error,
    });
  }

  progress = await recordDeckRecovery(input, {
    status: "running",
    run_kind: "final-deck-render",
    step: "final-render",
    target_page_ids: [],
    error: null,
    final_deck_render: {
      status: "running",
      message: text.finalRender,
      error: null,
    },
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "final-render",
      message: text.finalRender,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );
  let rendered: RenderDeckHtmlResult;
  try {
    rendered = await input.backend.renderDeckHtml({
      workspace_dir: input.workspace.workspace_dir,
    });
    if (input.isCancelled()) {
      progress = await recordDeckRecovery(input, {
        status: "interrupted",
        run_kind: "final-deck-render",
        step: "final-render",
        error: null,
        final_deck_render: {
          status: "interrupted",
          message: text.finalRender,
          error: null,
        },
        deck_status: "interrupted",
      });
      const cancelledProgress = createProgress(
        {
          step: "cancelled",
          message: text.cancelled,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        null,
        runtime.activeStreams.values(),
        attemptLimits,
      );
      input.onProgress(cancelledProgress);
      return {
        status: "cancelled",
        progress: cancelledProgress,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress = await recordDeckRecovery(input, {
      status: "failed",
      run_kind: "final-deck-render",
      step: "final-render",
      error: message,
      final_deck_render: {
        status: "failed",
        message,
        error: message,
      },
      deck_status: "failed",
    });
    const failedProgress = createProgress(
      {
        step: "final-render",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: {
        type: "final_render_failed",
        message,
      },
    });
  }
  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  progress = await recordDeckRecovery(input, {
    status: "completed",
    run_kind: "final-deck-render",
    step: "complete",
    error: null,
    final_deck_render: {
      status: "completed",
      message: text.deckReady,
      error: null,
      output_dir: rendered.output_dir,
      deck_html_path: rendered.slides[0]?.html_path ?? null,
      pages_path: `${input.workspace.workspace_dir}/pages.json`,
      rendered_at: rendered.rendered_at,
    },
    deck_status: "completed",
  });
  emit(
    input,
    {
      step: "complete",
      message: text.deckReady,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  return {
    status: "completed",
    result: {
      outline: input.confirmedOutline,
      pagePlan,
      progress,
      rendered,
    },
  };
}

async function runWholeDeckRefinement(args: {
  input: RunDeckRefinementInput;
  instruction: string;
  pagePlan: PagePlan;
  progress: PageProgress;
}): Promise<DeckGenerationCompletion> {
  const { input, instruction, pagePlan, progress } = args;
  const attemptLimits = getAttemptLimits(input);
  const text = generationText(input.locale);

  if (input.skipIntentReview) {
    const recoveryRequests = progress.recovery?.page_refinement_requests ?? {};
    const targetIds = new Set(input.resumePageIds ?? progress.recovery?.target_page_ids ?? []);
    const pageRefinementRequests = Object.fromEntries(
      Object.entries(recoveryRequests)
        .filter(([pageId]) => targetIds.size === 0 || targetIds.has(pageId))
        .filter(([, request]) => request.trim().length > 0),
    );
    return runDeckGeneration({
      backend: input.backend,
      aiClient: input.aiClient,
      agentClient: input.agentClient,
      aiLogger: input.aiLogger,
      workspace: input.workspace,
      confirmedOutline: input.confirmedOutline,
      locale: input.locale,
      startMode: "resume",
      onProgress: input.onProgress,
      isCancelled: input.isCancelled,
      cancelSignal: input.cancelSignal,
      pageRefinementRequests,
      refinementRunKind: "deck-refinement",
    });
  }

  emit(
    input,
    {
      step: "page-plan",
      message: input.locale === "zh" ? "正在理解整套优化需求" : "Reviewing whole-deck refinement request",
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  const planningContext = await input.backend.getTemplatePlanningContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const reviewLogContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "deck_refinement_intent_review",
        operation_id: input.aiLogger.createOperationId("page_plan", "deck_refinement_intent_review"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;

  let review: DeckRefinementIntentReviewResult;
  try {
    review = await input.aiClient.reviewDeckRefinementIntent({
      instruction,
      outline: input.confirmedOutline,
      pagePlan,
      planningContext,
      setting: readWorkspaceSetting(input.workspace),
      locale: input.locale,
      logContext: reviewLogContext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedProgress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: { type: "page_failed", message },
    });
  }

  if (review.route === "unsupported") {
    const message = review.blocking_reason || (
      input.locale === "zh"
        ? "整套优化无法处理这个需求。"
        : "This request cannot be handled as Deck Refinement."
    );
    const nextProgress = await recordDeckRecovery(input, {
      status: "failed",
      run_kind: "deck-refinement",
      step: "deck-refinement-context-review",
      target_page_ids: [],
      page_refinement_request: instruction,
      page_refinement_requests: {},
      deck_refinement_review: review,
      error: message,
      deck_status: "failed",
    });
    const failedProgress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      nextProgress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: { type: "page_failed", message },
    });
  }

  if (review.route === "no_op") {
    const rendered = readRenderedDeckFromWorkspace(input.workspace);
    if (!rendered) {
      const message = input.locale === "zh"
        ? "整套优化无需改动，但现有渲染产物不可用。"
        : "Deck Refinement is a no-op, but existing rendered artifacts are unavailable.";
      const failedProgress = createProgress(
        {
          step: "failed",
          message,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(failedProgress);
      return failedCompletion({
        progress: failedProgress,
        error: { type: "stale_artifacts", message },
      });
    }
    const nextProgress = await recordDeckRecovery(input, {
      status: "completed",
      run_kind: "deck-refinement",
      step: "complete",
      target_page_ids: [],
      page_refinement_request: instruction,
      page_refinement_requests: {},
      deck_refinement_review: review,
      error: null,
      deck_status: "completed",
    });
    emit(
      input,
      {
        step: "complete",
        message: input.locale === "zh" ? "整套优化无需改动" : "Deck Refinement completed with no changes",
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      nextProgress,
    );
    return {
      status: "completed",
      result: {
        outline: input.confirmedOutline,
        pagePlan,
        progress: nextProgress,
        rendered,
      },
    };
  }

  const addedOutlineItems = review.operations
    .filter((operation): operation is Extract<typeof operation, { op: "add" }> => operation.op === "add")
    .map((operation) => ({
      title: operation.title,
      outline: operation.outline,
    }));
  const addedPagePlan = addedOutlineItems.length > 0
    ? await input.aiClient.generateAddedPagePlan({
        outlineItems: addedOutlineItems,
        baseOutline: input.confirmedOutline,
        planningContext,
        locale: input.locale,
        logContext: input.aiLogger
          ? {
              logger: input.aiLogger,
              workspace_dir: input.workspace.workspace_dir,
              domain: "page_plan" as const,
              operation: "deck_refinement_added_page_plan",
              operation_id: input.aiLogger.createOperationId("page_plan", "deck_refinement_added_page_plan"),
              provider: "anna",
              runtime_mode: "anna",
            }
          : undefined,
      })
    : null;
  throwIfCancelled(input);

  const now = new Date().toISOString();
  const reconciliation = reconcileDeckRefinement({
    instruction,
    outline: input.confirmedOutline,
    pagePlan,
    review,
    addedPagePlan,
    now,
  });
  if (!reconciliation.renderRequired) {
    const rendered = readRenderedDeckFromWorkspace(input.workspace);
    if (!rendered) {
      const message = input.locale === "zh"
        ? "整套优化没有产生可执行变更，但现有渲染产物不可用。"
        : "Deck Refinement produced no runnable changes, but existing rendered artifacts are unavailable.";
      return failedCompletion({
        progress: createProgress({
          step: "failed",
          message,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        }, progress, undefined, undefined, attemptLimits),
        error: { type: "stale_artifacts", message },
      });
    }
    return {
      status: "completed",
      result: {
        outline: input.confirmedOutline,
        pagePlan,
        progress,
        rendered,
      },
    };
  }

  const needsAuthoring = Object.keys(reconciliation.pageRefinementRequests).length > 0;
  if (needsAuthoring) {
    const preflightFailure = await preflightAgentToolAccess({
      agentClient: input.agentClient,
      locale: input.locale,
      onProgress: input.onProgress,
      progress,
      attemptLimits,
      totalPages: pagePlan.pages.length,
      currentPageIndex: null,
    });
    if (preflightFailure) return preflightFailure;
  }

  let activeWorkspace = input.workspace;
  if (review.output_language_change.changed) {
    activeWorkspace = await input.backend.updateWorkspaceSettings({
      workspace_dir: input.workspace.workspace_dir,
      setting: applyDeckRefinementSettingUpdates({
        setting: readWorkspaceSetting(input.workspace),
        review,
        now,
      }),
    });
  }
  const updatedWorkspace = await input.backend.updateWorkspaceOutline({
    workspace_dir: input.workspace.workspace_dir,
    outline: {
      title: reconciliation.outline.title,
      output_language: reconciliation.outline.output_language,
      status: "confirmed",
      items: reconciliation.outline.items,
      source: {
        prompt: reconciliation.outline.source.prompt,
        context: reconciliation.outline.source.context,
        task_context: reconciliation.outline.source.task_context,
        setting: reconciliation.outline.source.setting,
      },
    },
  });
  const persistedOutline = updatedWorkspace.outline as WorkspaceOutline;
  const persistedPagePlan = alignDeckRefinementPagePlanToOutline({
    pagePlan: reconciliation.pagePlan,
    outline: persistedOutline,
  });
  activeWorkspace = {
    ...activeWorkspace,
    ...updatedWorkspace,
    outline: persistedOutline,
  };
  const activePagePlan = await input.backend.recordPagePlan({
    workspace_dir: input.workspace.workspace_dir,
    page_plan: persistedPagePlan,
  });
  throwIfCancelled(input);

  const existingResearchPlan = await readResearchPlanSafe(input) ?? createEmptyResearchPlan({
    outline: persistedOutline,
    pagePlan: activePagePlan,
    generatedBy: "deck-refinement-fallback",
  });
  const needsResearchPlanning = Object.keys(reconciliation.researchReviews).length > 0;
  const generatedResearchPlan = needsResearchPlanning
    ? await input.aiClient.generateResearchPlan({
        outline: persistedOutline,
        pagePlan: activePagePlan,
        locale: input.locale,
        logContext: input.aiLogger
          ? {
              logger: input.aiLogger,
              workspace_dir: input.workspace.workspace_dir,
              domain: "page_plan" as const,
              operation: "deck_refinement_research_plan",
              operation_id: input.aiLogger.createOperationId("page_plan", "deck_refinement_research_plan"),
              provider: "anna",
              runtime_mode: "anna",
            }
          : undefined,
      })
    : null;
  const mergedResearchPlan = mergeDeckRefinementResearchPlan({
    existingPlan: existingResearchPlan,
    generatedPlan: generatedResearchPlan,
    pagePlan: activePagePlan,
    researchReviews: reconciliation.researchReviews,
    now: new Date().toISOString(),
  });
  await input.backend.recordResearchPlan({
    workspace_dir: input.workspace.workspace_dir,
    research_plan: mergedResearchPlan,
  });
  const activePageIds = new Set(activePagePlan.pages.map((page) => page.page_id));
  const existingEvidence = await readResearchEvidenceSafe(input);
  if (existingEvidence) {
    await input.backend.recordResearchEvidence({
      workspace_dir: input.workspace.workspace_dir,
      evidence: {
        ...existingEvidence,
        pages: existingEvidence.pages.filter((page) => activePageIds.has(page.page_id)),
        updated_at: new Date().toISOString(),
      },
    });
  }
  try {
    const status = await input.backend.getResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
    });
    await input.backend.recordResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
      status: {
        ...status,
        pages: status.pages.filter((page) => activePageIds.has(page.page_id)),
        collection_ledger: status.collection_ledger
          ? {
              ...status.collection_ledger,
              pages: status.collection_ledger.pages.filter((page) => activePageIds.has(page.page_id)),
            }
          : undefined,
        updated_at: new Date().toISOString(),
      },
    });
  } catch {
    // Research status cleanup should not block Deck Refinement.
  }

  let activeProgress = await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-refinement",
    step: "prepare",
    target_page_ids: reconciliation.targetPageIds,
    page_refinement_request: instruction,
    page_refinement_requests: reconciliation.pageRefinementRequests,
    deck_refinement_review: review,
    error: null,
    final_deck_render: {
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      pages_path: null,
      rendered_at: null,
    },
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "prepare",
      message: text.prepare,
      currentPageIndex: null,
      totalPages: activePagePlan.pages.length,
    },
    activeProgress,
  );
  await input.backend.prepareDeckRefinementPageFiles({
    workspace_dir: input.workspace.workspace_dir,
    new_page_ids: reconciliation.addedPageIds,
  });
  activeProgress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-refinement",
    step: "page-authoring",
    target_page_ids: reconciliation.targetPageIds,
    page_refinement_request: instruction,
    page_refinement_requests: reconciliation.pageRefinementRequests,
    deck_refinement_review: review,
    error: null,
    deck_status: "running",
  });

  return runDeckGeneration({
    backend: input.backend,
    aiClient: input.aiClient,
    agentClient: input.agentClient,
    aiLogger: input.aiLogger,
    workspace: activeWorkspace,
    confirmedOutline: persistedOutline,
    locale: input.locale,
    startMode: "resume",
    onProgress: input.onProgress,
    isCancelled: input.isCancelled,
    cancelSignal: input.cancelSignal,
    pageRefinementRequests: reconciliation.pageRefinementRequests,
    refinementRunKind: "deck-refinement",
  });
}

export async function runDeckRefinement(
  input: RunDeckRefinementInput,
): Promise<DeckGenerationCompletion> {
  const attemptLimits = getAttemptLimits(input);
  const instruction = input.instruction.trim();
  if (!instruction) {
    const progress = createProgress(
      {
        step: "failed",
        message: input.locale === "zh" ? "请输入优化需求。" : "Enter a refinement request.",
        currentPageIndex: input.scope === "slide" ? input.pageIndex ?? null : null,
        totalPages: 0,
      },
      null,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(progress);
    return failedCompletion({
      progress,
      error: {
        type: "page_failed",
        message: progress.message,
      },
    });
  }

  const [pagePlan, progress] = await Promise.all([
    input.backend.getPagePlan({ workspace_dir: input.workspace.workspace_dir }),
    input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir }),
  ]);
  if (!pagePlanMatchesOutlineAndTemplate(input.workspace, pagePlan, progress, input.confirmedOutline)) {
    const staleProgress = createProgress(
      {
        step: "failed",
        message: generationText(input.locale).staleArtifacts,
        currentPageIndex: input.scope === "slide" ? input.pageIndex ?? null : null,
        totalPages: input.confirmedOutline.items.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(staleProgress);
    return failedCompletion({
      progress: staleProgress,
      error: {
        type: "stale_artifacts",
        message: staleProgress.message,
      },
    });
  }

  const resumeTargetIds = new Set(input.resumePageIds ?? []);
  const targetPages = resumeTargetIds.size > 0
    ? pagePlan.pages.filter((page) => resumeTargetIds.has(page.page_id))
    : input.scope === "deck"
      ? pagePlan.pages
      : pagePlan.pages.filter((page) => page.index === input.pageIndex);
  if (targetPages.length === 0) {
    const missingProgress = createProgress(
      {
        step: "failed",
        message: input.locale === "zh" ? "没有找到要优化的页面。" : "Could not find the slide to refine.",
        currentPageIndex: input.scope === "slide" ? input.pageIndex ?? null : null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(missingProgress);
    return failedCompletion({
      progress: missingProgress,
      error: {
        type: "page_failed",
        message: missingProgress.message,
      },
    });
  }

  if (input.scope === "deck") {
    return runWholeDeckRefinement({
      input,
      instruction,
      pagePlan,
      progress,
    });
  }

  let activeOutline = input.confirmedOutline;
  let activeWorkspace = input.workspace;
  let activePagePlan = pagePlan;
  let activeProgress = progress;
  let targetPageIds = new Set(targetPages.map((page) => page.page_id));
  const pageRefinementVisualContexts: Record<string, PageRefinementVisualContext> = {};

  if (input.skipIntentReview) {
    for (const page of targetPages) {
      pageRefinementVisualContexts[page.page_id] = await resolvePageRefinementVisualContext({
        backend: input.backend,
        workspace: activeWorkspace,
        page,
        progress: activeProgress,
      });
    }
  } else if (input.scope === "slide") {
    const targetPage = targetPages[0];
    const [planningContext, researchPlan, researchEvidence] = await Promise.all([
      input.backend.getTemplatePlanningContext({
        workspace_dir: input.workspace.workspace_dir,
      }),
      readResearchPlanSafe(input),
      readResearchEvidenceSafe(input),
    ]);
    const researchRequirement = researchPlan ? getResearchRequirement(researchPlan, targetPage) : null;
    let intentReview: PageRefinementIntentReviewResult;
    try {
      const logContext: AiOperationLogContext | undefined = input.aiLogger
        ? {
            logger: input.aiLogger,
            workspace_dir: input.workspace.workspace_dir,
            domain: "page_plan" as const,
            operation: "page_refinement_intent_review",
            operation_id: input.aiLogger.createOperationId("page_plan", "page_refinement_intent_review"),
            provider: "anna",
            runtime_mode: "anna",
          }
        : undefined;
      intentReview = await input.aiClient.reviewPageRefinementIntent({
        instruction,
        outline: input.confirmedOutline,
        pagePlan,
        targetPage,
        planningContext,
        researchRequirement,
        researchEvidence,
        locale: input.locale,
        logContext,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedProgress = createProgress(
        {
          step: "failed",
          message,
          currentPageIndex: input.pageIndex ?? null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(failedProgress);
      return failedCompletion({
        progress: failedProgress,
        error: {
          type: "page_failed",
          message,
        },
      });
    }

    if (intentReview.route === "unsupported") {
      const message = intentReview.blocking_reason || (
        input.locale === "zh"
          ? "当前页优化无法处理这个需求。"
          : "This request cannot be handled as current-page refinement."
      );
      const failedProgress = createProgress(
        {
          step: "failed",
          message,
          currentPageIndex: input.pageIndex ?? null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(failedProgress);
      return failedCompletion({
        progress: failedProgress,
        error: {
          type: "page_failed",
          message,
          page_id: targetPage.page_id,
          page_index: targetPage.index,
        },
      });
    }

    const preflightFailure = await preflightAgentToolAccess({
      agentClient: input.agentClient,
      locale: input.locale,
      onProgress: input.onProgress,
      progress,
      attemptLimits,
      totalPages: pagePlan.pages.length,
      currentPageIndex: input.pageIndex ?? null,
    });
    if (preflightFailure) return preflightFailure;

    const now = new Date().toISOString();
    if (intentReview.outline_change_required && intentReview.target_outline_item) {
      activeOutline = applyTargetOutlineRevision({
        outline: input.confirmedOutline,
        pageIndex: targetPage.index,
        revisedItem: intentReview.target_outline_item,
        now,
      });
      const updatedWorkspace = await input.backend.updateWorkspaceOutline({
        workspace_dir: input.workspace.workspace_dir,
        outline: {
          title: activeOutline.title,
          output_language: activeOutline.output_language,
          status: "confirmed",
          items: activeOutline.items,
          source: {
            prompt: activeOutline.source.prompt,
            context: activeOutline.source.context,
            task_context: activeOutline.source.task_context,
            setting: activeOutline.source.setting,
          },
        },
      });
      if (updatedWorkspace.outline) {
        activeOutline = updatedWorkspace.outline as WorkspaceOutline;
      }
      activeWorkspace = {
        ...updatedWorkspace,
        outline: activeOutline,
      };
    }

    if (intentReview.outline_change_required) {
      activePagePlan = reviseTargetPagePlanEntry({
        pagePlan,
        targetPage,
        activeOutline,
        now: new Date().toISOString(),
      });
      activePagePlan = await input.backend.recordPagePlan({
        workspace_dir: input.workspace.workspace_dir,
        page_plan: activePagePlan,
      });
      activeProgress = await input.backend.getPageProgress({
        workspace_dir: input.workspace.workspace_dir,
      });
    }

    const activeTargetPage = activePagePlan.pages.find((page) => page.page_id === targetPage.page_id) ?? targetPage;
    targetPageIds = new Set([activeTargetPage.page_id]);

    if (researchPlan && (
      intentReview.additional_research_required ||
      intentReview.additional_web_query_intents.length > 0 ||
      intentReview.additional_image_query_intents.length > 0 ||
      intentReview.evidence_needs.length > 0 ||
      intentReview.visual_needs.length > 0
    )) {
      if (researchEvidence?.pages.find((page) => page.page_id === targetPage.page_id)?.status === "curated" && researchRequirement) {
        const currentResearchStatus = await input.backend.getResearchStatus({
          workspace_dir: input.workspace.workspace_dir,
        });
        await input.backend.recordResearchStatus({
          workspace_dir: input.workspace.workspace_dir,
          status: recordResearchCollectionLedger({
            status: currentResearchStatus,
            pageId: targetPage.page_id,
            webCollections: researchRequirement.query_intents.map((query) => ({ query })),
            imageCollections: researchRequirement.image_query_intents.map((query) => ({ query })),
            now: new Date().toISOString(),
          }),
        });
      }
      await input.backend.recordResearchPlan({
        workspace_dir: input.workspace.workspace_dir,
        research_plan: mergeTargetResearchRequirement({
          researchPlan,
          targetPage: activeTargetPage,
          review: intentReview,
          pagePlanUpdatedAt: activePagePlan.updated_at,
          now: new Date().toISOString(),
        }),
      });
    }

    pageRefinementVisualContexts[activeTargetPage.page_id] = await resolvePageRefinementVisualContext({
      backend: input.backend,
      workspace: activeWorkspace,
      page: activeTargetPage,
      progress: activeProgress,
    });
  } else {
    const preflightFailure = await preflightAgentToolAccess({
      agentClient: input.agentClient,
      locale: input.locale,
      onProgress: input.onProgress,
      progress,
      attemptLimits,
      totalPages: pagePlan.pages.length,
      currentPageIndex: null,
    });
    if (preflightFailure) return preflightFailure;
  }

  const pageRefinementRequests: Record<string, string> = {};
  for (const page of activePagePlan.pages.filter((page) => targetPageIds.has(page.page_id))) {
    pageRefinementRequests[page.page_id] = instruction;
  }
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "page-refinement",
    step: "page-authoring",
    target_page_ids: Object.keys(pageRefinementRequests),
    page_refinement_request: instruction,
    page_refinement_requests: pageRefinementRequests,
    error: null,
    deck_status: "running",
  });

  return runDeckGeneration({
    backend: input.backend,
    aiClient: input.aiClient,
    agentClient: input.agentClient,
    aiLogger: input.aiLogger,
    workspace: activeWorkspace,
    confirmedOutline: activeOutline,
    locale: input.locale,
    startMode: "resume",
    onProgress: input.onProgress,
    isCancelled: input.isCancelled,
    cancelSignal: input.cancelSignal,
    pageRefinementRequests,
    pageRefinementVisualContexts,
  });
}

export async function runPageGenerationRetry(
  input: RunPageGenerationRetryInput,
): Promise<DeckGenerationCompletion> {
  const text = generationText(input.locale);
  const attemptLimits = getAttemptLimits(input);
  const [pagePlan, initialProgress] = await Promise.all([
    input.backend.getPagePlan({ workspace_dir: input.workspace.workspace_dir }),
    input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir }),
  ]);
  if (!pagePlanMatchesOutlineAndTemplate(input.workspace, pagePlan, initialProgress, input.confirmedOutline)) {
    const staleProgress = createProgress(
      {
        step: "failed",
        message: text.staleArtifacts,
        currentPageIndex: null,
        totalPages: input.confirmedOutline.items.length,
      },
      initialProgress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(staleProgress);
    return failedCompletion({
      progress: staleProgress,
      error: {
        type: "stale_artifacts",
        message: staleProgress.message,
      },
    });
  }

  const page = pagePlan.pages.find((item) => item.page_id === input.pageId);
  if (!page) {
    const missingProgress = createProgress(
      {
        step: "failed",
        message: input.locale === "zh" ? "没有找到要重跑的页面。" : "Could not find the page to retry.",
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      initialProgress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(missingProgress);
    return failedCompletion({
      progress: missingProgress,
      error: {
        type: "page_failed",
        message: missingProgress.message,
      },
    });
  }

  const preflightFailure = await preflightAgentToolAccess({
    agentClient: input.agentClient,
    locale: input.locale,
    onProgress: input.onProgress,
    progress: initialProgress,
    attemptLimits,
    totalPages: pagePlan.pages.length,
    currentPageIndex: page.index,
  });
  if (preflightFailure) return preflightFailure;

  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "page-generation-retry",
    step: "page-authoring",
    target_page_ids: [page.page_id],
    page_refinement_request: null,
    page_refinement_requests: {},
    error: null,
    deck_status: "running",
  });
  let progress = await recordProgress(input, page, {
    status: "pending",
    render_attempts: 0,
    visual_review_attempts: 0,
    content_review_attempts: 0,
    agent_failures: 0,
    agent_infrastructure_failures: 0,
    last_error: "",
    content_review: null,
    visual_review: null,
    review: null,
  });
  const runtime: DeckGenerationRuntime = {
    ...input,
    activeStreams: new Map(),
    getProgress: () => progress,
    setProgress: (nextProgress) => {
      progress = nextProgress;
    },
  };

  const result = await runPageGeneration(runtime, pagePlan, page);
  if (result.reason === "agent_infrastructure" && result.error) {
    const failedProgress = createProgress(
      {
        step: "failed",
        message: result.error.message,
        currentPageIndex: page.index,
        totalPages: pagePlan.pages.length,
      },
      result.progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: result.error,
    });
  }

  if (input.isCancelled() || result.reason === "cancelled") {
    const cancelledProgress = createProgress(
      {
        step: "cancelled",
        message: text.cancelled,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(cancelledProgress);
    await recordDeckRecovery(input, {
      status: "interrupted",
      run_kind: "page-generation-retry",
      step: "interrupted",
      target_page_ids: [page.page_id],
      error: null,
      deck_status: "interrupted",
    });
    return {
      status: "cancelled",
      progress: cancelledProgress,
    };
  }

  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  const failedPage = progress.pages.find((item) => item.status !== "accepted");
  if (failedPage) {
    const error = createFailedPageError(failedPage, input.locale);
    const failedCount = progress.pages.filter((item) => item.status !== "accepted").length;
    const failedProgress = createProgress(
      {
        step: "failed",
        message: failedCount > 1 ? text.failedSummary(failedCount) : error.message,
        currentPageIndex: failedPage.index,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error,
    });
  }

  progress = await recordDeckRecovery(input, {
    status: "running",
    run_kind: "final-deck-render",
    step: "final-render",
    target_page_ids: [],
    error: null,
    final_deck_render: {
      status: "running",
      message: text.finalRender,
      error: null,
    },
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "final-render",
      message: text.finalRender,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );
  let rendered: RenderDeckHtmlResult;
  try {
    rendered = await input.backend.renderDeckHtml({
      workspace_dir: input.workspace.workspace_dir,
    });
    if (input.isCancelled()) {
      progress = await recordDeckRecovery(input, {
        status: "interrupted",
        run_kind: "final-deck-render",
        step: "final-render",
        error: null,
        final_deck_render: {
          status: "interrupted",
          message: text.finalRender,
          error: null,
        },
        deck_status: "interrupted",
      });
      const cancelledProgress = createProgress(
        {
          step: "cancelled",
          message: text.cancelled,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(cancelledProgress);
      return {
        status: "cancelled",
        progress: cancelledProgress,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress = await recordDeckRecovery(input, {
      status: "failed",
      run_kind: "final-deck-render",
      step: "final-render",
      error: message,
      final_deck_render: {
        status: "failed",
        message,
        error: message,
      },
      deck_status: "failed",
    });
    const failedProgress = createProgress(
      {
        step: "final-render",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: {
        type: "final_render_failed",
        message,
      },
    });
  }
  progress = await recordDeckRecovery(input, {
    status: "completed",
    run_kind: "final-deck-render",
    step: "complete",
    error: null,
    final_deck_render: {
      status: "completed",
      message: text.deckReady,
      error: null,
      output_dir: rendered.output_dir,
      deck_html_path: rendered.slides[0]?.html_path ?? null,
      pages_path: `${input.workspace.workspace_dir}/pages.json`,
      rendered_at: rendered.rendered_at,
    },
    deck_status: "completed",
  });
  emit(
    input,
    {
      step: "complete",
      message: text.deckReady,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  return {
    status: "completed",
    result: {
      outline: input.confirmedOutline,
      pagePlan,
      progress,
      rendered,
    },
  };
}
