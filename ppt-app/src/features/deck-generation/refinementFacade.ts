import { createProgress } from "./progressProjection";
import { failedCompletion } from "./deckGenerationCompletion";
import { runDeckRefinementWorkflow } from "./deckRefinementRunner";
import { runPageRefinement } from "./pageRefinementRunner";
import { getAttemptLimits } from "./settings";
import type { DeckGenerationCompletion, RunDeckRefinementInput } from "./types";

export async function runDeckRefinement(input: RunDeckRefinementInput): Promise<DeckGenerationCompletion> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    const progress = createProgress({
      step: "failed",
      message: input.locale === "zh" ? "请输入优化需求。" : "Enter a refinement request.",
      currentPageIndex: null,
      totalPages: input.confirmedOutline.items.length,
    }, null, undefined, undefined, getAttemptLimits(input));
    input.onProgress(progress);
    return failedCompletion({ progress, error: { type: "page_failed", message: progress.message } });
  }
  return input.scope === "deck"
    ? runDeckRefinementWorkflow(input, instruction)
    : runPageRefinement(input, instruction);
}
