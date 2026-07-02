import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PagePlanItem, ResearchRequirement } from "../../src/api/types.ts";
import { buildWebResearchCurationPrompt } from "../../src/features/deck-generation/researchWorkflow.ts";

const page: PagePlanItem = {
  page_id: "page-01",
  index: 0,
  title: "Market Evidence",
  outline: "Use sourced market evidence.",
  blueprint_id: "evidence-slide",
  blueprint_source: "template",
  slide_path: "./slides/page-01.tsx",
  data_path: "./data/page-01.json",
  manifest_slide_id: "slide-01",
  reason: "Needs sourced evidence.",
};

const requirement: ResearchRequirement = {
  page_id: "page-01",
  index: 0,
  title: "Market Evidence",
  web_research_needed: true,
  image_research_needed: false,
  query_intents: ["market evidence"],
  image_query_intents: [],
  evidence_needs: ["Precise source-backed metric"],
  visual_needs: [],
  gap_strategy: "Mark unsupported details as TBD.",
  reason: "Needs external facts.",
};

describe("Research Workflow", () => {
  it("instructs web curation to produce verifiable evidence cards", () => {
    const prompt = buildWebResearchCurationPrompt({
      workspaceDir: "/tmp/workspace",
      page,
      requirement,
      rawWebIndexPaths: ["/tmp/workspace/research/raw/web/index.json"],
      draftPath: "/tmp/workspace/research/evidence/drafts/page-01-web.json",
      curationRunId: "page-01-web-1",
    });

    assert.match(prompt, /Treat each fact as a verifiable evidence card/);
    assert.match(prompt, /Every fact must be atomic/);
    assert.match(prompt, /Do not merge unrelated facts into one claim/);
    assert.match(prompt, /time period, geography, entity\/population, sample size, denominator, unit, currency, methodology, metric definition, and comparison baseline/);
    assert.match(prompt, /For numeric facts, claim must include the exact number, unit, time period, applicable scope, and denominator\/sample\/baseline/);
    assert.match(prompt, /Do not broaden source meaning/);
    assert.match(prompt, /excerpt must be a continuous passage from source_file that directly supports claim/);
    assert.match(prompt, /It is better to be slightly longer than to omit time period, denominator, metric definition, scope, or caveat/);
    assert.match(prompt, /Each web_source fact must include source_url or source_file/);
    assert.match(prompt, /do not create a fact. Add it to gaps or rejected_material/);
  });
});
