import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { randomInt } from "node:crypto";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeSlidePng(filePath: string, background: { r: number; g: number; b: number }) {
  const png = await sharp({
    create: { width: 1600, height: 900, channels: 3, background },
  })
    .png()
    .toBuffer();
  await writeFile(filePath, png);
}

async function createRenderedWorkspace(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", `ppt-20260630-${suffix}`);
  const outputDir = path.join(workspaceDir, "output", "app-render");
  const htmlPath = path.join(outputDir, "slide-1.html");
  const firstScreenshotPath = path.join(outputDir, "slide-1.png");
  const secondScreenshotPath = path.join(outputDir, "slide-2.png");

  await mkdir(outputDir, { recursive: true });
  await writeFile(htmlPath, "<!doctype html><title>Slide A</title>", "utf8");
  await writeSlidePng(firstScreenshotPath, { r: 12, g: 24, b: 48 });
  await writeSlidePng(secondScreenshotPath, { r: 200, g: 40, b: 40 });

  const pageIds = [
    "page-11111111-1111-4111-8111-111111111111",
    "page-22222222-2222-4222-8222-222222222222",
  ];

  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Cover fixture",
    workspace_format: "authoring-kit-v1",
    updated_at: "2026-06-30T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "outline.json"), {
    version: 3,
    title: "Cover fixture",
    status: "confirmed",
    items: pageIds.map((pageId, index) => ({
      page_id: pageId,
      title: `Slide ${index + 1}`,
      core_message: "A note",
      required_content: "- Render the page.",
    })),
    updated_at: "2026-06-30T00:00:00.000Z",
    confirmed_at: "2026-06-30T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "manifest.json"), {
    title: "Fixture Deck",
    slides: pageIds.map((pageId) => ({ id: pageId, source: `./slides/${pageId}.tsx` })),
  });
  await writeJson(path.join(workspaceDir, "page-progress.json"), {
    version: 1,
    status: "completed",
    final_deck_render: {
      status: "completed",
      message: null,
      error: null,
      output_dir: outputDir,
      deck_html_path: htmlPath,
      rendered_at: "2026-06-30T00:01:00.000Z",
      updated_at: "2026-06-30T00:01:00.000Z",
    },
    pages: pageIds.map((pageId, index) => ({
      page_id: pageId,
      status: "accepted",
      render_attempts: 0,
      visual_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_html_path: htmlPath,
      last_screenshot_path: index === 0 ? firstScreenshotPath : secondScreenshotPath,
      last_error: "",
      visual_review: null,
      updated_at: "2026-06-30T00:01:00.000Z",
    })),
    updated_at: "2026-06-30T00:01:00.000Z",
  });

  return { workspaceDir, firstScreenshotPath, pageIds };
}

// The workspace root is resolved from HOME once per module load, so every test
// in this file shares one temporary home.
const previousHome = process.env.HOME;
const homeDir = mkdtempSync(path.join(os.tmpdir(), "presenton-workspace-cover-home-"));
process.env.HOME = homeDir;

test.after(async () => {
  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }
  await rm(homeDir, { recursive: true, force: true });
});

test("getAppWorkspaceCover derives a small thumbnail from the first rendered page", async () => {
  const { getAppWorkspaceCover } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, firstScreenshotPath, pageIds } = await createRenderedWorkspace(homeDir);

  const cover = await getAppWorkspaceCover({ workspace_dir: workspaceDir });

  assert.equal(cover.version, 1);
  assert.equal(cover.page_id, pageIds[0]);
  assert.equal(cover.source_path, firstScreenshotPath);
  assert.match(cover.cover_path, /output\/covers\/cover-[0-9a-f]{16}\.webp$/);
  assert.equal(cover.width, 640);
  assert.equal(cover.height, 360);

  const sourceStat = await stat(firstScreenshotPath);
  assert.ok(
    cover.size_bytes < sourceStat.size,
    `thumbnail ${cover.size_bytes} should be smaller than source ${sourceStat.size}`,
  );

  const metadata = await sharp(cover.cover_path).metadata();
  assert.equal(metadata.format, "webp");
});

test("getAppWorkspaceCover reuses the thumbnail until the rendered page changes", async () => {
  const { getAppWorkspaceCover } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, firstScreenshotPath } = await createRenderedWorkspace(homeDir);

  const first = await getAppWorkspaceCover({ workspace_dir: workspaceDir });
  const firstStat = await stat(first.cover_path);

  const second = await getAppWorkspaceCover({ workspace_dir: workspaceDir });
  const secondStat = await stat(second.cover_path);

  assert.equal(second.cover_path, first.cover_path);
  assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);

  await writeSlidePng(firstScreenshotPath, { r: 240, g: 240, b: 10 });
  const rerendered = await getAppWorkspaceCover({ workspace_dir: workspaceDir });

  assert.notEqual(rerendered.cover_path, first.cover_path);
  const covers = await readdir(path.dirname(rerendered.cover_path));
  assert.deepEqual(covers, [path.basename(rerendered.cover_path)]);
});

test("getAppWorkspaceCover fails when the first rendered page screenshot is missing", async () => {
  const { getAppWorkspaceCover } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, firstScreenshotPath } = await createRenderedWorkspace(homeDir);
  await rm(firstScreenshotPath, { force: true });

  await assert.rejects(
    () => getAppWorkspaceCover({ workspace_dir: workspaceDir }),
    /Workspace cover screenshot/,
  );
});
