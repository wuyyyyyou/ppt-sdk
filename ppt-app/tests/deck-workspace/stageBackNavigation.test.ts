import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDeckBackStage } from "../../src/features/deck-workspace/stageBackNavigation.ts";

describe("resolveDeckBackStage", () => {
  it("steps back into the generation page the deck came from", () => {
    assert.equal(
      resolveDeckBackStage({ hasGenerationProgress: true, canReturnToOutline: true }),
      "generating",
    );
  });

  it("falls back to the outline when there is no run to step back into", () => {
    assert.equal(
      resolveDeckBackStage({ hasGenerationProgress: false, canReturnToOutline: true }),
      "outline",
    );
  });

  it("never resolves to a stage the navigation would refuse", () => {
    assert.equal(
      resolveDeckBackStage({ hasGenerationProgress: false, canReturnToOutline: false }),
      "brief",
    );
  });
});
