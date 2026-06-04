import test from "node:test";
import assert from "node:assert/strict";

import { syncUvLockText } from "./sync-tool-manifests.mjs";

const tool = {
  manifest: {
    version: "3.4.5",
  },
  pythonPackageName: "presenton-pptx-generator-executa",
  uvLockPath: "presenton-pptx-generator/uv.lock",
};

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
