import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("workspace theme token tools read contract, validate candidates, and record default fallback", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-theme-home-"));
  process.env.HOME = homeDir;

  const {
    createAppWorkspace,
    selectAppWorkspaceTemplate,
    getAppWorkspaceThemeContext,
    validateAppWorkspaceThemeToken,
    recordAppWorkspaceThemeToken,
  } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Theme token workspace" });
    const selected = await selectAppWorkspaceTemplate({
      workspace_dir: workspace.workspace_dir,
      template_group: "chart-analytics-canvas",
    });

    const context = await getAppWorkspaceThemeContext({
      workspace_dir: selected.workspace.workspace_dir,
    });
    assert.equal(context.workspace_dir, selected.workspace.workspace_dir);
    assert.match(context.schema_path, /theme\/token\.schema\.json$/);
    assert.match(context.default_token_path, /theme\/token\.default\.json$/);
    assert.match(context.readme_path, /theme\/README\.md$/);
    assert.equal(typeof context.readme, "string");
    assert.ok(context.readme.length > 0);

    const invalid = await validateAppWorkspaceThemeToken({
      workspace_dir: selected.workspace.workspace_dir,
      token: { version: 1 },
    });
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.length > 0);

    const recorded = await recordAppWorkspaceThemeToken({
      workspace_dir: selected.workspace.workspace_dir,
      use_default: true,
    });
    assert.equal(recorded.fallback_used, true);
    assert.equal(recorded.validation.ok, true);
    assert.deepEqual(recorded.token, context.default_token);

    const written = JSON.parse(await readFile(recorded.token_path, "utf8")) as unknown;
    assert.deepEqual(written, context.default_token);
  } finally {
    process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});
