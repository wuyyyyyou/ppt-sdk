import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLocalExecutaSync,
  applyPptAppListingSync,
  applyPptAppManifestSync,
  buildGeneratedFrontendConstants,
} from "./sync-tool-manifests.mjs";

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
];

test("applyPptAppManifestSync writes bundled handles and synchronizes min versions", () => {
  const manifest = applyPptAppManifestSync({
    required_executas: [
      { tool_id: "tool-old-engine", version: "latest" },
    ],
    ui: {
      host_api: {
        tools: [],
      },
    },
  }, tools);

  assert.deepEqual(manifest.required_executas, [
    { tool_id: "bundled:ppt-engine", version: "latest", min_version: "3.2.1" },
  ]);
  assert.deepEqual(manifest.ui.host_api.tools, [
    "required:bundled:ppt-engine",
  ]);
});

test("applyPptAppListingSync maps bundled handles to local executa shim directories", () => {
  const listing = applyPptAppListingSync({ name: "Anna Deck" }, tools);

  assert.deepEqual(listing.bundled_executas, {
    "ppt-engine": { path: "executas/ppt-engine" },
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
  });
});

test("buildGeneratedFrontendConstants emits bundled handles without real tool ids", () => {
  const generated = buildGeneratedFrontendConstants(tools);

  assert.match(generated, /handle: "ppt-engine"/);
  assert.doesNotMatch(generated, /tool-real-engine/);
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
