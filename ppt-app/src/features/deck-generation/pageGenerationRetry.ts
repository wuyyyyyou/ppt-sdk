import { generationText } from "./messages";
import { createProgress } from "./progressProjection";
import {
  type DeckGenerationCompletion,
  type DeckGenerationRuntime,
  type RunPageGenerationRetryInput,
} from "./types";
import { getAttemptLimits } from "./settings";
import { runPageGeneration } from "./pageGenerationRunner";
import { createFailedPageError } from "./pageFailure";
import { runFinalDeckRender } from "./finalDeckRender";
import {
  cancelledCompletion,
  failedCompletion,
  preflightAgentToolAccess,
} from "./deckGenerationCompletion";
import { pagePlanMatchesOutlineAndTemplate } from "./deckGenerationStartArtifacts";
import {
  recordDeckRecovery,
  recordProgress,
} from "./runtimeSupport";

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
    return cancelledCompletion(cancelledProgress);
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

  return runFinalDeckRender({
    flowInput: input,
    pagePlan,
    progress,
  });
}
