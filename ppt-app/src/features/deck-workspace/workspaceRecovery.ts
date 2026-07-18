import type { Locale } from "../../i18n/messages";
import {
  pageProgressToDeckGenerationProgress,
  type DeckGenerationProgress,
} from "../deck-generation";
import type { PageProgress, WorkspaceOutline } from "../../api/types";

export function completedDeckIsAvailable(
  staleDeck: boolean,
  pageProgress: PageProgress | null,
) {
  return !staleDeck && pageProgress?.final_deck_render?.status === "completed";
}

export function restoreDeckGenerationProgress(input: {
  staleDeck: boolean;
  pageProgress: PageProgress | null;
  locale: Locale;
  outline?: WorkspaceOutline | null;
}): DeckGenerationProgress | null {
  if (input.staleDeck || !input.pageProgress) {
    return null;
  }

  return pageProgressToDeckGenerationProgress(input.pageProgress, input.locale, input.outline);
}
