import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function createWorkspaceDir(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return path.join(homeDir, "anna-workspace", "ppt", "tasks", `ppt-20260609-${suffix}`);
}

test("workspace settings can be saved as defaults for newly created workspaces", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-settings-home-"));
  process.env.HOME = homeDir;

  const {
    createAppWorkspace,
    getAppWorkspaceDefaults,
    updateAppWorkspaceSettings,
  } = await import("../../src/app-workspace/index.ts");

  try {
    await writeJson(path.join(homeDir, "anna-workspace", "ppt", "setting.json"), {
      output_language: "English",
      language: "en",
      text_density: "detailed",
    });

    const first = await createAppWorkspace({ title: "First" });
    const firstSettingPath = path.join(first.workspace_dir, "setting.json");
    const firstSetting = await readJson<Record<string, unknown>>(firstSettingPath);

    assert.equal(firstSetting.output_language, "English");
    assert.equal(firstSetting.text_density, "detailed");
    assert.equal(firstSetting.content_review_enabled, true);
    assert.equal(firstSetting.content_review_failure_limit, 5);
    assert.equal(firstSetting.visual_review_enabled, true);
    assert.equal(firstSetting.visual_review_failure_limit, 5);
    assert.equal("language" in firstSetting, false);

    await updateAppWorkspaceSettings({
      workspace_dir: first.workspace_dir,
      setting: {
        output_language: "中文",
      },
    });

    const updatedFirstSetting = await readJson<Record<string, unknown>>(firstSettingPath);
    const globalSetting = await readJson<Record<string, unknown>>(
      path.join(homeDir, "anna-workspace", "ppt", "setting.json"),
    );

    assert.equal(updatedFirstSetting.output_language, "中文");
    assert.equal(globalSetting.output_language, "English");

    await updateAppWorkspaceSettings({
      workspace_dir: first.workspace_dir,
      persist_as_default: true,
      setting: {
        output_language: "中文",
        text_density: "light",
        content_review_enabled: false,
        content_review_failure_limit: 99,
        visual_review_enabled: false,
        visual_review_failure_limit: -1,
      },
    });

    const defaults = await getAppWorkspaceDefaults();
    const updatedGlobalSetting = await readJson<Record<string, unknown>>(
      path.join(homeDir, "anna-workspace", "ppt", "setting.json"),
    );

    assert.deepEqual(defaults.setting, updatedGlobalSetting);
    assert.equal(updatedGlobalSetting.output_language, "中文");
    assert.equal(updatedGlobalSetting.text_density, "light");
    assert.equal(updatedGlobalSetting.content_review_enabled, false);
    assert.equal(updatedGlobalSetting.content_review_failure_limit, 10);
    assert.equal(updatedGlobalSetting.visual_review_enabled, false);
    assert.equal(updatedGlobalSetting.visual_review_failure_limit, 0);

    const inherited = await createAppWorkspace({ title: "Inherited" });
    const inheritedSetting = await readJson<Record<string, unknown>>(path.join(inherited.workspace_dir, "setting.json"));

    assert.equal(inheritedSetting.output_language, "中文");
    assert.equal(inheritedSetting.text_density, "light");
    assert.equal(inheritedSetting.content_review_enabled, false);
    assert.equal(inheritedSetting.content_review_failure_limit, 10);
    assert.equal(inheritedSetting.visual_review_enabled, false);
    assert.equal(inheritedSetting.visual_review_failure_limit, 0);

    const secondWorkspaceDir = createWorkspaceDir(homeDir);
    const second = await updateAppWorkspaceSettings({
      workspace_dir: secondWorkspaceDir,
      setting: {
        output_language: "auto",
      },
    });
    const secondSetting = await readJson<Record<string, unknown>>(path.join(second.workspace_dir, "setting.json"));
    const finalGlobalSetting = await readJson<Record<string, unknown>>(
      path.join(homeDir, "anna-workspace", "ppt", "setting.json"),
    );

    assert.equal(secondSetting.output_language, "auto");
    assert.equal(finalGlobalSetting.output_language, "中文");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
