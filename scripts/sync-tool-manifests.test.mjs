import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  applyPptAppListingSync,
  applyPptAppManifestSync,
  buildGeneratedFrontendConstants,
  syncPyprojectText,
  syncUvLockText,
} from "./sync-tool-manifests.mjs";

const tool = {
  manifest: {
    name: "tool-lightvoss_5433-ppt-gener-dc7ftcep",
    version: "3.4.5",
  },
  pythonPackageName: "presenton-pptx-generator-executa",
  pythonScriptTarget: "presenton_pptx_generator_plugin:main",
  uvLockPath: "presenton-pptx-generator/uv.lock",
};

test("syncPyprojectText keeps script entry inside project scripts with Windows CRLF line endings", () => {
  const content = [
    "[project]",
    'version = "2.0.2"',
    "",
    "[project.scripts]",
    'presenton-pptx-generator = "presenton_sdk_pptx_generator.cli:main"',
    'tool-old = "presenton_pptx_generator_plugin:main"',
    "",
    "[tool.setuptools]",
    'package-dir = {"" = "src"}',
    "",
    "[tool.setuptools.package-data]",
    'presenton_sdk_pptx_generator = ["templates/*.xml"]',
    "",
  ].join("\r\n");

  assert.equal(
    syncPyprojectText(content, tool),
    [
      "[project]",
      'version = "3.4.5"',
      "",
      "[project.scripts]",
      'presenton-pptx-generator = "presenton_sdk_pptx_generator.cli:main"',
      'tool-lightvoss_5433-ppt-gener-dc7ftcep = "presenton_pptx_generator_plugin:main"',
      "",
      "[tool.setuptools]",
      'package-dir = {"" = "src"}',
      "",
      "[tool.setuptools.package-data]",
      'presenton_sdk_pptx_generator = ["templates/*.xml"]',
      "",
    ].join("\r\n"),
  );
});

test("syncPyprojectText is idempotent for the current pyproject with Windows CRLF line endings", async () => {
  const content = (await readFile("presenton-pptx-generator/pyproject.toml", "utf8")).replace(/\r?\n/g, "\r\n");
  const manifest = JSON.parse(await readFile("presenton-pptx-generator/manifest.json", "utf8"));

  assert.equal(syncPyprojectText(content, {
    ...tool,
    manifest,
  }), content);
});

test("syncUvLockText updates uv.lock package entry with Windows CRLF line endings", () => {
  const content = [
    "[[package]]",
    'name = "presenton-pptx-generator-executa"',
    'version = "2.0.2"',
    'source = { editable = "." }',
    "",
  ].join("\r\n");

  assert.equal(
    syncUvLockText(content, tool),
    [
      "[[package]]",
      'name = "presenton-pptx-generator-executa"',
      'version = "3.4.5"',
      'source = { editable = "." }',
      "",
    ].join("\r\n"),
  );
});

const tools = [
  {
    bundledHandle: "ppt-engine",
    manifestPath: "presenton-template-engine/manifest.json",
    bundledExecutaDir: "ppt-app/executas/ppt-engine-local",
    generatedConstName: "PPT_ENGINE_TOOL",
    manifest: {
      name: "tool-real-engine",
      version: "3.2.1",
      display_name: "ppt-engine",
    },
  },
  {
    bundledHandle: "ppt-gener",
    manifestPath: "presenton-pptx-generator/manifest.json",
    bundledExecutaDir: "ppt-app/executas/ppt-gener-local",
    generatedConstName: "PPT_GENER_TOOL",
    manifest: {
      name: "tool-real-gener",
      version: "3.1.1",
      display_name: "ppt-gener",
    },
  },
  {
    bundledHandle: "anna-search",
    manifestPath: "anna-search-executa/manifest.json",
    bundledExecutaDir: "ppt-app/executas/anna-search-local",
    generatedConstName: "ANNA_SEARCH_TOOL",
    manifest: {
      name: "tool-real-search",
      version: "0.1.0",
      display_name: "Anna Search",
    },
  },
];

test("applyPptAppManifestSync writes bundled handles and synchronizes min versions", () => {
  const manifest = applyPptAppManifestSync({
    required_executas: [
      { tool_id: "tool-old-engine", version: "latest" },
      { tool_id: "tool-old-gener", version: "latest" },
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
    { tool_id: "bundled:ppt-gener", version: "latest", min_version: "3.1.1" },
    { tool_id: "bundled:anna-search", version: "latest", min_version: "0.1.0" },
  ]);
  assert.deepEqual(manifest.ui.host_api.tools, [
    "required:bundled:ppt-engine",
    "required:bundled:ppt-gener",
    "required:bundled:anna-search",
  ]);
});

test("applyPptAppListingSync maps bundled handles to local executa shim directories", () => {
  const listing = applyPptAppListingSync({ name: "Anna Deck" }, tools);

  assert.deepEqual(listing.bundled_executas, {
    "ppt-engine": { path: "executas/ppt-engine-local" },
    "ppt-gener": { path: "executas/ppt-gener-local" },
    "anna-search": { path: "executas/anna-search-local" },
  });
});

test("applyPptAppListingSync writes POSIX paths from Windows relative paths", () => {
  const listing = applyPptAppListingSync(
    { name: "Anna Deck" },
    tools,
    (_from, to) => to.replace(/^ppt-app\//, "").replaceAll("/", "\\"),
  );

  assert.deepEqual(listing.bundled_executas, {
    "ppt-engine": { path: "executas/ppt-engine-local" },
    "ppt-gener": { path: "executas/ppt-gener-local" },
    "anna-search": { path: "executas/anna-search-local" },
  });
});

test("buildGeneratedFrontendConstants emits bundled handles without real tool ids", () => {
  const generated = buildGeneratedFrontendConstants(tools);

  assert.match(generated, /handle: "ppt-engine"/);
  assert.match(generated, /handle: "anna-search"/);
  assert.doesNotMatch(generated, /tool-real-engine/);
  assert.doesNotMatch(generated, /tool-real-search/);
});
