import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeckRefinementPlanningRepairRequest,
  buildDeckRefinementPlanningRequest,
  normalizeDeckRefinementPlan,
} from "../../src/ai/deckRefinementIntentReview.ts";
import type { PlanDeckRefinementInput } from "../../src/ai/types.ts";

const input: PlanDeckRefinementInput = {
  instruction: "把第二页改成结论页，整套改为英文",
  locale: "zh",
  currentStyleGuide: "# Style\nUse blue.",
  requirements: {
    version: 1,
    status: "confirmed",
    source: { brief: "季度经营复盘" },
    candidates: { audience: [], purpose: [], desired_outcome: [], slide_count: [2], output_language: ["中文"], visual_tone: [] },
    selections: { audience: null, purpose: null, desired_outcome: null, slide_count: 2, output_language: "中文", visual_tone: null },
    updated_at: null,
    confirmed_at: null,
  },
  outline: {
    version: 3,
    title: "经营复盘",
    status: "confirmed",
    items: [
      { page_id: "page-1", title: "现状", core_message: "收入增长", required_content: "- 收入" },
      { page_id: "page-2", title: "行动", core_message: "聚焦增长", required_content: "- 行动" },
    ],
    updated_at: null,
    confirmed_at: null,
  },
};

describe("Deck Refinement Planning", () => {
  it("uses separate English system/user prompts without legacy template or search tasks", () => {
    const request = buildDeckRefinementPlanningRequest(input);
    assert.equal(request.messages[0]?.role, "system");
    assert.equal(request.messages[1]?.role, "user");
    const system = request.messages[0]?.content.text ?? "";
    const user = request.messages[1]?.content.text ?? "";
    assert.match(system, /Deck Refinement Planning/);
    assert.match(system, /Return exactly one JSON object/);
    assert.match(user, /page-1/);
    assert.match(user, /Current Workspace Style Guide/);
    assert.doesNotMatch(system, /template|web search|image search|style profile/i);
  });

  it("validates complete operation coverage and language-wide updates", () => {
    assert.throws(() => normalizeDeckRefinementPlan({
      route: "proceed",
      title: "经营复盘",
      output_language_change: { changed: true, output_language: "English" },
      style_guide_change: { action: "preserve", reason: "Keep it." },
      operations: [{ op: "keep", page_id: "page-1", reason: "Keep." }],
      reason: "Translate.",
    }, input), /missing operation|require update operations/);
  });

  it("repair request keeps the invalid response and deterministic errors", () => {
    const original = buildDeckRefinementPlanningRequest(input);
    const repaired = buildDeckRefinementPlanningRepairRequest(original, "```json\n{}\n```", ["missing operation"]);
    assert.equal(repaired.messages.at(-2)?.role, "assistant");
    assert.match(repaired.messages.at(-1)?.content.text ?? "", /missing operation/);
    assert.match(repaired.messages.at(-1)?.content.text ?? "", /complete corrected JSON object/);
  });
});
