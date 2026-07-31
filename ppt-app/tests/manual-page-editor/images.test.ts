import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_CROP_MAX_ZOOM,
  clampSourcePosition,
  constrainCropFrame,
  constrainSourceBox,
  cropForBoxes,
  imageDisplaySize,
  sourceBoxForCrop,
} from "../../src/features/manual-page-editor/manualPageEditorImages";

test("新图片在 480x320 区域内按原比例缩小且不会放大小图", () => {
  assert.deepEqual(imageDisplaySize(1600, 900), { width: 480, height: 270 });
  assert.deepEqual(imageDisplaySize(900, 1600), { width: 180, height: 320 });
  assert.deepEqual(imageDisplaySize(120, 80), { width: 120, height: 80 });
});

test("裁剪框与归一化取景参数可以无损往返", () => {
  const frame = { left: 320, top: 180, width: 400, height: 200 };
  const crop = { x: 0.2, y: 0.25, width: 0.5, height: 0.4 };
  const source = sourceBoxForCrop(frame, crop);

  assert.deepEqual(source, {
    left: 160,
    top: 55,
    width: 800,
    height: 500,
  });
  assert.deepEqual(cropForBoxes(frame, source), crop);
});

test("移动和缩放原图时始终覆盖裁剪框并限制在三倍以内", () => {
  const frame = { left: 100, top: 100, width: 400, height: 200 };
  assert.deepEqual(
    clampSourcePosition({ left: 300, top: 200, width: 600, height: 300 }, frame),
    { left: 100, top: 100, width: 600, height: 300 },
  );

  const constrained = constrainSourceBox(
    { left: -2000, top: -2000, width: 10000, height: 5000 },
    frame,
    2,
  );
  assert.equal(constrained.width, frame.width * IMAGE_CROP_MAX_ZOOM);
  assert.equal(constrained.height, frame.height * IMAGE_CROP_MAX_ZOOM);
  assert.ok(constrained.left <= frame.left);
  assert.ok(constrained.left + constrained.width >= frame.left + frame.width);
  assert.ok(constrained.top <= frame.top);
  assert.ok(constrained.top + constrained.height >= frame.top + frame.height);
});

test("自由裁剪框不能越过原图或缩小到 16px 以下", () => {
  const source = { left: 50, top: 40, width: 500, height: 300 };
  assert.deepEqual(
    constrainCropFrame({ left: 0, top: 0, width: 900, height: 700 }, source),
    source,
  );
  assert.deepEqual(
    constrainCropFrame({ left: 540, top: 330, width: 2, height: 2 }, source),
    { left: 526, top: 316, width: 16, height: 16 },
  );
});
