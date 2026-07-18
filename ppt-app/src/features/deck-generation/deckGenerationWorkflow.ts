import { isAgentRunCancelledError } from "../../agent/agentClient";
import type { PageProgress } from "../../api/types";
import { generationText } from "./messages";
import { createProgress } from "./progressProjection";
import {
  type DeckGenerationCompletion,
  type DeckGenerationRuntime,
  type AuthoringDeck,
  type RunDeckGenerationInput,
} from "./types";
import { getAttemptLimits } from "./settings";
import { runPagesConcurrently } from "./pageGenerationRunner";
import { createFailedPageError } from "./pageFailure";
import { runFinalDeckRender } from "./finalDeckRender";
import {
  cancelledCompletion,
  failedCompletion,
  preflightAgentToolAccess,
} from "./deckGenerationCompletion";
import {
  createInitialArtifacts,
  loadResumeArtifacts,
} from "./deckGenerationStartArtifacts";
import {
  getProgressPage,
  recordDeckRecovery,
} from "./runtimeSupport";
import { shouldResumePageGenerationStatus } from "./pageStatusPolicy";

function getActiveGenerationRunKind(input: RunDeckGenerationInput): NonNullable<PageProgress["recovery"]>["run_kind"] {
  return input.refinementRunKind ?? (input.pageRefinementRequests ? "page-refinement" : "deck-generation");
}

function getAuthoringPageIds(
  input: RunDeckGenerationInput,
  authoringDeck: AuthoringDeck,
  progress: PageProgress,
) {
  return authoringDeck.pages
    .filter((page) => {
      const pageProgress = getProgressPage(progress, page.page_id);
      return Boolean(input.pageRefinementRequests?.[page.page_id]?.trim()) ||
        shouldResumePageGenerationStatus(pageProgress?.status ?? "pending");
    })
    .map((page) => page.page_id);
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

  const startMode = input.startMode ?? "new";
  let artifacts: { authoringDeck: AuthoringDeck; progress: PageProgress };

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
      const authoringPageIds = getAuthoringPageIds(
        input,
        resumeArtifacts.authoringDeck,
        resumeArtifacts.progress,
      );
      if (authoringPageIds.length > 0) {
        const preflightFailure = await preflightAgentToolAccess({
          agentClient: input.agentClient,
          locale: input.locale,
          onProgress: input.onProgress,
          progress: resumeArtifacts.progress,
          attemptLimits,
          totalPages: resumeArtifacts.authoringDeck.pages.length,
          currentPageIndex: null,
        });
        if (preflightFailure) return preflightFailure;
      }
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
      artifacts = await createInitialArtifacts(input);
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
      return cancelledCompletion(progress);
    }
    throw error;
  }

  const { authoringDeck } = artifacts;
  let { progress } = artifacts;
  const runtime: DeckGenerationRuntime = {
    ...input,
    activeStreams: new Map(),
    getProgress: () => progress,
    setProgress: (nextProgress) => {
      progress = nextProgress;
    },
  };

  const results = await runPagesConcurrently(runtime, authoringDeck);
  const infrastructureFailure = results.find((result) => result.reason === "agent_infrastructure");
  if (infrastructureFailure?.error) {
    const failedProgress = createProgress(
      {
        step: "failed",
        message: infrastructureFailure.error.message,
        currentPageIndex: infrastructureFailure.page.index,
        totalPages: authoringDeck.pages.length,
      },
      infrastructureFailure.progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
      runtime.researchDiscoveryProgress,
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
        totalPages: authoringDeck.pages.length,
      },
      progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
      runtime.researchDiscoveryProgress,
    );
    input.onProgress(cancelledProgress);
    await recordDeckRecovery(input, {
      status: "interrupted",
      run_kind: getActiveGenerationRunKind(input),
      step: "interrupted",
      target_page_ids: input.pageRefinementRequests
        ? Object.keys(input.pageRefinementRequests)
        : authoringDeck.pages.filter((page) => getProgressPage(progress, page.page_id)?.status !== "accepted").map((page) => page.page_id),
      page_refinement_request: input.pageRefinementRequests
        ? Object.values(input.pageRefinementRequests)[0] ?? null
        : null,
      page_refinement_requests: input.pageRefinementRequests ?? {},
      error: null,
      deck_status: "interrupted",
    });
    return cancelledCompletion(cancelledProgress);
  }

  progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  const failedPage = progress.pages.find((page) => page.status !== "accepted");
  if (failedPage) {
    const failedPageIndex = progress.pages.findIndex((page) => page.page_id === failedPage.page_id);
    const error = createFailedPageError(failedPage, input.locale, failedPageIndex);
    const failedCount = progress.pages.filter((page) => page.status !== "accepted").length;
    const failedProgress = createProgress(
      {
        step: "failed",
        message: failedCount > 1 ? text.failedSummary(failedCount) : error.message,
        currentPageIndex: failedPageIndex,
        totalPages: authoringDeck.pages.length,
      },
      progress,
      null,
      runtime.activeStreams.values(),
      attemptLimits,
      runtime.researchDiscoveryProgress,
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

  return runFinalDeckRender({
    flowInput: input,
    authoringDeck,
    progress,
    activeStreams: runtime.activeStreams.values(),
    researchDiscoveryProgress: runtime.researchDiscoveryProgress,
  });
}
