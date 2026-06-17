import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertResearchPlanAligned,
  buildGenerateResearchPlanLlmRequest,
  validateResearchPlanAlignment,
} from "../../src/ai/researchPlanPrompt.ts";
import type { PagePlan, ResearchPlan, WorkspaceOutline } from "../../src/api/types.ts";

const outline: WorkspaceOutline = {
  version: 2,
  title: "Market Update",
  output_language: "Chinese",
  status: "confirmed",
  items: [
    { title: "背景", outline: "介绍主题" },
    { title: "数据", outline: "使用最新市场数据" },
  ],
  source: {
    prompt: "写一个中文市场更新",
    context: [],
    setting: { output_language: "Chinese" },
  },
  updated_at: "2026-06-17T00:00:00.000Z",
};

const pagePlan: PagePlan = {
  version: 1,
  status: "planned",
  title: outline.title,
  source: {
    outline_updated_at: outline.updated_at,
    template_group: "default",
    template_manifest_path: "/tmp/template/manifest.json",
    generated_by: "test",
  },
  pages: outline.items.map((item, index) => {
    const pageId = `page-0${index + 1}`;
    return {
      page_id: pageId,
      index,
      title: item.title,
      outline: item.outline,
      blueprint_id: "simple",
      blueprint_source: "./blueprints/Simple.tsx",
      slide_path: `./slides/${pageId}.tsx`,
      data_path: `./data/${pageId}.json`,
      manifest_slide_id: pageId,
      reason: "test",
    };
  }),
  updated_at: "2026-06-17T00:00:00.000Z",
};

function makeResearchPlan(): ResearchPlan {
  return {
    version: 1,
    status: "planned",
    title: pagePlan.title,
    source: {
      outline_updated_at: outline.updated_at,
      page_plan_updated_at: pagePlan.updated_at,
      template_group: "default",
      generated_by: "test",
    },
    pages: pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      web_research_needed: page.index === 1,
      image_research_needed: false,
      query_intents: page.index === 1 ? ["中文 最新 市场数据"] : [],
      image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
      reason: "test",
    })),
    shared: {
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
    },
    updated_at: "2026-06-17T00:00:00.000Z",
  };
}

describe("Research Plan prompt", () => {
  it("discourages unnecessary research and separates web from image decisions", () => {
    const text = buildGenerateResearchPlanLlmRequest({
      outline,
      pagePlan,
      locale: "zh",
    }).messages.map((message) => message.content.text).join("\n");

    assert.match(text, /Do not enable research just to make a page richer/);
    assert.match(text, /web_research_needed and image_research_needed are independent booleans/);
    assert.match(text, /Search query language should follow the Brief and output language/);
    assert.match(text, /Do not plan provider region parameters/);
  });

  it("accepts a page-plan aligned research plan", () => {
    const researchPlan = makeResearchPlan();
    assert.deepEqual(validateResearchPlanAlignment({ researchPlan, pagePlan }), []);
    assert.equal(assertResearchPlanAligned({ researchPlan, pagePlan }), researchPlan);
  });

  it("reports missing, duplicate, unknown, and malformed page decisions", () => {
    const researchPlan = makeResearchPlan();
    researchPlan.pages = [
      {
        ...researchPlan.pages[0],
        web_research_needed: "yes" as never,
      },
      {
        ...researchPlan.pages[0],
        index: 99,
        title: "Wrong",
      },
    ];

    const errors = validateResearchPlanAlignment({ researchPlan, pagePlan });
    assert.ok(errors.some((error) => error.includes("Duplicate Research Plan page_id")));
    assert.ok(errors.some((error) => error.includes("missing page_id: page-02")));
    assert.ok(errors.some((error) => error.includes("web_research_needed must be boolean")));
    assert.ok(errors.some((error) => error.includes("index mismatch")));
    assert.ok(errors.some((error) => error.includes("title mismatch")));
  });
});
