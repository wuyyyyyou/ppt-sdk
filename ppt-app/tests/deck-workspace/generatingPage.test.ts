import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Messages } from "../../src/i18n/messages.ts";
import { messages } from "../../src/i18n/messages.ts";
import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { GeneratingPage } from "../../src/features/deck-workspace/components/GeneratingPage.tsx";
import type { GenerationViewState } from "../../src/features/deck-workspace/generationViewState.ts";
import type { GenerationPagePreviews } from "../../src/features/deck-workspace/generationPagePreviews.ts";

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
    canResume: false,
    canBackToOutline: false,
    showResume: false,
    showBackToOutline: false,
    hasUnfinishedPages: false,
    resumeAction: "generation",
    runIntent: "generation",
    ...patch,
  };
}

function renderPage(
  viewState: GenerationViewState,
  progress: DeckGenerationProgress,
  pagePreviews: GenerationPagePreviews = {},
) {
  return renderToStaticMarkup(
    createElement(GeneratingPage, {
      t,
      viewState,
      progress,
      history: [],
      pagePreviews,
      pinnedPreviewPageId: null,
      onSelectPreviewPage: () => undefined,
      onBack: () => undefined,
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
      }),
      makeProgress("prepare", "pending"),
    );

    assert.match(html, /生成准备中/);
    assert.doesNotMatch(html, /生成中断/);
    assert.doesNotMatch(html, />继续生成</);
    assert.doesNotMatch(html, />停止</);
  });

  it("keeps a back entry at the bottom of the stage through every generation status", () => {
    const running = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("page-authoring", "authoring"),
    );
    const complete = renderPage(
      makeViewState({ status: "complete", isActive: false }),
      makeProgress("complete", "passed"),
    );

    for (const html of [running, complete]) {
      assert.match(html, /generation-page-footer"><button [^>]*class="secondary-btn" type="button">/);
      assert.doesNotMatch(html, /page-header-left"><button/);
    }
  });

  it("locks the back entry while the run can no longer be abandoned", () => {
    const html = renderPage(
      makeViewState({ status: "stopping", isStopping: true, navigationLocked: true }),
      makeProgress("page-authoring", "authoring"),
    );

    assert.match(html, /generation-page-footer"><button [^>]*class="secondary-btn" type="button" disabled=""/);
  });

  it("never offers a stop entry on the page", () => {
    for (const status of ["running", "stopping", "interrupted", "unresumable"] as const) {
      const html = renderPage(
        makeViewState({
          status,
          isActive: status === "running" || status === "stopping",
          isStopping: status === "stopping",
        }),
        makeProgress("page-authoring", "authoring"),
      );

      assert.doesNotMatch(html, /<button[^>]*>[^<]*停止/);
      assert.doesNotMatch(html, /aria-busy/);
    }
  });

  it("labels back as returning to the last version while refining", () => {
    const html = renderPage(
      makeViewState({ status: "running", runIntent: "refinement" }),
      makeProgress("page-authoring", "authoring"),
    );

    assert.match(html, /generation-page-footer"><button [^>]*class="secondary-btn" type="button">[\s\S]*?返回上一版/);
    assert.doesNotMatch(html, />返回</);
  });

  it("shows interrupted title and resume action when no task is running", () => {
    const html = renderPage(
      makeViewState({
        status: "interrupted",
        isActive: false,
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

  it("keeps research planning inside the authoring setup major step", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("research-planning", "pending"),
    );

    assert.match(html, /<li class="generation-major-node active" aria-current="step">[\s\S]*?<span>创作准备<\/span><\/li>/);
    assert.match(html, /<li class="generation-major-node pending">[\s\S]*?<span>逐页生成<\/span><\/li>/);
    assert.match(html, /<li class="generation-major-node pending">[\s\S]*?<span>最终预览<\/span><\/li>/);
  });

  it("shows Research Discovery detail while the timeline stays on authoring setup", () => {
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

    assert.match(html, /<li class="generation-major-node active" aria-current="step">[\s\S]*?<span>创作准备<\/span><\/li>/);
    assert.match(html, /事实收集/);
    assert.match(html, /判断是否需要网页资料/);
    assert.match(html, /Need current facts before authoring/);
  });

  it("orders the major timeline as authoring setup, page generation, final preview", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("research-discovery", "pending"),
    );
    const labels = [...html.matchAll(/<span>(创作准备|逐页生成|最终预览)<\/span>/g)]
      .map((match) => match[1]);

    assert.deepEqual(labels, ["创作准备", "逐页生成", "最终预览"]);
  });

  it("marks every major step done after generation is complete", () => {
    const html = renderPage(
      makeViewState({ status: "complete", isActive: false }),
      makeProgress("complete", "accepted"),
    );

    assert.match(html, /<li class="generation-major-node done">[\s\S]*?<span>最终预览<\/span><\/li>/);
    assert.doesNotMatch(html, /<li class="generation-major-node active"[\s\S]*?<span>最终预览<\/span><\/li>/);
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
    assert.doesNotMatch(html, /证据缺口/);
    assert.doesNotMatch(html, /汇总/);
    assert.doesNotMatch(html, /No current price source\./);
  });

  it("hides gap and summary sections while a research phase is expanded", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "running",
          summary: {
            facts: 1,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 1,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "running", gaps: ["A source is unavailable."] },
            { phase: "visual-decision", state: "waiting" },
            { phase: "visual-collection", state: "waiting" },
          ],
        },
      },
    );

    assert.match(html, /research-discovery-record active[\s\S]*aria-expanded="true"/);
    assert.doesNotMatch(html, /证据缺口/);
    assert.doesNotMatch(html, /汇总/);
    assert.doesNotMatch(html, /A source is unavailable\./);
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

      assert.match(html, /创作准备/);
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

    assert.match(html, /1\/2 页已通过/);
    assert.doesNotMatch(html, /2\/3 页已通过/);
    assert.doesNotMatch(html, /Deck-level discovery/);
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

  it("shows current research activity without rendering visual asset paths or URLs", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "running",
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
            { phase: "visual-decision", state: "completed" },
            {
              phase: "visual-collection",
              state: "running",
              activities: ["检索图片素材"],
              lines: ["已找到 8 个候选"],
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
          ],
        },
      },
    );

    assert.match(html, /检索图片素材/);
    assert.match(html, /已找到 8 个候选/);
    assert.doesNotMatch(html, /research-discovery-visual-asset/);
    assert.doesNotMatch(html, /<img /);
    assert.doesNotMatch(html, /https:\/\/images\.example\.com/);
    assert.doesNotMatch(html, /\/tmp\/evidence\/image-1\.png/);
    assert.doesNotMatch(html, /https:\/\/example\.com\/source-page/);
    assert.doesNotMatch(html, /Factory line photo/);
  });

  it("leads with the rendered page preview and keeps the run log underneath", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("page-authoring", "authoring"),
        totalPages: 2,
        pages: [
          { ...makeProgress("page-authoring", "accepted").pages[0], page_id: "page-1", index: 0, title: "开场" },
          { ...makeProgress("page-authoring", "authoring").pages[0], page_id: "page-2", index: 1, title: "现状" },
        ],
      },
      {
        "page-1": {
          pageId: "page-1",
          pageIndex: 0,
          title: "开场",
          screenshotPath: "/tmp/one.png",
          status: "ready",
          imageUpload: {
            transport: "host_upload",
            r2_key: "one",
            url: "https://example.test/one.webp",
            mime_type: "image/webp",
            size_bytes: 1,
          },
        },
      },
    );

    assert.match(
      html,
      /generation-stage-stack"><section class="generation-preview-panel"/,
    );
    // The preview leads and the progress panel follows it in document order.
    const previewIndex = html.indexOf("generation-preview-panel");
    const progressIndex = html.indexOf("generation-progress-panel");
    assert.ok(previewIndex > -1 && progressIndex > previewIndex, "preview should precede the run log");
    assert.match(html, /<img src="https:\/\/example\.test\/one\.webp"/);
  });

  it("uses the same status rail colors for persistent elements and research discovery", async () => {
    const css = await readFile(
      path.resolve("src/features/deck-workspace/styles/deck-workspace.css"),
      "utf8",
    );

    assert.match(
      css,
      /\.research-discovery-stage-group\.completed,\s*\.persistent-elements-stage-group\.completed\s*\{\s*box-shadow:\s*inset 3px 0 0 #16a34a;/,
    );
    assert.match(
      css,
      /\.research-discovery-stage-group\.active,\s*\.persistent-elements-stage-group\.active\s*\{\s*box-shadow:\s*inset 3px 0 0 rgba\(124, 108, 240, 0\.58\);/,
    );
    assert.match(
      css,
      /\.research-discovery-stage-group\.failed,\s*\.persistent-elements-stage-group\.failed\s*\{\s*box-shadow:\s*inset 3px 0 0 #dc2626;/,
    );
  });

  it("does not surface a failure the run is still recovering from", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      makeProgress("page-render", "render_fixing"),
    );

    assert.doesNotMatch(html, /needs another pass/);
    assert.doesNotMatch(html, /generation-page-error/);
    assert.doesNotMatch(html, /generation-stage-record failed/);
  });

  it("keeps the failure visible once the page itself has finally failed", () => {
    const html = renderPage(
      makeViewState({ status: "interrupted", isActive: false }),
      makeProgress("failed", "render_failed"),
    );

    assert.match(html, /generation-page-error/);
    assert.match(html, /generation-status-badge failed/);
  });

  it("renders Research Discovery above page records without a fake slide", () => {
    const html = renderPage(
      makeViewState({ status: "running" }),
      {
        ...makeProgress("research-collection", "pending"),
        researchDiscovery: {
          status: "running",
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
              state: "running",
              activities: ["读取网页研究进度"],
              lines: ["正在整理网页资料"],
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
            { phase: "visual-decision", state: "waiting" },
            { phase: "visual-collection", state: "waiting" },
          ],
        },
      },
    );

    assert.match(html, /事实收集[\s\S]*?Page 1/);
    assert.match(html, /读取网页研究进度/);
    assert.match(html, /正在整理网页资料/);
    assert.doesNotMatch(html, /1\. Deck-level web Research Discovery batch 1/);
  });
});
