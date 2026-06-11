import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isFastModeEnabled,
  pageReviewSettingsToWorkspaceSettings,
  readPageReviewSettings,
} from "../../src/features/deck-workspace/reviewSettings.ts";

describe("deck workspace review settings", () => {
  it("reads defaults when settings are missing", () => {
    assert.deepEqual(readPageReviewSettings({}), {
      contentReviewEnabled: true,
      contentReviewFailureLimit: 5,
      visualReviewEnabled: true,
      visualReviewFailureLimit: 5,
    });
  });

  it("normalizes switches and failure limits", () => {
    assert.deepEqual(readPageReviewSettings({
      content_review_enabled: false,
      content_review_failure_limit: 12.8,
      visual_review_enabled: false,
      visual_review_failure_limit: -2,
    }), {
      contentReviewEnabled: false,
      contentReviewFailureLimit: 10,
      visualReviewEnabled: false,
      visualReviewFailureLimit: 0,
    });
  });

  it("serializes settings for workspace persistence", () => {
    assert.deepEqual(pageReviewSettingsToWorkspaceSettings({
      contentReviewEnabled: false,
      contentReviewFailureLimit: 3,
      visualReviewEnabled: true,
      visualReviewFailureLimit: 7,
    }), {
      content_review_enabled: false,
      content_review_failure_limit: 3,
      visual_review_enabled: true,
      visual_review_failure_limit: 7,
    });
  });

  it("treats fast mode as both reviews disabled", () => {
    assert.equal(isFastModeEnabled(readPageReviewSettings({
      content_review_enabled: false,
      visual_review_enabled: false,
    })), true);
    assert.equal(isFastModeEnabled(readPageReviewSettings({
      content_review_enabled: false,
      visual_review_enabled: true,
    })), false);
  });
});
