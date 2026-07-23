import assert from "node:assert/strict";
import test from "node:test";
import {
  DRAG_THRESHOLD_PX,
  canvasDistance,
  exceedsDragThreshold,
  isMoveableEditorTarget,
} from "../../src/features/manual-page-editor/manualPageEditorInteractions.ts";

function elementLike(classes: string[]): { closest: (selector: string) => object | null } {
  return {
    closest: (selector) => selector.includes("manual-editor-moveable") && classes.includes("manual-editor-moveable")
      ? {}
      : null,
  };
}

test("Moveable 控制层不会被当作 PPT 元素选中", () => {
  assert.equal(isMoveableEditorTarget(elementLike(["manual-editor-moveable"])), true);
  assert.equal(isMoveableEditorTarget(elementLike(["ppt-element"])), false);
  assert.equal(isMoveableEditorTarget(null), false);
});

test("拖动阈值按画布坐标判断，轻微抖动不会启动拖动", () => {
  assert.equal(exceedsDragThreshold([3, 0]), false);
  assert.equal(exceedsDragThreshold([DRAG_THRESHOLD_PX, 0]), true);
  assert.equal(exceedsDragThreshold([2, 0], 0.5), true);
});

test("屏幕距离按当前画布缩放比例换算为画布距离", () => {
  assert.deepEqual(canvasDistance([10, -6], 0.5), [20, -12]);
  assert.deepEqual(canvasDistance([10, -6], 2), [5, -3]);
});
