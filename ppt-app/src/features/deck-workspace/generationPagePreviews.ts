import type { HostUploadRef } from "../../api/types";
import type { DeckGenerationProgress } from "../deck-generation";

/** Requests stay bounded so previews never starve the generation polling. */
export const GENERATION_PAGE_PREVIEW_CONCURRENCY = 2;
export const GENERATION_PAGE_PREVIEW_EXPIRY_SAFETY_MS = 2 * 60_000;

export interface GenerationPagePreviewSource {
  pageId: string;
  pageIndex: number;
  title: string;
  screenshotPath: string;
  renderSourceFingerprint?: string;
}

export interface GenerationPagePreviewEntry extends GenerationPagePreviewSource {
  status: "loading" | "ready" | "error";
  previewSourceFingerprint?: string;
  imagePath?: string;
  imageUpload?: HostUploadRef;
  receivedAtMs?: number;
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
        renderSourceFingerprint: page.render_source_sha256,
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
    const sameRenderSource = Boolean(
      existing &&
      source.renderSourceFingerprint &&
      existing.renderSourceFingerprint === source.renderSourceFingerprint,
    );
    if (existing && (sameRenderSource || existing.screenshotPath === source.screenshotPath)) {
      const refreshed: GenerationPagePreviewEntry = {
        ...existing,
        pageIndex: source.pageIndex,
        title: source.title,
        screenshotPath: source.screenshotPath,
        renderSourceFingerprint: source.renderSourceFingerprint,
      };
      previews[source.pageId] = refreshed;
      if (
        refreshed.pageIndex !== existing.pageIndex ||
        refreshed.title !== existing.title ||
        refreshed.screenshotPath !== existing.screenshotPath ||
        refreshed.renderSourceFingerprint !== existing.renderSourceFingerprint
      ) {
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

export function isGenerationPagePreviewReusable(input: {
  entry: GenerationPagePreviewEntry | undefined;
  previewSourceFingerprint: string | undefined;
  nowMs?: number;
  safetyWindowMs?: number;
}): boolean {
  const { entry, previewSourceFingerprint } = input;
  if (
    !entry ||
    entry.status !== "ready" ||
    !entry.imageUpload?.url ||
    !entry.previewSourceFingerprint ||
    !previewSourceFingerprint ||
    entry.previewSourceFingerprint !== previewSourceFingerprint
  ) {
    return false;
  }

  const nowMs = input.nowMs ?? Date.now();
  const safetyWindowMs = input.safetyWindowMs ?? GENERATION_PAGE_PREVIEW_EXPIRY_SAFETY_MS;
  const upload = entry.imageUpload;
  if (upload.expires_at) {
    const expiresAtMs = Date.parse(upload.expires_at);
    return Number.isFinite(expiresAtMs) && expiresAtMs - nowMs >= safetyWindowMs;
  }
  if (typeof upload.expires_in === "number" && Number.isFinite(upload.expires_in)) {
    if (upload.expires_in <= 0 || entry.receivedAtMs === undefined) return false;
    return entry.receivedAtMs + upload.expires_in * 1000 - nowMs >= safetyWindowMs;
  }
  return true;
}
