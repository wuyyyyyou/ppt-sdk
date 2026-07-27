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
    resumeAction: "generation",
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
  it("shows preparing instead of interrupted before the generation run is active", () => {
    const html = renderPage(
      makeViewState({
        status: "preparing",
        isActive: false,
        canStop: false,
        showStop: false,
      }),
      makeProgress("prepare", "pending"),
    );

    assert.match(html, /生成准备中/);
    assert.doesNotMatch(html, /生成中断/);
    assert.doesNotMatch(html, />继续生成</);
    assert.doesNotMatch(html, />停止</);
  });

  it("shows running title without exposing the unfinished stop action", () => {
    const html = renderPage(
      makeViewState({ status: "running", canStop: true }),
      makeProgress("page-authoring", "authoring"),
    );

    assert.match(html, /生成中/);
    assert.doesNotMatch(html, />停止</);
    assert.doesNotMatch(html, />继续生成</);
  });

  it("shows interrupted title and resume action when no task is running", () => {
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
    assert.doesNotMatch(html, />停止</);
    assert.match(html, /继续生成/);
    assert.match(html, /generation-major-node interrupted/);
    assert.doesNotMatch(html, /generation-major-node failed/);
    assert.doesNotMatch(html, /创建演示文稿/);
    assert.doesNotMatch(html, /重跑本页/);
  });

  it("shows continue refinement for page refinement resume", () => {
    const html = renderPage(
      makeViewState({
        status: "interrupted",
        isActive: false,
        canStop: false,
        canResume: true,
        showResume: true,
        resumeAction: "refinement",
      }),
      makeProgress("interrupted", "accepted"),
    );

    assert.match(html, /继续修改/);
    assert.doesNotMatch(html, /继续生成/);
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
    assert.doesNotMatch(html, />停止</);
    assert.match(html, />大纲</);
    assert.doesNotMatch(html, />继续生成</);
  });

  it("shows Research Discovery as its own major step after file preparation", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-discovery", "pending"),
        researchDiscovery: {
          status: "running",
          summary: {
            facts: 0,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 0,
            rejectedMaterial: 0,
          },
          records: [
            {
              phase: "web-decision",
              state: "running",
              rationale: "Need current facts before authoring.",
            },
            { phase: "web-collection", state: "waiting" },
            { phase: "visual-decision", state: "waiting" },
            { phase: "visual-collection", state: "waiting" },
          ],
        },
      },
    );

    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>页面规划<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>准备文件<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node active">[\s\S]*?<span>事实收集<\/span><\/button>/);
    assert.match(html, /事实收集/);
    assert.match(html, /判断是否需要网页资料/);
    assert.match(html, /Need current facts before authoring/);
  });

  it("orders major timeline as planning, preparation, discovery, page generation, final preview", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("research-discovery", "pending"),
    );
    const labels = [...html.matchAll(/<span>(页面规划|准备文件|事实收集|逐页生成|最终预览)<\/span>/g)]
      .map((match) => match[1]);

    assert.deepEqual(labels, ["页面规划", "准备文件", "事实收集", "逐页生成", "最终预览"]);
  });

  it("marks every major step done after generation is complete", () => {
    const html = renderPage(
      makeViewState({ status: "complete", isActive: false, showStop: false }),
      makeProgress("complete", "accepted"),
    );

    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>最终预览<\/span><\/button>/);
    assert.doesNotMatch(html, /<button class="generation-major-node active">[\s\S]*?<span>最终预览<\/span><\/button>/);
    assert.doesNotMatch(html, /generation-running-icon/);
  });

  it("shows Research Discovery gaps as completed green badges instead of partial warning styling", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "warning",
          summary: {
            facts: 1,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 1,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "warning", gaps: ["No current price source."] },
            { phase: "visual-decision", state: "skipped" },
            { phase: "visual-collection", state: "skipped" },
          ],
        },
      },
    );

    assert.match(html, /generation-status-badge completed">已完成/);
    assert.match(html, /research-discovery-stage-group completed/);
    assert.doesNotMatch(html, /research-discovery-stage-group warning/);
    assert.doesNotMatch(html, /generation-status-badge warning/);
    assert.doesNotMatch(html, /部分完成/);
  });

  it("keeps deck-level Research Discovery header free of aggregate count summary", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "running",
          summary: {
            facts: 11,
            derivedInsights: 4,
            visualAssets: 5,
            gaps: 17,
            rejectedMaterial: 12,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "running" },
            { phase: "visual-decision", state: "waiting" },
            { phase: "visual-collection", state: "waiting" },
          ],
        },
      },
    );

    assert.doesNotMatch(html, /事实: 11 · 洞察: 4 · 图片: 5 · 缺口: 17 · 拒绝: 12/);
    assert.doesNotMatch(html, /research-discovery-summary/);
  });

  it("keeps completed Research Discovery phases with gaps collapsed by default", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "warning",
          summary: {
            facts: 1,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 1,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "warning", gaps: ["No current price source."] },
            { phase: "visual-decision", state: "waiting" },
            { phase: "visual-collection", state: "waiting" },
          ],
        },
      },
    );

    assert.match(html, /判断是否需要网页资料[\s\S]*?aria-expanded="false"/);
    assert.match(html, /搜索并整理网页资料[\s\S]*?aria-expanded="false"/);
    assert.doesNotMatch(html, /No current price source/);
  });

});
