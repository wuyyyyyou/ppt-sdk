import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { WorkspaceResult } from "../../src/api/types.ts";
import { LibraryPage } from "../../src/features/deck-workspace/components/LibraryPage.tsx";
import { DEFAULT_PAGE_REVIEW_SETTINGS } from "../../src/features/deck-workspace/reviewSettings.ts";
import { messages } from "../../src/i18n/messages.ts";

const workspace: WorkspaceResult = {
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
    pages: "/tmp/workspaces/demo/pages.json",
    template: "/tmp/workspaces/demo/template.json",
  },
  task: { title: "Demo" },
  setting: {},
  outline: {},
  pages: [],
  template: {},
};

describe("LibraryPage", () => {
  it("does not expose an optional outline review preference", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.zh,
      locale: "zh",
      workspaceScan: null,
      currentWorkspace: workspace,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onOpen: async () => undefined,
      onCreateWorkspace: async () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
    }));

    assert.doesNotMatch(html, /先审阅大纲/);
  });
});
