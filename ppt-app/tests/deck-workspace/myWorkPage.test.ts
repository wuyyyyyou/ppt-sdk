import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MyWorkPage } from "../../src/features/deck-workspace/components/MyWorkPage.tsx";
import { buildMyWorkMenuItems } from "../../src/features/deck-workspace/myWorkMenu.ts";
import type { WorkspaceCovers } from "../../src/features/deck-workspace/workspaceCovers.ts";
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

type RenderOverrides = {
  locale?: "en" | "zh";
  workspaceScan?: typeof scan | null;
  workspaceCovers?: WorkspaceCovers;
  openingWorkspaceDir?: string | null;
  loading?: boolean;
  error?: string;
  errorDetail?: string;
  onDuplicate?: (workspaceDir: string, sourceTitle: string) => Promise<void>;
  highlightedWorkspaceId?: string | null;
};

function renderMyWorkPage(overrides: RenderOverrides = {}) {
  const locale = overrides.locale ?? "zh";
  return renderToStaticMarkup(createElement(MyWorkPage, {
    t: messages[locale],
    locale,
    workspaceScan: overrides.workspaceScan === undefined ? scan : overrides.workspaceScan,
    workspaceCovers: overrides.workspaceCovers ?? {},
    openingWorkspaceDir: overrides.openingWorkspaceDir ?? null,
    loading: overrides.loading ?? false,
    error: overrides.error ?? "",
    errorDetail: overrides.errorDetail,
    onRetry: async () => undefined,
    onOpen: async () => undefined,
    onNew: async () => undefined,
    onRename: async () => undefined,
    onDelete: async () => undefined,
    onDuplicate: overrides.onDuplicate,
    highlightedWorkspaceId: overrides.highlightedWorkspaceId ?? null,
  }));
}

describe("MyWorkPage", () => {
  it("separates generated presentations from unfinished projects", () => {
    const html = renderMyWorkPage({
      workspaceCovers: { done: { status: "ready", url: "https://example.test/cover.png" } },
    });

    assert.match(html, /演示文稿/);
    assert.match(html, /未完成项目/);
    assert.match(html, /季度复盘/);
    assert.match(html, /产品规划/);
    assert.match(html, /新建演示文稿/);
    assert.match(html, /https:\/\/example\.test\/cover\.png/);
    assert.match(html, /default-project-cover\.svg/);
    assert.doesNotMatch(html, /src="\/default-project-cover\.svg"/);
  });

  it("renders skeletons while waiting for backend summaries", () => {
    const html = renderMyWorkPage({ locale: "en", workspaceScan: null, loading: true });

    assert.match(html, /my-work-skeleton-grid/);
    assert.doesNotMatch(html, /No generated presentations yet/);
  });

  it("uses the work title as the cover alt text and keeps the fallback decorative", () => {
    const html = renderMyWorkPage({
      workspaceCovers: { done: { status: "ready", url: "https://example.test/cover.png" } },
    });

    assert.match(html, /alt="季度复盘"/);
    assert.match(html, /default-project-cover\.svg" alt=""/);
  });

  it("shows a per-card cover skeleton instead of blocking the list", () => {
    const html = renderMyWorkPage({ workspaceCovers: { done: { status: "loading" } } });

    assert.match(html, /my-work-card-cover-skeleton/);
    assert.match(html, /季度复盘/);
    assert.doesNotMatch(html, /my-work-skeleton-grid/);
  });

  it("falls back to the default cover when a single cover fails", () => {
    const html = renderMyWorkPage({ workspaceCovers: { done: { status: "error" } } });

    assert.doesNotMatch(html, /my-work-card-cover-skeleton/);
    assert.match(html, /default-project-cover\.svg/);
    assert.match(html, /季度复盘/);
  });

  it("drops the redundant Home breadcrumb above the title", () => {
    const html = renderMyWorkPage({ locale: "en" });

    assert.match(html, /<h1>My Works<\/h1>/);
    assert.doesNotMatch(html, /class="eyebrow"/);
  });

  it("keeps the list visible and offers a retry when opening a work fails", () => {
    const html = renderMyWorkPage({
      locale: "en",
      error: messages.en.myWork.openFailed,
      errorDetail: '{"jsonrpc":"2.0","error":{"code":-32000}}',
    });

    assert.match(html, /This project could not be opened\./);
    assert.match(html, /季度复盘/);
    assert.match(html, /Show technical details/);
    assert.doesNotMatch(html, /jsonrpc/);
  });

  it("marks only the card being opened as busy", () => {
    const html = renderMyWorkPage({ openingWorkspaceDir: "/tmp/workspaces/done" });

    assert.match(html, /my-work-card busy/);
    assert.match(html, /正在打开/);
    assert.equal(html.match(/my-work-card-busy/g)?.length, 1);
  });

  it("gives the card menu trigger a name and popup semantics", () => {
    const html = renderMyWorkPage({ locale: "en" });

    assert.match(
      html,
      /class="my-work-card-menu-trigger" aria-label="Project actions" aria-haspopup="menu" aria-expanded="false"/,
    );
    assert.match(html, /lucide-ellipsis[^>]*aria-hidden="true"/);
  });
});

describe("MyWorkPage duplicate", () => {
  it("marks the freshly created copy so the user can find it in the list", () => {
    const html = renderMyWorkPage({
      onDuplicate: async () => undefined,
      highlightedWorkspaceId: "draft",
    });

    assert.match(html, /my-work-card highlighted/);
    assert.equal(html.match(/my-work-card highlighted/g)?.length, 1);
  });

  it("leaves every card unmarked when nothing was just duplicated", () => {
    const html = renderMyWorkPage({ onDuplicate: async () => undefined });

    assert.doesNotMatch(html, /highlighted/);
  });
});

describe("buildMyWorkMenuItems", () => {
  it("hides the duplicate action until a backend contract is wired up", () => {
    const items = buildMyWorkMenuItems(messages.en, { canDuplicate: false });

    assert.deepEqual(items.map((item) => item.id), ["rename", "delete"]);
  });

  it("offers duplicate once the backend contract is available", () => {
    const items = buildMyWorkMenuItems(messages.en, { canDuplicate: true });

    assert.deepEqual(items.map((item) => item.id), ["rename", "duplicate", "delete"]);
  });

  it("separates the destructive action from the ordinary ones", () => {
    const items = buildMyWorkMenuItems(messages.zh, { canDuplicate: true });
    const remove = items.at(-1);

    assert.equal(remove?.id, "delete");
    assert.equal(remove?.tone, "danger");
    assert.equal(remove?.dividerBefore, true);
    assert.ok(items.slice(0, -1).every((item) => !item.dividerBefore));
  });
});
