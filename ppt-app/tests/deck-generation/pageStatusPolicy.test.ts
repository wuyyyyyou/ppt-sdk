import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isActivePageGenerationStatus,
  isGenuinelyFailedPageGenerationStatus,
  isResumablePageGenerationStatus,
  isRetryablePageGenerationStatus,
} from "../../src/features/deck-generation/pageStatusPolicy.ts";

describe("Page Status Policy", () => {
  it("classifies active page generation statuses", () => {
    for (const status of [
      "authoring",
      "content_review",
      "content_review_fixing",
      "rendering",
      "visual_review",
      "visual_review_fixing",
      "render_fixing",
    ]) {
      assert.equal(isActivePageGenerationStatus(status), true, status);
    }

    assert.equal(isActivePageGenerationStatus("pending"), false);
    assert.equal(isActivePageGenerationStatus("interrupted"), false);
    assert.equal(isActivePageGenerationStatus("accepted"), false);
  });

  it("classifies resumable and genuinely failed statuses", () => {
    assert.equal(isResumablePageGenerationStatus("pending"), true);
    assert.equal(isResumablePageGenerationStatus("interrupted"), true);
    assert.equal(isResumablePageGenerationStatus("agent_infrastructure_failed"), true);
    assert.equal(isResumablePageGenerationStatus("render_failed"), false);

    assert.equal(isGenuinelyFailedPageGenerationStatus("render_failed"), true);
    assert.equal(isGenuinelyFailedPageGenerationStatus("agent_failed"), true);
    assert.equal(isGenuinelyFailedPageGenerationStatus("needs_user_review"), true);
    assert.equal(isGenuinelyFailedPageGenerationStatus("agent_infrastructure_failed"), false);
  });

  it("classifies retryable statuses", () => {
    assert.equal(isRetryablePageGenerationStatus("interrupted"), true);
    assert.equal(isRetryablePageGenerationStatus("render_failed"), true);
    assert.equal(isRetryablePageGenerationStatus("agent_failed"), true);
    assert.equal(isRetryablePageGenerationStatus("needs_user_review"), true);
    assert.equal(isRetryablePageGenerationStatus("agent_infrastructure_failed"), true);
    assert.equal(isRetryablePageGenerationStatus("pending"), false);
    assert.equal(isRetryablePageGenerationStatus("accepted"), false);
  });
});
