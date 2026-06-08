import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canRetryPageGenerationStatus } from "../../src/features/deck-workspace/components/GeneratingPage.tsx";

describe("GeneratingPage retry eligibility", () => {
  it("allows retrying Agent infrastructure failures", () => {
    assert.equal(canRetryPageGenerationStatus("agent_infrastructure_failed"), true);
  });

  it("keeps accepted and active pages out of retry eligibility", () => {
    assert.equal(canRetryPageGenerationStatus("accepted"), false);
    assert.equal(canRetryPageGenerationStatus("authoring"), false);
    assert.equal(canRetryPageGenerationStatus("self_review"), false);
  });
});
