import test from "node:test";
import assert from "node:assert/strict";
import {
  createHostUploadCache,
  hostUploadCacheKey,
  readCachedHostUpload,
  storeHostUpload,
} from "../host-upload-cache.js";

const NOW = Date.parse("2026-07-28T00:00:00.000Z");

function reference(overrides: Record<string, unknown> = {}) {
  return {
    transport: "host_upload",
    r2_key: "exec-uploads/staging/cover.webp",
    url: "https://example.invalid/cover.webp",
    mime_type: "image/webp",
    size_bytes: 22_000,
    expires_at: new Date(NOW + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

function key(overrides: Record<string, unknown> = {}) {
  return hostUploadCacheKey({
    filePath: "/w/output/covers/cover-abc.webp",
    sizeBytes: 22_000,
    mtimeMs: 1_700_000_000_123.456,
    mimeType: "image/webp",
    purpose: "user_artifact",
    ...overrides,
  });
}

test("a stored reference is reused until it approaches expiry", () => {
  const cache = createHostUploadCache();
  storeHostUpload(cache, key(), reference(), NOW);

  assert.equal(readCachedHostUpload(cache, key(), NOW)?.url, "https://example.invalid/cover.webp");
  assert.equal(
    readCachedHostUpload(cache, key(), NOW + 29 * 60_000 - 1)?.url,
    "https://example.invalid/cover.webp",
  );
  // Dropped a minute early so the browser still has time to fetch it.
  assert.equal(readCachedHostUpload(cache, key(), NOW + 29 * 60_000), null);
});

test("changed bytes miss the cache", () => {
  const cache = createHostUploadCache();
  storeHostUpload(cache, key(), reference(), NOW);

  assert.equal(readCachedHostUpload(cache, key({ mtimeMs: 1_700_000_999_000 }), NOW), null);
  assert.equal(readCachedHostUpload(cache, key({ sizeBytes: 22_001 }), NOW), null);
  assert.equal(readCachedHostUpload(cache, key({ mimeType: "image/png" }), NOW), null);
});

test("mtime is truncated so sub-millisecond precision differences still hit", () => {
  const cache = createHostUploadCache();
  storeHostUpload(cache, key({ mtimeMs: 1_700_000_000_123.456 }), reference(), NOW);

  assert.ok(readCachedHostUpload(cache, key({ mtimeMs: 1_700_000_000_123.999 }), NOW));
});

test("references without a usable expiry are not cached", () => {
  const cache = createHostUploadCache();

  storeHostUpload(cache, key(), reference({ expires_at: undefined, expires_in: undefined }), NOW);
  assert.equal(readCachedHostUpload(cache, key(), NOW), null);

  storeHostUpload(cache, key(), reference({ expires_at: "not-a-date", expires_in: undefined }), NOW);
  assert.equal(readCachedHostUpload(cache, key(), NOW), null);

  // Already inside the safety margin.
  storeHostUpload(cache, key(), reference({ expires_at: new Date(NOW + 30_000).toISOString() }), NOW);
  assert.equal(readCachedHostUpload(cache, key(), NOW), null);
});

test("expires_in is used when no absolute expiry is returned", () => {
  const cache = createHostUploadCache();
  storeHostUpload(cache, key(), reference({ expires_at: undefined, expires_in: 1_800 }), NOW);

  assert.ok(readCachedHostUpload(cache, key(), NOW));
});

test("the cache evicts the oldest entries past its limit", () => {
  const cache = createHostUploadCache({ maxEntries: 2 });
  storeHostUpload(cache, key({ filePath: "/w/a.webp" }), reference(), NOW);
  storeHostUpload(cache, key({ filePath: "/w/b.webp" }), reference(), NOW);
  storeHostUpload(cache, key({ filePath: "/w/c.webp" }), reference(), NOW);

  assert.equal(readCachedHostUpload(cache, key({ filePath: "/w/a.webp" }), NOW), null);
  assert.ok(readCachedHostUpload(cache, key({ filePath: "/w/b.webp" }), NOW));
  assert.ok(readCachedHostUpload(cache, key({ filePath: "/w/c.webp" }), NOW));
});
