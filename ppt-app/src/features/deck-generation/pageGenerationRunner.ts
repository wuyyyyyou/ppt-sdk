import { isAgentInfrastructureError, isAgentRunCancelledError, type AgentInfrastructureError, type AgentRunSummary } from "../../agent/agentClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { GetWorkspacePageFileFingerprintsResult, PagePlan, PagePlanItem, PageProgress, RenderWorkspacePagePreviewResult } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { generationText } from "./messages";
import { buildDeckGenerationSummary, emitRuntime as emitRuntimeProgress } from "./progressProjection";
import { shouldResumePageGenerationStatus } from "./pageStatusPolicy";
import { buildAuthoringPrompt, buildPageContentReviewPrompt, buildPageVisualReviewPrompt, contentReviewPassed, targetPageFilesChanged, targetPageFingerprintReadErrorMessage, targetPageNoChangeMessage, visualReviewPassed } from "./prompts";
import { collectAndCurateResearchForPage } from "./researchWorkflow";
import { buildAgentRunOptions, createAgentRunTracker, getProgressPage, getStoredContentReview, getStoredVisualReview, recordProgress } from "./runtimeSupport";
import { getAttemptLimits, getReviewSettings } from "./settings";
import { createFailedPageError } from "./pageFailure";
import { ATTEMPT_LIMITS, LOCAL_GATE_REPAIR_LIMIT, PAGE_GENERATION_CONCURRENCY, type DeckGenerationError, type DeckGenerationRuntime, type DeckGenerationStep, type DeckGenerationStream, type NoChangeAuthoringRetry, type PageGenerationResult, type RenderFailureHistoryItem, type RenderFailurePhase, type RunDeckGenerationInput } from "./types";

function emitRuntime(
  input: DeckGenerationRuntime,
  value: Omit<import("./types").DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
) {
  emitRuntimeProgress(
    input,
    value,
    progress,
    stream,
    getAttemptLimits({ workspace: input.workspace }),
  );
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

function classifyRenderFailurePhase(message: string): RenderFailurePhase {
  return message.includes("Pre-render TypeScript check failed")
    ? "pre-render-typecheck"
    : "render";
}

async function getTargetPageFileFingerprints(input: RunDeckGenerationInput, page: PagePlanItem) {
  return input.backend.getWorkspacePageFileFingerprints({
    workspace_dir: input.workspace.workspace_dir,
    slide_path: page.slide_path,
    data_path: page.data_path,
  });
}

export async function runPageGeneration(
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
      visualReviewScreenshotPath: visualReview
        ? getProgressPage(input.getProgress(), page.page_id)?.last_screenshot_path ||
          existingPageProgress?.last_screenshot_path ||
          ""
        : "",
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
      attemptLimits,
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
        attemptLimits,
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
      attemptLimits,
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
    const visualReviewExhausted = visualReviewAttempts >= attemptLimits.visualReview;
    if (visualReviewExhausted) {
      const visualReviewPassThroughReason = input.locale === "zh"
        ? "页面视觉检查未通过，但已达到视觉检查失败次数上限；为避免阻塞整套生成，已按策略放行。"
        : "Page Visual Review did not pass, but the visual review failure limit was reached; accepting the page to avoid blocking deck generation.";
      const passThroughMessage = [
        visualReviewPassThroughReason,
        visualReview.revision_request,
      ].filter(Boolean).join("\n");
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review_attempts: visualReviewAttempts,
        visual_review: visualReview,
        review: visualReview,
        last_error: passThroughMessage,
      });
      input.setProgress(progress);
      return {
        page,
        reason: "accepted",
        progress,
      };
    }

    progress = await recordProgress(input, page, {
      status: "visual_review_fixing",
      visual_review_attempts: visualReviewAttempts,
      visual_review: visualReview,
      review: visualReview,
      last_error: visualReview.revision_request,
    });
    input.setProgress(progress);
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

export async function runPagesConcurrently(
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
