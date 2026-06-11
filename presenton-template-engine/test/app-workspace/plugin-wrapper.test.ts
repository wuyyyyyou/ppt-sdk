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

test("app_get_workspace_defaults is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_get_workspace_defaults:\s*toolAppGetWorkspaceDefaults/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_get_workspace_defaults"));
});
