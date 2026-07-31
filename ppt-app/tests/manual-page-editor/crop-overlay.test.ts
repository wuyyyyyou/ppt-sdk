import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const CROP_OVERLAY = "src/features/manual-page-editor/ManualImageCropOverlay.tsx";

test("裁剪层使用独立的指针捕获手势，避免重叠 Moveable 吞掉拖拽", async () => {
  const source = await readFile(path.resolve(CROP_OVERLAY), "utf8");

  assert.doesNotMatch(source, /<Moveable/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /releasePointerCapture\(event\.pointerId\)/);
  assert.match(source, /data-crop-interaction="move-source"/);
  assert.match(source, /data-crop-interaction=\{`scale-source-\$\{direction\}`\}/);
  assert.match(source, /data-crop-interaction=\{`resize-frame-\$\{direction\}`\}/);
  assert.match(source, /touchAction: "none"/);
});
