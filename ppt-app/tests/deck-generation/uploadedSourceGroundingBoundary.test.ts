import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PagePlan, PagePlanItem, WorkspaceOutline } from "../../src/api/types.ts";
import {
  buildAuthoringPrompt,
  buildPageContentReviewPrompt,
} from "../../src/features/deck-generation/prompts.ts";

const page: PagePlanItem = {
  page_id: "page-01",
  index: 0,
  title: "Uploaded facts",
  outline: "Use only assigned uploaded source evidence.",
  blueprint_id: "simple",
  blueprint_source: "./blueprints/Simple.tsx",
  slide_path: "./slides/page-01.tsx",
  data_path: "./data/page-01.json",
  manifest_slide_id: "page-01",
  reason: "test",
  content_plan: {
    main_message: "Use assigned evidence",
    content_points: ["ARR grew 12%"],
    evidence_fact_ids: [],
    derived_insight_ids: [],
    visual_asset_ids: [],
    uploaded_source_fact_ids: ["uploaded-fact-1"],
    uploaded_source_visual_asset_ids: [],
    gaps: [],
    authoring_notes: [],
  },
};

const outline: WorkspaceOutline = {
  version: 3,
  title: "Uploaded Source Deck",
  output_language: "English",
  status: "confirmed",
  items: [{ title: page.title, core_message: page.outline, required_content: "- Use assigned evidence." }],
  source: {
    prompt: "Build from uploaded source material",
    context: [],
    setting: { output_language: "English" },
  },
  updated_at: "2026-07-01T00:00:00.000Z",
  confirmed_at: "2026-07-01T00:00:00.000Z",
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
  pages: [page],
  updated_at: "2026-07-01T00:00:00.000Z",
};

describe("Uploaded source grounding boundary prompts", () => {
  it("prevents Page Authoring from using raw uploaded files or full analysis", () => {
    const prompt = buildAuthoringPrompt({
      workspaceDir: "/tmp/workspace",
      page,
      pagePlan,
      outline,
      attemptKind: "initial",
    });

    assert.match(prompt, /Do not read raw uploaded files or full Uploaded Source Analysis/);
    assert.match(prompt, /current-page Research Evidence \/ Visual Assets/);
    assert.match(prompt, /Image text, chart labels, and visual-only material are not factual grounding/);
    assert.doesNotMatch(prompt, /uploaded or source material represented in workspace artifacts/);
  });

  it("requires Page Content Review to ground uploaded-source claims through page evidence only", () => {
    const prompt = buildPageContentReviewPrompt({
      workspaceDir: "/tmp/workspace",
      page,
      pagePlan,
      outline,
    });

    assert.match(prompt, /Uploaded-source-derived claims are grounded only when they trace to current-page Research Evidence/);
    assert.match(prompt, /Raw uploaded files and full Uploaded Source Analysis are not evidence sources/);
    assert.match(prompt, /Image text, chart labels, and visual-only material are not factual evidence/);
    assert.doesNotMatch(prompt, /uploaded\/source material represented in workspace artifacts/);
  });
});
