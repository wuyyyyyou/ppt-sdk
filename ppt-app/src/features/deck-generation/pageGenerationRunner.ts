import {
  isAgentInfrastructureError,
  isAgentRunCancelledError,
  type AgentInfrastructureError,
  type AgentRunSummary,
} from "../../agent/agentClient";
import type { HostUploadRef, PageProgress, RenderWorkspacePagePreviewResult } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { generationText } from "./messages";
import { buildDeckGenerationSummary, emitRuntime as emitRuntimeProgress } from "./progressProjection";
import { shouldResumePageGenerationStatus } from "./pageStatusPolicy";
import {
  buildAuthoringPrompt,
  buildPageVisualReviewPrompt,
  targetPageFingerprintReadErrorMessage,
  targetPageNoChangeMessage,
  visualReviewImageUnavailable,
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
import { beginPerformanceSpan } from "../../performance/performanceRecorder";
import { waitForWorkspacePagePreview } from "./renderPolling";

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

function uploadRefExpiryMs(ref: HostUploadRef, receivedAtMs: number) {
  if (ref.expires_at) {
    const parsed = Date.parse(ref.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof ref.expires_in === "number" && Number.isFinite(ref.expires_in) && ref.expires_in > 0) {
    return receivedAtMs + ref.expires_in * 1000;
  }
  return Number.POSITIVE_INFINITY;
}

async function getTargetPageFingerprint(input: DeckGenerationRuntime, page: AuthoringPage) {
  return input.backend.getWorkspacePageSourceFingerprint({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
  });
}

function beginPageStageSpan(
  input: DeckGenerationRuntime,
  page: AuthoringPage,
  operationName: string,
  parentSpanId?: string,
) {
  return beginPerformanceSpan({
    operationName,
    parentSpanId,
    workspaceId: input.workspace.workspace_id,
    attributes: {
      layer: "page-stage",
      page_id: page.page_id,
      page_index: page.index,
    },
  });
}

async function runPageGenerationInternal(
  input: DeckGenerationRuntime,
  authoringDeck: AuthoringDeck,
  page: AuthoringPage,
  performanceParentSpanId?: string,
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
  let baselineAttachment: { ref: HostUploadRef; receivedAtMs: number } | null = null;
  let baselineAttachmentError = "";
  const refinementVisualContext = input.pageRefinementVisualContexts?.[page.page_id];
  const shouldLoadBaseline = Boolean(
    refinementVisualContext?.screenshotPath?.trim() || existing?.last_screenshot_path,
  );
  const manualContext = input.refinementRequest?.trim() && shouldLoadBaseline
    ? await input.backend.getPageEditContext({
      workspace_dir: input.workspace.workspace_dir,
      page_id: page.page_id,
    }).catch((error) => {
      baselineAttachmentError = error instanceof Error ? error.message : String(error);
      return null;
    })
    : null;
  const manualRevision = manualContext?.manifest ?? null;
  if (manualContext?.screenshot_upload) {
    baselineAttachment = { ref: manualContext.screenshot_upload, receivedAtMs: Date.now() };
  } else if (existing?.last_screenshot_path) {
    const ref = await input.backend.uploadCurrentPageScreenshot({
      workspace_dir: input.workspace.workspace_dir,
      page_id: page.page_id,
    }).catch((error) => {
      baselineAttachmentError = error instanceof Error ? error.message : String(error);
      return null;
    });
    if (ref) baselineAttachment = { ref, receivedAtMs: Date.now() };
  }

  if (shouldLoadBaseline && !baselineAttachment) {
    const message = text.baselineScreenshotUploadFailed(baselineAttachmentError);
    if (visualReview) {
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review: visualReview,
        last_error: message,
      });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }
    agentInfrastructureFailures += 1;
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

  while (!input.isCancelled()) {
    if (baselineAttachment && uploadRefExpiryMs(baselineAttachment.ref, baselineAttachment.receivedAtMs) - Date.now() < 120_000) {
      const refreshed = await input.backend.uploadCurrentPageScreenshot({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
      }).catch((error) => {
        baselineAttachmentError = error instanceof Error ? error.message : String(error);
        return null;
      });
      if (refreshed) {
        baselineAttachment = { ref: refreshed, receivedAtMs: Date.now() };
      } else {
        const message = text.screenshotRefreshFailed(baselineAttachmentError);
        if (visualReview) {
          progress = await recordProgress(input, page, {
            status: "accepted",
            visual_review: visualReview,
            last_error: message,
          });
          input.setProgress(progress);
          return { page, reason: "accepted", progress };
        }
        agentInfrastructureFailures += 1;
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
    }
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
      hasImageAttachment: Boolean(baselineAttachment),
      noChangeRetry,
      refinementRequest: input.refinementRequest,
      refinementReason,
      refinementVisualContext,
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
    const authoringOperation = renderError
      ? "page.render_fix"
      : visualReview
        ? "page.visual_review_fix"
        : "page.authoring";
    const authoringSpan = beginPageStageSpan(input, page, authoringOperation, performanceParentSpanId);

    try {
      const before = await getTargetPageFingerprint(input, page).catch((error) => {
        throw new Error(targetPageFingerprintReadErrorMessage(input.locale, page, error));
      });
      const result: AgentRunSummary = await input.agentClient.runAuthoringPrompt(
        prompt,
        {
          ...buildAgentRunOptions(input, tracker.onStreamEvent, tracker.logContext),
          ...(baselineAttachment ? {
            attachments: [{
              type: baselineAttachment.ref.mime_type,
              url: baselineAttachment.ref.url,
              filename: baselineAttachment.ref.filename,
              detail: "auto" as const,
            }],
          } : {}),
        },
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
      authoringSpan?.finish("ok");
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
      authoringSpan?.finish(isAgentRunCancelledError(error) ? "interrupted" : "error");
      if (isAgentRunCancelledError(error)) {
        await tracker.flush("error", { cancelled: true });
        return { page, reason: "cancelled", progress: input.getProgress() ?? progress as PageProgress };
      }
      if (isAgentInfrastructureError(error)) {
        const message = localizeAgentInfrastructureMessage(error, input.locale);
        if (visualReview) {
          await tracker.flush("error", { error: message, raw_error: error.rawMessage });
          progress = await recordProgress(input, page, {
            status: "accepted",
            visual_review: visualReview,
            last_error: message,
          });
          input.setProgress(progress);
          return { page, reason: "accepted", progress };
        }
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
    let latestAttachment: HostUploadRef | null = null;
    const renderSpan = beginPageStageSpan(input, page, "page.render", performanceParentSpanId);
    try {
      progress = await recordProgress(input, page, { status: "rendering", last_error: "" });
      input.setProgress(progress);
      emitRuntime(input, {
        step: "page-render",
        message: buildDeckGenerationSummary(input, progress, totalPages),
        currentPageIndex: page.index,
        totalPages,
      }, progress);
      const submission = await input.backend.renderWorkspacePagePreview({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
      });
      const completedPreview = await waitForWorkspacePagePreview({
        backend: input.backend,
        workspaceDir: input.workspace.workspace_dir,
        submission,
        isCancelled: input.isCancelled,
        onProgress: (nextProgress) => {
          progress = nextProgress;
          input.setProgress(nextProgress);
        },
      });
      if (!completedPreview) {
        renderSpan?.finish("interrupted");
        return { page, reason: "cancelled", progress: input.getProgress() ?? progress as PageProgress };
      }
      preview = completedPreview;
      renderAttempts = submission.render_attempt;
      renderSpan?.finish("ok");
      progress = await recordProgress(input, page, {
        status: reviewSettings.visualReviewEnabled ? "visual_review" : "accepted",
        last_html_path: preview.html_path,
        last_screenshot_path: preview.screenshot_path,
        last_error: "",
      });
      input.setProgress(progress);
      renderFailureHistory = [];
      if (reviewSettings.visualReviewEnabled) {
        let uploadError = "";
        latestAttachment = await input.backend.uploadCurrentPageScreenshot({
          workspace_dir: input.workspace.workspace_dir,
          page_id: page.page_id,
        }).catch((error) => {
          uploadError = error instanceof Error ? error.message : String(error);
          return null;
        });
        if (!latestAttachment) {
          const message = text.visualReviewScreenshotUploadFailed(uploadError);
          progress = await recordProgress(input, page, {
            status: "accepted",
            last_html_path: preview.html_path,
            last_screenshot_path: preview.screenshot_path,
            last_error: message,
          });
          input.setProgress(progress);
          return { page, reason: "accepted", progress };
        }
      }
    } catch (error) {
      renderSpan?.finish("error");
      const latestProgress = await input.backend.getPageProgress({
        workspace_dir: input.workspace.workspace_dir,
      }).catch(() => null);
      const latestPage = latestProgress?.pages.find((item) => item.page_id === page.page_id);
      renderAttempts = latestPage?.render_attempts ?? (renderAttempts + 1);
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
      page,
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
    const visualReviewSpan = beginPageStageSpan(input, page, "page.visual_review", performanceParentSpanId);
    try {
      visualReview = await input.agentClient.runPageVisualReviewPrompt(
        reviewPrompt,
        {
          ...buildAgentRunOptions(input, reviewTracker.onStreamEvent, reviewTracker.logContext),
          attachments: latestAttachment ? [{
            type: latestAttachment.mime_type,
            url: latestAttachment.url,
            filename: latestAttachment.filename,
            detail: "auto" as const,
          }] : undefined,
        },
      );
      await reviewTracker.flush("completed", { parsed_review: true, review: visualReview });
      visualReviewSpan?.finish("ok");
    } catch (error) {
      visualReviewSpan?.finish(isAgentRunCancelledError(error) ? "interrupted" : "error");
      if (isAgentRunCancelledError(error)) {
        await reviewTracker.flush("error", { cancelled: true });
        return { page, reason: "cancelled", progress };
      }
      const message = error instanceof Error ? error.message : String(error);
      await reviewTracker.flush("error", { error: message });
      progress = await recordProgress(input, page, {
        status: "accepted",
        last_error: message,
      });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }

    if (visualReviewImageUnavailable(visualReview)) {
      progress = await recordProgress(input, page, {
        status: "accepted",
        visual_review: visualReview,
        last_error: text.visualReviewImageUnavailable,
      });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }

    if (visualReviewPassed(visualReview)) {
      progress = await recordProgress(input, page, { status: "accepted", visual_review: visualReview, last_error: "" });
      input.setProgress(progress);
      return { page, reason: "accepted", progress };
    }

    if (latestAttachment) {
      baselineAttachment = { ref: latestAttachment, receivedAtMs: Date.now() };
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

export async function runPageGeneration(
  input: DeckGenerationRuntime,
  authoringDeck: AuthoringDeck,
  page: AuthoringPage,
): Promise<PageGenerationResult> {
  const pageSpan = beginPerformanceSpan({
    operationName: "page.generation",
    workspaceId: input.workspace.workspace_id,
    attributes: {
      layer: "page-workflow",
      page_id: page.page_id,
      page_index: page.index,
    },
  });
  try {
    const result = await runPageGenerationInternal(input, authoringDeck, page, pageSpan?.spanId);
    pageSpan?.finish(
      result.reason === "accepted"
        ? "ok"
        : result.reason === "cancelled"
          ? "interrupted"
          : "error",
      { result: result.reason },
    );
    return result;
  } catch (error) {
    pageSpan?.finish(isAgentRunCancelledError(error) || input.isCancelled() ? "interrupted" : "error");
    throw error;
  }
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
