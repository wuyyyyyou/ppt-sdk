import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PagePlanItem,
  ResearchEvidenceIndex,
  ResearchRequirement,
  VisualResearchCurationDraft,
  WebResearchCurationDraft,
} from "../../src/api/types.ts";
import {
  createVisualResearchCurationGapDraft,
  createWebResearchCurationGapDraft,
  mergeResearchCurationDrafts,
  validateVisualResearchCurationDraft,
  validateWebResearchCurationDraft,
} from "../../src/features/deck-generation/researchCurationDrafts.ts";

const now = "2026-06-22T00:00:00.000Z";

const page: PagePlanItem = {
  page_id: "page-01",
  index: 0,
  title: "Market facts",
  outline: "Use evidence",
  blueprint_id: "simple",
  blueprint_source: "./blueprints/Simple.tsx",
  slide_path: "./slides/page-01.tsx",
  data_path: "./data/page-01.json",
  manifest_slide_id: "page-01",
  reason: "test",
};

const requirement: ResearchRequirement = {
  page_id: page.page_id,
  index: page.index,
  title: page.title,
  web_research_needed: true,
  image_research_needed: true,
  query_intents: ["market facts"],
  image_query_intents: ["market photo"],
  evidence_needs: [],
  visual_needs: [],
  gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
  reason: "test",
};

function makeEvidenceIndex(): ResearchEvidenceIndex {
  return {
    version: 1,
    status: "partial",
    pages: [
      {
        page_id: "page-00",
        status: "curated",
        facts: [{ id: "old-fact", claim: "Old", source_type: "user_provided" }],
        visual_assets: [],
        derived_insights: [],
        gaps: [],
        rejected_material: [],
        markdown_path: "/tmp/page-00.md",
        updated_at: now,
      },
    ],
    shared: {
      facts: [{ id: "shared-fact", claim: "Shared", source_type: "user_provided" }],
      visual_assets: [],
      gaps: ["shared gap"],
    },
    updated_at: now,
  };
}

function makeWebDraft(overrides: Partial<WebResearchCurationDraft> = {}): WebResearchCurationDraft {
  return {
    version: 1,
    page_id: page.page_id,
    status: "curated",
    facts: [
      {
        id: "fact-1",
        claim: "The market grew.",
        source_type: "web_source",
        source_title: "Report",
        source_url: "https://example.com/report",
        excerpt: "market grew",
        confidence: "medium",
      },
    ],
    derived_insights: [
      {
        id: "insight-1",
        insight: "Growth is visible.",
        supporting_fact_ids: ["fact-1"],
      },
    ],
    gaps: [],
    rejected_material: [{ source: "Bad SEO", reason: "Low quality" }],
    source_summary: "One useful source.",
    updated_at: now,
    ...overrides,
  };
}

function makeVisualDraft(overrides: Partial<VisualResearchCurationDraft> = {}): VisualResearchCurationDraft {
  return {
    version: 1,
    page_id: page.page_id,
    status: "curated",
    visual_assets: [
      {
        id: "image-1",
        file_path: "/tmp/research/evidence/images/image-1.jpg",
        image_url: "https://example.com/image.jpg",
        page_url: "https://example.com/page",
        reason: "Clear visual",
        visual_summary: "A clear product image.",
      },
    ],
    gaps: [],
    rejected_material: [{ source: "Tiny image", reason: "Too small" }],
    visual_summary: "One useful image.",
    updated_at: now,
    ...overrides,
  };
}

describe("Research Curation Drafts", () => {
  it("validates web draft facts and rejects malformed page identity", () => {
    const valid = validateWebResearchCurationDraft(makeWebDraft(), page.page_id);
    assert.equal(valid.gaps.length, 0);
    assert.equal(valid.draft?.facts[0]?.id, "fact-1");

    const invalid = validateWebResearchCurationDraft(
      { ...makeWebDraft(), page_id: "page-99" },
      page.page_id,
    );
    assert.equal(invalid.draft, null);
    assert.ok(invalid.gaps.some((gap) => gap.includes("page_id")));
  });

  it("rejects visual drafts that try to contribute factual evidence", () => {
    const result = validateVisualResearchCurationDraft(
      { ...makeVisualDraft(), facts: [{ id: "bad", claim: "Bad" }] },
      page.page_id,
    );

    assert.equal(result.draft, null);
    assert.ok(result.gaps.some((gap) => gap.includes("must not contain factual evidence")));
  });

  it("merges web and visual drafts into curated page evidence", () => {
    const result = mergeResearchCurationDrafts({
      currentEvidence: makeEvidenceIndex(),
      page,
      requirement,
      evidenceMarkdownPath: "/tmp/research/evidence/pages/page-01.md",
      webDraft: makeWebDraft(),
      visualDraft: makeVisualDraft(),
      now,
    });

    assert.equal(result.pageEvidence.status, "curated");
    assert.equal(result.pageEvidence.facts.length, 1);
    assert.equal(result.pageEvidence.derived_insights.length, 1);
    assert.equal(result.pageEvidence.visual_assets.length, 1);
    assert.equal(result.pageEvidence.rejected_material.length, 2);
    assert.equal(result.evidence.pages[0]?.page_id, "page-00");
    assert.equal(result.evidence.pages[1]?.page_id, "page-01");
    assert.equal(result.evidence.shared.facts[0]?.id, "shared-fact");
    assert.match(result.markdown, /The market grew/);
    assert.match(result.markdown, /A clear product image/);
  });

  it("keeps curated status when only one requested path produces usable evidence", () => {
    const result = mergeResearchCurationDrafts({
      currentEvidence: makeEvidenceIndex(),
      page,
      requirement,
      evidenceMarkdownPath: "/tmp/page-01.md",
      webDraft: makeWebDraft(),
      visualDraft: createVisualResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw image material was collected for this page."],
        now,
      }),
      now,
    });

    assert.equal(result.pageEvidence.status, "curated");
    assert.deepEqual(result.pageEvidence.gaps, ["No raw image material was collected for this page."]);
    assert.equal(result.pageEvidence.visual_assets.length, 0);
  });

  it("marks final page evidence as gap when no usable evidence exists", () => {
    const result = mergeResearchCurationDrafts({
      currentEvidence: makeEvidenceIndex(),
      page,
      requirement,
      evidenceMarkdownPath: "/tmp/page-01.md",
      webDraft: createWebResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw web material was collected for this page."],
        now,
      }),
      visualDraft: createVisualResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw image material was collected for this page."],
        now,
      }),
      now,
    });

    assert.equal(result.pageEvidence.status, "gap");
    assert.equal(result.pageEvidence.facts.length, 0);
    assert.equal(result.pageEvidence.visual_assets.length, 0);
    assert.deepEqual(result.pageEvidence.gaps, [
      "No raw web material was collected for this page.",
      "No raw image material was collected for this page.",
    ]);
  });

  it("replaces only the current page evidence entry", () => {
    const currentEvidence = makeEvidenceIndex();
    currentEvidence.pages.push({
      page_id: page.page_id,
      status: "gap",
      facts: [],
      visual_assets: [],
      derived_insights: [],
      gaps: ["old gap"],
      rejected_material: [],
      markdown_path: "/tmp/old.md",
      updated_at: now,
    });

    const result = mergeResearchCurationDrafts({
      currentEvidence,
      page,
      requirement,
      evidenceMarkdownPath: "/tmp/new.md",
      webDraft: makeWebDraft(),
      now,
    });

    assert.equal(result.evidence.pages.length, 2);
    assert.equal(result.evidence.pages[0]?.page_id, "page-00");
    assert.equal(result.evidence.pages[1]?.page_id, page.page_id);
    assert.deepEqual(result.evidence.pages[1]?.gaps, ["old gap"]);
    assert.equal(result.evidence.pages[1]?.markdown_path, "/tmp/new.md");
  });
});
