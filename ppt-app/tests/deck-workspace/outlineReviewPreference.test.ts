import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  outlineReviewPreferenceToWorkspaceSettings,
  readOutlineReviewPreference,
} from "../../src/features/deck-workspace/outlineReviewPreference.ts";

describe("outline review preference", () => {
  it("defaults to disabled when the setting is missing", () => {
    assert.equal(readOutlineReviewPreference({}), false);
  });

  it("reads and writes review_outline_first", () => {
    assert.equal(readOutlineReviewPreference({ review_outline_first: true }), true);
    assert.deepEqual(outlineReviewPreferenceToWorkspaceSettings(true), {
      review_outline_first: true,
    });
  });
});
