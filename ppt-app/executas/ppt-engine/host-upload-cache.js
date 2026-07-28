/**
 * Reuses a confirmed Host Upload reference while it is still valid.
 *
 * Deck screenshots are immutable once rendered, but every My Works visit and
 * every workspace open used to re-run negotiate + PUT + confirm for the same
 * bytes. Confirmed download URLs stay valid for tens of minutes, so a hit here
 * removes three network round trips.
 */

/** Stop serving a reference shortly before it expires so the browser still has time to fetch it. */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 64;

export function createHostUploadCache({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  return { entries: new Map(), maxEntries: Math.max(1, Math.floor(maxEntries)) };
}

/**
 * Identity is the bytes we are about to send, so a re-render or an edit misses
 * the cache instead of resurrecting a stale image.
 */
export function hostUploadCacheKey({ filePath, sizeBytes, mtimeMs, mimeType, purpose }) {
  return [
    filePath,
    Number.isFinite(sizeBytes) ? sizeBytes : "?",
    Number.isFinite(mtimeMs) ? Math.trunc(mtimeMs) : "?",
    mimeType ?? "",
    purpose ?? "",
  ].join("|");
}

export function readCachedHostUpload(cache, key, nowMs = Date.now()) {
  const entry = cache?.entries.get(key);
  if (!entry) return null;
  if (nowMs >= entry.usableUntilMs) {
    cache.entries.delete(key);
    return null;
  }
  return entry.ref;
}

/** Ignores references without a usable expiry rather than guessing a TTL. */
export function storeHostUpload(cache, key, ref, nowMs = Date.now()) {
  if (!cache || !key || !ref) return ref;
  const expiresAtMs = readExpiryMs(ref, nowMs);
  if (expiresAtMs === null) return ref;

  const usableUntilMs = expiresAtMs - EXPIRY_SAFETY_MARGIN_MS;
  if (usableUntilMs <= nowMs) return ref;

  cache.entries.delete(key);
  cache.entries.set(key, { ref, usableUntilMs });
  while (cache.entries.size > cache.maxEntries) {
    const oldest = cache.entries.keys().next();
    if (oldest.done) break;
    cache.entries.delete(oldest.value);
  }
  return ref;
}

function readExpiryMs(ref, nowMs) {
  if (typeof ref.expires_at === "string" && ref.expires_at.length > 0) {
    const parsed = Date.parse(ref.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof ref.expires_in === "number" && Number.isFinite(ref.expires_in) && ref.expires_in > 0) {
    return nowMs + ref.expires_in * 1000;
  }
  return null;
}
