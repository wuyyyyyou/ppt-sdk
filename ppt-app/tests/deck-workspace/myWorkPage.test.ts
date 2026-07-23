import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MyWorkPage } from "../../src/features/deck-workspace/components/MyWorkPage.tsx";
import { messages } from "../../src/i18n/messages.ts";

const scan = {
  workspace_root: "/tmp/workspaces",
  has_workspaces: true,
  latest_workspace: null,
  workspaces: [
    { workspace_id: "done", workspace_dir: "/tmp/workspaces/done", title: "季度复盘", status: "ready", created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-23T10:00:00Z", has_deck_html: true },
    { workspace_id: "draft", workspace_dir: "/tmp/workspaces/draft", title: "产品规划", status: "initialized", created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-23T09:00:00Z", has_deck_html: false },
  ],
};

describe("MyWorkPage", () => {
  it("separates generated presentations from unfinished projects", () => {
    const html = renderToStaticMarkup(createElement(MyWorkPage, {
      t: messages.zh,
      locale: "zh",
      workspaceScan: scan,
      workspaceCovers: { done: "https://example.test/cover.png" },
      loading: false,
      error: "",
      onRetry: async () => undefined,
      onOpen: async () => undefined,
      onNew: async () => undefined,
      onRename: async () => undefined,
      onDelete: async () => undefined,
    }));

    assert.match(html, /演示文稿/);
    assert.match(html, /未完成项目/);
    assert.match(html, /季度复盘/);
    assert.match(html, /产品规划/);
    assert.match(html, /新建演示文稿/);
    assert.match(html, /https:\/\/example\.test\/cover\.png/);
    assert.match(html, /default-project-cover\.svg/);
  });

  it("renders skeletons while waiting for backend summaries", () => {
    const html = renderToStaticMarkup(createElement(MyWorkPage, {
      t: messages.en,
      locale: "en",
      workspaceScan: null,
      workspaceCovers: {},
      loading: true,
      error: "",
      onRetry: async () => undefined,
      onOpen: async () => undefined,
      onNew: async () => undefined,
      onRename: async () => undefined,
      onDelete: async () => undefined,
    }));

    assert.match(html, /my-work-skeleton-grid/);
    assert.doesNotMatch(html, /No generated presentations yet/);
  });
});
