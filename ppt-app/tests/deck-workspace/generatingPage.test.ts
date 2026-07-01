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
            { phase: "visual-decision", state: "completed" },
            { phase: "visual-collection", state: "completed" },
            { phase: "visual-curation", state: "completed" },
            { phase: "evidence-page-planning", state: "completed" },
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

  it("does not show accepted page counts during deck-level Research Discovery steps", () => {
    for (const step of ["research-discovery", "research-collection", "research-curation", "evidence-page-planning"] as const) {
      const html = renderPage(
        makeViewState({ status: "running" }),
        {
          ...makeProgress(step, "pending"),
          message: "0/1 页已通过",
        },
      );

      assert.match(html, /事实收集|判断网页资料需求|搜索并抓取网页资料|筛选事实证据|证据感知页面规划/);
      assert.doesNotMatch(html, /0\/1 页通过/);
      assert.doesNotMatch(html, /0\/1 页已通过/);
    }
  });

  it("shows accepted page counts during page generation using real pages only", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("page-authoring", "authoring"),
        totalPages: 2,
        pages: [
          {
            page_id: "discovery-web-1",
            index: 0,
            title: "Deck-level discovery",
            status: "accepted",
            render_attempts: 0,
            render_attempt_limit: 10,
            visual_review_attempts: 0,
            visual_review_attempt_limit: 5,
            content_review_attempts: 0,
            content_review_attempt_limit: 5,
            agent_failures: 0,
            agent_failure_limit: 5,
            agent_infrastructure_failures: 0,
          },
          {
            page_id: "page-1",
            index: 0,
            title: "Page 1",
            status: "accepted",
            render_attempts: 0,
            render_attempt_limit: 10,
            visual_review_attempts: 0,
            visual_review_attempt_limit: 5,
            content_review_attempts: 0,
            content_review_attempt_limit: 5,
            agent_failures: 0,
            agent_failure_limit: 5,
            agent_infrastructure_failures: 0,
          },
          {
            page_id: "page-2",
            index: 1,
            title: "Page 2",
            status: "authoring",
            render_attempts: 0,
            render_attempt_limit: 10,
            visual_review_attempts: 0,
            visual_review_attempt_limit: 5,
            content_review_attempts: 0,
            content_review_attempt_limit: 5,
            agent_failures: 0,
            agent_failure_limit: 5,
            agent_infrastructure_failures: 0,
          },
        ],
      },
    );

    assert.match(html, /1\/2 页通过/);
    assert.doesNotMatch(html, /2\/3 页通过/);
    assert.doesNotMatch(html, /Deck-level discovery/);
  });

  it("keeps deck-level Research Discovery header free of aggregate count summary", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-curation", "pending"),
        researchDiscovery: {
          status: "active",
          summary: {
            facts: 11,
            derivedInsights: 4,
            visualAssets: 5,
            gaps: 17,
            rejectedMaterial: 12,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "completed" },
            { phase: "web-curation", state: "active", counts: { facts: 11, derivedInsights: 4 } },
            { phase: "visual-decision", state: "completed" },
            { phase: "visual-collection", state: "completed" },
            { phase: "visual-curation", state: "completed", counts: { visualAssets: 5, rejectedMaterial: 12 } },
            { phase: "evidence-page-planning", state: "completed", counts: { gaps: 17 } },
          ],
        },
      },
    );

    assert.doesNotMatch(html, /事实: 11 · 洞察: 4 · 图片: 5 · 缺口: 17 · 拒绝: 12/);
    assert.doesNotMatch(html, /research-discovery-summary/);
    assert.match(html, /汇总[\s\S]*?事实: 11/);
  });

  it("keeps completed Research Discovery phases with gaps collapsed by default", () => {
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

    assert.match(html, /判断网页资料需求[\s\S]*?aria-expanded="false"/);
    assert.match(html, /筛选事实证据[\s\S]*?aria-expanded="false"/);
    assert.doesNotMatch(html, /No current price source/);
  });

  it("does not render selected visual asset cards, thumbnails, paths, or URLs in the generating page", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-curation", "pending"),
        researchDiscovery: {
          status: "completed",
          summary: {
            facts: 0,
            derivedInsights: 0,
            visualAssets: 1,
            gaps: 0,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "completed" },
            { phase: "web-curation", state: "completed" },
            { phase: "visual-decision", state: "completed" },
            {
              phase: "visual-collection",
              state: "active",
              queries: [
                {
                  kind: "visual",
                  query: "factory automation photo",
                  status: "collected",
                  resultCount: 8,
                  downloadCount: 3,
                },
              ],
            },
            {
              phase: "visual-curation",
              state: "completed",
              visualAssets: [
                {
                  id: "asset-1",
                  thumbnailUrl: "https://images.example.com/thumb.png",
                  imageUrl: "https://images.example.com/full.png",
                  filePath: "/tmp/evidence/image-1.png",
                  pageUrl: "https://example.com/source-page",
                  reason: "Matches page intent",
                  visualSummary: "Factory line photo",
                },
              ],
              counts: { visualAssets: 1 },
            },
            { phase: "evidence-page-planning", state: "completed" },
          ],
        },
      },
    );

    assert.match(html, /已收集: factory automation photo \(8 条结果 · 下载 3 张\)/);
    assert.doesNotMatch(html, /research-discovery-visual-asset/);
    assert.doesNotMatch(html, /<img /);
    assert.doesNotMatch(html, /https:\/\/images\.example\.com/);
    assert.doesNotMatch(html, /\/tmp\/evidence\/image-1\.png/);
    assert.doesNotMatch(html, /https:\/\/example\.com\/source-page/);
    assert.doesNotMatch(html, /Factory line photo/);
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
