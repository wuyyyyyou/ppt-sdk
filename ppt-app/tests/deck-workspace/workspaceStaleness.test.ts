import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceResult } from "../../src/api/types.ts";
import { isWorkspaceDeckStale } from "../../src/features/deck-workspace/utils.ts";

function makeWorkspace(overrides: Partial<WorkspaceResult> = {}): WorkspaceResult {
  return {
    workspace_root: "/tmp/anna-workspace/ppt",
    task_root: "/tmp/anna-workspace/ppt",
    workspace_dir: "/tmp/anna-workspace/ppt/ppt-20260602-114351",
    task_dir: "/tmp/anna-workspace/ppt/ppt-20260602-114351",
    workspace_id: "ppt-20260602-114351",
    task_id: "ppt-20260602-114351",
    initialized: true,
    created_files: [],
    missing_files: [],
    files: {
      task: "task.json",
      setting: "setting.json",
      outline: "outline.json",
      page_plan: "page-plan.json",
      page_progress: "page-progress.json",
      pages: "pages.json",
      template: "template.json",
    },
    task: {},
    setting: {},
    outline: {
      version: 3,
      title: "AI: Our Smart Robot Friend",
      status: "confirmed",
      items: [
        {
          title: "What is AI?",
          core_message: "Artificial Intelligence is like giving a computer a smart brain.",
          required_content: "- Explain AI with an accessible analogy.",
        },
      ],
      updated_at: "2026-06-02T03:47:38.344Z",
      confirmed_at: "2026-06-02T03:47:38.344Z",
    },
    page_plan: {
      version: 1,
      status: "prepared",
      title: "AI: Our Smart Robot Friend",
      source: {
        outline_updated_at: "2026-06-02T03:44:57.562Z",
        template_group: "template",
        template_manifest_path: "/tmp/anna-workspace/ppt/ppt-20260602-114351/template/manifest.json",
        generated_by: "llm.complete",
      },
      pages: [
        {
          page_id: "page-01",
          index: 0,
          title: "What is AI?",
          outline: "Artificial Intelligence is like giving a computer a smart brain.",
          blueprint_id: "cover-statement",
          blueprint_source: "./blueprints/CoverStatement.tsx",
          slide_path: "./slides/page-01.tsx",
          data_path: "./data/page-01.json",
          manifest_slide_id: "page-01",
          reason: "",
        },
      ],
      updated_at: "2026-06-02T03:45:04.610Z",
    },
    page_progress: {
      version: 1,
      status: "prepared",
      pages: [],
      updated_at: null,
    },
    pages: {
      version: 1,
      status: "rendered",
      pages: [
        {
          page_id: "page-01",
          index: 0,
          title: "What is AI?",
          layout_id: "template:cover-statement",
          html_path: "/tmp/page-01.html",
          speaker_note: "Artificial Intelligence is like giving a computer a smart brain.",
        },
      ],
      updated_at: "2026-06-02T03:47:38.344Z",
    },
    template: {},
    ...overrides,
  };
}

describe("Workspace Deck Staleness", () => {
  it("does not mark rendered pages stale when only outline timestamp drifted", () => {
    assert.equal(isWorkspaceDeckStale(makeWorkspace()), false);
  });

  it("keeps the existing deck available when confirmed outline content changes", () => {
    const workspace = makeWorkspace({
      outline: {
        version: 3,
        title: "AI: Our Smart Robot Friend",
        status: "confirmed",
        items: [
          {
            title: "What is AI?",
            core_message: "A changed outline can be confirmed to generate a new deck.",
            required_content: "- Keep the existing deck until confirmation.",
          },
        ],
        updated_at: "2026-06-02T03:47:38.344Z",
        confirmed_at: "2026-06-02T03:47:38.344Z",
      },
    });

    assert.equal(isWorkspaceDeckStale(workspace), false);
  });

  it("keeps the existing deck available while a draft outline is being edited", () => {
    const workspace = makeWorkspace({
      outline: {
        version: 3,
        title: "AI: Our Smart Robot Friend",
        status: "draft",
        items: [
          {
            title: "What is AI?",
            core_message: "Artificial Intelligence is like giving a computer a smart brain.",
            required_content: "- Explain AI with an accessible analogy.",
          },
        ],
        updated_at: "2026-06-02T03:44:57.562Z",
        confirmed_at: null,
      },
    });

    assert.equal(isWorkspaceDeckStale(workspace), false);
  });
});
