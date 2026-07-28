import type { MainStage } from "./types";

export interface DeckBackTargetInput {
  hasGenerationProgress: boolean;
  canReturnToOutline: boolean;
}

/**
 * The deck page steps back to the generation page it came from. A deck opened
 * from My Works has no run to step back into, so it falls back to the closest
 * earlier stage that `navigateMain` will actually accept — otherwise Back would
 * answer with a toast instead of navigating.
 */
export function resolveDeckBackStage(input: DeckBackTargetInput): MainStage {
  if (input.hasGenerationProgress) return "generating";
  if (input.canReturnToOutline) return "outline";
  return "brief";
}
