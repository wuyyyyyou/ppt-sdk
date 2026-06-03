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
      version: 2,
      title: "Original Outline",
      status: "confirmed",
      items: [
        {
          title: "Original Page",
          outline: "This outline came from the user's confirmed outline.",
        },
      ],
      source: {
        prompt: "original prompt",
        context: [],
        setting: {},
      },
      updated_at: "2026-06-02T00:00:00.000Z",
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
          id: "page-01",
          title: "Rendered Page",
          speaker_note: "Rendered speaker note",
          source: {
            type: "builtin",
            template_group: "red-finance-v3",
            layout_id: "cover-statement",
          },
        },
      ],
    });

    const rendered = await renderAppWorkspaceDeckHtml({
      workspace_dir: workspaceDir,
    });

    assert.match(rendered.slides[0]?.screenshot_path ?? "", /\.png$/);

    const outline = await readJson<{
      title: string;
      source: { prompt: string };
      updated_at: string;
    }>(outlinePath);
    assert.equal(outline.title, "Original Outline");
    assert.equal(outline.source.prompt, "original prompt");
    assert.equal(outline.updated_at, "2026-06-02T00:00:00.000Z");

    const pages = await readJson<{
      title: string;
      pages: Array<{ title: string; screenshot_path?: string }>;
    }>(
      path.join(workspaceDir, "pages.json"),
    );
    assert.equal(pages.title, "Rendered Deck");
    assert.deepEqual(pages.pages.map((page) => page.title), ["Rendered Page"]);
    assert.match(pages.pages[0]?.screenshot_path ?? "", /\.png$/);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
