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
    assert.match(html, /<button class="generation-major-node pending">[\s\S]*?<span>事实收集<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node pending">[\s\S]*?<span>逐页生成<\/span><\/button>/);
  });

  it("shows Research Discovery as its own major step after file preparation", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-discovery", "pending"),
        researchDiscovery: {
          status: "active",
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
              state: "active",
              rationale: "Need current facts before authoring.",
            },
            { phase: "web-collection", state: "pending" },
            { phase: "web-curation", state: "pending" },
            { phase: "visual-decision", state: "pending" },
            { phase: "visual-collection", state: "pending" },
            { phase: "visual-curation", state: "pending" },
            { phase: "evidence-page-planning", state: "pending" },
          ],
        },
      },
    );

    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>页面规划<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node done">[\s\S]*?<span>准备文件<\/span><\/button>/);
    assert.match(html, /<button class="generation-major-node active">[\s\S]*?<span>事实收集<\/span><\/button>/);
    assert.match(html, /事实收集/);
    assert.match(html, /判断网页资料需求/);
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

  it("uses a warning badge for partial Research Discovery instead of failed styling", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-curation", "pending"),
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
            { phase: "web-collection", state: "completed" },
            { phase: "web-curation", state: "warning", gaps: ["No current price source."] },
            { phase: "visual-decision", state: "pending" },
            { phase: "visual-collection", state: "pending" },
            { phase: "visual-curation", state: "pending" },
            { phase: "evidence-page-planning", state: "pending" },
          ],
        },
      },
    );

    assert.match(html, /generation-status-badge warning/);
    assert.doesNotMatch(html, /generation-status-badge failed">部分完成/);
  });

  it("renders Research Discovery above page records without a fake slide", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-curation", "pending"),
        activeStreams: [
          {
            run_id: "research-web",
            kind: "web-research-curation",
            page_id: "discovery-web-1",
            page_index: 0,
            status: "正在筛选资料证据",
            lines: ["筛选事实证据流"],
            activities: ["读取抓取索引"],
          },
        ],
        researchDiscovery: {
          status: "active",
          summary: {
            facts: 1,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 0,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed", rationale: "Need source-backed facts." },
            {
              phase: "web-collection",
              state: "completed",
              queries: [
                {
                  kind: "web",
                  query: "EV market 2026",
                  status: "collected",
                  resultCount: 6,
                  fetchCount: 4,
                  sources: [{ title: "IEA", url: "https://example.com/iea" }],
                },
              ],
            },
            { phase: "web-curation", state: "active" },
            { phase: "visual-decision", state: "pending" },
            { phase: "visual-collection", state: "pending" },
            { phase: "visual-curation", state: "pending" },
            { phase: "evidence-page-planning", state: "pending" },
          ],
        },
      },
    );

    assert.match(html, /事实收集[\s\S]*?Page 1/);
    assert.match(html, /筛选事实证据流/);
    assert.doesNotMatch(html, /1\. Deck-level web Research Discovery batch 1/);
  });
});
