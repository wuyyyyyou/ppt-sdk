import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
}

test("authoring-kit-v1 settings persist globally and workspace setting files are ignored", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-settings-home-"));
  process.env.HOME = homeDir;
  const {
    createAppWorkspace,
    getAppWorkspaceDefaults,
    patchAppWorkspaceSettings,
  } = await import("../../src/app-workspace/index.ts");
  try {
    const created = await createAppWorkspace({ title: "Settings" });
    assert.deepEqual(created.setting, {
      page_generation_concurrency: 5,
      visual_review_enabled: false,
      visual_review_failure_limit: 2,
      disable_web_research: false,
      disable_image_research: false,
    });

    const patched = await patchAppWorkspaceSettings({
      workspace_dir: created.workspace_dir,
      persist_as_default: true,
      setting: {
        page_generation_concurrency: 99,
        visual_review_enabled: true,
        visual_review_failure_limit: -1,
        disable_web_research: true,
        disable_image_research: "true",
        output_language: "must be discarded",
        content_review_enabled: true,
      },
    });
    assert.deepEqual(Object.keys(patched.setting).sort(), [
      "disable_image_research",
      "disable_web_research",
      "page_generation_concurrency",
      "updated_at",
      "visual_review_enabled",
      "visual_review_failure_limit",
    ]);
    assert.equal(patched.setting.page_generation_concurrency, 10);
    assert.equal(patched.setting.visual_review_enabled, true);
    assert.equal(patched.setting.visual_review_failure_limit, 1);
    assert.equal(patched.setting.disable_web_research, true);
    assert.equal(patched.setting.disable_image_research, false);

    await assert.rejects(readFile(path.join(created.workspace_dir, "setting.json")));
    const defaults = await getAppWorkspaceDefaults();
    assert.deepEqual(defaults.setting, await readJson(path.join(homeDir, "anna-workspace", "ppt", "setting.json")));

    const inherited = await createAppWorkspace({ title: "Inherited" });
    assert.equal(inherited.setting.page_generation_concurrency, 10);
    assert.equal(inherited.setting.visual_review_enabled, true);
    assert.equal(inherited.setting.visual_review_failure_limit, 1);
    assert.equal(inherited.setting.disable_web_research, true);
    assert.equal(inherited.setting.disable_image_research, false);

    await writeJson(path.join(inherited.workspace_dir, "setting.json"), { page_generation_concurrency: 1 });
    const reopened = await import("../../src/app-workspace/index.ts").then((api) => api.openAppWorkspace({ workspace_dir: inherited.workspace_dir }));
    assert.equal(reopened.setting.page_generation_concurrency, 10);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});

async function writeJson(filePath: string, value: unknown) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, JSON.stringify(value), "utf8");
}
