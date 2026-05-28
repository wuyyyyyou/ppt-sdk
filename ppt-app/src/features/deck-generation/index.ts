import {
  isAgentInfrastructureError,
  type AgentClient,
  type AgentRunSummary,
  type AgentSelfReviewResult,
  type AgentStreamEvent,
} from "../../agent/agentClient";
import { TSX_AUTHORING_RULES_SUMMARY } from "../../agent/promptRules";
import type { AiClient } from "../../ai/aiClient";
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

const ATTEMPT_LIMITS = {
  render: 10,
  selfReview: 5,
  agent: 5,
};

export type DeckGenerationStep =
  | "page-plan"
  | "prepare"
  | "page-authoring"
  | "page-render"
  | "page-review"
  | "final-render"
  | "complete"
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
  self_review_attempts: number;
  self_review_attempt_limit: number;
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
}

export interface DeckGenerationProgress {
  step: DeckGenerationStep;
  message: string;
  currentPageIndex: number | null;
  totalPages: number;
  pages: DeckGenerationProgressPage[];
  stream?: DeckGenerationStream;
}

export interface DeckGenerationStreamSnapshot {
  id: string;
  phase: string;
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
  workspace: WorkspaceResult;
  confirmedOutline: WorkspaceOutline;
  locale: Locale;
  startMode?: DeckGenerationStartMode;
  onProgress: (progress: DeckGenerationProgress) => void;
  isCancelled: () => boolean;
}

export interface RunDeckRefinementInput extends RunDeckGenerationInput {
  instruction: string;
  scope: "deck" | "slide";
  pageIndex?: number;
}

type DeckGenerationContext = Omit<RunDeckGenerationInput, "startMode">;

function generationText(locale: Locale) {
  const zh = locale === "zh";
  return {
    pagePlan: zh ? "正在规划页面和模板蓝图" : "Planning pages and template blueprints",
    prepare: zh ? "正在准备页面文件" : "Preparing page files",
    complete: zh ? "生成完成" : "Generation complete",
    resumed: zh ? "已恢复上次生成进度" : "Resumed previous generation progress",
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
      zh ? `Agent 正在编辑第 ${page.index + 1} 页` : `Agent is editing page ${page.index + 1}`,
    renderingPage: (page: PagePlanItem) =>
      zh ? `正在渲染第 ${page.index + 1} 页` : `Rendering page ${page.index + 1}`,
    reviewingScreenshot: (page: PagePlanItem) =>
      zh ? `正在自评第 ${page.index + 1} 页截图` : `Reviewing page ${page.index + 1} screenshot`,
    reviewingPage: (page: PagePlanItem) =>
      zh ? `Agent 正在自评第 ${page.index + 1} 页` : `Agent is reviewing page ${page.index + 1}`,
    cancelled: zh ? "已停止生成" : "Generation stopped",
    finalRender: zh ? "正在生成最终预览" : "Generating final preview",
    deckReady: zh ? "演示文稿已生成" : "Deck generated",
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
    self_review_attempts: page.self_review_attempts,
    self_review_attempt_limit: ATTEMPT_LIMITS.selfReview,
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
): DeckGenerationProgress {
  return {
    ...value,
    pages: mapProgress(progress),
    stream: stream ?? undefined,
  };
}

function emit(
  input: Pick<DeckGenerationContext, "onProgress">,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
) {
  input.onProgress(createProgress(value, progress, stream));
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
  attemptKind: "initial" | "render-fix" | "self-review-fix";
  renderError?: string;
  selfReview?: AgentSelfReviewResult | null;
}) {
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
    `Full outline JSON: ${JSON.stringify(input.outline)}`,
    `Full page plan JSON: ${JSON.stringify(input.pagePlan)}`,
    input.renderError ? `Render error to fix:\n${input.renderError}` : "",
    input.selfReview
      ? `Visual review failed. Fix request:\n${JSON.stringify(input.selfReview)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSelfReviewPrompt(input: {
  page: PagePlanItem;
  screenshotPath: string;
  preview: RenderWorkspacePagePreviewResult;
}) {
  return [
    "Review the generated PPT slide screenshot for visual quality.",
    "First use `upload_local_file` on the screenshot path, then inspect that uploaded image with `analyze_image` before making a visual judgment.",
    "If image analysis is unavailable or inconclusive, use the rendered HTML path as fallback context and still return a JSON review.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[],"revision_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    `Screenshot path: ${input.screenshotPath}`,
    `Page title: ${input.page.title}`,
    `Page outline: ${input.page.outline}`,
    `Rendered HTML path: ${input.preview.html_path}`,
    "",
    "Pass only if the slide follows the outline, looks like a complete PPT page, has no obvious overlap/cutoff/blank errors, uses readable text, and fits the selected template style.",
    "Use score 0-10. pass=true requires score >= 7.",
  ].join("\n");
}

function selfReviewPassed(review: AgentSelfReviewResult) {
  return review.pass && review.score >= 7 && review.confidence !== "low";
  // return true; // 先关闭自评结果中的置信度判断，后续根据实际情况再调整
}

function getProgressPage(progress: PageProgress | null, pageId: string) {
  return progress?.pages.find((page) => page.page_id === pageId) ?? null;
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
  flowInput: DeckGenerationContext;
  page: PagePlanItem;
  step: DeckGenerationStep;
  message: string;
  totalPages: number;
  progress: () => PageProgress | null;
  prompt: string;
  kind: string;
}) {
  const startedAt = new Date().toISOString();
  const runId = `${input.page.page_id}-${input.kind}-${Date.now().toString(36)}`;
  const stream: DeckGenerationStream = {
    run_id: runId,
    kind: input.kind,
    page_id: input.page.page_id,
    page_index: input.page.index,
    status: input.message,
    lines: [],
    activities: [],
  };
  const contentChunks: string[] = [];
  const activities: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  let usage: unknown = null;

  function emitStream() {
    emit(
      input.flowInput,
      {
        step: input.step,
        message: input.message,
        currentPageIndex: input.page.index,
        totalPages: input.totalPages,
      },
      input.progress(),
      stream,
    );
  }

  return {
    onStreamEvent(event: AgentStreamEvent) {
      if (event.type === "content") {
        contentChunks.push(event.text);
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
    async flush(status: "completed" | "error", extra: Record<string, unknown>) {
      const endedAt = new Date().toISOString();
      const finalText = contentChunks.join("");
      const baseEntry = {
        event: "ai.page_agent.run",
        run_id: runId,
        page_id: input.page.page_id,
        page_index: input.page.index,
        kind: input.kind,
        status,
        prompt_hash: shortHash(input.prompt),
        started_at: startedAt,
        ended_at: endedAt,
        final_text: finalText,
        usage,
        ...extra,
      };
      try {
        await input.flowInput.backend.appendWorkspaceLog({
          workspace_dir: input.flowInput.workspace.workspace_dir,
          channel: "ai-page-agent",
          entry: baseEntry,
        });
        await input.flowInput.backend.appendWorkspaceLog({
          workspace_dir: input.flowInput.workspace.workspace_dir,
          channel: "ai-page-agent-stream",
          entry: {
            event: "ai.page_agent.stream",
            run_id: runId,
            page_id: input.page.page_id,
            kind: input.kind,
            status,
            content: finalText,
            activities,
            errors,
            usage,
          },
        });
      } catch {
        // Logging must never fail Deck Generation.
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
  const pagePlan = await input.aiClient.generatePagePlan({
    outline: input.confirmedOutline,
    planningContext,
    locale: input.locale,
  });
  await appendWorkspaceLogSafe(input, "ai-page-plan", {
    event: "ai.page_plan.generated",
    title: pagePlan.title,
    page_count: pagePlan.pages.length,
    template_group: pagePlan.source.template_group,
    plan: pagePlan,
  });
  await input.backend.recordPagePlan({
    workspace_dir: input.workspace.workspace_dir,
    page_plan: pagePlan,
  });

  emit(
    input,
    {
      step: "prepare",
      message: text.prepare,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    null,
  );

  await input.backend.preparePageFiles({
    workspace_dir: input.workspace.workspace_dir,
  });

  let progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });

  for (const page of pagePlan.pages) {
    progress = await recordProgress(input, page, {
      status: "pending",
      render_attempts: 0,
      self_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_error: "",
      last_html_path: "",
      last_screenshot_path: "",
      review: null,
    });
  }

  return { pagePlan, progress };
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

export function pageProgressToDeckGenerationProgress(
  storedProgress: PageProgress,
  locale: Locale = "zh",
): DeckGenerationProgress {
  const pages = [...storedProgress.pages].sort((left, right) => left.index - right.index);
  const failedPage = pages.find((item) =>
    /failed/i.test(item.status) ||
    item.status === "needs_user_review" ||
    item.status === "agent_infrastructure_failed"
  );
  const activePage =
    failedPage ??
    [...pages].reverse().find((item) => item.status !== "pending") ??
    pages[0] ??
    null;
  const acceptedCount = pages.filter((item) => item.status === "accepted").length;
  const step: DeckGenerationStep = failedPage
    ? "failed"
    : acceptedCount === pages.length
      ? "complete"
      : "page-authoring";
  const message = failedPage?.last_error
    ? failedPage.last_error
    : step === "complete"
      ? generationText(locale).complete
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
    page_id: progress.stream?.page_id,
    page_index: progress.stream?.page_index,
    status: progress.stream?.status ?? progress.message,
    message: progress.message,
    lines: progress.stream ? [...progress.stream.lines] : [],
    activities: progress.stream ? [...progress.stream.activities] : [],
    updated_at: new Date().toISOString(),
  };
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
    artifacts = resumeArtifacts;
  } else {
    artifacts = await createRestartArtifacts(input);
  }

  let { pagePlan, progress } = artifacts;

  for (const page of pagePlan.pages) {
    if (input.isCancelled()) break;

    const existingPageProgress = getProgressPage(progress, page.page_id);
    if (existingPageProgress?.status === "accepted") {
      emit(
        input,
        {
          step: "page-authoring",
          message: text.pagePassed(page),
          currentPageIndex: page.index,
          totalPages: pagePlan.pages.length,
        },
        progress,
      );
      continue;
    }

    progress = await recordProgress(input, page, { status: "authoring" });
    emit(
      input,
      {
        step: "page-authoring",
        message: text.generatingPage(page, pagePlan.pages.length),
        currentPageIndex: page.index,
        totalPages: pagePlan.pages.length,
      },
      progress,
    );

    let renderAttempts = existingPageProgress?.render_attempts ?? 0;
    let selfReviewAttempts = existingPageProgress?.self_review_attempts ?? 0;
    let agentFailures = existingPageProgress?.agent_failures ?? 0;
    let agentInfrastructureFailures =
      existingPageProgress?.agent_infrastructure_failures ?? 0;
    let renderError =
      existingPageProgress?.status === "render_fixing"
        ? existingPageProgress.last_error
        : "";
    let selfReview =
      existingPageProgress?.status === "self_review_fixing"
        ? (existingPageProgress.review as AgentSelfReviewResult | null)
        : null;
    let accepted = false;

    while (!accepted && !input.isCancelled()) {
      const authoringPrompt = buildAuthoringPrompt({
        workspaceDir: input.workspace.workspace_dir,
        page,
        pagePlan,
        outline: input.confirmedOutline,
        attemptKind: renderError ? "render-fix" : selfReview ? "self-review-fix" : "initial",
        renderError,
        selfReview,
      });
      const authoringKind = renderError ? "render-fix" : selfReview ? "self-review-fix" : "authoring";
      const authoringTracker = createAgentRunTracker({
        flowInput: input,
        page,
        step: "page-authoring",
        message: text.authoringPage(page),
        totalPages: pagePlan.pages.length,
        progress: () => progress,
        prompt: authoringPrompt,
        kind: authoringKind,
      });

      try {
        const authoringResult: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
          authoringPrompt,
          { onStreamEvent: authoringTracker.onStreamEvent },
        );
        await authoringTracker.flush("completed", {
          parsed_summary: authoringResult.parsed_json === true,
          summary: authoringResult.summary,
          changed_files: authoringResult.changed_files,
          needs_render: authoringResult.needs_render,
          session_retries: authoringResult.session_retries ?? 0,
        });
        renderError = "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isAgentInfrastructureError(error)) {
          agentInfrastructureFailures += 1;
          await authoringTracker.flush("error", {
            error: message,
            agent_infrastructure_failures: agentInfrastructureFailures,
            active_session_limit: error.activeSessionLimit,
          });
          progress = await recordProgress(input, page, {
            status: "agent_infrastructure_failed",
            agent_infrastructure_failures: agentInfrastructureFailures,
            last_error: message,
          });
          const failedProgress = createProgress(
            {
              step: "failed",
              message,
              currentPageIndex: page.index,
              totalPages: pagePlan.pages.length,
            },
            progress,
          );
          input.onProgress(failedProgress);
          return failedCompletion({
            progress: failedProgress,
            error: {
              type: "agent_infrastructure",
              message,
              page_id: page.page_id,
              page_index: page.index,
              page_status: "agent_infrastructure_failed",
            },
          });
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
        if (agentFailures >= ATTEMPT_LIMITS.agent) break;
        continue;
      }

      let preview: RenderWorkspacePagePreviewResult;
      try {
        emit(
          input,
          {
            step: "page-render",
            message: text.renderingPage(page),
            currentPageIndex: page.index,
            totalPages: pagePlan.pages.length,
          },
          progress,
        );
        preview = await input.backend.renderWorkspacePagePreview({
          workspace_dir: input.workspace.workspace_dir,
          page_index: page.index,
        });
        progress = await recordProgress(input, page, {
          status: "self_review",
          last_html_path: preview.html_path,
          last_screenshot_path: preview.screenshot_path,
          last_error: "",
        });
      } catch (error) {
        renderAttempts += 1;
        renderError = error instanceof Error ? error.message : String(error);
        progress = await recordProgress(input, page, {
          status: renderAttempts >= ATTEMPT_LIMITS.render ? "render_failed" : "render_fixing",
          render_attempts: renderAttempts,
          last_error: renderError,
        });
        if (renderAttempts >= ATTEMPT_LIMITS.render) break;
        continue;
      }

      emit(
        input,
        {
          step: "page-review",
          message: text.reviewingScreenshot(page),
          currentPageIndex: page.index,
          totalPages: pagePlan.pages.length,
        },
        progress,
      );
      const selfReviewPrompt = buildSelfReviewPrompt({
        page,
        screenshotPath: preview.screenshot_path,
        preview,
      });
      const selfReviewTracker = createAgentRunTracker({
        flowInput: input,
        page,
        step: "page-review",
        message: text.reviewingPage(page),
        totalPages: pagePlan.pages.length,
        progress: () => progress,
        prompt: selfReviewPrompt,
        kind: "self-review",
      });
      try {
        selfReview = await input.agentClient.runSelfReviewPrompt(
          selfReviewPrompt,
          { onStreamEvent: selfReviewTracker.onStreamEvent },
        );
        await selfReviewTracker.flush("completed", {
          parsed_review: true,
          review: selfReview,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isAgentInfrastructureError(error)) {
          agentInfrastructureFailures += 1;
          await selfReviewTracker.flush("error", {
            error: message,
            agent_infrastructure_failures: agentInfrastructureFailures,
            active_session_limit: error.activeSessionLimit,
          });
          progress = await recordProgress(input, page, {
            status: "agent_infrastructure_failed",
            agent_infrastructure_failures: agentInfrastructureFailures,
            last_error: message,
          });
          const failedProgress = createProgress(
            {
              step: "failed",
              message,
              currentPageIndex: page.index,
              totalPages: pagePlan.pages.length,
            },
            progress,
          );
          input.onProgress(failedProgress);
          return failedCompletion({
            progress: failedProgress,
            error: {
              type: "agent_infrastructure",
              message,
              page_id: page.page_id,
              page_index: page.index,
              page_status: "agent_infrastructure_failed",
            },
          });
        }

        agentFailures += 1;
        await selfReviewTracker.flush("error", {
          error: message,
          agent_failures: agentFailures,
        });
        progress = await recordProgress(input, page, {
          status: agentFailures >= ATTEMPT_LIMITS.agent ? "agent_failed" : "self_review",
          agent_failures: agentFailures,
          last_error: message,
        });
        if (agentFailures >= ATTEMPT_LIMITS.agent) break;
        continue;
      }
      progress = await recordProgress(input, page, {
        review: selfReview,
      });

      if (selfReviewPassed(selfReview)) {
        accepted = true;
        progress = await recordProgress(input, page, {
          status: "accepted",
          review: selfReview,
        });
        break;
      }

      selfReviewAttempts += 1;
      progress = await recordProgress(input, page, {
        status:
          selfReviewAttempts >= ATTEMPT_LIMITS.selfReview
            ? "needs_user_review"
            : "self_review_fixing",
        self_review_attempts: selfReviewAttempts,
        review: selfReview,
        last_error: selfReview.revision_request,
      });
      if (selfReviewAttempts >= ATTEMPT_LIMITS.selfReview) break;
      continue;
    }
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
  const failedPage = progress.pages.find((page) => page.status !== "accepted");
  if (failedPage) {
    const error = createFailedPageError(failedPage, input.locale);
    const failedProgress = createProgress(
      {
        step: "failed",
        message: error.message,
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

function buildRefinementReview(instruction: string): AgentSelfReviewResult {
  return {
    pass: false,
    score: 0,
    issues: [
      {
        severity: "user-request",
        area: "refinement",
        problem: instruction,
        fix_hint: instruction,
      },
    ],
    revision_request: instruction,
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

  const review = buildRefinementReview(instruction);
  for (const page of targetPages) {
    await recordProgress(input, page, {
      status: "self_review_fixing",
      render_attempts: 0,
      self_review_attempts: 0,
      agent_failures: 0,
      last_error: instruction,
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
