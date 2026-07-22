import {
  isAgentInfrastructureError,
  isAgentRunCancelledError,
  type AgentInfrastructureError,
  type AgentRunSummary,
} from "../../agent/agentClient";
import type { PageProgress, RenderWorkspacePagePreviewResult } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { generationText } from "./messages";
import { buildDeckGenerationSummary, emitRuntime as emitRuntimeProgress } from "./progressProjection";
import { shouldResumePageGenerationStatus } from "./pageStatusPolicy";
import {
  buildAuthoringPrompt,
  buildPageVisualReviewPrompt,
  targetPageFingerprintReadErrorMessage,
  targetPageNoChangeMessage,
  visualReviewPassed,
} from "./prompts";
import {
  buildAgentRunOptions,
  createAgentRunTracker,
  getProgressPage,
  getStoredVisualReview,
  recordProgress,
} from "./runtimeSupport";
import { getAttemptLimits, getPageGenerationConcurrency, getReviewSettings } from "./settings";
import { createFailedPageError } from "./pageFailure";
import {
  LOCAL_GATE_REPAIR_LIMIT,
  type AuthoringDeck,
  type AuthoringPage,
  type DeckGenerationRuntime,
  type DeckGenerationStream,
  type NoChangeAuthoringRetry,
  type PageGenerationResult,
  type RenderFailureHistoryItem,
  type RenderFailurePhase,
} from "./types";

function emitRuntime(
  input: DeckGenerationRuntime,
  value: Omit<import("./types").DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
) {
  emitRuntimeProgress(input, value, progress, stream, getAttemptLimits({ workspace: input.workspace }));
}

function localizeAgentInfrastructureMessage(error: AgentInfrastructureError, locale: Locale): string {
  const text = generationText(locale);
  if (error.sessionCacheMiss) return text.agentSessionCacheMissExhausted;
  if (error.noToolsAvailable) return text.agentToolsUnavailable;
  return error.message;
}

function classifyRenderFailurePhase(message: string): RenderFailurePhase {
  return message.includes("Pre-render TypeScript check failed") ? "pre-render-typecheck" : "render";
}

async function getTargetPageFingerprint(input: DeckGenerationRuntime, page: AuthoringPage) {
  return input.backend.getWorkspacePageSourceFingerprint({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
  });
}

export async function runPageGeneration(
  input: DeckGenerationRuntime,
  authoringDeck: AuthoringDeck,
  page: AuthoringPage,
): Promise<PageGenerationResult> {
  const text = generationText(input.locale);
  const totalPages = authoringDeck.pages.length;
  const reviewSettings = getReviewSettings(input);
  const attemptLimits = getAttemptLimits(input);
  let progress = input.getProgress();
  const existing = getProgressPage(progress, page.page_id);
  const refinementReason = input.pageRefinementReasons?.[page.page_id]?.trim() ?? "";
  if (existing?.status === "accepted" && !refinementReason) {
    return { page, reason: "accepted", progress: progress as PageProgress };
  }

  let renderAttempts = existing?.render_attempts ?? 0;
  let visualReviewAttempts = existing?.visual_review_attempts ?? 0;
  let agentFailures = existing?.agent_failures ?? 0;
  let agentInfrastructureFailures = existing?.agent_infrastructure_failures ?? 0;
  let renderError = existing?.status === "render_fixing" ? existing.last_error : "";
  let visualReview = existing?.status === "visual_review_fixing" ? getStoredVisualReview(existing) : null;
  let renderFailureHistory: RenderFailureHistoryItem[] = renderError ? [{
    attempt: renderAttempts,
    phase: classifyRenderFailurePhase(renderError),
    error: renderError,
    timestamp: existing?.updated_at ?? new Date().toISOString(),
  }] : [];
  let noChangeRetry: NoChangeAuthoringRetry | null = null;
  let noChangeRetryCount = 0;
  const manualRevision = input.refinementRequest?.trim()
    ? await input.backend.getPageEditContext({
      workspace_dir: input.workspace.workspace_dir,
      page_id: page.page_id,
    }).then((context) => context.manifest).catch(() => null)
    : null;

  while (!input.isCancelled()) {
    progress = await recordProgress(input, page, {
      status: renderError ? "render_fixing" : visualReview ? "visual_review_fixing" : "authoring",
    });
    input.setProgress(progress);
    emitRuntime(input, {
      step: "page-authoring",
      message: buildDeckGenerationSummary(input, progress, totalPages),
      currentPageIndex: page.index,
      totalPages,
    }, progress);

    const currentProgressPage = getProgressPage(input.getProgress(), page.page_id);
    const prompt = buildAuthoringPrompt({
      workspaceRoot: input.workspace.workspace_root,
      workspaceDir: input.workspace.workspace_dir,
      page,
      authoringDeck,
      outline: input.confirmedOutline,
      attemptKind: renderError ? "render-fix" : visualReview ? "visual-review-fix" : "initial",
      renderError,
      renderFailureHistory,
      visualReview,
      visualReviewScreenshotPath: currentProgressPage?.last_screenshot_path ?? "",
      noChangeRetry,
      refinementRequest: input.refinementRequest,
      refinementReason,
      refinementVisualContext: input.pageRefinementVisualContexts?.[page.page_id],
      manualRevision,
    });
    const tracker = createAgentRunTracker({
      flowInput: input,
      page,
      step: "page-authoring",
      message: text.authoringPage(page),
      totalPages,
      progress: input.getProgress,
      prompt,
      kind: renderError ? "render-fix" : visualReview ? "visual-review-fix" : "authoring",
      attemptLimits,
    });

    try {
      const before = await getTargetPageFingerprint(input, page).catch((error) => {
        throw new Error(targetPageFingerprintReadErrorMessage(input.locale, page, error));
      });
      const result: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
        prompt,
        buildAgentRunOptions(input, tracker.onStreamEvent, tracker.logContext),
      );
      const after = await getTargetPageFingerprint(input, page).catch((error) => {
        throw new Error(targetPageFingerprintReadErrorMessage(input.locale, page, error));
      });
      const changed = before.sha256 !== after.sha256 || before.size_bytes !== after.size_bytes;
      await tracker.flush("completed", {
        parsed_summary: result.parsed_json === true,
        summary: result.summary,
        files_read: result.files_read,
        authoring_kit_sources_read: result.authoring_kit_sources_read,
        changed_files: result.changed_files,
        target_tsx_fingerprint: { before, after },
        target_tsx_changed: changed,
      });
      if (!changed) {
        const exhausted = noChangeRetryCount >= LOCAL_GATE_REPAIR_LIMIT;
        const message = targetPageNoChangeMessage(input.locale, page);
        if (exhausted) agentFailures += 1;
        progress = await recordProgress(input, page, {
          status: agentFailures >= attemptLimits.agent ? "agent_failed" : "authoring",
          agent_failures: agentFailures,
          last_error: message,
        });
        input.setProgress(progress);
        if (agentFailures >= attemptLimits.agent) break;
        noChangeRetryCount = exhausted ? 0 : noChangeRetryCount + 1;
        noChangeRetry = exhausted ? null : {
          retryCount: noChangeRetryCount,
          previousSummary: result.summary,
          previousChangedFiles: result.changed_files,
        };
        continue;
      }
      noChangeRetry = null;
      noChangeRetryCount = 0;
      renderError = "";
      visualReview = null;
    } catch (error) {
      if (isAgentRunCancelledError(error)) {
        await tracker.flush("error", { cancelled: true });
        return { page, reason: "cancelled", progress: input.getProgress() ?? progress as PageProgress };
      }
      if (isAgentInfrastructureError(error)) {
        const message = localizeAgentInfrastructureMessage(error, input.locale);
        agentInfrastructureFailures += 1;
        await tracker.flush("error", { error: message, raw_error: error.rawMessage });
        progress = await recordProgress(input, page, {
          status: "agent_infrastructure_failed",
          agent_infrastructure_failures: agentInfrastructureFailures,
          last_error: message,
        });
        input.setProgress(progress);
        return {
          page,
          reason: "agent_infrastructure",
          progress,
          error: { type: "agent_infrastructure", message, page_id: page.page_id, page_index: page.index, page_status: "agent_infrastructure_failed" },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      agentFailures += 1;
      await tracker.flush("error", { error: message, agent_failures: agentFailures });
      progress = await recordProgress(input, page, {
        status: agentFailures >= attemptLimits.agent ? "agent_failed" : "authoring",
        agent_failures: agentFailures,
        last_error: message,
      });
      input.setProgress(progress);
      if (agentFailures >= attemptLimits.agent) break;
      continue;
    }

    let preview: RenderWorkspacePagePreviewResult;
    try {
      progress = await recordProgress(input, page, { status: "rendering", last_error: "" });
      input.setProgress(progress);
      emitRuntime(input, {
        step: "page-render",
        message: buildDeckGenerationSummary(input, progress, totalPages),
        currentPageIndex: page.index,
        totalPages,
      }, progress);
      preview = await input.backend.renderWorkspacePagePreview({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
      });
      progress = await recordProgress(input, page, {
        status: reviewSettings.visualReviewEnabled ? "visual_review" : "accepted",
        last_html_path: preview.html_path,
        last_screenshot_path: preview.screenshot_path,
        last_error: "",
      });
      input.setProgress(progress);
      renderFailureHistory = [];
    } catch (error) {
      renderAttempts += 1;
      renderError = error instanceof Error ? error.message : String(error);
      renderFailureHistory.push({
        attempt: renderAttempts,
        phase: classifyRenderFailurePhase(renderError),
        error: renderError,
        timestamp: new Date().toISOString(),
      });
      progress = await recordProgress(input, page, {
        status: renderAttempts >= attemptLimits.render ? "render_failed" : "render_fixing",
        render_attempts: renderAttempts,
        last_error: renderError,
      });
      input.setProgress(progress);
      if (renderAttempts >= attemptLimits.render) break;
      continue;
    }

    if (!reviewSettings.visualReviewEnabled) {
      return { page, reason: "accepted", progress };
    }

    emitRuntime(input, {
      step: "page-visual-review",
      message: buildDeckGenerationSummary(input, progress, totalPages),
      currentPageIndex: page.index,
      totalPages,
    }, progress);
    const reviewPrompt = buildPageVisualReviewPrompt({
      workspaceRoot: input.workspace.workspace_root,
      workspaceDir: input.workspace.workspace_dir,
      page,
      screenshotPath: preview.screenshot_path,
      preview,
    });
    const reviewTracker = createAgentRunTracker({
      flowInput: input,
      page,
      step: "page-visual-review",
      message: text.reviewingVisuals(page),
      totalPages,
      progress: input.getProgress,
      prompt: reviewPrompt,
      kind: "page-visual-review",
      attemptLimits,
    });
    try {
      visualReview = await input.agentClient.runPageVisualReviewPrompt(
        reviewPrompt,
        buildAgentRunOptions(input, reviewTracker.onStreamEvent, reviewTracker.logContext),
      );
      await reviewTracker.flush("completed", { parsed_review: true, review: visualReview });
    } catch (error) {
      if (isAgentRunCancelledError(error)) {
        await reviewTracker.flush("error", { cancelled: true });
        return { page, reason: "cancelled", progress };
      }
      const message = error instanceof Error ? error.message : String(error);
      await reviewTracker.flush("error", { error: message });
      visualReviewAttempts += 1;
      if (visualReviewAttempts >= attemptLimits.visualReview) {
        progress = await recordProgress(input, page, {
          status: "accepted",
          visual_review_attempts: visualReviewAttempts,
          last_error: message,
        });
        input.setProgress(progress);
        return { page, reason: "accepted", progress };
      }
      progress = await recordProgress(input, page, {
        status: "visual_review_fixing",
        visual_review_attempts: visualReviewAttempts,
        last_error: message,
      });
      input.setProgress(progress);
      continue;
    }

    if (visualReviewPassed(visualReview)) {
      progress = await recordProgress(input, page, { status: "accepted", visual_review: visualReview, last_error: "" });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }

    visualReviewAttempts += 1;
    if (visualReviewAttempts >= attemptLimits.visualReview) {
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review_attempts: visualReviewAttempts,
        visual_review: visualReview,
        last_error: visualReview.revision_request,
      });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }
    progress = await recordProgress(input, page, {
      status: "visual_review_fixing",
      visual_review_attempts: visualReviewAttempts,
      visual_review: visualReview,
      last_error: visualReview.revision_request,
    });
    input.setProgress(progress);
  }

  progress = input.getProgress() ?? await input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir });
  if (input.isCancelled()) return { page, reason: "cancelled", progress };
  const failedPage = getProgressPage(progress, page.page_id);
  const error = failedPage
    ? createFailedPageError(failedPage, input.locale, page.index)
    : { type: "page_failed" as const, message: `Page ${page.index + 1} failed`, page_id: page.page_id, page_index: page.index, page_status: "failed" };
  return { page, reason: "page_failed", progress, error };
}

export async function runPagesConcurrently(
  runtime: DeckGenerationRuntime,
  authoringDeck: AuthoringDeck,
): Promise<PageGenerationResult[]> {
  const pages = authoringDeck.pages.filter((page) => {
    const current = getProgressPage(runtime.getProgress(), page.page_id);
    return Boolean(runtime.pageRefinementReasons?.[page.page_id]?.trim()) || shouldResumePageGenerationStatus(current?.status ?? "pending");
  });
  const results: PageGenerationResult[] = [];
  let nextIndex = 0;
  let stopScheduling = false;
  async function worker() {
    while (!stopScheduling && !runtime.isCancelled()) {
      const page = pages[nextIndex++];
      if (!page) return;
      const result = await runPageGeneration(runtime, authoringDeck, page);
      results.push(result);
      if (result.reason === "agent_infrastructure") stopScheduling = true;
    }
  }
  const count = Math.min(getPageGenerationConcurrency(runtime), pages.length);
  await Promise.all(Array.from({ length: count }, worker));
  return results.sort((left, right) => left.page.index - right.page.index);
}
