import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { createHash, randomInt } from "node:crypto";
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

/**
 * Mirrors an in-flight run: the second page has no screenshot yet, so the
 * generation page can only preview the page that already passed.
 */
async function createPartiallyRenderedWorkspace(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", `ppt-20260630-${suffix}`);
  const outputDir = path.join(workspaceDir, "output", "app-render");
  const htmlPath = path.join(outputDir, "slide-1.html");
  const firstScreenshotPath = path.join(outputDir, "slide-1.png");

  await mkdir(outputDir, { recursive: true });
  await writeFile(htmlPath, "<!doctype html><title>Slide A</title>", "utf8");
  await writeSlidePng(firstScreenshotPath, { r: 12, g: 24, b: 48 });

  const pageIds = [
    "page-11111111-1111-4111-8111-111111111111",
    "page-22222222-2222-4222-8222-222222222222",
  ];

  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Page image fixture",
    workspace_format: "authoring-kit-v1",
    updated_at: "2026-06-30T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "outline.json"), {
    version: 3,
    title: "Page image fixture",
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
    status: "running",
    final_deck_render: {
      status: "pending",
      message: null,
      error: null,
      output_dir: "",
      deck_html_path: "",
      rendered_at: null,
      updated_at: "2026-06-30T00:01:00.000Z",
    },
    pages: pageIds.map((pageId, index) => ({
      page_id: pageId,
      status: index === 0 ? "accepted" : "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_html_path: index === 0 ? htmlPath : "",
      last_screenshot_path: index === 0 ? firstScreenshotPath : "",
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
const homeDir = mkdtempSync(path.join(os.tmpdir(), "presenton-workspace-page-image-home-"));
process.env.HOME = homeDir;

test.after(async () => {
  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }
  await rm(homeDir, { recursive: true, force: true });
});

test("getAppWorkspacePageImage derives a preview image for one rendered page", async () => {
  const { getAppWorkspacePageImage } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, firstScreenshotPath, pageIds } = await createPartiallyRenderedWorkspace(homeDir);

  const image = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
  });

  assert.equal(image.version, 1);
  assert.equal(image.page_id, pageIds[0]);
  assert.equal(image.page_index, 0);
  assert.equal(image.page_status, "accepted");
  assert.equal(image.source_path, firstScreenshotPath);
  assert.equal(
    image.preview_source_fingerprint,
    createHash("sha256").update(await readFile(firstScreenshotPath)).digest("hex"),
  );
  assert.match(image.image_path, /output\/page-previews\/page-[a-z0-9-]+-[0-9a-f]{16}\.webp$/);
  assert.equal(image.width, 1280);
  assert.equal(image.height, 720);

  const sourceStat = await stat(firstScreenshotPath);
  assert.ok(
    image.size_bytes < sourceStat.size,
    `preview ${image.size_bytes} should be smaller than source ${sourceStat.size}`,
  );
  const metadata = await sharp(image.image_path).metadata();
  assert.equal(metadata.format, "webp");
});

test("getAppWorkspacePageImage honours a requested width and caps it", async () => {
  const { getAppWorkspacePageImage } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, pageIds } = await createPartiallyRenderedWorkspace(homeDir);

  const small = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
    width: 320,
  });
  assert.equal(small.width, 320);

  const capped = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
    width: 4000,
  });
  // The source is 1600px wide and never enlarged, so the cap shows up as a
  // separate derivation keyed on 1920 rather than 4000.
  assert.equal(capped.width, 1600);
  assert.notEqual(capped.image_path, small.image_path);
});

test("getAppWorkspacePageImage reuses the preview until the page is re-rendered", async () => {
  const { getAppWorkspacePageImage } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, firstScreenshotPath, pageIds } = await createPartiallyRenderedWorkspace(homeDir);

  const first = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
  });
  const firstStat = await stat(first.image_path);

  const second = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
  });
  assert.equal(second.image_path, first.image_path);
  assert.equal(second.preview_source_fingerprint, first.preview_source_fingerprint);
  assert.equal((await stat(second.image_path)).mtimeMs, firstStat.mtimeMs);

  await writeSlidePng(firstScreenshotPath, { r: 240, g: 240, b: 10 });
  const rerendered = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageIds[0],
  });

  assert.notEqual(rerendered.image_path, first.image_path);
  assert.notEqual(rerendered.preview_source_fingerprint, first.preview_source_fingerprint);
  const previews = await readdir(path.dirname(rerendered.image_path));
  assert.deepEqual(previews, [path.basename(rerendered.image_path)]);
});

test("getAppWorkspacePageImage fails for pages that have not rendered yet", async () => {
  const { getAppWorkspacePageImage } = await import("../../src/app-workspace/index.ts");
  const { workspaceDir, pageIds } = await createPartiallyRenderedWorkspace(homeDir);

  await assert.rejects(
    () => getAppWorkspacePageImage({ workspace_dir: workspaceDir, page_id: pageIds[1] }),
    /Page image screenshot/,
  );
  await assert.rejects(
    () => getAppWorkspacePageImage({ workspace_dir: workspaceDir, page_id: "page-does-not-exist" }),
    /Unknown page_id/,
  );
});
