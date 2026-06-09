import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { syncPyprojectText, syncUvLockText } from "./sync-tool-manifests.mjs";

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

  assert.equal(syncPyprojectText(content, {
    ...tool,
    manifest: {
      ...tool.manifest,
      version: "2.0.2",
    },
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
