#!/usr/bin/env node

const { createHash, randomBytes } = require("node:crypto");
const {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isSea, getAsset } = require("node:sea");
const { pathToFileURL } = require("node:url");

const MANIFEST_ASSET_KEY = "app/.sea-asset-manifest.json";
const CACHE_SCHEMA_VERSION = 2;
const DEFAULT_CACHE_ROOT = path.join(
  os.tmpdir(),
  `presenton-template-engine-sea-v${CACHE_SCHEMA_VERSION}`,
);
const STALE_DIRECTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getCacheRoot() {
  const configured = process.env.PRESENTON_TEMPLATE_ENGINE_SEA_CACHE_DIR?.trim();
  return configured ? path.resolve(configured) : DEFAULT_CACHE_ROOT;
}

function preserveFailedCache() {
  return process.env.PRESENTON_SEA_PRESERVE_FAILED_CACHE === "1";
}

function reportCleanupFailure(targetPath, error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to clean SEA cache path "${targetPath}": ${message}\n`);
}

function removeDirectoryBestEffort(targetPath) {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    reportCleanupFailure(targetPath, error);
  }
}

function cleanupStaleWorkDirectories(cacheRoot, now = Date.now()) {
  if (preserveFailedCache() || !existsSync(cacheRoot)) {
    return;
  }

  let entries;
  try {
    entries = readdirSync(cacheRoot, { withFileTypes: true });
  } catch (error) {
    reportCleanupFailure(cacheRoot, error);
    return;
  }

  for (const entry of entries) {
    if (
      !entry.isDirectory()
      || (!entry.name.includes(".staging-") && !entry.name.includes(".corrupt-"))
    ) {
      continue;
    }

    const targetPath = path.join(cacheRoot, entry.name);
    try {
      const ageMs = now - statSync(targetPath).mtimeMs;
      if (ageMs >= STALE_DIRECTORY_MAX_AGE_MS) {
        removeDirectoryBestEffort(targetPath);
      }
    } catch (error) {
      reportCleanupFailure(targetPath, error);
    }
  }
}

function isPathInside(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveBundleFilePath(bundleRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("SEA asset manifest contains an invalid relative path");
  }
  const outputPath = path.resolve(bundleRoot, relativePath);
  if (!isPathInside(bundleRoot, outputPath)) {
    throw new Error(`SEA asset path escapes the bundle root: ${relativePath}`);
  }
  return outputPath;
}

function readTextFileIfPresent(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function isPublishedBundleValid({ bundleRoot, bundleId, manifest, manifestContent }) {
  const readyMarker = path.join(bundleRoot, ".ready");
  const extractedManifestPath = path.join(bundleRoot, ".sea-asset-manifest.json");
  const entryPath = resolveBundleFilePath(bundleRoot, manifest.entry);
  const packageManifestPath = path.join(bundleRoot, "package.json");

  return (
    readTextFileIfPresent(readyMarker) === bundleId
    && readTextFileIfPresent(extractedManifestPath) === manifestContent
    && existsSync(entryPath)
    && existsSync(packageManifestPath)
  );
}

function createUniqueSuffix() {
  return `${Date.now()}-${process.pid}-${randomBytes(6).toString("hex")}`;
}

function quarantineInvalidBundle(bundleRoot) {
  if (!existsSync(bundleRoot)) {
    return null;
  }

  const quarantinePath = `${bundleRoot}.corrupt-${createUniqueSuffix()}`;
  try {
    renameSync(bundleRoot, quarantinePath);
    return quarantinePath;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function extractBundleToStaging({
  cacheRoot,
  bundleId,
  manifest,
  manifestContent,
  readAssetBuffer,
}) {
  const stagingRoot = mkdtempSync(path.join(cacheRoot, `${bundleId}.staging-`));
  try {
    for (const file of manifest.files) {
      const outputPath = resolveBundleFilePath(stagingRoot, file.relativePath);
      const buffer = readAssetBuffer(file.assetKey);
      const actualSha256 = createHash("sha256").update(buffer).digest("hex");
      if (actualSha256 !== file.sha256) {
        throw new Error(
          `SEA asset checksum mismatch for ${file.relativePath}: expected ${file.sha256}, got ${actualSha256}`,
        );
      }
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, buffer);
      chmodSync(outputPath, file.mode);
    }

    writeFileSync(
      path.join(stagingRoot, ".sea-asset-manifest.json"),
      manifestContent,
      "utf8",
    );
    writeFileSync(path.join(stagingRoot, ".ready"), bundleId, "utf8");
    return stagingRoot;
  } catch (error) {
    if (!preserveFailedCache()) {
      removeDirectoryBestEffort(stagingRoot);
    }
    throw error;
  }
}

function publishStagingBundle({
  stagingRoot,
  bundleRoot,
  bundleId,
  manifest,
  manifestContent,
}) {
  const quarantinedPaths = [];
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (isPublishedBundleValid({ bundleRoot, bundleId, manifest, manifestContent })) {
        return;
      }

      if (existsSync(bundleRoot)) {
        const quarantinedPath = quarantineInvalidBundle(bundleRoot);
        if (quarantinedPath) {
          quarantinedPaths.push(quarantinedPath);
        }
        continue;
      }

      try {
        renameSync(stagingRoot, bundleRoot);
        return;
      } catch (error) {
        if (!["EEXIST", "ENOTEMPTY", "ENOENT", "EPERM"].includes(error?.code)) {
          throw error;
        }
      }
    }

    if (!isPublishedBundleValid({ bundleRoot, bundleId, manifest, manifestContent })) {
      throw new Error(`Could not atomically publish SEA bundle cache: ${bundleRoot}`);
    }
  } finally {
    if (existsSync(stagingRoot) && !preserveFailedCache()) {
      removeDirectoryBestEffort(stagingRoot);
    }
    if (!preserveFailedCache()) {
      for (const quarantinedPath of quarantinedPaths) {
        removeDirectoryBestEffort(quarantinedPath);
      }
    }
  }
}

function ensureExtractedApp(options = {}) {
  const cacheRoot = options.cacheRoot ?? getCacheRoot();
  const manifestContent = options.manifestContent
    ?? getAsset(MANIFEST_ASSET_KEY, "utf8");
  const manifest = JSON.parse(manifestContent);
  const readAssetBuffer = options.readAssetBuffer
    ?? ((assetKey) => Buffer.from(getAsset(assetKey)));
  const bundleId = createHash("sha256")
    .update(`sea-cache-v${CACHE_SCHEMA_VERSION}\0`)
    .update(manifestContent)
    .digest("hex")
    .slice(0, 16);
  const bundleRoot = path.join(cacheRoot, bundleId);

  mkdirSync(cacheRoot, { recursive: true });
  cleanupStaleWorkDirectories(cacheRoot);

  if (!isPublishedBundleValid({ bundleRoot, bundleId, manifest, manifestContent })) {
    const stagingRoot = extractBundleToStaging({
      cacheRoot,
      bundleId,
      manifest,
      manifestContent,
      readAssetBuffer,
    });
    publishStagingBundle({
      stagingRoot,
      bundleRoot,
      bundleId,
      manifest,
      manifestContent,
    });
  }

  if (!isPublishedBundleValid({ bundleRoot, bundleId, manifest, manifestContent })) {
    throw new Error(`SEA bundle cache validation failed after publication: ${bundleRoot}`);
  }

  return {
    bundleId,
    bundleRoot,
    entryPath: resolveBundleFilePath(bundleRoot, manifest.entry),
  };
}

function isCacheLoadFailure(error, bundleRoot) {
  const code = error && typeof error === "object" ? error.code : undefined;
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return (
    ["ENOENT", "EACCES", "ERR_MODULE_NOT_FOUND", "ERR_DLOPEN_FAILED"].includes(code)
    && message.includes(bundleRoot)
  );
}

async function importExtractedAppWithRepair() {
  let extracted = ensureExtractedApp();
  try {
    await import(pathToFileURL(extracted.entryPath).href);
    return;
  } catch (error) {
    if (!isCacheLoadFailure(error, extracted.bundleRoot)) {
      throw error;
    }

    const quarantinedPath = quarantineInvalidBundle(extracted.bundleRoot);
    if (quarantinedPath && !preserveFailedCache()) {
      removeDirectoryBestEffort(quarantinedPath);
    }
    extracted = ensureExtractedApp();
    try {
      await import(`${pathToFileURL(extracted.entryPath).href}?sea_cache_repair=1`);
      return;
    } catch (retryError) {
      throw new Error(
        `SEA application load failed after one cache repair attempt: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
        { cause: retryError instanceof Error ? retryError : undefined },
      );
    }
  }
}

async function main() {
  if (!isSea()) {
    throw new Error("scripts/sea-bootstrap.cjs is only meant to run inside a SEA binary");
  }
  await importExtractedAppWithRepair();
}

if (isSea()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
} else {
  module.exports = {
    CACHE_SCHEMA_VERSION,
    STALE_DIRECTORY_MAX_AGE_MS,
    cleanupStaleWorkDirectories,
    ensureExtractedApp,
    isPublishedBundleValid,
    resolveBundleFilePath,
  };
}
