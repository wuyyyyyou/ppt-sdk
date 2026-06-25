import assert from "node:assert/strict";
import test from "node:test";
import type { DeckRefinementIntentReviewResult } from "../src/ai/types";
import type { PagePlan, ResearchPlan, WorkspaceOutline } from "../src/api/types";
import {
  alignDeckRefinementPagePlanToOutline,
  mergeDeckRefinementResearchPlan,
  reconcileDeckRefinement,
} from "../src/features/deck-generation/deckRefinementWorkflow";

const baseOutline: WorkspaceOutline = {
  version: 2,
  title: "Deck",
  output_language: "中文",
  status: "confirmed",
  items: [
    { title: "One", outline: "First page" },
    { title: "Two", outline: "Second page" },
    { title: "Three", outline: "Third page" },
  ],
  source: {
    prompt: "Build a deck",
    context: [],
    setting: { output_language: "中文" },
  },
  updated_at: "2026-01-01T00:00:00.000Z",
};

const basePagePlan: PagePlan = {
  version: 1,
  status: "prepared",
  title: "Deck",
  source: {
    outline_updated_at: baseOutline.updated_at,
    template_group: "default",
    template_manifest_path: "/workspace/template/manifest.json",
    generated_by: "test",
  },
  pages: [
    {
      page_id: "page-01",
      index: 0,
      title: "One",
      outline: "First page",
      blueprint_id: "cover",
      blueprint_source: "./blueprints/Cover.tsx",
      slide_path: "./slides/page-01.tsx",
      data_path: "./data/page-01.json",
      manifest_slide_id: "page-01",
      reason: "Existing cover.",
    },
    {
      page_id: "page-02",
      index: 1,
      title: "Two",
      outline: "Second page",
      blueprint_id: "content",
      blueprint_source: "./blueprints/Content.tsx",
      slide_path: "./slides/page-02.tsx",
      data_path: "./data/page-02.json",
      manifest_slide_id: "page-02",
      reason: "Existing content.",
    },
    {
      page_id: "page-03",
      index: 2,
      title: "Three",
      outline: "Third page",
      blueprint_id: "closing",
      blueprint_source: "./blueprints/Closing.tsx",
      slide_path: "./slides/page-03.tsx",
      data_path: "./data/page-03.json",
      manifest_slide_id: "page-03",
      reason: "Existing closing.",
    },
  ],
  updated_at: "2026-01-01T00:00:00.000Z",
};

function proceedReview(patch: Partial<DeckRefinementIntentReviewResult>): DeckRefinementIntentReviewResult {
  return {
    route: "proceed",
    output_language_change: { changed: false },
    operations: basePagePlan.pages.map((page) => ({
      op: "keep" as const,
      page_id: page.page_id,
      reason: "Keep.",
    })),
    reason: "Proceed.",
    ...patch,
  };
}

test("same-count update preserves retained page identity and targets only changed page", () => {
  const result = reconcileDeckRefinement({
    instruction: "优化第二页表达",
    outline: baseOutline,
    pagePlan: basePagePlan,
    now: "2026-01-02T00:00:00.000Z",
    review: proceedReview({
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
        { op: "update", page_id: "page-02", title: "Two Updated", outline: "Updated second page", reason: "Intent changed." },
        { op: "keep", page_id: "page-03", reason: "Keep." },
      ],
    }),
  });

  const updated = result.pagePlan.pages[1];
  assert.equal(updated.page_id, "page-02");
  assert.equal(updated.blueprint_id, "content");
  assert.equal(updated.blueprint_source, "./blueprints/Content.tsx");
  assert.equal(updated.slide_path, "./slides/page-02.tsx");
  assert.equal(updated.data_path, "./data/page-02.json");
  assert.equal(updated.manifest_slide_id, "page-02");
  assert.equal(updated.title, "Two Updated");
  assert.deepEqual(result.targetPageIds, ["page-02"]);
});

test("output language change targets every retained page and updates outline language", () => {
  const result = reconcileDeckRefinement({
    instruction: "把整套改成英文",
    outline: baseOutline,
    pagePlan: basePagePlan,
    now: "2026-01-02T00:00:00.000Z",
    review: proceedReview({
      output_language_change: {
        changed: true,
        output_language: "English",
        reason: "Explicit language change.",
      },
    }),
  });

  assert.equal(result.outline.output_language, "English");
  assert.deepEqual(result.targetPageIds, ["page-01", "page-02", "page-03"]);
});

test("add operation allocates a new page identity and preserves retained pages", () => {
  const result = reconcileDeckRefinement({
    instruction: "新增一页案例",
    outline: baseOutline,
    pagePlan: basePagePlan,
    now: "2026-01-02T00:00:00.000Z",
    addedPagePlan: {
      ...basePagePlan,
      pages: [{
        ...basePagePlan.pages[1],
        page_id: "added-01",
        title: "Case",
        outline: "Case page",
        blueprint_id: "content",
        blueprint_source: "./blueprints/Content.tsx",
        reason: "Selected for new page.",
      }],
    },
    review: proceedReview({
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
        { op: "add", title: "Case", outline: "Case page", reason: "Add case page." },
        { op: "keep", page_id: "page-02", reason: "Keep." },
        { op: "keep", page_id: "page-03", reason: "Keep." },
      ],
    }),
  });

  assert.equal(result.pagePlan.pages.length, 4);
  assert.equal(result.pagePlan.pages[0].page_id, "page-01");
  assert.equal(result.pagePlan.pages[2].page_id, "page-02");
  assert.deepEqual(result.addedPageIds, ["page-04"]);
  assert.equal(result.pagePlan.pages[1].page_id, "page-04");
  assert.equal(result.pagePlan.pages[1].blueprint_id, "content");
  assert.match(result.pagePlan.pages[1].slide_path, /^\.\/slides\/page-04/);
  assert.deepEqual(result.targetPageIds, ["page-04"]);
});

test("add operation falls back to page id slug for non-ascii titles", () => {
  const result = reconcileDeckRefinement({
    instruction: "新增中文页",
    outline: baseOutline,
    pagePlan: basePagePlan,
    now: "2026-01-02T00:00:00.000Z",
    addedPagePlan: {
      ...basePagePlan,
      pages: [{
        ...basePagePlan.pages[1],
        title: "冷门与奇迹：本届世界杯最令人意想不到的对决",
        outline: "新增中文页",
      }],
    },
    review: proceedReview({
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
        { op: "keep", page_id: "page-02", reason: "Keep." },
        { op: "keep", page_id: "page-03", reason: "Keep." },
        {
          op: "add",
          title: "冷门与奇迹：本届世界杯最令人意想不到的对决",
          outline: "新增中文页",
          reason: "Add Chinese page.",
        },
      ],
    }),
  });

  const added = result.pagePlan.pages[3];
  assert.equal(added.page_id, "page-04");
  assert.equal(added.slide_path, "./slides/page-04.tsx");
  assert.equal(added.data_path, "./data/page-04.json");
  assert.equal(added.manifest_slide_id, "page-04");
});

test("add operation preserves readable ascii title segment and resolves collisions", () => {
  const result = reconcileDeckRefinement({
    instruction: "新增英文页",
    outline: baseOutline,
    pagePlan: {
      ...basePagePlan,
      pages: [
        ...basePagePlan.pages,
        {
          ...basePagePlan.pages[1],
          page_id: "page-04",
          index: 3,
          title: "Existing",
          outline: "Existing page",
          slide_path: "./slides/page-05-market-update.tsx",
          data_path: "./data/page-05-market-update.json",
          manifest_slide_id: "page-05-market-update",
        },
      ],
    },
    now: "2026-01-02T00:00:00.000Z",
    addedPagePlan: {
      ...basePagePlan,
      pages: [{
        ...basePagePlan.pages[1],
        title: "Market Update",
        outline: "Market update page",
      }],
    },
    review: proceedReview({
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
        { op: "keep", page_id: "page-02", reason: "Keep." },
        { op: "keep", page_id: "page-03", reason: "Keep." },
        { op: "keep", page_id: "page-04", reason: "Keep." },
        {
          op: "add",
          title: "Market Update",
          outline: "Market update page",
          reason: "Add market update.",
        },
      ],
    }),
  });

  const added = result.pagePlan.pages[4];
  assert.equal(added.page_id, "page-05");
  assert.equal(added.slide_path, "./slides/page-05-market-update-2.tsx");
  assert.equal(added.data_path, "./data/page-05-market-update-2.json");
  assert.equal(added.manifest_slide_id, "page-05-market-update-2");
});

test("page plan can be aligned to persisted outline timestamp", () => {
  const persistedOutline = {
    ...baseOutline,
    updated_at: "2026-01-03T00:00:00.000Z",
  };
  const result = alignDeckRefinementPagePlanToOutline({
    pagePlan: basePagePlan,
    outline: persistedOutline,
  });

  assert.equal(result.source.outline_updated_at, persistedOutline.updated_at);
  assert.notEqual(basePagePlan.source.outline_updated_at, persistedOutline.updated_at);
});

test("deck refinement research plan inherits outline timestamp from page plan", () => {
  const existingPlan: ResearchPlan = {
    version: 1,
    status: "planned",
    title: "Deck",
    source: {
      outline_updated_at: "old-outline",
      page_plan_updated_at: "old-page-plan",
      template_group: "default",
      generated_by: "test",
    },
    pages: basePagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
      image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
      reason: "No research needed.",
    })),
    shared: {
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
    },
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const pagePlan = {
    ...basePagePlan,
    source: {
      ...basePagePlan.source,
      outline_updated_at: "persisted-outline",
    },
    updated_at: "persisted-page-plan",
  };

  const result = mergeDeckRefinementResearchPlan({
    existingPlan,
    generatedPlan: {
      ...existingPlan,
      source: {
        ...existingPlan.source,
        outline_updated_at: "llm-returned-outline",
      },
    },
    pagePlan,
    researchReviews: {},
    now: "2026-01-02T00:00:00.000Z",
  });

  assert.equal(result.source.outline_updated_at, "persisted-outline");
  assert.equal(result.source.page_plan_updated_at, "persisted-page-plan");
});

test("delete operation removes active references without targeting retained pages", () => {
  const result = reconcileDeckRefinement({
    instruction: "删掉第二页",
    outline: baseOutline,
    pagePlan: basePagePlan,
    now: "2026-01-02T00:00:00.000Z",
    review: proceedReview({
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
        { op: "delete", page_id: "page-02", reason: "Delete." },
        { op: "keep", page_id: "page-03", reason: "Keep." },
      ],
    }),
  });

  assert.deepEqual(result.deletedPageIds, ["page-02"]);
  assert.deepEqual(result.targetPageIds, []);
  assert.deepEqual(result.pagePlan.pages.map((page) => page.page_id), ["page-01", "page-03"]);
  assert.deepEqual(result.pagePlan.pages.map((page) => page.index), [0, 1]);
  assert.equal(result.pagePlan.pages[1].slide_path, "./slides/page-03.tsx");
});
