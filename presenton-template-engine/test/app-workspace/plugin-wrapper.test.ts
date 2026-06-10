import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("app_update_workspace_settings plugin wrapper forwards persist_as_default", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");

  assert.match(
    source,
    /persist_as_default:\s*args\.persist_as_default\s*===\s*true/,
  );
});
