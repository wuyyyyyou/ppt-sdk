import type { Messages } from "../../i18n/messages";
import type { DeckGenerationProgress } from "../deck-generation";

export function getGenerationProgressDisplayMessage(
  t: Messages,
  progress: DeckGenerationProgress | null,
): string {
  if (!progress) return t.status.creatingDeck;
  if (progress.step === "complete") return t.generating.generationComplete;
  return progress.message;
}
