import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceResult } from "../../src/api/types.ts";
import { shouldAutoSyncWorkspaceTitleFromOutline } from "../../src/features/deck-workspace/workspaceTitleSync.ts";

function workspaceWithTitle(input: {
  taskTitle: string;
  outlineTitle?: string;
}): WorkspaceResult {
  return {
    workspace_root: "/tmp/workspaces",
    workspace_dir: "/tmp/workspaces/ppt-20260707-120000",
    workspace_id: "ppt-20260707-120000",
    initialized: true,
    created_files: [],
    missing_files: [],
    files: {
      task: "/tmp/workspaces/ppt-20260707-120000/task.json",
      setting: "/tmp/workspaces/ppt-20260707-120000/setting.json",
      outline: "/tmp/workspaces/ppt-20260707-120000/outline.json",
      pages: "/tmp/workspaces/ppt-20260707-120000/pages.json",
      template: "/tmp/workspaces/ppt-20260707-120000/template.json",
    },
    task: {
      title: input.taskTitle,
    },
    setting: {},
    outline: {
      title: input.outlineTitle ?? "",
    },
    pages: {},
    template: {},
  };
}

describe("workspace title sync", () => {
  it("syncs when the current task title is a localized default title", () => {
    for (const taskTitle of [
      "新建任务-2026-07-07",
      "New Task-2026-07-07",
      "新建工作区-2026-07-07",
      "New Workspace-2026-07-07",
    ]) {
      assert.equal(
        shouldAutoSyncWorkspaceTitleFromOutline(
          workspaceWithTitle({ taskTitle }),
          "AI Agent 工作流"
        ),
        true,
        taskTitle
      );
    }
  });

  it("keeps syncing while the task title matches the previous outline title", () => {
    assert.equal(
      shouldAutoSyncWorkspaceTitleFromOutline(
        workspaceWithTitle({
          taskTitle: "旧标题",
          outlineTitle: "旧标题",
        }),
        "新标题"
      ),
      true
    );
  });

  it("does not sync over a custom task title", () => {
    assert.equal(
      shouldAutoSyncWorkspaceTitleFromOutline(
        workspaceWithTitle({
          taskTitle: "我的客户汇报",
          outlineTitle: "AI Agent 工作流",
        }),
        "AI Agent 商业化路径"
      ),
      false
    );
  });

  it("does not sync when the task title already matches the next outline title", () => {
    assert.equal(
      shouldAutoSyncWorkspaceTitleFromOutline(
        workspaceWithTitle({
          taskTitle: "AI Agent 工作流",
          outlineTitle: "AI Agent 工作流",
        }),
        "AI Agent 工作流"
      ),
      false
    );
  });
});
