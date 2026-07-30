import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeResearchImageUrl,
  isDisallowedResearchImageAddress,
  RESEARCH_IMAGE_DOWNLOAD_LIMITS,
} from "../src/research-image-download/index.js";

test("research image downloader enforces the agreed limits", () => {
  assert.deepEqual(RESEARCH_IMAGE_DOWNLOAD_LIMITS, {
    connectTimeoutMs: 8_000,
    totalTimeoutMs: 30_000,
    maxRedirects: 3,
    maxBytes: 20 * 1024 * 1024,
    minWidth: 800,
    minHeight: 600,
    maxDimension: 12_000,
    maxPixels: 60_000_000,
  });
});

test("research image URLs require credential-free HTTPS on port 443", () => {
  assert.equal(assertSafeResearchImageUrl("https://cdn.example/image.jpg").hostname, "cdn.example");
  assert.throws(() => assertSafeResearchImageUrl("http://cdn.example/image.jpg"), /must use HTTPS/);
  assert.throws(() => assertSafeResearchImageUrl("https://user:secret@cdn.example/image.jpg"), /must not contain credentials/);
  assert.throws(() => assertSafeResearchImageUrl("https://cdn.example:8443/image.jpg"), /port 443/);
});

test("research image downloader blocks private and special-purpose addresses", () => {
  for (const address of [
    "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1",
    "::1", "[::1]", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "64:ff9b::1", "::ffff:127.0.0.1",
  ]) {
    assert.equal(isDisallowedResearchImageAddress(address), true, address);
  }
  assert.equal(isDisallowedResearchImageAddress("8.8.8.8"), false);
  assert.equal(isDisallowedResearchImageAddress("2606:4700:4700::1111"), false);
});
