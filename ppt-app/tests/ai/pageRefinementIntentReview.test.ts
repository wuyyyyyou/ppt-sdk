import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePageRefinementIntentReview } from "../../src/ai/pageRefinementIntentReview.ts";

describe("normalizePageRefinementIntentReview", () => {
  it("requires a complete target outline item when the target outline changes", () => {
    const result = normalizePageRefinementIntentReview({
      route: "proceed",
      outline_change_required: true,
      target_outline_item: {
        title: "Updated page",
        outline: "Updated target-page outline.",
      },
      additional_research_required: false,
      additional_web_query_intents: [],
      additional_image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      reason: "The request changes the target page intent.",
    });

    assert.equal(result.outline_change_required, true);
    assert.deepEqual(result.target_outline_item, {
      title: "Updated page",
      outline: "Updated target-page outline.",
    });
  });

  it("ignores legacy page-plan revision fields", () => {
    const result = normalizePageRefinementIntentReview({
      route: "proceed",
      outline_change_required: false,
      page_plan_replan_required: true,
      revised_page_plan_item: {
        title: "Do not use",
        outline: "Do not use",
        blueprint_id: "legacy-blueprint",
        blueprint_source: "./blueprints/Legacy.tsx",
        reason: "Do not use",
      },
      additional_research_required: false,
      additional_web_query_intents: [],
      additional_image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      reason: "Proceed without changing the target outline.",
    });

    assert.equal(result.outline_change_required, false);
    assert.equal(result.target_outline_item, undefined);
    assert.equal("page_plan_replan_required" in result, false);
    assert.equal("revised_page_plan_item" in result, false);
  });

  it("rejects missing target outline content when outline_change_required is true", () => {
    assert.throws(
      () => normalizePageRefinementIntentReview({
        route: "proceed",
        outline_change_required: true,
        target_outline_item: {
          title: "Updated page",
        },
      }),
      /target_outline_item\.title and outline/,
    );
  });
});
