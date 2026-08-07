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
  screenshotSourceFingerprint?: string;
}

export interface GenerationPagePreviewEntry extends GenerationPagePreviewSource {
  status: "loading" | "ready" | "error";
  previewSourceFingerprint?: string;
  imagePath?: string;
  imageUpload?: HostUploadRef;
  receivedAtMs?: number;
  /**
   * Source hash this page carried when the run claimed it. While set, the entry
   * refuses to surface the screenshot on disk, so a page being rewritten never
   * flashes the version it is replacing.
   */
  awaitingRenderFrom?: string;
  /** The run stopped before replacing this page, so what it shows is the
   * untouched original rather than a result. */
  notApplied?: boolean;
}

export type GenerationPagePreviews = Record<string, GenerationPagePreviewEntry | undefined>;

/** Every planned page participates in preview state. Pages without a rendered
 * screenshot stay loading instead of leaving an unexplained empty frame. */
export function selectGenerationPagePreviewSources(
  progress: DeckGenerationProgress | null,
): GenerationPagePreviewSource[] {
  return (progress?.pages ?? [])
    .flatMap((page) => {
      const screenshotPath = page.last_screenshot_path?.trim() ?? "";
      const pageId = page.page_id?.trim() ?? "";
      if (!pageId) return [];
      return [{
        pageId,
        pageIndex: page.index,
        title: page.title,
        screenshotPath,
        renderSourceFingerprint: page.render_source_sha256,
        screenshotSourceFingerprint: page.screenshot_source_sha256,
      }];
    })
    .sort((left, right) => left.pageIndex - right.pageIndex);
}

/**
 * A page's render source hash advances the moment a render is submitted, while
 * the screenshot file keeps the previous bytes until that render finishes, so
 * the two hashes disagree exactly while a stale image sits on disk. Workspaces
 * written before the screenshot hash existed leave it empty and keep the older
 * behaviour of trusting the file.
 */
export function isRenderedScreenshotCurrent(source: {
  renderSourceFingerprint?: string;
  screenshotSourceFingerprint?: string;
}): boolean {
  if (!source.screenshotSourceFingerprint || !source.renderSourceFingerprint) return true;
  return source.screenshotSourceFingerprint === source.renderSourceFingerprint;
}

/**
 * Releasing the placeholder needs positive proof that the run produced new
 * bytes: a screenshot hash that is both settled and different from the one the
 * page started at. An empty hash proves nothing, so it keeps waiting.
 */
function stillAwaitingRender(
  awaitingRenderFrom: string,
  source: GenerationPagePreviewSource,
): boolean {
  const screenshotSource = source.screenshotSourceFingerprint ?? "";
  if (!screenshotSource) return true;
  if (screenshotSource !== (source.renderSourceFingerprint ?? "")) return true;
  return screenshotSource === awaitingRenderFrom;
}

export interface GenerationPagePreviewReconciliation {
  previews: GenerationPagePreviews;
  pending: GenerationPagePreviewSource[];
  changed: boolean;
}

function withSource(
  entry: GenerationPagePreviewEntry,
  source: GenerationPagePreviewSource,
): GenerationPagePreviewEntry {
  return {
    ...entry,
    pageIndex: source.pageIndex,
    title: source.title,
    screenshotPath: source.screenshotPath,
    renderSourceFingerprint: source.renderSourceFingerprint,
    screenshotSourceFingerprint: source.screenshotSourceFingerprint,
  };
}

function differs(
  left: GenerationPagePreviewEntry,
  right: GenerationPagePreviewEntry,
): boolean {
  return left.pageIndex !== right.pageIndex ||
    left.title !== right.title ||
    left.screenshotPath !== right.screenshotPath ||
    left.renderSourceFingerprint !== right.renderSourceFingerprint ||
    left.screenshotSourceFingerprint !== right.screenshotSourceFingerprint ||
    left.awaitingRenderFrom !== right.awaitingRenderFrom ||
    left.notApplied !== right.notApplied ||
    left.status !== right.status;
}

/**
 * Progress polls on a timer, so reconciliation has to be a no-op unless a page
 * actually gained or re-rendered a screenshot. `lockPageIds` carries the pages
 * the run has just claimed; they hold a placeholder from that point until a
 * render newer than the one they start from lands.
 */
export function reconcileGenerationPagePreviews(
  previous: GenerationPagePreviews,
  sources: readonly GenerationPagePreviewSource[],
  lockPageIds: readonly string[] = [],
): GenerationPagePreviewReconciliation {
  // A refinement seeds its target hold before the Shadow Workspace publishes
  // the first progress snapshot. An empty snapshot in that hand-off window is
  // not evidence that the page disappeared.
  if (
    sources.length === 0 &&
    Object.values(previous).some((entry) => entry?.awaitingRenderFrom !== undefined)
  ) {
    return { previews: previous, pending: [], changed: false };
  }

  const previews: GenerationPagePreviews = {};
  const pending: GenerationPagePreviewSource[] = [];
  const locking = new Set(lockPageIds);
  let changed = Object.keys(previous).filter((pageId) => previous[pageId]).length !== sources.length;

  for (const source of sources) {
    const existing = previous[source.pageId];

    if (locking.has(source.pageId)) {
      const base = existing ? withSource(existing, source) : { ...source, status: "loading" as const };
      const locked: GenerationPagePreviewEntry = {
        ...base,
        awaitingRenderFrom: source.renderSourceFingerprint ?? "",
        notApplied: undefined,
        status: "loading",
      };
      previews[source.pageId] = locked;
      if (!existing || differs(existing, locked)) changed = true;
      continue;
    }

    if (existing?.awaitingRenderFrom !== undefined) {
      const merged = withSource(existing, source);
      if (stillAwaitingRender(existing.awaitingRenderFrom, source)) {
        const waiting: GenerationPagePreviewEntry = { ...merged, status: "loading" };
        previews[source.pageId] = waiting;
        if (differs(existing, waiting)) changed = true;
        continue;
      }
      const released: GenerationPagePreviewEntry = {
        ...merged,
        awaitingRenderFrom: undefined,
        status: "loading",
      };
      previews[source.pageId] = released;
      if (source.screenshotPath) pending.push(source);
      changed = true;
      continue;
    }

    const sameRenderSource = Boolean(
      existing &&
      source.renderSourceFingerprint &&
      existing.renderSourceFingerprint === source.renderSourceFingerprint,
    );
    if (existing && (sameRenderSource || existing.screenshotPath === source.screenshotPath)) {
      const refreshed = withSource(existing, source);
      previews[source.pageId] = refreshed;
      if (differs(existing, refreshed)) changed = true;
      continue;
    }

    previews[source.pageId] = { ...source, status: "loading" };
    if (source.screenshotPath && isRenderedScreenshotCurrent(source)) pending.push(source);
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
  activePageIndex?: number | null;
}): GenerationPagePreviewEntry | null {
  const { entries, pinnedPageId, activePageIndex } = input;
  if (entries.length === 0) return null;
  if (pinnedPageId) {
    const pinned = entries.find((entry) => entry.pageId === pinnedPageId);
    if (pinned) return pinned;
  }
  if (activePageIndex !== null && activePageIndex !== undefined) {
    const active = entries.find((entry) => entry.pageIndex === activePageIndex);
    if (active) return active;
  }
  const readyEntries = entries.filter((entry) => entry.status === "ready");
  return readyEntries[readyEntries.length - 1] ?? entries[entries.length - 1];
}

export interface GenerationPagePreviewSeedPage {
  pageId: string;
  pageIndex: number;
  title: string;
}

/** The subset of a rendered Deck slide the preview panel can start from. */
export interface GenerationPagePreviewSeedSlide {
  slide_id: string;
  screenshot_path?: string;
  render_source_fingerprint?: string;
  preview_source_fingerprint?: string;
  screenshot_upload?: HostUploadRef;
}

/**
 * A run only rewrites the pages it targets, so the panel opens as the whole
 * deck: untouched pages keep the image the user is already looking at, and
 * target pages hold a placeholder over theirs. Carrying the previous entry's
 * receipt time keeps a reused upload's expiry honest.
 */
export function createRunGenerationPagePreviews(input: {
  pages: readonly GenerationPagePreviewSeedPage[];
  targetPageIds: readonly string[];
  slides?: readonly GenerationPagePreviewSeedSlide[];
  previous?: GenerationPagePreviews;
}): GenerationPagePreviews {
  const slidesByPageId = new Map(
    (input.slides ?? []).map((slide) => [slide.slide_id, slide] as const),
  );
  const targets = new Set(input.targetPageIds);
  const previews: GenerationPagePreviews = {};

  for (const page of input.pages) {
    const pageId = page.pageId.trim();
    if (!pageId) continue;
    const slide = slidesByPageId.get(pageId);
    const previousEntry = input.previous?.[pageId];
    const carriedReceiptMs = previousEntry?.previewSourceFingerprint &&
      previousEntry.previewSourceFingerprint === slide?.preview_source_fingerprint
      ? previousEntry.receivedAtMs
      : undefined;
    const entry: GenerationPagePreviewEntry = {
      pageId,
      pageIndex: page.pageIndex,
      title: page.title,
      screenshotPath: slide?.screenshot_path ?? "",
      renderSourceFingerprint: slide?.render_source_fingerprint,
      screenshotSourceFingerprint: slide?.render_source_fingerprint,
      previewSourceFingerprint: slide?.preview_source_fingerprint,
      imageUpload: slide?.screenshot_upload,
      receivedAtMs: carriedReceiptMs,
      status: slide?.screenshot_upload && !targets.has(pageId) ? "ready" : "loading",
    };
    previews[pageId] = targets.has(pageId)
      ? { ...entry, awaitingRenderFrom: slide?.render_source_fingerprint ?? "" }
      : entry;
  }

  return previews;
}

/**
 * A stopped run leaves its target pages holding the version the user already
 * had, so show it again flagged as not applied rather than spinning forever.
 */
export function releaseAwaitingGenerationPagePreviews(
  previews: GenerationPagePreviews,
): GenerationPagePreviews {
  const next: GenerationPagePreviews = {};
  let changed = false;

  for (const [pageId, entry] of Object.entries(previews)) {
    if (!entry) continue;
    if (entry.awaitingRenderFrom === undefined) {
      next[pageId] = entry;
      continue;
    }
    changed = true;
    next[pageId] = {
      ...entry,
      awaitingRenderFrom: undefined,
      notApplied: true,
      status: entry.imageUpload ? "ready" : "error",
    };
  }

  return changed ? next : previews;
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
