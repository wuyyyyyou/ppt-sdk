import { describe, expect, it } from 'vitest';
import { generateGradientSVG } from '../utils.js';

function decodeSvg(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64').toString('utf8');
}

describe('radial gradient backgrounds', () => {
  it('converts the PPT-SDK radial background into an SVG radialGradient', () => {
    const dataUrl = generateGradientSVG(
      1280,
      720,
      'radial-gradient(circle, rgb(10, 22, 51) 0%, rgb(5, 10, 26) 100%)',
      0,
      null
    );

    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = decodeSvg(dataUrl);
    expect(svg).toContain('<radialGradient');
    expect(svg).toContain('rgb(10, 22, 51)');
    expect(svg).toContain('rgb(5, 10, 26)');
    expect(svg).toContain('scale(640 640)');
  });

  it('supports a positioned ellipse', () => {
    const svg = decodeSvg(
      generateGradientSVG(200, 100, 'radial-gradient(ellipse at 25% 75%, red 0%, blue 100%)', 0, null)
    );

    expect(svg).toContain('translate(50 75)');
    expect(svg).toContain('scale(150 75)');
  });
});
