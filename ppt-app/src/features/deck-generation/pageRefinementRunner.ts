import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { PageRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PagePlanItem,
  PageProgress,
  WorkspaceResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";
import { createProgress } from "./progressProjection";
import {
  type DeckGenerationCompletion,
  type PageRefinementVisualContext,
  type RunDeckRefinementInput,
} from "./types";
import { getAttemptLimits } from "./settings";
import { getResearchRequirement } from "./researchWorkflow";
import {
  persistPageRefinementArtifacts,
  recordPageRefinementRecovery,
} from "./pageRefinementArtifacts";
import {
  failedCompletion,
  preflightAgentToolAccess,
} from "./deckGenerationCompletion";
import {
  getProgressPage,
} from "./runtimeSupport";
import {
  readResearchEvidenceSafe,
  readResearchPlanSafe,
} from "./researchArtifacts";
import { runDeckGeneration } from "./deckGenerationWorkflow";

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

export async function runPageRefinement(args: {
  input: RunDeckRefinementInput;
  instruction: string;
  pagePlan: PagePlan;
  progress: PageProgress;
  targetPages: PagePlanItem[];
}): Promise<DeckGenerationCompletion> {
  const { input, instruction, pagePlan, progress, targetPages } = args;
  const attemptLimits = getAttemptLimits(input);
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

    const persisted = await persistPageRefinementArtifacts({
      flowInput: input,
      pagePlan,
      progress,
      targetPage,
      review: intentReview,
      researchPlan,
      researchEvidence,
      researchRequirement,
      now: new Date().toISOString(),
    });
    activeOutline = persisted.activeOutline;
    activeWorkspace = persisted.activeWorkspace;
    activePagePlan = persisted.activePagePlan;
    activeProgress = persisted.activeProgress;
    const activeTargetPage = persisted.activeTargetPage;
    targetPageIds = new Set([activeTargetPage.page_id]);

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
  await recordPageRefinementRecovery({
    flowInput: input,
    instruction,
    pageRefinementRequests,
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
