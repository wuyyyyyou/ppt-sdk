import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CreateWorkspaceResult } from "../../src/api/types.ts";
import { createInitialWorkspaceSnapshot } from "../../src/features/deck-workspace/createdWorkspace.ts";

describe("created Workspace snapshot", () => {
  it("materializes only the canonical empty client state", () => {
    const created: CreateWorkspaceResult = {
      version: 1,
      workspace_root: "/tmp/workspaces",
      workspace_id: "ppt-20260716-120000",
      workspace_dir: "/tmp/workspaces/ppt-20260716-120000",
      title: "New task",
      setting: {
        output_language: "English",
        text_density: "balanced",
        page_generation_concurrency: 5,
        content_review_enabled: false,
        content_review_failure_limit: 5,
        visual_review_enabled: true,
        visual_review_failure_limit: 2,
        review_outline_first: true,
        disable_web_research: false,
        disable_image_research: true,
      },
    };

    const workspace = createInitialWorkspaceSnapshot(created);

    assert.equal(workspace.workspace_id, created.workspace_id);
    assert.equal(workspace.workspace_dir, created.workspace_dir);
    assert.equal((workspace.task as { title: string }).title, created.title);
    assert.equal(workspace.setting, created.setting);
    assert.deepEqual((workspace.outline as { items: unknown[] }).items, []);
    assert.deepEqual((workspace.pages as { pages: unknown[] }).pages, []);
    assert.equal(workspace.page_plan, undefined);
    assert.equal(workspace.page_progress, undefined);
    assert.equal(workspace.files, undefined);
    assert.equal(workspace.created_files, undefined);
    assert.equal(workspace.missing_files, undefined);
  });
});
