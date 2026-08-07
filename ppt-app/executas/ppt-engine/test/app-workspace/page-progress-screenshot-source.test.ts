import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createProgressWorkspace(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", `ppt-20260601-1${suffix.slice(1)}`);
  await mkdir(workspaceDir, { recursive: true });
  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Screenshot source fixture",
    updated_at: "2026-06-01T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "outline.json"), {
    version: 2,
    title: "Screenshot source fixture",
    status: "confirmed",
    items: [],
    source: { prompt: "", context: [], setting: {} },
    updated_at: null,
  });
  await writeJson(path.join(workspaceDir, "page-plan.json"), {
    version: 1,
    status: "prepared",
    title: "Screenshot source fixture",
    source: {
      outline_updated_at: null,
      template_group: "fixture",
      template_manifest_path: path.join(workspaceDir, "template", "manifest.json"),
      generated_by: "test",
    },
    pages: [],
    updated_at: "2026-06-01T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "pages.json"), {
    version: 1,
    status: "rendered",
    pages: [],
    updated_at: null,
  });
  await writeJson(path.join(workspaceDir, "template.json"), {});
  // Deliberately written without `screenshot_source_sha256`, the way every
  // Workspace created before the field existed looks on disk.
  await writeJson(path.join(workspaceDir, "page-progress.json"), {
    version: 1,
    status: "prepared",
    pages: [
      {
        page_id: "page-01",
        index: 0,
        title: "Page 1",
        status: "pending",
        render_attempts: 0,
        visual_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        slide_path: "./slides/page-01.tsx",
        data_path: "./data/page-01.json",
        last_html_path: "",
        last_screenshot_path: "",
        last_error: "",
        review: null,
        updated_at: null,
      },
    ],
    updated_at: null,
  });
  return workspaceDir;
}

test("page progress keeps the source hash the current screenshot came from", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-screenshot-source-home-"));
  process.env.HOME = homeDir;

  const { getAppPageProgress, recordAppPageProgress } = await import("../../src/app-workspace/index.ts");

  try {
    const workspaceDir = await createProgressWorkspace(homeDir);

    const legacy = await getAppPageProgress({ workspace_dir: workspaceDir });
    assert.equal(legacy.pages[0]?.screenshot_source_sha256, "");

    await recordAppPageProgress({
      workspace_dir: workspaceDir,
      page_id: "page-01",
      patch: {
        status: "rendered",
        last_screenshot_path: "/tmp/page-01.png",
        render_source_sha256: "source-v1",
        screenshot_source_sha256: "source-v1",
      },
    });

    // Submitting the next render advances the render hash only. The screenshot
    // file still holds the previous bytes until that render finishes, and the
    // two hashes disagreeing is what tells a consumer to keep waiting.
    await recordAppPageProgress({
      workspace_dir: workspaceDir,
      page_id: "page-01",
      patch: { status: "rendering", render_source_sha256: "source-v2" },
    });

    const submitted = await getAppPageProgress({ workspace_dir: workspaceDir });
    const page = submitted.pages.find((item) => item.page_id === "page-01");
    assert.equal(page?.render_source_sha256, "source-v2");
    assert.equal(page?.screenshot_source_sha256, "source-v1");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
