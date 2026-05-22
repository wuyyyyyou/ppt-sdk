import {
  isAgentInfrastructureError,
  type AgentClient,
  type AgentRunSummary,
  type AgentSelfReviewResult,
  type AgentStreamEvent,
} from "../../../agent/agentClient";
import { TSX_AUTHORING_RULES_SUMMARY } from "../../../agent/promptRules";
import type { PptBackend } from "../../../api/pptBackend";
import type {
  PagePlan,
  PagePlanItem,
  PageProgress,
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
  WorkspaceResult,
  WorkspaceSettings,
} from "../../../api/types";
import type { AiClient } from "../../../ai/aiClient";
import type { ContextRow } from "../types";
import type { Locale } from "../../../i18n/messages";

export const MAX_RENDER_ATTEMPTS = 10;
export const MAX_SELF_REVIEW_ATTEMPTS = 5;
export const MAX_AGENT_FAILURES = 5;

export type CreateDeckFlowPhase =
  | "outline"
  | "page-plan"
  | "prepare"
  | "authoring"
  | "render"
  | "self-review"
  | "final-render"
  | "complete"
  | "cancelled"
  | "error";

export interface CreateDeckFlowProgressPage {
  page_id: string;
  index: number;
  title: string;
  status: string;
  render_attempts: number;
  self_review_attempts: number;
  agent_failures: number;
  agent_infrastructure_failures: number;
  last_error?: string;
  last_screenshot_path?: string;
}

export interface CreateDeckFlowStream {
  page_id: string;
  page_index: number;
  status: string;
  lines: string[];
  activities: string[];
}

export interface CreateDeckFlowProgress {
  phase: CreateDeckFlowPhase;
  message: string;
  currentPageIndex: number | null;
  totalPages: number;
  pages: CreateDeckFlowProgressPage[];
  stream?: CreateDeckFlowStream;
}

interface DeckFlowContext {
  backend: PptBackend;
  agentClient: AgentClient;
  workspace: WorkspaceResult;
  locale: Locale;
  onProgress: (progress: CreateDeckFlowProgress) => void;
  isCancelled: () => boolean;
}

export interface CreateDeckFlowInput extends DeckFlowContext {
  aiClient: AiClient;
  prompt: string;
  contextRows: ContextRow[];
  setting: WorkspaceSettings;
}

export interface CreateDeckFlowFromOutlineInput extends DeckFlowContext {
  aiClient: AiClient;
  outline: WorkspaceOutline;
}

export interface CreateDeckFlowResult {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  progress: PageProgress;
  rendered: Awaited<ReturnType<PptBackend["renderDeckHtml"]>>;
}

function getWorkspaceTitle(workspace: WorkspaceResult) {
  return workspace.task && typeof workspace.task === "object" && !Array.isArray(workspace.task)
    && typeof (workspace.task as { title?: unknown }).title === "string"
    ? (workspace.task as { title: string }).title
    : workspace.workspace_id;
}

function mapProgress(progress: PageProgress | null): CreateDeckFlowProgressPage[] {
  return progress?.pages.map((page) => ({
    page_id: page.page_id,
    index: page.index,
    title: page.title,
    status: page.status,
    render_attempts: page.render_attempts,
    self_review_attempts: page.self_review_attempts,
    agent_failures: page.agent_failures,
    agent_infrastructure_failures: page.agent_infrastructure_failures,
    last_error: page.last_error,
    last_screenshot_path: page.last_screenshot_path,
  })) ?? [];
}

function emit(
  input: Pick<DeckFlowContext, "onProgress">,
  value: Omit<CreateDeckFlowProgress, "pages">,
  progress: PageProgress | null,
  stream?: CreateDeckFlowStream | null
) {
  input.onProgress({
    ...value,
    pages: mapProgress(progress),
    stream: stream ?? undefined,
  });
}

async function recordProgress(
  input: Pick<DeckFlowContext, "backend" | "workspace">,
  page: PagePlanItem,
  patch: Record<string, unknown>
) {
  return input.backend.recordPageProgress({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
    patch,
  });
}

function buildOutlineArtifact(
  result: Awaited<ReturnType<AiClient["generateOutline"]>>,
  input: CreateDeckFlowInput
): WorkspaceOutline {
  return {
    version: 2,
    title: result.outline.title || getWorkspaceTitle(input.workspace),
    status: "confirmed",
    items: result.outline.items,
    source: {
      prompt: input.prompt,
      context: input.contextRows,
      setting: input.setting,
      kind: "llm-outline",
    },
    updated_at: new Date().toISOString(),
  };
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
    input.renderError
      ? `Render error to fix:\n${input.renderError}`
      : "",
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
  flowInput: DeckFlowContext;
  page: PagePlanItem;
  phase: CreateDeckFlowPhase;
  message: string;
  totalPages: number;
  progress: () => PageProgress | null;
  prompt: string;
  kind: string;
}) {
  const startedAt = new Date().toISOString();
  const runId = `${input.page.page_id}-${input.kind}-${Date.now().toString(36)}`;
  const stream: CreateDeckFlowStream = {
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
    emit(input.flowInput, {
      phase: input.phase,
      message: input.message,
      currentPageIndex: input.page.index,
      totalPages: input.totalPages,
    }, input.progress(), stream);
  }

  return {
    runId,
    stream,
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
        // Logging must never fail the generation flow.
      }
    },
  };
}

async function appendWorkspaceLogSafe(
  input: Pick<DeckFlowContext, "backend" | "workspace">,
  channel: "ai-outline" | "ai-page-plan" | "ai-page-agent" | "ai-page-agent-stream",
  entry: Record<string, unknown>
) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspace.workspace_dir,
      channel,
      entry,
    });
  } catch {
    // Logging must never fail the generation flow.
  }
}

export async function runDeckFlowFromOutline(
  input: CreateDeckFlowFromOutlineInput
): Promise<CreateDeckFlowResult> {
  let progress: PageProgress | null = null;
  const outline = input.outline;
  if (!outline || !Array.isArray(outline.items)) {
    throw new Error("Missing confirmed outline for deck generation.");
  }

  emit(
    input,
    {
      phase: "page-plan",
      message: "正在规划页面和模板蓝图",
      currentPageIndex: null,
      totalPages: outline.items.length,
    },
    progress
  );

  const planningContext = await input.backend.getTemplatePlanningContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  const pagePlan = await input.aiClient.generatePagePlan({
    outline,
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
      phase: "prepare",
      message: "正在准备页面文件",
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress
  );

  await input.backend.preparePageFiles({
    workspace_dir: input.workspace.workspace_dir,
  });
  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });

  for (const page of pagePlan.pages) {
    if (input.isCancelled()) break;

    const existingPageProgress = getProgressPage(progress, page.page_id);
    if (existingPageProgress?.status === "accepted") {
      emit(
        input,
        {
          phase: "authoring",
          message: `第 ${page.index + 1} 页已通过，继续下一页`,
          currentPageIndex: page.index,
          totalPages: pagePlan.pages.length,
        },
        progress
      );
      continue;
    }

    progress = await recordProgress(input, page, { status: "authoring" });
    emit(
      input,
      {
        phase: "authoring",
        message: `正在生成第 ${page.index + 1} / ${pagePlan.pages.length} 页`,
        currentPageIndex: page.index,
        totalPages: pagePlan.pages.length,
      },
      progress
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
        outline,
        attemptKind: renderError ? "render-fix" : selfReview ? "self-review-fix" : "initial",
        renderError,
        selfReview,
      });
      const authoringKind = renderError ? "render-fix" : selfReview ? "self-review-fix" : "authoring";
      const authoringTracker = createAgentRunTracker({
        flowInput: input,
        page,
        phase: "authoring",
        message: `Agent 正在编辑第 ${page.index + 1} 页`,
        totalPages: pagePlan.pages.length,
        progress: () => progress,
        prompt: authoringPrompt,
        kind: authoringKind,
      });

      try {
        const authoringResult: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
          authoringPrompt,
          { onStreamEvent: authoringTracker.onStreamEvent }
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
          emit(
            input,
            {
              phase: "error",
              message,
              currentPageIndex: page.index,
              totalPages: pagePlan.pages.length,
            },
            progress
          );
          throw error;
        }

        agentFailures += 1;
        await authoringTracker.flush("error", {
          error: message,
          agent_failures: agentFailures,
        });
        progress = await recordProgress(input, page, {
          status: agentFailures >= MAX_AGENT_FAILURES ? "agent_failed" : "authoring",
          agent_failures: agentFailures,
          last_error: message,
        });
        if (agentFailures >= MAX_AGENT_FAILURES) break;
        continue;
      }

      let preview: RenderWorkspacePagePreviewResult;
      try {
        emit(
          input,
          {
            phase: "render",
            message: `正在渲染第 ${page.index + 1} 页`,
            currentPageIndex: page.index,
            totalPages: pagePlan.pages.length,
          },
          progress
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
          status: renderAttempts >= MAX_RENDER_ATTEMPTS ? "render_failed" : "render_fixing",
          render_attempts: renderAttempts,
          last_error: renderError,
        });
        if (renderAttempts >= MAX_RENDER_ATTEMPTS) break;
        continue;
      }

      emit(
        input,
        {
          phase: "self-review",
          message: `正在自评第 ${page.index + 1} 页截图`,
          currentPageIndex: page.index,
          totalPages: pagePlan.pages.length,
        },
        progress
      );
      const selfReviewPrompt = buildSelfReviewPrompt({
        page,
        screenshotPath: preview.screenshot_path,
        preview,
      });
      const selfReviewTracker = createAgentRunTracker({
        flowInput: input,
        page,
        phase: "self-review",
        message: `Agent 正在自评第 ${page.index + 1} 页`,
        totalPages: pagePlan.pages.length,
        progress: () => progress,
        prompt: selfReviewPrompt,
        kind: "self-review",
      });
      try {
        selfReview = await input.agentClient.runSelfReviewPrompt(
          selfReviewPrompt,
          { onStreamEvent: selfReviewTracker.onStreamEvent }
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
          emit(
            input,
            {
              phase: "error",
              message,
              currentPageIndex: page.index,
              totalPages: pagePlan.pages.length,
            },
            progress
          );
          throw error;
        }

        agentFailures += 1;
        await selfReviewTracker.flush("error", {
          error: message,
          agent_failures: agentFailures,
        });
        progress = await recordProgress(input, page, {
          status: agentFailures >= MAX_AGENT_FAILURES ? "agent_failed" : "self_review",
          agent_failures: agentFailures,
          last_error: message,
        });
        if (agentFailures >= MAX_AGENT_FAILURES) break;
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
          selfReviewAttempts >= MAX_SELF_REVIEW_ATTEMPTS
            ? "needs_user_review"
            : "self_review_fixing",
        self_review_attempts: selfReviewAttempts,
        review: selfReview,
        last_error: selfReview.revision_request,
      });
      if (selfReviewAttempts >= MAX_SELF_REVIEW_ATTEMPTS) break;
    }
  }

  if (input.isCancelled()) {
    emit(
      input,
      {
        phase: "cancelled",
        message: "已停止生成",
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress
    );
    throw new Error("Deck generation cancelled.");
  }

  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  const failedPage = progress.pages.find((page) => page.status !== "accepted");
  if (failedPage) {
    emit(
      input,
      {
        phase: "error",
        message: `第 ${failedPage.index + 1} 页未通过：${failedPage.status}`,
        currentPageIndex: failedPage.index,
        totalPages: pagePlan.pages.length,
      },
      progress
    );
    throw new Error(
      failedPage.last_error ||
        `Page ${failedPage.index + 1} did not pass generation (${failedPage.status}).`
    );
  }

  emit(
    input,
    {
      phase: "final-render",
      message: "正在生成最终预览",
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress
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
      phase: "complete",
      message: "演示文稿已生成",
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress
  );

  return {
    outline,
    pagePlan,
    progress,
    rendered,
  };
}

export async function runCreateDeckFlow(
  input: CreateDeckFlowInput
): Promise<CreateDeckFlowResult> {
  emit(input, {
    phase: "outline",
    message: "正在调用 LLM 生成大纲",
    currentPageIndex: null,
    totalPages: 0,
  }, null);

  const outlineResult = await input.aiClient.generateOutline({
    prompt: input.prompt,
    contextRows: input.contextRows,
    locale: input.locale,
    setting: input.setting,
  });
  const outline = buildOutlineArtifact(outlineResult, input);
  await input.backend.updateWorkspaceOutline({
    workspace_dir: input.workspace.workspace_dir,
    outline,
  });

  if (input.isCancelled()) {
    emit(input, {
      phase: "cancelled",
      message: "已停止生成",
      currentPageIndex: null,
      totalPages: outline.items.length,
    }, null);
    throw new Error("Deck generation cancelled.");
  }
  return runDeckFlowFromOutline({
    ...input,
    outline,
  });
}
