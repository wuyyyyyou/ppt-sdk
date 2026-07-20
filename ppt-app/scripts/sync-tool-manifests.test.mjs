import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyLocalExecutaSync,
  applyPptAppListingSync,
  applyPptAppManifestSync,
  buildGeneratedFrontendConstants,
} from "./sync-tool-manifests.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

const tools = [
  {
    bundledHandle: "ppt-engine",
    manifestPath: "ppt-app/executas/ppt-engine/manifest.json",
    bundledExecutaDir: "ppt-app/executas/ppt-engine",
    generatedConstName: "PPT_ENGINE_TOOL",
    manifest: {
      version: "3.2.1",
      display_name: "ppt-engine",
    },
    localExecuta: {
      tool_id: "tool-real-engine",
    },
  },
  {
    bundledHandle: "anna-search",
    manifestPath: "ppt-app/executas/anna-search/manifest.json",
    bundledExecutaDir: "ppt-app/executas/anna-search",
    generatedConstName: "ANNA_SEARCH_TOOL",
    manifest: {
      version: "0.1.0",
      display_name: "Anna Search",
    },
    localExecuta: {
      tool_id: "tool-real-search",
    },
  },
];

test("applyPptAppManifestSync writes bundled handles and synchronizes min versions", () => {
  const manifest = applyPptAppManifestSync({
    required_executas: [
      { tool_id: "tool-old-engine", version: "latest" },
      { tool_id: "tool-old-search", version: "latest" },
    ],
    ui: {
      host_api: {
        tools: [],
      },
    },
  }, tools);

  assert.deepEqual(manifest.required_executas, [
    { tool_id: "bundled:ppt-engine", version: "latest", min_version: "3.2.1" },
    { tool_id: "bundled:anna-search", version: "latest", min_version: "0.1.0" },
  ]);
  assert.deepEqual(manifest.ui.host_api.tools, [
    "required:bundled:ppt-engine",
    "required:bundled:anna-search",
  ]);
});

test("applyPptAppListingSync maps bundled handles to local executa shim directories", () => {
  const listing = applyPptAppListingSync({ name: "Anna Deck" }, tools);

  assert.deepEqual(listing.bundled_executas, {
    "ppt-engine": { path: "executas/ppt-engine" },
    "anna-search": { path: "executas/anna-search" },
  });
});

test("applyPptAppListingSync writes POSIX paths from Windows relative paths", () => {
  const listing = applyPptAppListingSync(
    { name: "Anna Deck" },
    tools,
    (_from, to) => to.replace(/^ppt-app\//, "").replaceAll("/", "\\"),
  );

  assert.deepEqual(listing.bundled_executas, {
    "ppt-engine": { path: "executas/ppt-engine" },
    "anna-search": { path: "executas/anna-search" },
  });
});

test("buildGeneratedFrontendConstants emits bundled handles without real tool ids", () => {
  const generated = buildGeneratedFrontendConstants(tools);

  assert.match(generated, /handle: "ppt-engine"/);
  assert.match(generated, /handle: "anna-search"/);
  assert.doesNotMatch(generated, /tool-real-engine/);
  assert.doesNotMatch(generated, /tool-real-search/);
});

test("applyLocalExecutaSync mirrors publish metadata while preserving tool id", () => {
  const executa = applyLocalExecutaSync({
    tool_id: "tool-keep-me",
    name: "Old Name",
    version: "0.0.1",
    description: "Old description",
  }, {
    manifest: {
      display_name: "New Name",
      version: "1.2.3",
      description: "New description",
    },
  });

  assert.deepEqual(executa, {
    tool_id: "tool-keep-me",
    name: "New Name",
    version: "1.2.3",
    description: "New description",
  });
});

test("anna-search executa starts through uv in the bundled project directory", async () => {
  const executa = JSON.parse(await readFile(repoPath("ppt-app/executas/anna-search/executa.json"), "utf8"));

  assert.deepEqual(executa.command, [
    "uv",
    "run",
    "--project",
    ".",
    "python",
    "example_plugin.py",
  ]);
});
