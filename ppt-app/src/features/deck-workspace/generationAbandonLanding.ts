import type { MainStage, PageId } from "./types";

export interface GenerationAbandonLanding {
  page: Extract<PageId, "main" | "my-work">;
  stage: MainStage;
}

/**
 * GEN-003: where the user ends up after a Generation Abandonment. Leaving
 * through a header entry means they wanted out of this deck, so they land in
 * My Works; stopping from the generation page itself keeps them next to the
 * restored artifact they are about to fix.
 */
export function resolveGenerationAbandonLanding(input: {
  runKind: string;
  fromHeader: boolean;
}): GenerationAbandonLanding {
  const stage: MainStage = input.runKind === "deck-generation" ? "outline" : "deck";
  return { page: input.fromHeader ? "my-work" : "main", stage };
}
