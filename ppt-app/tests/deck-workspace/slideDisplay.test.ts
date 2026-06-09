import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { visibleSlideSubtitle } from "../../src/features/deck-workspace/slideDisplay.ts";

describe("slide display helpers", () => {
  it("hides template layout subtitles only in the UI display layer", () => {
    assert.equal(visibleSlideSubtitle({ subtitle: "template:cover-statement" }), "");
    assert.equal(visibleSlideSubtitle({ subtitle: "  template:two-column-insight  " }), "");
  });

  it("keeps normal slide subtitles visible", () => {
    assert.equal(visibleSlideSubtitle({ subtitle: "Executive summary" }), "Executive summary");
  });
});
