import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEvidenceAwarePagePlanLlmRequest,
  buildResearchDiscoveryDecisionLlmRequest,
  parseResearchDiscoveryDecisionJson,
} from "../../src/ai/researchDiscoveryPrompt.ts";
import type { PagePlan, ResearchDiscoveryEvidencePool, WorkspaceOutline } from "../../src/api/types.ts";

const outline: WorkspaceOutline = {
  version: 2,
  title: "2026 World Cup Guide",
  output_language: "Chinese",
  status: "confirmed",
  items: [
    { title: "赛制", outline: "介绍 48 队赛制" },
    { title: "球场", outline: "展示北美核心球场" },
  ],
  source: {
    prompt: "做一份 2026 世界杯观赛指南",
    context: [],
    setting: { output_language: "Chinese" },
  },
  updated_at: "2026-07-01T00:00:00.000Z",
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
  updated_at: "2026-07-01T00:00:00.000Z",
};

const discoveryPool: ResearchDiscoveryEvidencePool = {
  version: 1,
  status: "partial",
  facts: [
    {
      id: "fact-format",
      claim: "The 2026 World Cup uses a 48-team format.",
      source_type: "web",
      source_title: "FIFA",
      source_url: "https://www.fifa.com/",
      confidence: "high",
    },
  ],
  derived_insights: [],
  visual_assets: [
    {
      id: "visual-azteca",
      file_path: "/tmp/research/evidence/images/azteca.jpg",
      image_url: "https://example.com/azteca.jpg",
      reason: "Opening match stadium visual.",
      visual_summary: "Night aerial view of Estadio Azteca.",
    },
  ],
  gaps: ["Need a non-watermarked Canadian stadium image."],
  rejected_material: [],
  source_summaries: [],
  iterations: [],
  updated_at: "2026-07-01T00:00:00.000Z",
};

function requestText(phase: "web" | "visual") {
  return buildResearchDiscoveryDecisionLlmRequest({
    outline,
    pagePlan,
    phase,
    iteration: 3,
    iterationLimit: 3,
    discoveryPool,
    uploadedSourceAnalysisContext: {
      status: "ready",
      facts: [{ id: "uploaded-fact-1", claim: "Uploaded source already covers format." }],
      visual_assets: [{ id: "uploaded-visual-1", use_constraint: "usable_visual_asset" }],
      gaps: ["Need current ticketing policy."],
    },
    researchStatus: { status: "gap" },
    locale: "zh",
  }).messages.map((message) => message.content.text).join("\n");
}

describe("Research Discovery decision prompt", () => {
  it("uses visual-only completion rules and phase-specific JSON shape for visual discovery", () => {
    const text = requestText("visual");

    assert.match(text, /Decide only whether image research is still needed/);
    assert.match(text, /Completion means no more image asset collection is needed/);
    assert.match(text, /evidence_needs must be \[\]/);
    assert.match(text, /Return exactly this JSON shape:\n\{"action":"stop","phase":"visual"/);
    assert.doesNotMatch(text, /Return exactly this JSON shape:\n\{"action":"stop","phase":"web"/);
  });

  it("keeps factual evidence needs out of parsed visual decisions", () => {
    const decision = parseResearchDiscoveryDecisionJson(JSON.stringify({
      action: "stop",
      phase: "visual",
      queries: [],
      rationale: "Facts are complete, and images look good.",
      evidence_needs: ["ticket pricing facts"],
      visual_needs: [],
      gaps: [],
    }), "visual");

    assert.equal(decision.phase, "visual");
    assert.deepEqual(decision.evidence_needs, []);
  });

  it("treats uploaded source analysis as prior context without merging it into the discovery pool", () => {
    const text = requestText("web");

    assert.match(text, /Uploaded Source Analysis prior context/);
    assert.match(text, /Uploaded source already covers format/);
    assert.match(text, /outrank external web facts/);
    assert.match(text, /conflicts between uploaded-source facts and web facts/);
    assert.doesNotMatch(text, /discovery_pool[\s\S]*uploaded-fact-1/);
  });

  it("allows evidence-aware page planning to assign uploaded-source ids separately", () => {
    const text = buildEvidenceAwarePagePlanLlmRequest({
      outline,
      pagePlan,
      discoveryPool,
      uploadedSourceAnalysisContext: {
        status: "ready",
        facts: [{ id: "uploaded-fact-1", claim: "ARR grew 12%." }],
        visual_assets: [{ id: "uploaded-visual-1", use_constraint: "must_use" }],
      },
      locale: "zh",
    }).messages.map((message) => message.content.text).join("\n");

    assert.match(text, /uploaded_source_fact_ids/);
    assert.match(text, /uploaded_source_visual_asset_ids/);
    assert.match(text, /Do not add pages or overload a page solely/);
    assert.match(text, /ARR grew 12%/);
  });
});
