import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { buildResearchDiscoveryStageRecords } from "../../src/features/deck-workspace/researchDiscoveryStageRecords.ts";
import { messages } from "../../src/i18n/messages.ts";

describe("Research Discovery Stage Records", () => {
  it("projects query and source summaries without treating them as page records", () => {
    const progress: DeckGenerationProgress = {
      step: "research-collection",
      message: "Collecting",
      currentPageIndex: null,
      totalPages: 1,
      pages: [],
      researchDiscovery: {
        status: "completed",
        summary: {
          facts: 1,
          derivedInsights: 1,
          visualAssets: 0,
          gaps: 0,
          rejectedMaterial: 1,
        },
        records: [
          { phase: "web-decision", state: "completed", rationale: "Need source-backed facts." },
          {
            phase: "web-collection",
            state: "completed",
            queries: [
              {
                kind: "web",
                query: "EV market 2026",
                status: "collected",
                resultCount: 6,
                fetchCount: 4,
                sources: [{ title: "IEA", url: "https://example.com/iea" }],
              },
            ],
          },
          { phase: "web-curation", state: "completed", counts: { facts: 1, rejectedMaterial: 1 } },
          { phase: "visual-decision", state: "pending" },
          { phase: "visual-collection", state: "pending" },
          { phase: "visual-curation", state: "pending" },
          { phase: "evidence-page-planning", state: "pending" },
        ],
      },
    };

    const group = buildResearchDiscoveryStageRecords({ t: messages.en, progress });
    const collection = group?.records.find((record) => record.phase === "web-collection");

    assert.equal(group?.title, "Facts collection");
    assert.equal(group?.summaryLines.includes("Facts: 1"), true);
    assert.equal(collection?.queryLines[0], "Collected: EV market 2026 (6 results · 4 fetched)");
    assert.deepEqual(collection?.sourceLines, ["IEA · https://example.com/iea"]);
  });

  it("presents gaps as warning state rather than failed state", () => {
    const progress: DeckGenerationProgress = {
      step: "research-curation",
      message: "Curating",
      currentPageIndex: null,
      totalPages: 1,
      pages: [],
      researchDiscovery: {
        status: "warning",
        summary: {
          facts: 2,
          derivedInsights: 0,
          visualAssets: 1,
          gaps: 1,
          rejectedMaterial: 0,
        },
        records: [
          { phase: "web-decision", state: "completed" },
          { phase: "web-collection", state: "completed" },
          { phase: "web-curation", state: "warning", gaps: ["No source verified the latest price."] },
          { phase: "visual-decision", state: "completed" },
          { phase: "visual-collection", state: "completed" },
          { phase: "visual-curation", state: "completed" },
          { phase: "evidence-page-planning", state: "warning", gaps: ["Use TBD for unsupported values."] },
        ],
      },
    };

    const group = buildResearchDiscoveryStageRecords({ t: messages.en, progress });

    assert.equal(group?.state, "warning");
    assert.equal(group?.statusLabel, "Partial");
    assert.equal(group?.records.find((record) => record.phase === "web-curation")?.state, "warning");
  });
});
