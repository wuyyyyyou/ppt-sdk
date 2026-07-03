import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeckRefinementIntentReviewLlmRequest,
  normalizeDeckRefinementIntentReview,
} from "../../src/ai/deckRefinementIntentReview.ts";
import type { PagePlan, TemplatePlanningContext, WorkspaceOutline, WorkspaceSettings } from "../../src/api/types.ts";

const outline: WorkspaceOutline = {
  version: 2,
  title: "Demo Deck",
  output_language: "zh",
  status: "confirmed",
  items: [
    { title: "Outline Only Title", outline: "Outline-only wording" },
  ],
  source: {
    prompt: "Build a demo deck",
    context: [{ id: "theme", value: "digital-indigo" }],
    setting: { output_language: "zh", theme_id: "digital-indigo" },
  },
  updated_at: "2026-01-01T00:00:00.000Z",
};

const pagePlan: PagePlan = {
  version: 1,
  status: "prepared",
  title: "Demo Deck",
  source: {
    outline_updated_at: outline.updated_at,
    template_group: "template",
    template_manifest_path: "/workspace/template/manifest.json",
    generated_by: "test",
  },
  pages: [
    {
      page_id: "page-01",
      index: 0,
      title: "Plan Page One",
      outline: "Page-plan wording",
      blueprint_id: "content-canvas",
      blueprint_source: "./blueprints/ContentCanvas.tsx",
      slide_path: "./slides/page-01.tsx",
      data_path: "./data/page-01.json",
      manifest_slide_id: "page-01",
      reason: "Existing page.",
    },
  ],
  updated_at: "2026-01-01T00:00:00.000Z",
};

const planningContext: TemplatePlanningContext = {
  template_group: "template",
  template_group_name: "Template",
  template_dir: "/workspace/template",
  manifest_path: "/workspace/template/manifest.json",
  catalog_path: "/workspace/template/catalog.json",
  rules: [],
  blueprints: [
    {
      id: "content-canvas",
      name: "Content Canvas",
      blueprint_source: "./blueprints/ContentCanvas.tsx",
      example_slide: "./slides/ContentCanvas.tsx",
      layout_family: "content-canvas",
      content_intents: ["analysis"],
      suitable_for: ["ordinary content page"],
      avoid_for: ["cover"],
    },
  ],
};

const setting: WorkspaceSettings = {
  output_language: "zh",
  theme_id: "digital-indigo",
  text_density: "balanced",
};

describe("deck refinement intent review prompt", () => {
  it("uses system and user messages with trimmed review input", () => {
    const request = buildDeckRefinementIntentReviewLlmRequest({
      instruction: "把第一页改成摘要",
      outline,
      pagePlan,
      planningContext,
      setting,
      locale: "zh",
    });

    assert.equal(request.messages[0]?.role, "system");
    assert.equal(request.messages[1]?.role, "user");
    const systemPrompt = request.messages[0]?.content.text ?? "";
    const userPrompt = request.messages[1]?.content.text ?? "";

    assert.match(systemPrompt, /Do not return context_updates/);
    assert.match(userPrompt, /"page_id": "page-01"/);
    assert.match(userPrompt, /"output_language": "zh"/);
    assert.match(userPrompt, /"title": "Plan Page One"/);
    assert.doesNotMatch(userPrompt, /Outline Only Title/);
    assert.doesNotMatch(userPrompt, /slide_path/);
    assert.doesNotMatch(userPrompt, /blueprint_source/);
    assert.doesNotMatch(userPrompt, /theme_id/);
    assert.doesNotMatch(userPrompt, /manifest\.json/);
  });
});

describe("deck refinement intent review normalization", () => {
  it("ignores legacy context/global fields instead of preserving them", () => {
    const result = normalizeDeckRefinementIntentReview({
      route: "proceed",
      context_updates: {
        audience: "Executives",
        theme_id: "digital-indigo",
      },
      global_change: true,
      global_change_reason: "Legacy field should be ignored.",
      output_language_change: { changed: false },
      operations: [
        { op: "keep", page_id: "page-01", reason: "Keep." },
      ],
      reason: "Proceed.",
    });

    assert.equal(result.route, "proceed");
    assert.equal(Object.prototype.hasOwnProperty.call(result, "context_updates"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "global_change"), false);
  });
});
