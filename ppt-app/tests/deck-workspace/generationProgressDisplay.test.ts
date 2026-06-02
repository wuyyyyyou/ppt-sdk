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
});
