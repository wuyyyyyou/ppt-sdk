import { describe, expect, it } from 'vitest';

import { extractCssImageUrls } from '../css-image-url.js';

const nestedSvgDataUrl = String.raw`data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\"/%3E%3C/filter%3E%3Crect filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E`;

describe('CSS image URL parsing', () => {
  it('treats a quoted SVG data URL as one image', () => {
    expect(extractCssImageUrls(`url("${nestedSvgDataUrl}")`)).toEqual([nestedSvgDataUrl.replaceAll('\\"', '"')]);
  });

  it('extracts top-level URLs from multiple layers', () => {
    expect(
      extractCssImageUrls('url("https://example.com/a.png"), linear-gradient(red, blue), url(https://example.com/b.png)')
    ).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  it('ignores non-URL image layers', () => {
    expect(extractCssImageUrls('none')).toEqual([]);
    expect(extractCssImageUrls('linear-gradient(red, blue)')).toEqual([]);
  });
});
