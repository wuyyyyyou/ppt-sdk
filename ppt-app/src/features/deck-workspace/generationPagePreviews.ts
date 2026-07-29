import type { DeckGenerationProgress } from "../deck-generation";

/** Requests stay bounded so previews never starve the generation polling. */
export const GENERATION_PAGE_PREVIEW_CONCURRENCY = 2;

export interface GenerationPagePreviewSource {
  pageId: string;
  pageIndex: number;
  title: string;
  screenshotPath: string;
}

export interface GenerationPagePreviewEntry extends GenerationPagePreviewSource {
  status: "loading" | "ready" | "error";
  url?: string;
}

export type GenerationPagePreviews = Record<string, GenerationPagePreviewEntry | undefined>;

/**
 * A page only has a screenshot path once it rendered successfully, so this is
 * also the "which pages can be previewed yet" question during a run.
 */
export function selectGenerationPagePreviewSources(
  progress: DeckGenerationProgress | null,
): GenerationPagePreviewSource[] {
  return (progress?.pages ?? [])
    .flatMap((page) => {
      const screenshotPath = page.last_screenshot_path?.trim() ?? "";
      const pageId = page.page_id?.trim() ?? "";
      if (!screenshotPath || !pageId) return [];
      return [{
        pageId,
        pageIndex: page.index,
        title: page.title,
        screenshotPath,
      }];
    })
    .sort((left, right) => left.pageIndex - right.pageIndex);
}

export interface GenerationPagePreviewReconciliation {
  previews: GenerationPagePreviews;
  pending: GenerationPagePreviewSource[];
  changed: boolean;
}

/**
 * Progress polls on a timer, so reconciliation has to be a no-op unless a page
 * actually gained or re-rendered a screenshot. Re-renders arrive as a new
 * screenshot path, which invalidates whatever was already fetched.
 */
export function reconcileGenerationPagePreviews(
  previous: GenerationPagePreviews,
  sources: readonly GenerationPagePreviewSource[],
): GenerationPagePreviewReconciliation {
  const previews: GenerationPagePreviews = {};
  const pending: GenerationPagePreviewSource[] = [];
  let changed = Object.keys(previous).filter((pageId) => previous[pageId]).length !== sources.length;

  for (const source of sources) {
    const existing = previous[source.pageId];
    if (existing && existing.screenshotPath === source.screenshotPath) {
      const refreshed: GenerationPagePreviewEntry = {
        ...existing,
        pageIndex: source.pageIndex,
        title: source.title,
      };
      previews[source.pageId] = refreshed;
      if (refreshed.pageIndex !== existing.pageIndex || refreshed.title !== existing.title) {
        changed = true;
      }
      continue;
    }
    previews[source.pageId] = { ...source, status: "loading" };
    pending.push(source);
    changed = true;
  }

  return { previews, pending, changed };
}

/** Newest first is what the run cares about; ties keep deck order. */
export function orderGenerationPagePreviews(
  previews: GenerationPagePreviews,
): GenerationPagePreviewEntry[] {
  return Object.values(previews)
    .filter((entry): entry is GenerationPagePreviewEntry => Boolean(entry))
    .sort((left, right) => left.pageIndex - right.pageIndex);
}

/**
 * The preview follows the newest rendered page while the user watches, and stays
 * put once they picked a page from the thumbnails.
 */
export function resolveGenerationPreviewSelection(input: {
  entries: readonly GenerationPagePreviewEntry[];
  pinnedPageId: string | null;
}): GenerationPagePreviewEntry | null {
  const { entries, pinnedPageId } = input;
  if (entries.length === 0) return null;
  if (pinnedPageId) {
    const pinned = entries.find((entry) => entry.pageId === pinnedPageId);
    if (pinned) return pinned;
  }
  const readyEntries = entries.filter((entry) => entry.status === "ready");
  return readyEntries[readyEntries.length - 1] ?? entries[entries.length - 1];
}
