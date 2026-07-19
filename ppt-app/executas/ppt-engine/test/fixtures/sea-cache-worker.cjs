#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const path = require("node:path");

const { ensureExtractedApp } = require("../../scripts/sea-bootstrap.cjs");

const [cacheRoot, manifestPath, assetRoot] = process.argv.slice(2);
if (!cacheRoot || !manifestPath || !assetRoot) {
  throw new Error("Usage: sea-cache-worker.cjs <cache-root> <manifest-path> <asset-root>");
}

const manifestContent = readFileSync(manifestPath, "utf8");
const result = ensureExtractedApp({
  cacheRoot,
  manifestContent,
  readAssetBuffer(assetKey) {
    const relativePath = assetKey.replace(/^app\//, "");
    return readFileSync(path.join(assetRoot, relativePath));
  },
});

process.stdout.write(`${JSON.stringify(result)}\n`);
