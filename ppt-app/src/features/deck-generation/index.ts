import {
  isAgentInfrastructureError,
  isAgentRunCancelledError,
  type AgentInfrastructureError,
  type AgentClient,
  type AgentPageContentReviewResult,
  type AgentRunSummary,
  type AgentPageVisualReviewResult,
  type AgentStreamEvent,
} from "../../agent/agentClient";
import { TSX_AUTHORING_RULES_SUMMARY } from "../../agent/promptRules";
import { CONTENT_GROUNDING_RULES } from "../../ai/groundingRules";
import {
  AUTO_OUTPUT_LANGUAGE,
  normalizeOutputLanguage,
  readOutlineOutputLanguage,
} from "../../ai/outputLanguage";
import type { AiClient } from "../../ai/aiClient";
import type { AiInteractionLogger, AiOperationLogContext } from "../../ai/interactionLog";
import type {
  PagePlan,
  PagePlanItem,
  PageProgress,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";
import type { Locale } from "../../i18n/messages";
import {
  isActivePageGenerationStatus,
  isGenuinelyFailedPageGenerationStatus,
  isResumablePageGenerationStatus,
} from "./pageStatusPolicy";

const ATTEMPT_LIMITS = {
  render: 10,
  visualReview: 5,
  contentReview: 5,
  agent: 5,
};
const PAGE_GENERATION_CONCURRENCY = 3;

export type DeckGenerationStep =
  | "page-plan"
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
}

export interface RunDeckRefinementInput extends RunDeckGenerationInput {
  instruction: string;
  scope: "deck" | "slide";
  pageIndex?: number;
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

function generationText(locale: Locale) {
  const zh = locale === "zh";
  return {
    pagePlan: zh ? "正在规划页面和模板蓝图" : "Planning pages and template blueprints",
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

function mapProgress(progress: PageProgress | null): DeckGenerationProgressPage[] {
  return progress?.pages.map((page) => ({
    page_id: page.page_id,
    index: page.index,
    title: page.title,
    status: page.status,
    render_attempts: page.render_attempts,
    render_attempt_limit: ATTEMPT_LIMITS.render,
    visual_review_attempts: page.visual_review_attempts,
    visual_review_attempt_limit: ATTEMPT_LIMITS.visualReview,
    content_review_attempts: page.content_review_attempts ?? 0,
    content_review_attempt_limit: ATTEMPT_LIMITS.contentReview,
    agent_failures: page.agent_failures,
    agent_failure_limit: ATTEMPT_LIMITS.agent,
    agent_infrastructure_failures: page.agent_infrastructure_failures,
    last_error: page.last_error,
    last_screenshot_path: page.last_screenshot_path,
  })) ?? [];
}

function createProgress(
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
): DeckGenerationProgress {
  const activeStreamList = activeStreams
    ? Array.from(activeStreams).sort((left, right) => left.page_index - right.page_index)
    : [];
  return {
    ...value,
    pages: mapProgress(progress),
    stream: stream ?? undefined,
    activeStreams: activeStreamList.length > 0 ? activeStreamList.map((item) => ({
      ...item,
      lines: [...item.lines],
      activities: [...item.activities],
    })) : undefined,
  };
}

function emit(
  input: Pick<DeckGenerationContext, "onProgress">,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
) {
  input.onProgress(createProgress(value, progress, stream, activeStreams));
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

function buildAuthoringPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
  attemptKind: "initial" | "render-fix" | "visual-review-fix" | "content-review-fix";
  renderError?: string;
  visualReview?: AgentPageVisualReviewResult | null;
  contentReview?: AgentPageContentReviewResult | null;
}) {
  const hasFailureFix = Boolean(input.renderError || input.visualReview || input.contentReview);

  return [
    "You are a local file-editing Agent generating one PPT slide in a TSX-first template workspace.",
    "Edit files directly on disk. Work only on the current page unless a shared component/theme change is truly necessary.",
    "After editing, summarize briefly. A JSON object is preferred but not required. Preferred shape:",
    '{"status":"ready_for_render","changed_files":["template/slides/page-01.tsx"],"summary":"...","needs_render":true,"notes":[]}',
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page index: ${input.page.index}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Output content language: ${readOutlineOutputLanguage(input.outline)}`,
    `Current slide path: ${input.workspaceDir}/template/${input.page.slide_path.replace(/^\.\//, "")}`,
    `Current data path: ${input.workspaceDir}/template/${input.page.data_path.replace(/^\.\//, "")}`,
    `Selected blueprint id: ${input.page.blueprint_id}`,
    `Selected blueprint source: ${input.workspaceDir}/template/${input.page.blueprint_source.replace(/^\.\//, "")}`,
    "",
    "Read these workspace files before editing:",
    `- ${input.workspaceDir}/template/catalog.json`,
    `- ${input.workspaceDir}/template/blueprints/README.md`,
    `- ${input.workspaceDir}/template/components/README.md`,
    `- ${input.workspaceDir}/template/slides/README.md`,
    `- ${input.workspaceDir}/outline.json`,
    `- ${input.workspaceDir}/page-plan.json`,
    "",
    "Rules summary:",
    TSX_AUTHORING_RULES_SUMMARY,
    "",
    CONTENT_GROUNDING_RULES,
    "",
    "Before editing, think through a concise page-specific design direction, then implement it directly. In the final summary or notes, mention the main design decisions you made.",
    "When editing slide TSX/data, remove or soften unsupported specifics. Use neutral business language or TBD for missing details.",
    "If content-review-fix asks for content changes, edit only the current data JSON by default. Edit the current slide TSX only when visible hardcoded text, schema constraints, or rendering logic prevent a data-only fix.",
    "If a content-review-fix request asks you to add real facts, numbers, dates, or source-backed data that are not present in workspace files, treat that request as conflicting with the grounding rules. Do not add the facts; instead remove the unsupported detail, soften it, or mark it as TBD / 待补充.",
    "If render-fix or visual-review-fix asks for visual changes, fix visuals without adding new factual claims.",
    "",
    `Full outline JSON: ${JSON.stringify(input.outline)}`,
    `Full page plan JSON: ${JSON.stringify(input.pagePlan)}`,
    hasFailureFix
      ? [
          "Failure-fix priority:",
          "A failure report is provided for this pass. Fix the reported failure first.",
          "Make only the design or content changes that support the fix.",
          "Do not introduce unrelated redesigns, new content, or broad refactors during a fix pass.",
        ].join("\n")
      : "",
    input.renderError ? `Render error to fix:\n${input.renderError}` : "",
    input.visualReview
      ? `Visual review failed. Fix request:\n${JSON.stringify(input.visualReview)}`
      : "",
    input.contentReview
      ? [
          "Page Content Review failed. Rewrite request:",
          JSON.stringify(input.contentReview),
          "Fix language, outline-alignment, and grounding issues by editing the current page data JSON first.",
          "Do not modify page-plan.json, outline.json, other pages, or unrelated shared files.",
          "Remove, soften, or mark unsupported concrete claims as TBD. Do not replace them with new unsupported specifics.",
          "Never satisfy a rewrite request by inventing or approximating real-world numbers, years, citations, rankings, named-organization facts, or chart data. If the review asks for real data but the workspace has no source for it, keep or add a clear TBD / 待补充 marker instead.",
        ].join("\n")
      : "",
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

function buildPageContentReviewPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
}) {
  const expectedOutputLanguage = resolveReviewExpectedOutputLanguage(input.outline);
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
    `5. Workspace setting: ${input.workspaceDir}/setting.json`,
    `6. Workspace task metadata: ${input.workspaceDir}/task.json`,
    "",
    "Data field scope:",
    "- Judge user-visible string values in the current data JSON.",
    "- Judge speaker note string values when they are present in the current data JSON.",
    "- Also judge visible hardcoded strings in the current slide TSX when they render as user-facing slide content.",
    "- Use the current slide TSX to distinguish visible content fields from control/configuration fields.",
    "- Do not judge JSON keys, internal _plan fields, enum/control values, file paths, ids, booleans, or non-visible template configuration as language/content issues.",
    "- Allow proper nouns, brand names, product names, organization names, acronyms, numbers, dates, units, and user-provided source terms.",
    "",
    "Language check:",
    languageInstruction,
    "",
    "Outline alignment check:",
    "- The current page's Page Plan entry is the primary content boundary.",
    "- Fail with an outline_alignment issue when main titles, body text, lists, chart narrative, or speaker notes clearly belong to another page or contradict the current page outline.",
    "- Do not fail minor wording differences, concise paraphrases, or light connective context when they preserve the current page's intent.",
    "- Allow light deck-level connective text.",
    "- Allow cover, agenda, and closing pages to summarize the deck when that fits the current page role.",
    "",
    "Grounding check:",
    "Do not use your own world knowledge to approve a claim.",
    "Judge support only from workspace artifacts: current data, current slide, current page plan entry, Confirmed Outline and its source prompt/context/task_context, workspace settings, and uploaded/source material represented in workspace artifacts.",
    "",
    CONTENT_GROUNDING_RULES,
    "",
    "Treat these as unsupported unless explicitly present in the workspace artifacts: numbers, dates, market sizes, growth rates, customer names, case studies, product capabilities, URLs, citations, quotes, rankings, regulatory/legal claims, geography-specific facts, and claims about competitors or named organizations.",
    "Clear placeholders such as TBD, 待补充, 待确认, 暂无数据, or 数据待补充 are acceptable grounding treatments when the workspace lacks source material. Do not report them as grounding issues solely because the page openly marks a fact or chart as pending.",
    "Chart or table placeholder values such as all-zero series can pass grounding when the visible chart title, subtitle, note, or nearby text clearly marks the data as TBD / 待补充. If you need to mention them, use type placeholder_quality with low severity, not type grounding.",
    "Unsupported concrete facts, numbers, dates, years, chart data, or named-organization claims that are not present in workspace artifacts must be reported as type grounding, must set pass=false, and must include a concrete rewrite_request. Never downgrade unsupported concrete facts to placeholder_quality or low-severity advisory issues.",
    "Never ask the authoring agent to replace placeholders with real facts, numbers, dates, or chart data unless you can point to the exact workspace artifact that provides those facts. Without such a source, rewrite_request must ask to remove, soften, generalize, or mark the content as TBD / 待补充.",
    "Generic business phrasing can pass if it is clearly not presented as a concrete fact.",
    "For each issue, evidence should quote the problematic text and include the data field path or TSX location when available.",
    "rewrite_request must be actionable for the authoring agent, scoped to the current page, and should name the exact text or field to change when possible.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[{"type":"language","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"outline_alignment","severity":"medium","evidence":"...","reason":"...","fix_hint":"..."},{"type":"grounding","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"placeholder_quality","severity":"low","evidence":"...","reason":"...","fix_hint":"..."}],"rewrite_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    "Use score 0-10. pass=true requires score >= 7, confidence not low, no language, outline_alignment, or grounding issues.",
    "placeholder_quality issues are advisory and may pass when score and confidence are sufficient. language, outline_alignment, and grounding issues require pass=false and a concrete rewrite_request.",
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

function createAgentRunTracker(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  step: DeckGenerationStep;
  message: string;
  totalPages: number;
  progress: () => PageProgress | null;
  prompt: string;
  kind: string;
}) {
  const startedAt = new Date().toISOString();
  const operationId = input.flowInput.aiLogger
    ? input.flowInput.aiLogger.createOperationId("page_agent", input.kind)
    : `${input.page.page_id}-${input.kind}-${Date.now().toString(36)}`;
  const logContext: AiOperationLogContext | undefined = input.flowInput.aiLogger
    ? {
        logger: input.flowInput.aiLogger,
        workspace_dir: input.flowInput.workspace.workspace_dir,
        domain: "page_agent" as const,
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
        event: "ai.page_agent.operation.finished",
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
          channel: "ai-page-agent",
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
  progress: PageProgress,
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

  return progressMatchesPlan(pagePlan, progress);
}

async function loadResumeArtifacts(input: RunDeckGenerationInput) {
  try {
    const [pagePlan, progress] = await Promise.all([
      input.backend.getPagePlan({ workspace_dir: input.workspace.workspace_dir }),
      input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir }),
    ]);
    if (!pagePlanMatchesOutlineAndTemplate(input.workspace, pagePlan, progress, input.confirmedOutline)) {
      return null;
    }
    return { pagePlan, progress };
  } catch {
    return null;
  }
}

async function createRestartArtifacts(input: RunDeckGenerationInput) {
  const text = generationText(input.locale);
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

  let progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });

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
  const activePage =
    resumablePage ??
    failedPage ??
    activePageCandidate ??
    [...pages].reverse().find((item) => item.status !== "pending") ??
    pages[0] ??
    null;
  const acceptedCount = pages.filter((item) => item.status === "accepted").length;
  const allAccepted = pages.length > 0 && acceptedCount === pages.length;
  const step: DeckGenerationStep = allAccepted
      ? "complete"
      : resumablePage
        ? "interrupted"
        : failedPage && !activePageCandidate
          ? "failed"
          : "page-authoring";
  const message = step === "complete"
      ? generationText(locale).complete
      : step === "interrupted"
        ? generationText(locale).interrupted
        : failedPage?.last_error
          ? failedPage.last_error
      : generationText(locale).resumed;

  return {
    step,
    message,
    currentPageIndex: activePage ? activePage.index : null,
    totalPages: pages.length,
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
  let progress = input.getProgress();
  const existingPageProgress = getProgressPage(progress, page.page_id);

  if (existingPageProgress?.status === "accepted") {
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
  let visualReview =
    existingPageProgress?.status === "visual_review_fixing"
      ? getStoredVisualReview(existingPageProgress)
      : null;
  let contentReview =
    existingPageProgress?.status === "content_review_fixing"
      ? getStoredContentReview(existingPageProgress)
      : null;

  while (!input.isCancelled()) {
    const attemptKind = renderError
      ? "render-fix"
      : contentReview
        ? "content-review-fix"
        : visualReview
          ? "visual-review-fix"
          : "initial";
    const authoringPrompt = buildAuthoringPrompt({
      workspaceDir: input.workspace.workspace_dir,
      page,
      pagePlan,
      outline: input.confirmedOutline,
      attemptKind,
      renderError,
      visualReview,
      contentReview,
    });
    const authoringKind = attemptKind === "initial" ? "authoring" : attemptKind;
    const authoringTracker = createAgentRunTracker({
      flowInput: input,
      page,
      step: "page-authoring",
      message: text.authoringPage(page),
      totalPages,
      progress: input.getProgress,
      prompt: authoringPrompt,
      kind: authoringKind,
    });

    try {
      const authoringResult: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
        authoringPrompt,
        buildAgentRunOptions(input, authoringTracker.onStreamEvent, authoringTracker.logContext),
      );
      await authoringTracker.flush("completed", {
        parsed_summary: authoringResult.parsed_json === true,
        summary: authoringResult.summary,
        changed_files: authoringResult.changed_files,
        needs_render: authoringResult.needs_render,
        session_retries: authoringResult.session_retries ?? 0,
        session_cache_miss_retries:
          authoringResult.session_cache_miss_retries ?? 0,
      });
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
        status: agentFailures >= ATTEMPT_LIMITS.agent ? "agent_failed" : "authoring",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= ATTEMPT_LIMITS.agent) break;
      continue;
    }

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
        status: agentFailures >= ATTEMPT_LIMITS.agent ? "agent_failed" : "content_review",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= ATTEMPT_LIMITS.agent) break;
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
          contentReviewAttempts >= ATTEMPT_LIMITS.contentReview
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
      if (contentReviewAttempts >= ATTEMPT_LIMITS.contentReview) break;
      continue;
    }

    contentReview = null;
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
      progress = await recordProgress(input, page, {
        status: "visual_review",
        last_html_path: preview.html_path,
        last_screenshot_path: preview.screenshot_path,
        last_error: "",
      });
      input.setProgress(progress);
    } catch (error) {
      renderAttempts += 1;
      renderError = error instanceof Error ? error.message : String(error);
      progress = await recordProgress(input, page, {
        status: renderAttempts >= ATTEMPT_LIMITS.render ? "render_failed" : "render_fixing",
        render_attempts: renderAttempts,
        last_error: renderError,
      });
      input.setProgress(progress);
      if (renderAttempts >= ATTEMPT_LIMITS.render) break;
      continue;
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
        status: agentFailures >= ATTEMPT_LIMITS.agent ? "agent_failed" : "visual_review",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= ATTEMPT_LIMITS.agent) break;
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
        visualReviewAttempts >= ATTEMPT_LIMITS.visualReview
          ? "needs_user_review"
          : "visual_review_fixing",
      visual_review_attempts: visualReviewAttempts,
      visual_review: visualReview,
      review: visualReview,
      last_error: visualReview.revision_request,
    });
    input.setProgress(progress);
    if (visualReviewAttempts >= ATTEMPT_LIMITS.visualReview) break;
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
    return pageProgress?.status === "visual_review_fixing" ||
      isResumablePageGenerationStatus(pageProgress?.status ?? "pending");
  });
  const results: PageGenerationResult[] = [];
  let nextIndex = 0;
  let stopScheduling = false;

  async function worker() {
    while (!stopScheduling && !runtime.isCancelled()) {
      const page = pagesToRun[nextIndex];
      nextIndex += 1;
      if (!page) return;

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
  if (input.confirmedOutline.status !== "confirmed") {
    const progress = createProgress(
      {
        step: "failed",
        message: text.invalidOutline,
        currentPageIndex: null,
        totalPages: 0,
      },
      null,
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
      totalPages: input.confirmedOutline.items.length,
      currentPageIndex: null,
    });
    if (preflightFailure) return preflightFailure;
    artifacts = await createRestartArtifacts(input);
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
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: infrastructureFailure.error,
    });
  }

  if (input.isCancelled()) {
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
    );
    input.onProgress(cancelledProgress);
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
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error,
    });
  }

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
  const rendered = await input.backend.renderDeckHtml({
    workspace_dir: input.workspace.workspace_dir,
  });
  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
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

function buildRefinementReview(instruction: string): AgentPageVisualReviewResult {
  const groundedInstruction = [
    instruction,
    "",
    CONTENT_GROUNDING_RULES,
    "Apply the refinement without adding unsupported facts. If the requested improvement needs missing facts, use neutral wording or TBD.",
  ].join("\n");

  return {
    pass: false,
    score: 0,
    issues: [
      {
        severity: "user-request",
        area: "refinement",
        problem: groundedInstruction,
        fix_hint: groundedInstruction,
      },
    ],
    revision_request: groundedInstruction,
    confidence: "high",
  };
}

export async function runDeckRefinement(
  input: RunDeckRefinementInput,
): Promise<DeckGenerationCompletion> {
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

  const targetPages =
    input.scope === "deck"
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
    progress,
    totalPages: pagePlan.pages.length,
    currentPageIndex: input.scope === "slide" ? input.pageIndex ?? null : null,
  });
  if (preflightFailure) return preflightFailure;

  const review = buildRefinementReview(instruction);
  for (const page of targetPages) {
    await recordProgress(input, page, {
      status: "visual_review_fixing",
      render_attempts: 0,
      visual_review_attempts: 0,
      content_review_attempts: 0,
      agent_failures: 0,
      last_error: instruction,
      content_review: null,
      visual_review: review,
      review,
    });
  }

  return runDeckGeneration({
    backend: input.backend,
    aiClient: input.aiClient,
    agentClient: input.agentClient,
    workspace: input.workspace,
    confirmedOutline: input.confirmedOutline,
    locale: input.locale,
    startMode: "resume",
    onProgress: input.onProgress,
    isCancelled: input.isCancelled,
  });
}

export async function runPageGenerationRetry(
  input: RunPageGenerationRetryInput,
): Promise<DeckGenerationCompletion> {
  const text = generationText(input.locale);
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
    totalPages: pagePlan.pages.length,
    currentPageIndex: page.index,
  });
  if (preflightFailure) return preflightFailure;

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
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: result.error,
    });
  }

  if (input.isCancelled()) {
    const cancelledProgress = createProgress(
      {
        step: "cancelled",
        message: text.cancelled,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
    );
    input.onProgress(cancelledProgress);
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
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error,
    });
  }

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
  const rendered = await input.backend.renderDeckHtml({
    workspace_dir: input.workspace.workspace_dir,
  });
  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
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
