import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { messages } from "../../src/i18n/messages.ts";
import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { buildPageGenerationStageRecords } from "../../src/features/deck-workspace/generationStageRecords.ts";
import type { GenerationStreamSnapshot } from "../../src/features/deck-workspace/types.ts";

function makeProgress(overrides: Partial<DeckGenerationProgress> = {}): DeckGenerationProgress {
  return {
    step: "page-authoring",
    message: "Generating 2 pages",
    currentPageIndex: 0,
    totalPages: 2,
    pages: [
      {
        page_id: "page-02",
        index: 1,
        title: "Second",
        status: "rendering",
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
        page_id: "page-01",
        index: 0,
        title: "First",
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
    ...overrides,
  };
}

describe("Page Generation Stage Records", () => {
  it("groups active streams and completed snapshots by page", () => {
    const progress = makeProgress({
      activeStreams: [
        {
          run_id: "run-1",
          kind: "authoring",
          page_id: "page-01",
          page_index: 0,
          status: "正在思考第 1 页的表达",
          lines: ["writing"],
          activities: ["read outline"],
        },
      ],
    });
    const history: GenerationStreamSnapshot[] = [
      {
        id: "page-visual-review:page-01:review-1",
        phase: "page-visual-review",
        kind: "page-visual-review",
        label: "第 1 页 · page-visual-review",
        page_id: "page-01",
        page_index: 0,
        status: "completed",
        message: "done",
        lines: ["reviewed"],
        activities: [],
        updated_at: "2026-06-02T00:00:00.000Z",
      },
    ];

    const records = buildPageGenerationStageRecords({
      t: messages.zh,
      progress,
      history,
    });

    assert.deepEqual(records.map((record) => record.pageId), ["page-01", "page-02"]);
    assert.equal(records[0].stages.some((stage) => stage.label === "正在思考第 1 页的表达"), true);
    assert.equal(records[0].stages.some((stage) => stage.label === "页面视觉检查"), true);
    assert.equal(records[0].stages.some((stage) => stage.lines.includes("writing")), true);
    assert.equal(records[0].stages.some((stage) => stage.lines.includes("reviewed")), true);
  });

  it("does not duplicate the active stream when history has the same snapshot id", () => {
    const progress = makeProgress({
      activeStreams: [
        {
          run_id: "run-1",
          kind: "authoring",
          page_id: "page-01",
          page_index: 0,
          status: "Thinking through page 1",
          lines: ["active"],
          activities: [],
        },
      ],
    });
    const history: GenerationStreamSnapshot[] = [
      {
        id: "page-authoring:page-01:run-1",
        phase: "page-authoring",
        kind: "authoring",
        label: "Page 1 · authoring",
        page_id: "page-01",
        page_index: 0,
        status: "Thinking through page 1",
        message: "Generating",
        lines: ["older"],
        activities: [],
        updated_at: "2026-06-02T00:00:00.000Z",
      },
    ];

    const records = buildPageGenerationStageRecords({
      t: messages.en,
      progress,
      history,
    });
    const authoringStages = records[0].stages.filter((stage) => stage.stageKey === "authoring");

    assert.equal(authoringStages.length, 1);
    assert.deepEqual(authoringStages[0].lines, ["active"]);
  });

  it("creates a truthful tool stage for rendering without stream output", () => {
    const records = buildPageGenerationStageRecords({
      t: messages.en,
      progress: makeProgress(),
      history: [],
    });
    const secondPage = records.find((record) => record.pageId === "page-02");
    const renderingStage = secondPage?.stages.find((stage) => stage.stageKey === "rendering");

    assert.equal(renderingStage?.label, "Rendering page");
    assert.equal(renderingStage?.hasStream, false);
    assert.equal(renderingStage?.state, "active");
  });

  it("uses locale labels instead of raw internal statuses", () => {
    const zhRecords = buildPageGenerationStageRecords({
      t: messages.zh,
      progress: makeProgress(),
      history: [],
    });
    const enRecords = buildPageGenerationStageRecords({
      t: messages.en,
      progress: makeProgress(),
      history: [],
    });

    assert.equal(zhRecords[0].pageStatusLabel, "正在思考这一页");
    assert.equal(enRecords[0].pageStatusLabel, "Thinking through this page");
    assert.notEqual(zhRecords[0].pageStatusLabel, "authoring");
    assert.notEqual(enRecords[0].pageStatusLabel, "authoring");
  });

  it("labels split research curation streams by evidence type", () => {
    const records = buildPageGenerationStageRecords({
      t: messages.zh,
      progress: makeProgress({
        step: "research-curation",
        activeStreams: [
          {
            run_id: "research-web",
            kind: "web-research-curation",
            page_id: "page-01",
            page_index: 0,
            status: "正在筛选第 1 页事实证据",
            lines: ["curating"],
            activities: ["read source"],
          },
          {
            run_id: "research-visual",
            kind: "visual-research-curation",
            page_id: "page-01",
            page_index: 0,
            status: "正在筛选第 1 页图片素材",
            lines: ["checking image"],
            activities: ["analyzed image"],
          },
        ],
      }),
      history: [],
    });

    const researchStages = records[0].stages.filter((stage) =>
      stage.stageKey === "webResearchCuration" || stage.stageKey === "visualResearchCuration"
    );
    assert.deepEqual(
      researchStages.map((stage) => stage.stageKey),
      ["webResearchCuration", "visualResearchCuration"],
    );
    assert.deepEqual(
      researchStages.map((stage) => stage.label),
      ["正在筛选第 1 页事实证据", "正在筛选第 1 页图片素材"],
    );
    assert.deepEqual(researchStages[1].activities, ["analyzed image"]);
  });

  it("keeps legacy research curation snapshots on the aggregate evidence label", () => {
    const records = buildPageGenerationStageRecords({
      t: messages.en,
      progress: makeProgress({ activeStreams: [] }),
      history: [
        {
          id: "research-curation:page-01:legacy-run",
          phase: "research-curation",
          kind: "research-curation",
          label: "Page 1 · research-curation",
          page_id: "page-01",
          page_index: 0,
          status: "completed",
          message: "done",
          lines: ["curated"],
          activities: [],
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ],
    });

    const researchStage = records[0].stages.find((stage) => stage.stageKey === "researchCuration");
    assert.equal(researchStage?.label, "Curating evidence");
  });

  it("shows page-level research collection status instead of waiting", () => {
    const records = buildPageGenerationStageRecords({
      t: messages.zh,
      progress: makeProgress({
        pages: [
          {
            page_id: "page-03",
            index: 2,
            title: "Research page",
            status: "research_collecting",
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
      }),
      history: [],
    });

    assert.equal(records[0].pageStatusLabel, "正在搜索并抓取资料");
    assert.equal(records[0].stages[0].stageKey, "researchCollection");
    assert.equal(records[0].stages[0].state, "active");
  });

  it("uses aggregate evidence wording for page-level research curation status", () => {
    const records = buildPageGenerationStageRecords({
      t: messages.zh,
      progress: makeProgress({
        pages: [
          {
            page_id: "page-03",
            index: 2,
            title: "Research page",
            status: "research_curating",
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
      }),
      history: [],
    });

    assert.equal(records[0].pageStatusLabel, "正在筛选证据");
    assert.equal(records[0].stages[0].label, "正在筛选证据");
    assert.equal(records[0].stages[0].stageKey, "researchCuration");
  });

  it("orders repeated review and fix stages by their actual timeline", () => {
    const progress = makeProgress({
      step: "page-visual-review",
      message: "正在生成 1 页，0/1 页已通过",
      totalPages: 1,
      pages: [
        {
          page_id: "page-01",
          index: 0,
          title: "First",
          status: "visual_review",
          render_attempts: 0,
          render_attempt_limit: 10,
          visual_review_attempts: 1,
          visual_review_attempt_limit: 5,
          content_review_attempts: 0,
          content_review_attempt_limit: 5,
          agent_failures: 0,
          agent_failure_limit: 5,
          agent_infrastructure_failures: 0,
        },
      ],
      activeStreams: [
        {
          run_id: "page-01-page-visual-review-run-2",
          kind: "page-visual-review",
          page_id: "page-01",
          page_index: 0,
          status: "正在检查页面视觉",
          lines: ["reviewing again"],
          activities: [],
          started_at: "2026-06-02T00:00:03.000Z",
          updated_at: "2026-06-02T00:00:04.000Z",
        },
      ],
    });
    const history: GenerationStreamSnapshot[] = [
      {
        id: "page-visual-review:page-01:run-1",
        phase: "page-visual-review",
        kind: "page-visual-review",
        label: "第 1 页 · page-visual-review",
        page_id: "page-01",
        page_index: 0,
        status: "completed",
        message: "done",
        lines: ["first review"],
        activities: [],
        updated_at: "2026-06-02T00:00:01.000Z",
      },
      {
        id: "page-authoring:page-01:fix-1",
        phase: "page-authoring",
        kind: "visual-review-fix",
        label: "第 1 页 · visual-review-fix",
        page_id: "page-01",
        page_index: 0,
        status: "completed",
        message: "done",
        lines: ["fixed visuals"],
        activities: [],
        updated_at: "2026-06-02T00:00:02.000Z",
      },
    ];

    const records = buildPageGenerationStageRecords({
      t: messages.zh,
      progress,
      history,
    });

    assert.deepEqual(
      records[0].stages.map((stage) => stage.stageKey),
      ["visualReview", "visualReviewFix", "visualReview"],
    );
    assert.equal(records[0].stages.at(-1)?.state, "active");
  });
});
