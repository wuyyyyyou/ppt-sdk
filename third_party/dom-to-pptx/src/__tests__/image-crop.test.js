import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProcessedImage } from '../image-processor.js';

describe('manual editor image crops', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps a normalized source crop directly into the target image box', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      drawImage,
      set fillStyle(_value) {},
      set globalCompositeOperation(_value) {},
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cropped');

    class FakeImage {
      width = 1000;
      height = 500;
      onload = null;
      onerror = null;
      set src(_value) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const result = await getProcessedImage(
      'data:image/png;base64,source',
      400,
      200,
      0,
      'fill',
      '50% 50%',
      { x: 0.25, y: 0.1, width: 0.5, height: 0.5 }
    );

    expect(result).toBe('data:image/png;base64,cropped');
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), -200, -40, 800, 400);
  });
});
