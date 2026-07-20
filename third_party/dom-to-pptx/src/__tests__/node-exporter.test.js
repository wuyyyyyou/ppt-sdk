// src/__tests__/node-exporter.test.js
//
// Tests for the Puppeteer launch-arg helper used by exportHtmlToPptx.
//
// Motivation: without --allow-file-access-from-files, Chromium blocks
// fetch() from a file:// page to other file:// URLs — which is the
// exact code path autoEmbedFonts uses to pull local .ttf files into an
// embedded font blob. The failure is silent (fetch just rejects, the
// per-font warn is easy to miss), so users end up with a fonts-less
// PPTX that PowerPoint renders in a fallback system font. Enabling the
// flag by default prevents that failure mode.

import { describe, it, expect } from 'vitest';
import { getLaunchArgs } from '../node-exporter.js';

describe('getLaunchArgs', () => {
  it('enables --allow-file-access-from-files for Chrome/Chromium/Edge', () => {
    const args = getLaunchArgs('chrome');
    expect(args).toContain('--allow-file-access-from-files');
  });

  it('keeps the existing --no-sandbox flags for Chrome-family browsers', () => {
    const args = getLaunchArgs('chrome');
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });

  it('returns an empty arg list for Firefox (WebDriver BiDi manages its own launch)', () => {
    expect(getLaunchArgs('firefox')).toEqual([]);
  });

  it('is a pure function — repeated calls produce distinct arrays that can be safely mutated', () => {
    const a = getLaunchArgs('chrome');
    const b = getLaunchArgs('chrome');
    expect(a).toEqual(b);
    // Mutating one should not affect the other.
    a.push('--custom');
    expect(b).not.toContain('--custom');
  });
});
