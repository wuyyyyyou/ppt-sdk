import type { PageProgress } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { generationText } from "./messages";
import type { DeckGenerationError } from "./types";

export function createFailedPageError(
  page: PageProgress["pages"][number],
  locale: Locale,
  pageIndex?: number,
): DeckGenerationError {
  const type =
    page.status === "agent_infrastructure_failed"
      ? "agent_infrastructure"
      : "page_failed";
  return {
    type,
    message: generationText(locale).pageFailed(page),
    page_id: page.page_id,
    page_index: pageIndex,
    page_status: page.status,
  };
}
