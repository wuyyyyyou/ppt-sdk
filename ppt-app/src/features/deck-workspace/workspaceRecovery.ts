import type { Locale } from "../../i18n/messages";
import {
  pageProgressToDeckGenerationProgress,
  type DeckGenerationProgress,
} from "../deck-generation";
import type { PageProgress } from "../../api/types";

export function restoreDeckGenerationProgress(input: {
  staleDeck: boolean;
  pageProgress: PageProgress | null;
  locale: Locale;
}): DeckGenerationProgress | null {
  if (input.staleDeck || !input.pageProgress) {
    return null;
  }

  return pageProgressToDeckGenerationProgress(input.pageProgress, input.locale);
}
