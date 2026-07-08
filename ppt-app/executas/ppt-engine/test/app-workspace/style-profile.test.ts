import test from "node:test";
import assert from "node:assert/strict";
import { selectEvenlySpacedReferenceImages } from "../../src/app-workspace/index.js";

test("selectEvenlySpacedReferenceImages keeps every image when count is at most five", () => {
  assert.deepEqual(selectEvenlySpacedReferenceImages([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
});

test("selectEvenlySpacedReferenceImages samples five images evenly and includes first and last", () => {
  assert.deepEqual(selectEvenlySpacedReferenceImages(Array.from({ length: 6 }, (_, index) => index + 1)), [1, 2, 4, 5, 6]);
  assert.deepEqual(selectEvenlySpacedReferenceImages(Array.from({ length: 10 }, (_, index) => index + 1)), [1, 3, 6, 8, 10]);
  assert.deepEqual(selectEvenlySpacedReferenceImages(Array.from({ length: 20 }, (_, index) => index + 1)), [1, 6, 11, 15, 20]);
  assert.deepEqual(selectEvenlySpacedReferenceImages(Array.from({ length: 50 }, (_, index) => index + 1)), [1, 13, 26, 38, 50]);
});
