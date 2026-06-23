import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  return path.join(homeDir, "anna-workspace", "ppt", "ppt-20260601-1" + suffix.slice(1));
}

async function createProgressWorkspace(homeDir: string) {
  const workspaceDir = createWorkspaceDir(homeDir);
  await mkdir(workspaceDir, { recursive: true });
  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Progress fixture",
    updated_at: "2026-06-01T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "outline.json"), {
    version: 2,
    title: "Progress fixture",
    status: "confirmed",
    items: [],
    source: { prompt: "", context: [], setting: {} },
    updated_at: null,
  });
  await writeJson(path.join(workspaceDir, "page-plan.json"), {
    version: 1,
    status: "prepared",
    title: "Progress fixture",
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
        content_review_attempts: 0,
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
      {
        page_id: "page-02",
        index: 1,
        title: "Page 2",
        status: "pending",
        render_attempts: 0,
        visual_review_attempts: 0,
        content_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        slide_path: "./slides/page-02.tsx",
        data_path: "./data/page-02.json",
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

test("recordAppPageProgress preserves concurrent updates in one workspace", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-page-progress-home-"));
  process.env.HOME = homeDir;

  const { recordAppPageProgress } = await import("../../src/app-workspace/index.ts");

  try {
    const workspaceDir = await createProgressWorkspace(homeDir);

    await recordAppPageProgress({
      workspace_dir: workspaceDir,
      patch: {
        deck_status: "running",
        recovery: {
          status: "running",
          run_kind: "page-refinement",
          step: "page-authoring",
          target_page_ids: ["page-01"],
          page_refinement_request: "make it clearer",
          page_refinement_requests: {
            "page-01": "make it clearer",
          },
        },
        final_deck_render: {
          status: "running",
          message: "Rendering final deck",
        },
      },
    });

    await Promise.all([
      recordAppPageProgress({
        workspace_dir: workspaceDir,
        page_id: "page-01",
        patch: {
          status: "accepted",
          render_attempts: 1,
          last_html_path: "/tmp/page-01.html",
        },
      }),
      recordAppPageProgress({
        workspace_dir: workspaceDir,
        page_id: "page-02",
        patch: {
          status: "render_failed",
          render_attempts: 10,
          last_error: "render broke",
        },
      }),
    ]);

    const persisted = await readJson<{
      status: string;
      recovery: {
        status: string;
        run_kind: string;
        target_page_ids: string[];
        page_refinement_request: string;
        page_refinement_requests: Record<string, string>;
      };
      final_deck_render: {
        status: string;
        message: string;
      };
      pages: Array<{
        page_id: string;
        status: string;
        render_attempts: number;
        last_html_path: string;
        last_error: string;
      }>;
    }>(path.join(workspaceDir, "page-progress.json"));
    const first = persisted.pages.find((page) => page.page_id === "page-01");
    const second = persisted.pages.find((page) => page.page_id === "page-02");

    assert.equal(first?.status, "accepted");
    assert.equal(first?.render_attempts, 1);
    assert.equal(first?.last_html_path, "/tmp/page-01.html");
    assert.equal(second?.status, "render_failed");
    assert.equal(second?.render_attempts, 10);
    assert.equal(second?.last_error, "render broke");
    assert.equal(persisted.status, "running");
    assert.equal(persisted.recovery.status, "running");
    assert.equal(persisted.recovery.run_kind, "page-refinement");
    assert.deepEqual(persisted.recovery.target_page_ids, ["page-01"]);
    assert.equal(persisted.recovery.page_refinement_request, "make it clearer");
    assert.equal(persisted.recovery.page_refinement_requests["page-01"], "make it clearer");
    assert.equal(persisted.final_deck_render.status, "running");
    assert.equal(persisted.final_deck_render.message, "Rendering final deck");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
