import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceResult } from "../../src/api/types.ts";
import { createWorkspaceReviewRenderKey } from "../../src/features/deck-workspace/workspaceReviewRenderKey.ts";

function makeWorkspace(overrides: Partial<WorkspaceResult> = {}): WorkspaceResult {
  return {
    workspace_root: "/tmp/workspaces",
    workspace_dir: "/tmp/workspaces/demo",
    workspace_id: "demo",
    initialized: true,
    created_files: [],
    missing_files: [],
    files: {
      task: "/tmp/workspaces/demo/task.json",
      setting: "/tmp/workspaces/demo/setting.json",
      outline: "/tmp/workspaces/demo/outline.json",
      page_plan: "/tmp/workspaces/demo/page-plan.json",
      page_progress: "/tmp/workspaces/demo/page-progress.json",
      pages: "/tmp/workspaces/demo/pages.json",
      template: "/tmp/workspaces/demo/template.json",
    },
    task: {},
    setting: {
      theme_id: "finance-red-classic",
      updated_at: "2026-07-03T00:00:00.000Z",
    },
    outline: {
      updated_at: "2026-07-03T00:01:00.000Z",
    },
    page_plan: {
      updated_at: "2026-07-03T00:02:00.000Z",
    },
    page_progress: {
      updated_at: "2026-07-03T00:03:00.000Z",
    },
    pages: {
      updated_at: "2026-07-03T00:04:00.000Z",
    },
    template: {
      manifest_path: "/tmp/workspaces/demo/template/manifest.json",
      selected_at: "2026-07-03T00:05:00.000Z",
    },
    ...overrides,
  };
}

describe("workspace review render key", () => {
  it("does not invalidate rendered previews for non-rendering setting saves", () => {
    const before = makeWorkspace();
    const after = makeWorkspace({
      setting: {
        theme_id: "finance-red-classic",
        disable_web_research: true,
        disable_image_research: true,
        updated_at: "2026-07-03T00:10:00.000Z",
      },
    });

    assert.equal(createWorkspaceReviewRenderKey(after), createWorkspaceReviewRenderKey(before));
  });

  it("invalidates rendered previews when render-affecting workspace artifacts change", () => {
    const before = makeWorkspace();
    const nextTheme = makeWorkspace({
      setting: {
        theme_id: "digital-indigo",
        updated_at: "2026-07-03T00:10:00.000Z",
      },
    });
    const nextPages = makeWorkspace({
      pages: {
        updated_at: "2026-07-03T00:10:00.000Z",
      },
    });

    assert.notEqual(createWorkspaceReviewRenderKey(nextTheme), createWorkspaceReviewRenderKey(before));
    assert.notEqual(createWorkspaceReviewRenderKey(nextPages), createWorkspaceReviewRenderKey(before));
  });
});
