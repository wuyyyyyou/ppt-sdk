import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { buildResearchDiscoveryStageRecords } from "../../src/features/deck-workspace/researchDiscoveryStageRecords.ts";
import { messages } from "../../src/i18n/messages.ts";

function makeProgress(
  status: "waiting" | "running" | "completed" | "warning" | "skipped",
  records: NonNullable<DeckGenerationProgress["researchDiscovery"]>["records"],
): DeckGenerationProgress {
  return {
    step: "prepare",
    message: "Researching",
    currentPageIndex: null,
    totalPages: 1,
    pages: [],
    researchDiscovery: {
      status,
      summary: { facts: 0, derivedInsights: 0, visualAssets: 0, gaps: 0, rejectedMaterial: 0 },
      records,
    },
  };
}

describe("Linear Research Stage Records", () => {
  it("projects the four current Web and image phases", () => {
    const group = buildResearchDiscoveryStageRecords({
      t: messages.en,
      progress: makeProgress("running", [
        { phase: "web-decision", state: "completed", rationale: "Current facts are needed." },
        { phase: "web-collection", state: "running", activities: ["Searching official sources."] },
        { phase: "visual-decision", state: "waiting" },
        { phase: "visual-collection", state: "waiting" },
      ]),
    });

    assert.equal(group?.title, "Facts collection");
    assert.equal(group?.state, "active");
    assert.deepEqual(group?.records.map((record) => record.phase), [
      "web-decision",
      "web-collection",
      "visual-decision",
      "visual-collection",
    ]);
    assert.equal(group?.records[0]?.rationale, "Current facts are needed.");
    assert.deepEqual(group?.records[1]?.activities, ["Searching official sources."]);
    assert.deepEqual(group?.records[1]?.queryLines, []);
    assert.deepEqual(group?.records[1]?.sourceLines, []);
  });

  it("presents a terminal warning as completed with gaps", () => {
    const group = buildResearchDiscoveryStageRecords({
      t: messages.en,
      progress: makeProgress("warning", [
        { phase: "web-decision", state: "completed" },
        { phase: "web-collection", state: "warning", gaps: ["Some selected pages could not be read."] },
        { phase: "visual-decision", state: "skipped" },
        { phase: "visual-collection", state: "skipped" },
      ]),
    });

    assert.equal(group?.state, "completed");
    assert.equal(group?.statusLabel, "Completed with gaps");
    assert.equal(group?.records[1]?.state, "completed");
    assert.deepEqual(group?.records[1]?.gaps, ["Some selected pages could not be read."]);
  });

  it("keeps waiting phases pending while the workflow is running", () => {
    const group = buildResearchDiscoveryStageRecords({
      t: messages.en,
      progress: makeProgress("running", [
        { phase: "web-decision", state: "completed" },
        { phase: "web-collection", state: "completed" },
        { phase: "visual-decision", state: "running" },
        { phase: "visual-collection", state: "waiting" },
      ]),
    });

    assert.equal(group?.state, "active");
    assert.equal(group?.statusLabel, "Running");
    assert.equal(group?.records[2]?.state, "active");
    assert.equal(group?.records[3]?.state, "pending");
  });

  it("formats structured activity in both locales and hides full source URLs", () => {
    const records: NonNullable<DeckGenerationProgress["researchDiscovery"]>["records"] = [
      { phase: "web-decision", state: "completed" },
      {
        phase: "web-collection",
        state: "running",
        activity: { kind: "web-fetch", completed: 2, total: 4 },
        queries: [{
          kind: "web",
          query: "EV market 2026",
          status: "collected",
          resultCount: 6,
          fetchCount: 2,
          sources: [{ title: "IEA report", url: "https://example.com/private/path?token=secret" }],
        }],
      },
      { phase: "visual-decision", state: "waiting" },
      { phase: "visual-collection", state: "waiting" },
    ];
    const en = buildResearchDiscoveryStageRecords({ t: messages.en, progress: makeProgress("running", records) });
    const zh = buildResearchDiscoveryStageRecords({ t: messages.zh, progress: makeProgress("running", records) });

    assert.equal(en?.records[1]?.activities[0], "Fetching web pages: 2/4 completed");
    assert.equal(zh?.records[1]?.activities[0], "正在抓取网页正文：已完成 2/4");
    assert.equal(en?.records[1]?.queryLines[0], "Collected: EV market 2026 (6 results · 2 fetched)");
    assert.deepEqual(en?.records[1]?.sourceLines, ["IEA report"]);
    assert.equal(JSON.stringify(en).includes("token=secret"), false);
  });
});
