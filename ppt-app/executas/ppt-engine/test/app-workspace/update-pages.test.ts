import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function createWorkspaceDir(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return path.join(homeDir, "anna-workspace", "ppt", "tasks", `ppt-20260528-${suffix}`);
}

test("workspace page updates reorder, delete, and duplicate rendered pages", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-update-pages-home-"));
  process.env.HOME = homeDir;

  const { duplicateAppWorkspacePage, updateAppWorkspacePages } = await import("../../src/app-workspace/index.ts");
  const workspaceDir = createWorkspaceDir(homeDir);
  const templateDir = path.join(workspaceDir, "template");
  const manifestPath = path.join(templateDir, "manifest.json");

  try {
    await mkdir(templateDir, { recursive: true });

    await writeJson(path.join(workspaceDir, "task.json"), {
      title: "Update pages fixture",
      updated_at: "2026-05-28T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "setting.json"), {});
    await writeJson(path.join(workspaceDir, "outline.json"), {
      version: 2,
      title: "Update pages fixture",
      status: "confirmed",
      items: [],
      source: { prompt: "", context: [], setting: {} },
      updated_at: null,
    });
    await writeJson(path.join(workspaceDir, "template.json"), {
      version: 1,
      selected_template_group: "fixture",
      selected_template_group_name: "Fixture",
      template_dir: templateDir,
      manifest_path: manifestPath,
      catalog_json_path: path.join(templateDir, "catalog.json"),
      data_dir_path: path.join(templateDir, "data"),
      selected_at: "2026-05-28T00:00:00.000Z",
    });
    await writeJson(manifestPath, {
      title: "Fixture Deck",
      slides: [
        { id: "slide-a", title: "Slide A", speaker_note: "A note" },
        { id: "slide-b", title: "Slide B", speaker_note: "B note" },
        { id: "slide-c", title: "Slide C", speaker_note: "C note" },
      ],
    });
    await writeJson(path.join(workspaceDir, "pages.json"), {
      version: 1,
      pages: [
        { page_id: "slide-a", index: 0, title: "Slide A" },
        { page_id: "slide-b", index: 1, title: "Slide B" },
        { page_id: "slide-c", index: 2, title: "Slide C" },
      ],
      updated_at: null,
    });
    await writeJson(path.join(workspaceDir, "page-plan.json"), {
      version: 1,
      status: "prepared",
      title: "Fixture Deck",
      source: {
        outline_updated_at: null,
        template_group: "fixture",
        template_manifest_path: manifestPath,
        generated_by: "test",
      },
      pages: [
        {
          page_id: "page-a",
          index: 0,
          title: "Slide A",
          outline: "A",
          blueprint_id: "blueprint-a",
          blueprint_source: "./blueprints/A.tsx",
          slide_path: "./slides/A.tsx",
          data_path: "./data/A.json",
          manifest_slide_id: "slide-a",
          reason: "",
        },
        {
          page_id: "page-b",
          index: 1,
          title: "Slide B",
          outline: "B",
          blueprint_id: "blueprint-b",
          blueprint_source: "./blueprints/B.tsx",
          slide_path: "./slides/B.tsx",
          data_path: "./data/B.json",
          manifest_slide_id: "slide-b",
          reason: "",
        },
        {
          page_id: "page-c",
          index: 2,
          title: "Slide C",
          outline: "C",
          blueprint_id: "blueprint-c",
          blueprint_source: "./blueprints/C.tsx",
          slide_path: "./slides/C.tsx",
          data_path: "./data/C.json",
          manifest_slide_id: "slide-c",
          reason: "",
        },
      ],
      updated_at: "2026-05-28T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "page-progress.json"), {
      version: 1,
      status: "complete",
      pages: [
        { page_id: "page-a", index: 0, title: "Slide A", status: "complete" },
        { page_id: "page-b", index: 1, title: "Slide B", status: "complete" },
        { page_id: "page-c", index: 2, title: "Slide C", status: "complete" },
      ],
      updated_at: null,
    });

    await updateAppWorkspacePages({
      workspace_dir: workspaceDir,
      pages: [
        { page_id: "slide-c", title: "Renamed C" },
        { page_id: "slide-a", title: "Slide A" },
      ],
    });

    const manifest = await readJson<{ slides: Array<{ id: string; title: string }> }>(manifestPath);
    assert.deepEqual(
      manifest.slides.map((slide) => [slide.id, slide.title]),
      [
        ["slide-c", "Renamed C"],
        ["slide-a", "Slide A"],
      ],
    );

    const pages = await readJson<{ pages: Array<{ page_id: string; index: number; title: string }> }>(
      path.join(workspaceDir, "pages.json"),
    );
    assert.deepEqual(
      pages.pages.map((page) => [page.page_id, page.index, page.title]),
      [
        ["slide-c", 0, "Renamed C"],
        ["slide-a", 1, "Slide A"],
      ],
    );

    const pagePlan = await readJson<{
      pages: Array<{ page_id: string; index: number; title: string; manifest_slide_id: string }>;
    }>(path.join(workspaceDir, "page-plan.json"));
    assert.deepEqual(
      pagePlan.pages.map((page) => [page.page_id, page.index, page.title, page.manifest_slide_id]),
      [
        ["page-c", 0, "Renamed C", "slide-c"],
        ["page-a", 1, "Slide A", "slide-a"],
      ],
    );

    const pageProgress = await readJson<{
      pages: Array<{ page_id: string; index: number; title: string }>;
    }>(path.join(workspaceDir, "page-progress.json"));
    assert.deepEqual(
      pageProgress.pages.map((page) => [page.page_id, page.index, page.title]),
      [
        ["page-c", 0, "Renamed C"],
        ["page-a", 1, "Slide A"],
      ],
    );

    await duplicateAppWorkspacePage({
      workspace_dir: workspaceDir,
      page_id: "slide-c",
      title: "Renamed C Copy",
    });

    const duplicatedManifest = await readJson<{ slides: Array<{ id: string; title: string }> }>(manifestPath);
    assert.deepEqual(
      duplicatedManifest.slides.map((slide) => [slide.id, slide.title]),
      [
        ["slide-c", "Renamed C"],
        ["slide-c-copy", "Renamed C Copy"],
        ["slide-a", "Slide A"],
      ],
    );

    const duplicatedPages = await readJson<{ pages: Array<{ page_id: string; index: number; title: string }> }>(
      path.join(workspaceDir, "pages.json"),
    );
    assert.deepEqual(
      duplicatedPages.pages.map((page) => [page.page_id, page.index, page.title]),
      [
        ["slide-c", 0, "Renamed C"],
        ["slide-c-copy", 1, "Renamed C Copy"],
        ["slide-a", 2, "Slide A"],
      ],
    );

    const duplicatedPagePlan = await readJson<{
      pages: Array<{ page_id: string; index: number; title: string; manifest_slide_id: string }>;
    }>(path.join(workspaceDir, "page-plan.json"));
    assert.deepEqual(
      duplicatedPagePlan.pages.map((page) => [page.page_id, page.index, page.title, page.manifest_slide_id]),
      [
        ["page-c", 0, "Renamed C", "slide-c"],
        ["page-c-copy", 1, "Renamed C Copy", "slide-c-copy"],
        ["page-a", 2, "Slide A", "slide-a"],
      ],
    );

    const duplicatedPageProgress = await readJson<{
      pages: Array<{ page_id: string; index: number; title: string }>;
    }>(path.join(workspaceDir, "page-progress.json"));
    assert.deepEqual(
      duplicatedPageProgress.pages.map((page) => [page.page_id, page.index, page.title]),
      [
        ["page-c", 0, "Renamed C"],
        ["page-c-copy", 1, "Renamed C Copy"],
        ["page-a", 2, "Slide A"],
      ],
    );
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
