import { isAgentRunCancelledError } from "../../agent/agentClient";
import type { PagePlan, PageProgress } from "../../api/types";
import { generationText } from "./messages";
import { createProgress } from "./progressProjection";
import {
  type DeckGenerationCompletion,
  type DeckGenerationRuntime,
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
  createRestartArtifacts,
  loadResumeArtifacts,
} from "./deckGenerationStartArtifacts";
import {
  getProgressPage,
  recordDeckRecovery,
} from "./runtimeSupport";
import { runResearchDiscoveryForPagePlan } from "./researchDiscoveryWorkflow";
import { ensureFreshUploadedSourceAnalysis } from "./uploadedSourceAnalysisWorkflow";
import { uploadedSourceDependencyMatchesAnalysis } from "./uploadedSourceAnalysis";

function getActiveGenerationRunKind(input: RunDeckGenerationInput): NonNullable<PageProgress["recovery"]>["run_kind"] {
  return input.refinementRunKind ?? (input.pageRefinementRequests ? "page-refinement" : "deck-generation");
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

  const uploadedSourceDependency = input.confirmedOutline.source?.uploaded_source_analysis;
  let uploadedSourceList;
  try {
    uploadedSourceList = await input.backend.listUploadedSources({
      workspace_dir: input.workspace.workspace_dir,
    });
  } catch (error) {
    const message = `Uploaded Source Material is unavailable: ${error instanceof Error ? error.message : String(error)}`;
    const progress = createProgress(
      {
        step: "failed",
        message,
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
        message,
      },
    });
  }
  const hasActiveUploadedSources = (uploadedSourceList?.active.length ?? 0) > 0;
  if (hasActiveUploadedSources || uploadedSourceDependency) {
    const uploadedSourceAnalysis = hasActiveUploadedSources
      ? await ensureFreshUploadedSourceAnalysis({
          backend: input.backend,
          agentClient: input.agentClient,
          workspace: input.workspace,
        })
      : null;
    if (
      uploadedSourceAnalysis?.status === "blocked" ||
      (uploadedSourceAnalysis && !uploadedSourceAnalysis.continuation_decision.can_continue) ||
      (!uploadedSourceAnalysis && uploadedSourceDependency) ||
      (uploadedSourceAnalysis && !uploadedSourceDependencyMatchesAnalysis({
        dependency: uploadedSourceDependency,
        analysis: uploadedSourceAnalysis,
      }))
    ) {
      const message = uploadedSourceAnalysis?.status === "blocked"
        ? `Uploaded Source Analysis blocks deck generation: ${uploadedSourceAnalysis.continuation_decision.reason}`
        : "Uploaded Source Analysis changed after this outline was confirmed. Regenerate or reconfirm the outline before generating the deck.";
      const progress = createProgress(
        {
          step: "failed",
          message,
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
          message,
        },
      });
    }
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
      return cancelledCompletion(progress);
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

  const targetPageIds = input.pageRefinementRequests
    ? Object.keys(input.pageRefinementRequests).filter((pageId) => input.pageRefinementRequests?.[pageId]?.trim())
    : pagePlan.pages
        .filter((page) => getProgressPage(progress, page.page_id)?.status !== "accepted")
        .map((page) => page.page_id);
  if (targetPageIds.length > 0) {
    pagePlan = await runResearchDiscoveryForPagePlan({
      runtime,
      pagePlan,
      targetPageIds: targetPageIds.length === pagePlan.pages.length && !input.pageRefinementRequests
        ? undefined
        : targetPageIds,
    });
  }

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
        totalPages: pagePlan.pages.length,
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
        : pagePlan.pages.filter((page) => getProgressPage(progress, page.page_id)?.status !== "accepted").map((page) => page.page_id),
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
    pagePlan,
    progress,
    activeStreams: runtime.activeStreams.values(),
    researchDiscoveryProgress: runtime.researchDiscoveryProgress,
  });
}
