import assert from "node:assert/strict";
import test from "node:test";
import {
  DRAG_THRESHOLD_PX,
  canvasDistance,
  exceedsDragThreshold,
  isMoveableEditorTarget,
  isSelectableBox,
  type SelectionCandidate,
} from "../../src/features/manual-page-editor/manualPageEditorInteractions.ts";

function candidate(overrides: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    tagName: "DIV",
    display: "block",
    visibility: "visible",
    width: 120,
    height: 40,
    isEditorArtifact: false,
    ...overrides,
  };
}

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

test("模板里当作形状用的 span 可以直接点中", () => {
  // 标题左侧的竖线：<span style={{ position: absolute, width: 5 }} />
  assert.equal(isSelectableBox(candidate({ tagName: "SPAN", display: "block", width: 5, height: 24 })), true);
  assert.equal(isSelectableBox(candidate({ tagName: "SPAN", display: "inline-block", width: 5, height: 24 })), true);
  assert.equal(isSelectableBox(candidate({ tagName: "SPAN", display: "flex" })), true);
});

test("正文里的行内文字片段仍然让位给它所在的段落", () => {
  assert.equal(isSelectableBox(candidate({ tagName: "SPAN", display: "inline" })), false);
  assert.equal(isSelectableBox(candidate({ tagName: "STRONG", display: "inline" })), false);
  assert.equal(isSelectableBox(candidate({ tagName: "A", display: "inline" })), false);
  // 行内元素只要不是文字片段就仍然可选，例如行内 SVG 图标。
  assert.equal(isSelectableBox(candidate({ tagName: "SVG", display: "inline" })), true);
});

test("没有可见外框的节点不参与选中", () => {
  assert.equal(isSelectableBox(candidate({ display: "none" })), false);
  assert.equal(isSelectableBox(candidate({ display: "contents" })), false);
  assert.equal(isSelectableBox(candidate({ visibility: "hidden" })), false);
  assert.equal(isSelectableBox(candidate({ height: 0 })), false);
  assert.equal(isSelectableBox(candidate({ isEditorArtifact: true })), false);
});
