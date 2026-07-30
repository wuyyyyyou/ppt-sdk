import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explicitZIndex,
  planStackingChange,
  type StackingEntry,
} from "../../src/features/manual-page-editor/manualPageEditorStacking";

function entries(...values: (number | null)[]): StackingEntry[] {
  return values.map((zIndex) => ({ zIndex }));
}

describe("layer changes", () => {
  it("lifts the moved element above the highest sibling and touches nothing else", () => {
    // Renumbering the group used to overwrite template layering such as z-20.
    const updates = planStackingChange(entries(20, 3, null), 2, "front");

    assert.deepEqual(updates, [{ index: 2, zIndex: 21 }]);
  });

  it("drops the moved element below the lowest sibling", () => {
    const updates = planStackingChange(entries(4, 9, 7), 1, "back");

    assert.deepEqual(updates, [{ index: 1, zIndex: 3 }]);
  });

  it("steps over exactly one layer at a time", () => {
    assert.deepEqual(planStackingChange(entries(2, 5, 9), 0, "forward"), [{ index: 0, zIndex: 6 }]);
    assert.deepEqual(planStackingChange(entries(2, 5, 9), 2, "backward"), [{ index: 2, zIndex: 4 }]);
  });

  it("treats an untouched sibling as layer zero", () => {
    assert.equal(explicitZIndex("auto"), null);
    assert.equal(explicitZIndex(undefined), null);
    assert.equal(explicitZIndex(""), null);
    assert.equal(explicitZIndex("12"), 12);
    assert.deepEqual(planStackingChange(entries(null, null), 0, "front"), [{ index: 0, zIndex: 1 }]);
  });

  it("escapes a tie by rising above the elements sharing its layer", () => {
    assert.deepEqual(planStackingChange(entries(5, 5, 5), 1, "forward"), [{ index: 1, zIndex: 6 }]);
  });

  it("does nothing when the element is already where it would go", () => {
    assert.deepEqual(planStackingChange(entries(9, 1, 2), 0, "front"), []);
    assert.deepEqual(planStackingChange(entries(0, 4, 6), 0, "back"), []);
    assert.deepEqual(planStackingChange(entries(9, 1), 0, "forward"), []);
    assert.deepEqual(planStackingChange(entries(1, 9), 0, "backward"), []);
    assert.deepEqual(planStackingChange(entries(3), 0, "front"), []);
  });

  // A negative z-index paints the element behind the background of its own
  // parent, which reads as the element disappearing.
  it("lifts the group rather than going negative, keeping the gaps intact", () => {
    const updates = planStackingChange(entries(null, 0, 4), 1, "back");

    assert.deepEqual(updates, [
      { index: 1, zIndex: 0 },
      { index: 0, zIndex: 1 },
      { index: 2, zIndex: 5 },
    ]);
  });

  it("ignores an out of range target", () => {
    assert.deepEqual(planStackingChange(entries(1, 2), 7, "front"), []);
  });
});
