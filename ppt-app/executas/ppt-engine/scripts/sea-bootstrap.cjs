#!/usr/bin/env node

const { createHash } = require("node:crypto");
const { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isSea, getAsset } = require("node:sea");
const { pathToFileURL } = require("node:url");

const MANIFEST_ASSET_KEY = "app/.sea-asset-manifest.json";
const CACHE_ROOT = path.join(os.tmpdir(), "presenton-template-engine-sea");

function readAssetBuffer(assetKey) {
  return Buffer.from(getAsset(assetKey));
}

function ensureExtractedApp() {
  const manifestContent = getAsset(MANIFEST_ASSET_KEY, "utf8");
  const manifest = JSON.parse(manifestContent);
  const bundleId = createHash("sha256").update(manifestContent).digest("hex").slice(0, 16);
  const bundleRoot = path.join(CACHE_ROOT, bundleId);
  const readyMarker = path.join(bundleRoot, ".ready");

  if (!existsSync(readyMarker)) {
    rmSync(bundleRoot, { recursive: true, force: true });
    mkdirSync(bundleRoot, { recursive: true });

    for (const file of manifest.files) {
      const outputPath = path.join(bundleRoot, file.relativePath);
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, readAssetBuffer(file.assetKey));
      chmodSync(outputPath, file.mode);
    }

    writeFileSync(path.join(bundleRoot, ".sea-asset-manifest.json"), manifestContent, "utf8");
    writeFileSync(readyMarker, bundleId, "utf8");
  }

  return {
    entryPath: path.join(bundleRoot, manifest.entry),
  };
}

async function main() {
  if (!isSea()) {
    throw new Error("scripts/sea-bootstrap.cjs is only meant to run inside a SEA binary");
  }

  const { entryPath } = ensureExtractedApp();
  await import(pathToFileURL(entryPath).href);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
