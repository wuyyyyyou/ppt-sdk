import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatResearchCurationExhaustedGap,
  formatResearchCurationRetryActivity,
  formatResearchCurationRunError,
  RESEARCH_CURATION_ATTEMPT_LIMIT,
} from "../../src/features/deck-generation/researchCurationRetry.ts";

describe("Research Curation Retry", () => {
  it("formats retry activity with the shared attempt limit", () => {
    assert.equal(RESEARCH_CURATION_ATTEMPT_LIMIT, 5);
    assert.equal(
      formatResearchCurationRetryActivity({ kind: "web", nextAttempt: 3 }),
      "Web Research Curation retry 3/5",
    );
    assert.equal(
      formatResearchCurationRetryActivity({ kind: "visual", nextAttempt: 2 }),
      "Visual Research Curation retry 2/5",
    );
  });

  it("formats run errors without losing the original message", () => {
    assert.equal(
      formatResearchCurationRunError({
        kind: "web",
        error: new Error("QueuePool limit of size 3 overflow 5 reached"),
      }),
      "Web Research Curation failed: QueuePool limit of size 3 overflow 5 reached",
    );
  });

  it("formats a single final gap after attempts are exhausted", () => {
    assert.equal(
      formatResearchCurationExhaustedGap({
        kind: "visual",
        lastFailure: "Visual Research Curation draft was not written.",
      }),
      "Visual Research Curation failed after 5 attempts. Last error: Visual Research Curation draft was not written.",
    );
  });
});

