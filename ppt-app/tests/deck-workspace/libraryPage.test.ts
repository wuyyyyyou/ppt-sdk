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
  it("does not expose sealed or optional preferences", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.zh,
      settings: {},
      currentWorkspace: workspace,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
      workspaceDiagnosticBundle: { status: "idle", message: "" },
      onPrepareWorkspaceDiagnosticBundle: async () => undefined,
      onResetWorkspaceDiagnosticBundle: () => undefined,
    }));

    assert.doesNotMatch(html, /先审阅大纲/);
    assert.doesNotMatch(html, /禁用网页搜索|禁用图片搜索/);
    assert.doesNotMatch(html, /Disable web research|Disable image research/);
    assert.doesNotMatch(html, /新建任务|打开/);
  });

  it("shows global preferences without a current workspace", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.zh,
      settings: { page_generation_concurrency: 7 },
      currentWorkspace: null,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
      workspaceDiagnosticBundle: { status: "idle", message: "" },
      onPrepareWorkspaceDiagnosticBundle: async () => undefined,
      onResetWorkspaceDiagnosticBundle: () => undefined,
    }));

    assert.match(html, /设置/);
    assert.match(html, /页面生成并发数/);
    assert.match(html, />7</);
    assert.doesNotMatch(html, /当前任务|问题排查包/);
  });

  it("shows the complete Workspace disclosure and diagnostic bundle action", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.zh,
      settings: {},
      currentWorkspace: workspace,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
      workspaceDiagnosticBundle: { status: "idle", message: "" },
      onPrepareWorkspaceDiagnosticBundle: async () => undefined,
      onResetWorkspaceDiagnosticBundle: () => undefined,
    }));

    assert.match(html, /问题排查包/);
    assert.match(html, /完整工作区/);
    assert.match(html, /上传资料/);
    assert.match(html, /生成问题排查包下载链接/);
  });

  it("shows a copyable URL when the diagnostic bundle is ready", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.zh,
      settings: {},
      currentWorkspace: workspace,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
      workspaceDiagnosticBundle: {
        status: "ready",
        message: "问题排查包下载链接已准备。",
        href: "https://storage.example/diagnostic.zip",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      onPrepareWorkspaceDiagnosticBundle: async () => undefined,
      onResetWorkspaceDiagnosticBundle: () => undefined,
    }));

    assert.match(html, /https:\/\/storage\.example\/diagnostic\.zip/);
    assert.match(html, /复制问题排查包链接/);
    assert.match(html, /不要将链接分享给无关人员/);
    assert.match(html, /aria-label="重新生成问题排查包"/);
  });

  it("localizes the diagnostic bundle refresh action in English", () => {
    const html = renderToStaticMarkup(createElement(LibraryPage, {
      t: messages.en,
      settings: {},
      currentWorkspace: workspace,
      loading: false,
      savingSettings: false,
      pageReviewSettings: DEFAULT_PAGE_REVIEW_SETTINGS,
      onBack: () => undefined,
      onSaveSettings: async () => undefined,
      onSaveTitle: async () => undefined,
      workspaceDiagnosticBundle: {
        status: "ready",
        message: "Troubleshooting bundle download link is ready.",
        href: "https://storage.example/diagnostic.zip",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      onPrepareWorkspaceDiagnosticBundle: async () => undefined,
      onResetWorkspaceDiagnosticBundle: () => undefined,
    }));

    assert.match(html, /aria-label="Regenerate troubleshooting bundle"/);
    assert.match(html, /title="Regenerate troubleshooting bundle"/);
    assert.doesNotMatch(html, /重新生成问题排查包/);
  });
});
