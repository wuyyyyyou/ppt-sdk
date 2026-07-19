import assert from "node:assert/strict";
import test from "node:test";
import { resolveRefineSlideIndex } from "../../src/features/deck-workspace/refineNavigation.ts";

test("refinement navigation never treats a click event as a slide index", () => {
  assert.equal(resolveRefineSlideIndex({ type: "click" }, 2, 5), 2);
  assert.equal(resolveRefineSlideIndex(4, 2, 5), 4);
  assert.equal(resolveRefineSlideIndex(99, 2, 5), 4);
  assert.equal(resolveRefineSlideIndex(-1, 2, 5), 0);
});
