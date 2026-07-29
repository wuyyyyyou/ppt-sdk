import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PanelHeader } from "../../src/features/deck-workspace/components/PanelHeader.tsx";
import { buildGenerationViewState } from "../../src/features/deck-workspace/generationViewState.ts";
import { messages } from "../../src/i18n/messages.ts";

function renderPanelHeader(navigationDisabled?: boolean) {
  return renderToStaticMarkup(
    createElement(PanelHeader, {
      t: messages.zh,
      locale: "zh",
      setLocale: () => undefined,
      status: "草稿已就绪",
      onLibrary: () => undefined,
      onHome: () => undefined,
      navigationDisabled,
    }),
  );
}

const activeRun = {
  kind: "deck-generation" as const,
  runId: "run-1",
  officialWorkspaceDir: "/tmp/official",
  shadowWorkspaceDir: "/tmp/shadow",
  stopping: false,
  committing: false,
};

describe("PanelHeader", () => {
  it("shows the home entry as an icon instead of the wordmark", () => {
    const html = renderPanelHeader();

    assert.match(html, /class="header-home-btn"/);
    assert.match(html, /lucide-house/);
    assert.match(html, new RegExp(`aria-label="${messages.zh.myWork.home}"`));
    assert.doesNotMatch(html, /class="app-title"/);
    assert.doesNotMatch(html, new RegExp(messages.zh.appName));
  });

  it("keeps the workspace status next to the home entry", () => {
    assert.match(renderPanelHeader(), /class="status-pill">草稿已就绪/);
  });

  it("removes minimize and close controls", () => {
    const html = renderPanelHeader();

    assert.doesNotMatch(html, /title="最小化"/);
    assert.doesNotMatch(html, /title="关闭"/);
  });

  it("keeps the top entries clickable so the run can ask for confirmation", () => {
    const running = buildGenerationViewState({ loading: "none", progress: null, activeRun });
    const html = renderPanelHeader(running.navigationLocked);

    assert.equal(running.navigationLocked, false);
    assert.doesNotMatch(html, /disabled=""/);
  });

  it("locks the top entries only while committing or stopping", () => {
    const committing = buildGenerationViewState({
      loading: "none",
      progress: null,
      activeRun: { ...activeRun, committing: true },
    });
    const stopping = buildGenerationViewState({
      loading: "none",
      progress: null,
      activeRun: { ...activeRun, stopping: true },
    });

    assert.equal(committing.navigationLocked, true);
    assert.equal(stopping.navigationLocked, true);
    assert.match(renderPanelHeader(true), /disabled=""/);
  });
});
