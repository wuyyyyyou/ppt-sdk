import { generationText } from "./messages";
import { createProgress } from "./progressProjection";
import {
  type DeckGenerationCompletion,
  type RunDeckRefinementInput,
} from "./types";
import { getAttemptLimits } from "./settings";
import { failedCompletion } from "./deckGenerationCompletion";
import { pagePlanMatchesOutlineAndTemplate } from "./deckGenerationStartArtifacts";
import { runDeckRefinementWorkflow } from "./deckRefinementRunner";
import { runPageRefinement } from "./pageRefinementRunner";

export async function runDeckRefinement(
  input: RunDeckRefinementInput,
): Promise<DeckGenerationCompletion> {
  const attemptLimits = getAttemptLimits(input);
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
      undefined,
      undefined,
      attemptLimits,
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

  const resumeTargetIds = new Set(input.resumePageIds ?? []);
  const targetPages = resumeTargetIds.size > 0
    ? pagePlan.pages.filter((page) => resumeTargetIds.has(page.page_id))
    : input.scope === "deck"
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

  if (input.scope === "deck") {
    return runDeckRefinementWorkflow({
      input,
      instruction,
      pagePlan,
      progress,
    });
  }

  return runPageRefinement({
    input,
    instruction,
    pagePlan,
    progress,
    targetPages,
  });
}
