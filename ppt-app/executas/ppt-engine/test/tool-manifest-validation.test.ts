import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateToolManifest } from "../scripts/tool-manifest-validation.mjs";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function manifestWithParameter(parameter: Record<string, unknown>) {
  return {
    display_name: "ppt-engine",
    version: "1.0.0",
    tools: [
      {
        name: "example_tool",
        description: "Example tool.",
        parameters: [parameter],
      },
    ],
  };
}

test("current ppt-engine manifest satisfies the Anna parameter schema requirements", async () => {
  const manifest = JSON.parse(await readFile(path.join(PROJECT_DIR, "manifest.json"), "utf8"));
  assert.equal(validateToolManifest(manifest), manifest);
});

test("parameter description is required", () => {
  assert.throws(
    () => validateToolManifest(manifestWithParameter({ name: "workspace_dir", type: "string" })),
    /tools\[0\]\.parameters\[0\]\.description: must be a non-empty string/,
  );
});

test("array parameters require an element type", () => {
  assert.throws(
    () => validateToolManifest(manifestWithParameter({
      name: "page_ids",
      type: "array",
      description: "Page ids.",
    })),
    /tools\[0\]\.parameters\[0\]\.items: array parameters must declare/,
  );
});

test("array parameters accept items.type and items_type", () => {
  assert.doesNotThrow(() => validateToolManifest(manifestWithParameter({
    name: "page_ids",
    type: "array",
    items: { type: "string" },
    description: "Page ids.",
  })));
  assert.doesNotThrow(() => validateToolManifest(manifestWithParameter({
    name: "pages",
    type: "array",
    items_type: "object",
    description: "Pages.",
  })));
});
