#!/usr/bin/env node

const { existsSync, realpathSync, statSync } = require("node:fs");
const path = require("node:path");
const { isSea } = require("node:sea");
const { pathToFileURL } = require("node:url");

const EXTERNAL_APP_RELATIVE_PATH = path.join("lib", "app");
const EXTERNAL_APP_ENTRY_NAME = "example_plugin.js";

function resolveDistributionRoot(binaryPath = process.execPath) {
  const resolvedBinaryPath = realpathSync(binaryPath);
  return path.dirname(path.dirname(resolvedBinaryPath));
}

function resolveExternalAppLayout(binaryPath = process.execPath) {
  const distributionRoot = resolveDistributionRoot(binaryPath);
  const appRoot = path.join(distributionRoot, EXTERNAL_APP_RELATIVE_PATH);
  return {
    distributionRoot,
    appRoot,
    entryPath: path.join(appRoot, EXTERNAL_APP_ENTRY_NAME),
    packageManifestPath: path.join(appRoot, "package.json"),
    toolManifestPath: path.join(appRoot, "manifest.json"),
  };
}

function assertFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Missing ${label} in the ppt-engine Binary distribution: ${filePath}`);
  }
}

function assertExternalAppLayout(layout) {
  assertFile(layout.entryPath, "external app entry");
  assertFile(layout.packageManifestPath, "external app package manifest");
  assertFile(layout.toolManifestPath, "external app tool manifest");
  return layout;
}

async function importExternalApp(binaryPath = process.execPath) {
  const layout = assertExternalAppLayout(resolveExternalAppLayout(binaryPath));
  await import(pathToFileURL(layout.entryPath).href);
}

async function main() {
  if (!isSea()) {
    throw new Error("scripts/sea-bootstrap.cjs is only meant to run inside a SEA binary");
  }
  await importExternalApp();
}

if (isSea()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
} else {
  module.exports = {
    EXTERNAL_APP_ENTRY_NAME,
    EXTERNAL_APP_RELATIVE_PATH,
    assertExternalAppLayout,
    importExternalApp,
    resolveDistributionRoot,
    resolveExternalAppLayout,
  };
}
