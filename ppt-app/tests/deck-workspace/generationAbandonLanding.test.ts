import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveGenerationAbandonLanding } from "../../src/features/deck-workspace/generationAbandonLanding.ts";

describe("generation abandonment landing", () => {
  it("sends the user to My Works when they left through a header entry", () => {
    assert.deepEqual(
      resolveGenerationAbandonLanding({ runKind: "deck-generation", fromHeader: true }),
      { page: "my-work", stage: "outline" },
    );
    assert.deepEqual(
      resolveGenerationAbandonLanding({ runKind: "deck-refinement", fromHeader: true }),
      { page: "my-work", stage: "deck" },
    );
  });

  it("keeps the user next to the restored artifact when they stopped from the generation page", () => {
    assert.deepEqual(
      resolveGenerationAbandonLanding({ runKind: "deck-generation", fromHeader: false }),
      { page: "main", stage: "outline" },
    );
    assert.deepEqual(
      resolveGenerationAbandonLanding({ runKind: "page-refinement", fromHeader: false }),
      { page: "main", stage: "deck" },
    );
  });
});
