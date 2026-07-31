import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addImage: vi.fn(),
  addShape: vi.fn(),
  addText: vi.fn(),
}));

vi.mock('pptxgenjs', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      defineLayout: vi.fn(),
      addSlide: vi.fn(() => ({
        addImage: mocks.addImage,
        addShape: mocks.addShape,
        addText: mocks.addText,
        addTable: vi.fn(),
      })),
      write: vi.fn(() => Promise.resolve('')),
      ShapeType: { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse' },
    };
  }),
}));

import { exportToPptx } from '../index.js';

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
}

describe('manual editor crop export', () => {
  beforeEach(() => {
    mocks.addImage.mockClear();
    mocks.addShape.mockClear();
    mocks.addText.mockClear();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the crop frame geometry and normalized source crop for PPTX', async () => {
    const drawImage = vi.fn();
    let fillStyle = '';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      drawImage,
      get fillStyle() { return fillStyle; },
      set fillStyle(value) { fillStyle = value; },
      set globalCompositeOperation(_value) {},
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cropped');
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = nativeGetComputedStyle(element);
      return new Proxy(style, {
        get(target, property) {
          const value = Reflect.get(target, property, target);
          if (typeof value === 'function') return value.bind(target);
          return value ?? '';
        },
      });
    });

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

    const root = document.createElement('div');
    root.style.width = '1280px';
    root.style.height = '720px';
    root.style.border = '0 solid transparent';
    root.getBoundingClientRect = () => rect(0, 0, 1280, 720);

    const frame = document.createElement('div');
    frame.setAttribute('data-ppt-editor-image-crop', 'true');
    frame.dataset.pptEditorCropX = '0.25';
    frame.dataset.pptEditorCropY = '0.1';
    frame.dataset.pptEditorCropWidth = '0.5';
    frame.dataset.pptEditorCropHeight = '0.5';
    frame.style.position = 'absolute';
    frame.style.left = '100px';
    frame.style.top = '80px';
    frame.style.width = '400px';
    frame.style.height = '200px';
    frame.style.overflow = 'hidden';
    frame.style.border = '0 solid transparent';
    frame.getBoundingClientRect = () => rect(100, 80, 400, 200);
    Object.defineProperties(frame, {
      offsetWidth: { value: 400 },
      offsetHeight: { value: 200 },
    });

    const image = document.createElement('img');
    image.setAttribute('data-ppt-editor-image-source', 'true');
    image.src = 'data:image/png;base64,source';
    image.style.position = 'absolute';
    image.style.left = '-200px';
    image.style.top = '-40px';
    image.style.width = '800px';
    image.style.height = '400px';
    image.style.border = '0 solid transparent';
    image.getBoundingClientRect = () => rect(-100, 40, 800, 400);
    Object.defineProperties(image, {
      offsetWidth: { value: 800 },
      offsetHeight: { value: 400 },
    });

    frame.append(image);
    root.append(frame);
    document.body.append(root);

    await exportToPptx(root, { skipDownload: true, skipNormalize: true });

    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), -200, -40, 800, 400);
    expect(mocks.addImage).toHaveBeenCalledWith(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      w: expect.any(Number),
      h: expect.any(Number),
      data: 'data:image/png;base64,cropped',
    }));
  });
});
