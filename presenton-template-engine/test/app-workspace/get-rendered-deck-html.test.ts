import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import os from "node:os";
import path from "node:path";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function createRenderedWorkspace(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", `ppt-20260630-${suffix}`);
  const templateDir = path.join(workspaceDir, "template");
  const outputDir = path.join(workspaceDir, "output", "app-render");
  const manifestPath = path.join(templateDir, "manifest.json");
  const htmlPath = path.join(outputDir, "slide-1.html");
  const screenshotPath = path.join(outputDir, "slide-1.png");

  await mkdir(outputDir, { recursive: true });
  await writeFile(htmlPath, "<!doctype html><title>Slide A</title>", "utf8");
  await writeFile(screenshotPath, "png fixture", "utf8");
  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Cached render fixture",
    updated_at: "2026-06-30T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "outline.json"), {
    version: 2,
    title: "Cached render fixture",
    status: "confirmed",
    items: [{ title: "Slide A", outline: "A note" }],
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
    selected_at: "2026-06-30T00:00:00.000Z",
  });
  await writeJson(manifestPath, {
    title: "Fixture Deck",
    slides: [{ id: "slide-a", title: "Slide A", speaker_note: "A note" }],
  });
  await writeJson(path.join(workspaceDir, "pages.json"), {
    version: 1,
    status: "rendered",
    title: "Fixture Deck",
    manifest_path: manifestPath,
    output_dir: outputDir,
    rendered_at: "2026-06-30T00:01:00.000Z",
    pages: [
      {
        page_id: "slide-a",
        index: 0,
        title: "Slide A",
        layout_id: "",
        html_path: htmlPath,
        screenshot_path: screenshotPath,
        speaker_note: "A note",
      },
    ],
    source: { kind: "template-manifest" },
    updated_at: "2026-06-30T00:01:00.000Z",
  });

  return { workspaceDir, screenshotPath };
}

test("getRenderedAppWorkspaceDeckHtml reads complete rendered pages and rejects missing screenshots", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-get-rendered-home-"));
  process.env.HOME = homeDir;

  try {
    const { getRenderedAppWorkspaceDeckHtml } = await import("../../src/app-workspace/index.ts");
    const { workspaceDir } = await createRenderedWorkspace(homeDir);

    const rendered = await getRenderedAppWorkspaceDeckHtml({ workspace_dir: workspaceDir });

    assert.equal(rendered.title, "Fixture Deck");
    assert.equal(rendered.slide_count, 1);
    assert.equal(rendered.slides[0]?.slide_id, "slide-a");
    assert.match(rendered.slides[0]?.screenshot_path ?? "", /slide-1\.png$/);

    const task = await readJson<{ updated_at: string }>(path.join(workspaceDir, "task.json"));
    assert.equal(task.updated_at, "2026-06-30T00:00:00.000Z");

    const missing = await createRenderedWorkspace(homeDir);
    await rm(missing.screenshotPath, { force: true });

    await assert.rejects(
      () => getRenderedAppWorkspaceDeckHtml({ workspace_dir: missing.workspaceDir }),
      /Rendered deck screenshot/,
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
