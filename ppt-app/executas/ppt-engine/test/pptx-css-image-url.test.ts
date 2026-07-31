import assert from "node:assert/strict";
import test from "node:test";

import { extractCssImageUrls } from "../src/pptx-export/css-image-url.js";

const nestedSvgDataUrl = String.raw`data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\"/%3E%3C/filter%3E%3Crect filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E`;

test("CSS image URL parser treats a quoted SVG data URL as one image", () => {
  assert.deepEqual(
    extractCssImageUrls(`url("${nestedSvgDataUrl}")`),
    [nestedSvgDataUrl.replaceAll('\\"', '"')],
  );
});

test("CSS image URL parser extracts top-level URLs from multiple layers", () => {
  assert.deepEqual(
    extractCssImageUrls('url("https://example.com/a.png"), linear-gradient(red, blue), url(https://example.com/b.png)'),
    ["https://example.com/a.png", "https://example.com/b.png"],
  );
});

test("CSS image URL parser ignores non-URL image layers", () => {
  assert.deepEqual(extractCssImageUrls("none"), []);
  assert.deepEqual(extractCssImageUrls("linear-gradient(red, blue)"), []);
});
