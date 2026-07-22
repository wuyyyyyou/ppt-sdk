import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import os from "node:os";
import path from "node:path";

const PAGE_1 = "page-11111111-1111-4111-8111-111111111111";
const PAGE_2 = "page-22222222-2222-4222-8222-222222222222";
const PAGE_3 = "page-33333333-3333-4333-8333-333333333333";
const PAGE_4 = "page-44444444-4444-4444-8444-444444444444";
const PAGE_5 = "page-66666666-6666-4666-8666-666666666666";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writePageSource(templateDir: string, pageId: string) {
  const sourcePath = path.join(templateDir, "slides", `${pageId}.tsx`);
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(
    sourcePath,
    [
      'import React from "react";',
      "",
      "export default function Page() {",
      `  return <main data-page-id="${pageId}" />;`,
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function createWorkspaceDir(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return path.join(homeDir, "anna-workspace", "ppt", `ppt-20260602-${suffix}`);
}

test("renderAppWorkspaceDeckHtml preserves the confirmed outline artifact", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-render-outline-home-"));
  process.env.HOME = homeDir;

  const { renderAppWorkspaceDeckHtml } = await import("../../src/app-workspace/index.ts");
  const workspaceDir = createWorkspaceDir(homeDir);
  const templateDir = path.join(workspaceDir, "template");
  const manifestPath = path.join(templateDir, "manifest.json");
  const outlinePath = path.join(workspaceDir, "outline.json");

  try {
    await mkdir(templateDir, { recursive: true });
    await writeJson(path.join(workspaceDir, "task.json"), {
      title: "Render outline fixture",
      updated_at: "2026-06-02T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "setting.json"), {});
    await writeJson(outlinePath, {
      version: 3,
      title: "Original Outline",
      status: "confirmed",
      items: [
        {
          page_id: PAGE_1,
          title: "Original Page",
          core_message: "This outline came from the user's confirmed outline.",
          required_content: "- Preserve the confirmed page content.",
        },
      ],
      updated_at: "2026-06-02T00:00:00.000Z",
      confirmed_at: "2026-06-02T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "template.json"), {
      version: 1,
      selected_template_group: "red-finance-v3",
      selected_template_group_name: "Red Finance V3",
      template_dir: templateDir,
      manifest_path: manifestPath,
      catalog_json_path: path.join(templateDir, "catalog.json"),
      data_dir_path: path.join(templateDir, "data"),
      selected_at: "2026-06-02T00:00:00.000Z",
    });
    await writeJson(manifestPath, {
      title: "Rendered Deck",
      slides: [
        {
          id: PAGE_1,
          source: `./slides/${PAGE_1}.tsx`,
        },
      ],
    });
    await writePageSource(templateDir, PAGE_1);
    await writeJson(path.join(workspaceDir, "page-progress.json"), {
      version: 1,
      status: "running",
      final_deck_render: {
        status: "pending",
        message: null,
        error: null,
        output_dir: null,
        deck_html_path: null,
        rendered_at: null,
        updated_at: "2026-06-02T00:00:00.000Z",
      },
      pages: [{
        page_id: PAGE_1,
        status: "accepted",
        render_attempts: 0,
        visual_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        last_html_path: null,
        last_screenshot_path: null,
        last_error: "",
        visual_review: null,
        updated_at: "2026-06-02T00:00:00.000Z",
      }],
      updated_at: "2026-06-02T00:00:00.000Z",
    });

    const rendered = await renderAppWorkspaceDeckHtml({
      workspace_dir: workspaceDir,
    });

    assert.match(rendered.slides[0]?.screenshot_path ?? "", /\.png$/);
    const renderedHtml = await readFile(rendered.slides[0]!.html_path, "utf8");
    assert.match(renderedHtml, /data-presenton-render-document="static"/);
    assert.doesNotMatch(
      renderedHtml,
      /__PRESENTON_RENDER_CONTEXT__|cdn\.tailwindcss\.com|react-dom|createRoot\(/,
    );

    const outline = await readJson<{
      title: string;
      items: Array<{ core_message: string; required_content: string }>;
      updated_at: string;
      confirmed_at: string;
    }>(outlinePath);
    assert.equal(outline.title, "Original Outline");
    assert.equal(outline.items[0]?.core_message, "This outline came from the user's confirmed outline.");
    assert.equal(outline.items[0]?.required_content, "- Preserve the confirmed page content.");
    assert.equal(outline.updated_at, "2026-06-02T00:00:00.000Z");
    assert.equal(outline.confirmed_at, "2026-06-02T00:00:00.000Z");

    const progress = await readJson<{
      final_deck_render: { status: string; output_dir: string; deck_html_path: string };
      pages: Array<{ page_id: string; last_html_path: string; last_screenshot_path: string }>;
    }>(path.join(workspaceDir, "page-progress.json"));
    assert.equal(progress.final_deck_render.status, "completed");
    assert.equal(progress.final_deck_render.output_dir, rendered.output_dir);
    assert.match(progress.final_deck_render.deck_html_path, /\.html$/);
    assert.equal(progress.pages[0]?.page_id, PAGE_1);
    assert.match(progress.pages[0]?.last_html_path ?? "", /\.html$/);
    assert.match(progress.pages[0]?.last_screenshot_path ?? "", /\.png$/);
    await assert.rejects(
      () => readFile(path.join(workspaceDir, "pages.json"), "utf8"),
      (error: NodeJS.ErrnoException) => error.code === "ENOENT",
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

test("renderAppWorkspacePagePreview includes stable slide id in preview filenames", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-page-preview-home-"));
  process.env.HOME = homeDir;

  const { renderAppWorkspacePagePreview } = await import(`../../src/app-workspace/index.ts?preview=${Date.now()}`);
  const workspaceDir = createWorkspaceDir(homeDir);
  const templateDir = path.join(workspaceDir, "template");
  const manifestPath = path.join(templateDir, "manifest.json");

  try {
    await mkdir(templateDir, { recursive: true });
    await writeJson(path.join(workspaceDir, "task.json"), {
      title: "Page preview fixture",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "setting.json"), {});
    await writeJson(path.join(workspaceDir, "template.json"), {
      version: 1,
      selected_template_group: "red-finance-canvas",
      selected_template_group_name: "Red Finance Canvas",
      template_dir: templateDir,
      manifest_path: manifestPath,
      catalog_json_path: path.join(templateDir, "catalog.json"),
      data_dir_path: path.join(templateDir, "data"),
      selected_at: "2026-07-01T00:00:00.000Z",
    });
    await writeJson(manifestPath, {
      title: "Preview Deck",
      slides: [PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5].map((id) => ({
        id,
        source: `./slides/${id}.tsx`,
      })),
    });
    await Promise.all(
      [PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5].map((pageId) =>
        writePageSource(templateDir, pageId),
      ),
    );

    const preview = await renderAppWorkspacePagePreview({
      workspace_dir: workspaceDir,
      page_id: PAGE_5,
    });

    assert.equal(preview.slide_id, PAGE_5);
    assert.equal(preview.layout_id, PAGE_5);
    assert.match(
      path.basename(preview.html_path),
      new RegExp(`^05-ppt-20260602-\\d{6}-page-preview-${PAGE_5}-${PAGE_5}\\.html$`),
    );
    assert.match(
      path.basename(preview.screenshot_path),
      new RegExp(`^05-ppt-20260602-\\d{6}-page-preview-${PAGE_5}-${PAGE_5}\\.png$`),
    );
    const previewHtml = await readFile(preview.html_path, "utf8");
    assert.match(previewHtml, /data-presenton-render-document="static"/);
    assert.doesNotMatch(
      previewHtml,
      /__PRESENTON_RENDER_CONTEXT__|cdn\.tailwindcss\.com|react-dom|createRoot\(/,
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

test("renderAppWorkspacePagePreview typechecks canonical string slide sources before rendering", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-page-preview-typecheck-home-"));
  process.env.HOME = homeDir;

  const { renderAppWorkspacePagePreview } = await import(`../../src/app-workspace/index.ts?typecheck=${Date.now()}`);
  const workspaceDir = createWorkspaceDir(homeDir);
  const manifestPath = path.join(workspaceDir, "manifest.json");
  const sourcePath = path.join(workspaceDir, "slides", `${PAGE_1}.tsx`);

  try {
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeJson(path.join(workspaceDir, "task.json"), {
      title: "Page preview typecheck fixture",
      workspace_format: "authoring-kit-v1",
      updated_at: "2026-07-22T00:00:00.000Z",
    });
    await writeJson(path.join(workspaceDir, "setting.json"), {});
    await writeJson(manifestPath, {
      title: "Preview Typecheck Deck",
      slides: [{
        id: PAGE_1,
        source: `./slides/${PAGE_1}.tsx`,
      }],
    });
    await writeFile(
      sourcePath,
      [
        'import React from "react";',
        "",
        "export default function Page() {",
        "  return <main>{space}</main>;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    await assert.rejects(
      () => renderAppWorkspacePagePreview({
        workspace_dir: workspaceDir,
        page_id: PAGE_1,
      }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Pre-render TypeScript check failed/);
        assert.match(error.message, /Cannot find name 'space'/);
        return true;
      },
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
