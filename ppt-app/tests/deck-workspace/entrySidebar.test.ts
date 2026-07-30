import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EntrySidebar } from "../../src/features/deck-workspace/components/EntrySidebar.tsx";
import { EntryTopControls } from "../../src/features/deck-workspace/components/EntryTopControls.tsx";
import type { PageId } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

function renderEntrySidebar(page: PageId, collapsed = false) {
  return renderToStaticMarkup(
    createElement(EntrySidebar, {
      t: messages.zh,
      page,
      collapsed,
      onToggleCollapsed: () => undefined,
      onHome: () => undefined,
      onMyWork: () => undefined,
    }),
  );
}

function renderEntryTopControls() {
  return renderToStaticMarkup(
    createElement(EntryTopControls, {
      t: messages.zh,
      locale: "zh" as const,
      setLocale: () => undefined,
      onSettings: () => undefined,
    }),
  );
}

describe("EntrySidebar", () => {
  it("carries the brand as text only, without the leading icon", () => {
    const html = renderEntrySidebar("main");
    const brand = html.slice(html.indexOf("entry-sidebar-brand"), html.indexOf("entry-sidebar-nav"));

    assert.match(brand, new RegExp(messages.zh.appName));
    assert.doesNotMatch(brand, /lucide-presentation/);
  });

  it("marks the current entry page", () => {
    assert.match(renderEntrySidebar("main"), /class="active" aria-current="page"/);
    assert.equal(renderEntrySidebar("my-work").match(/aria-current="page"/g)?.length, 1);
  });

  it("offers a collapse toggle that reports the expanded state", () => {
    const html = renderEntrySidebar("main");

    assert.match(html, /entry-sidebar-toggle/);
    assert.match(html, new RegExp(`aria-label="${messages.zh.controls.collapseSidebar}"`));
    assert.match(html, /aria-expanded="true"/);
  });

  it("leads the brand row with the toggle so it lines up with the nav icons", () => {
    const html = renderEntrySidebar("main");
    const row = html.slice(html.indexOf("entry-sidebar-brand"), html.indexOf("entry-sidebar-nav"));

    assert.ok(
      row.indexOf("entry-sidebar-toggle") < row.indexOf("app-title"),
      "the toggle has to come before the wordmark",
    );
  });

  it("drops the labels but keeps the links reachable when collapsed", () => {
    const html = renderEntrySidebar("main", true);

    assert.match(html, /class="entry-sidebar collapsed"/);
    // The landmark keeps its accessible name; only the visible wordmark goes away.
    assert.doesNotMatch(html, /class="app-title"/);
    assert.match(html, new RegExp(`aria-label="${messages.zh.myWork.title}"`));
    assert.match(html, new RegExp(`aria-label="${messages.zh.controls.expandSidebar}"`));
    assert.match(html, /aria-expanded="false"/);
  });
});

describe("EntryTopControls", () => {
  it("puts settings and the locale switch in the top right of the content column", () => {
    const html = renderEntryTopControls();

    assert.match(html, /entry-topbar/);
    assert.match(html, new RegExp(messages.zh.controls.library));
    assert.match(html, /lang-switch/);
  });
});
