import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Messages } from "../../src/i18n/messages.ts";
import { messages } from "../../src/i18n/messages.ts";
import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { GeneratingPage } from "../../src/features/deck-workspace/components/GeneratingPage.tsx";
import type { GenerationViewState } from "../../src/features/deck-workspace/generationViewState.ts";

const t = messages.zh as Messages;

function makeProgress(
  step: DeckGenerationProgress["step"],
  status = "accepted",
): DeckGenerationProgress {
  return {
    step,
    message: step,
    currentPageIndex: 0,
    totalPages: 1,
    pages: [
      {
        page_id: "page-1",
        index: 0,
        title: "Page 1",
        status,
        render_attempts: 0,
        render_attempt_limit: 10,
        visual_review_attempts: 0,
        visual_review_attempt_limit: 5,
        content_review_attempts: 0,
        content_review_attempt_limit: 5,
        agent_failures: 0,
        agent_failure_limit: 5,
        agent_infrastructure_failures: 0,
        last_error: status === "accepted" ? "" : "needs another pass",
      },
    ],
  };
}

function makeViewState(patch: Partial<GenerationViewState>): GenerationViewState {
  return {
    status: "running",
    isActive: true,
    isStopping: false,
    canStop: true,
    canResume: false,
    canBackToOutline: false,
    showStop: true,
    showResume: false,
    showBackToOutline: false,
    hasUnfinishedPages: false,
    ...patch,
  };
}

function renderPage(viewState: GenerationViewState, progress: DeckGenerationProgress) {
  return renderToStaticMarkup(
    createElement(GeneratingPage, {
      t,
      viewState,
      progress,
      history: [],
      onCancel: () => undefined,
      onBackToOutline: () => undefined,
      onResume: async () => undefined,
      canBackToOutline: true,
    }),
  );
}

describe("GeneratingPage controls", () => {
  it("shows running title and an enabled stop button while active", () => {
    const html = renderPage(
      makeViewState({ status: "running", canStop: true }),
      makeProgress("page-authoring", "authoring"),
    );

    assert.match(html, /生成中/);
    assert.match(html, />停止</);
    assert.doesNotMatch(html, /disabled="">停止/);
    assert.doesNotMatch(html, />继续生成</);
  });

  it("shows interrupted title, disabled stop, and resume action when no task is running", () => {
    const html = renderPage(
      makeViewState({
        status: "interrupted",
        isActive: false,
        canStop: false,
        canResume: true,
        showResume: true,
      }),
      makeProgress("failed", "render_failed"),
    );

    assert.match(html, /生成中断/);
    assert.match(html, /disabled="">停止/);
    assert.match(html, /继续生成/);
    assert.match(html, /generation-major-node interrupted/);
    assert.doesNotMatch(html, /generation-major-node failed/);
    assert.doesNotMatch(html, /创建演示文稿/);
    assert.doesNotMatch(html, /重跑本页/);
  });

  it("shows unresumable title and back-to-outline action without resume", () => {
    const html = renderPage(
      makeViewState({
        status: "unresumable",
        isActive: false,
        canStop: false,
        canResume: false,
        canBackToOutline: true,
        showResume: false,
        showBackToOutline: true,
      }),
      makeProgress("failed", "pending"),
    );

    assert.match(html, /无法继续生成/);
    assert.match(html, /disabled="">停止/);
    assert.match(html, />大纲</);
    assert.doesNotMatch(html, />继续生成</);
  });

  it("keeps research planning in the page planning major step", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("research-planning", "pending"),
    );

    assert.match(html, /<button class="generation-major-node active">[\s\S]*?<span>页面规划<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node pending">[\s\S]*?<span>逐页生成<\/span><\/button>/);
  });

  it("shows page-level research collection in the page generation major step", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("research-collection", "research_collecting"),
    );

    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>页面规划<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>准备文件<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node active">[\s\S]*?<span>逐页生成<\/span><\/button>/);
  });
});
