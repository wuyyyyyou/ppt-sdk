import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeSlideCountContextValue,
} from "../../src/features/deck-workspace/contextSuggestion.ts";

describe("Legacy context row normalization", () => {
  it("normalizes invalid slide counts to auto", () => {
    assert.equal(normalizeSlideCountContextValue("3"), "3");
    assert.equal(normalizeSlideCountContextValue("auto"), "auto");
    assert.equal(normalizeSlideCountContextValue("0"), "auto");
    assert.equal(normalizeSlideCountContextValue("3 pages"), "auto");
  });
});
