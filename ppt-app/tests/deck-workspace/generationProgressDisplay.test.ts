import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { getGenerationProgressDisplayMessage } from "../../src/features/deck-workspace/generationProgressDisplay.ts";
import { messages } from "../../src/i18n/messages.ts";

const completeProgress: DeckGenerationProgress = {
  step: "complete",
  message: "生成完成",
  currentPageIndex: 0,
  totalPages: 0,
  pages: [],
};

describe("Generation Progress Display", () => {
  it("localizes completed generation instead of reusing persisted progress text", () => {
    assert.equal(getGenerationProgressDisplayMessage(messages.en, completeProgress), "Generation complete");
    assert.equal(getGenerationProgressDisplayMessage(messages.zh, completeProgress), "生成完成");
  });

  it("keeps live progress messages for non-complete steps", () => {
    assert.equal(
      getGenerationProgressDisplayMessage(messages.en, {
        ...completeProgress,
        step: "page-authoring",
        message: "Writing page 1",
      }),
      "Writing page 1",
    );
  });

  it("hides page accepted summaries while Research Discovery is active", () => {
    assert.equal(
      getGenerationProgressDisplayMessage(messages.zh, {
        ...completeProgress,
        step: "research-curation",
        message: "0/1 页已通过",
        researchDiscovery: {
          status: "active",
          summary: {
            facts: 0,
            derivedInsights: 0,
            visualAssets: 0,
            gaps: 0,
            rejectedMaterial: 0,
          },
          records: [
            { phase: "web-decision", state: "completed" },
            { phase: "web-collection", state: "completed" },
            { phase: "web-curation", state: "completed" },
            { phase: "visual-decision", state: "completed" },
            { phase: "visual-collection", state: "completed" },
            { phase: "visual-curation", state: "active" },
            { phase: "evidence-page-planning", state: "pending" },
          ],
        },
      }),
      "筛选图片素材",
    );
  });

  it("uses Research Discovery step fallback when stale page accepted summaries have no active phase", () => {
    assert.equal(
      getGenerationProgressDisplayMessage(messages.zh, {
        ...completeProgress,
        step: "research-discovery",
        message: "0/1 页通过",
      }),
      "判断网页资料需求",
    );
    assert.equal(
      getGenerationProgressDisplayMessage(messages.en, {
        ...completeProgress,
        step: "research-collection",
        message: "0/1 accepted",
      }),
      "Search and fetch web sources",
    );
  });

  it("keeps page accepted summaries during page generation", () => {
    assert.equal(
      getGenerationProgressDisplayMessage(messages.zh, {
        ...completeProgress,
        step: "page-authoring",
        message: "0/1 页已通过",
      }),
      "0/1 页已通过",
    );
  });
});
