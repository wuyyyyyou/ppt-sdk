import { describe, it, expect, beforeAll, vi } from 'vitest';
import { collectTextParts } from '../utils.js';
import { exportToPptx } from '../index.js';
import { getProcessedImage } from '../image-processor.js';

// Mock pptxgenjs
const mockAddText = vi.fn();
const mockAddImage = vi.fn();
const mockAddShape = vi.fn();
const mockAddSlide = vi.fn(() => ({
  addText: mockAddText,
  addShape: mockAddShape,
  addImage: mockAddImage,
  addTable: vi.fn(),
}));

vi.mock('../image-processor.js', () => ({
  getProcessedImage: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

vi.mock('pptxgenjs', () => {
  const mockShapeType = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse' };
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        defineLayout: vi.fn(),
        addSlide: mockAddSlide,
        write: vi.fn(() => Promise.resolve('')),
        ShapeType: mockShapeType,
      };
    }),
  };
});

describe('Bug 2: Inline styled badges keep highlight', () => {
  beforeAll(() => {
    // Mock HTMLCanvasElement.prototype.getContext for JSDOM env
    let fillStyle = '';
    HTMLCanvasElement.prototype.getContext = () => ({
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(val) {
        fillStyle = val;
      },
      clearRect: () => {},
      fillRect: () => {},
      getImageData: () => ({ data: [0, 0, 0, 0] }),
    });
  });

  it('should keep highlight on inline elements and delete on block elements', () => {
    // Test case 1: inline-block element (e.g. badge)
    const span = document.createElement('span');
    span.style.backgroundColor = 'blue';
    span.style.display = 'inline-block';
    const textNode = document.createTextNode('LABEL');
    span.appendChild(textNode);
    document.body.appendChild(span);

    const partsSpan = collectTextParts(span, window.getComputedStyle(span), 1);
    expect(partsSpan[0].options.highlight).toBeDefined();

    // Test case 2: block element (e.g. div)
    const div = document.createElement('div');
    div.style.backgroundColor = 'blue';
    div.style.display = 'block';
    const textNodeDiv = document.createTextNode('LABEL');
    div.appendChild(textNodeDiv);
    document.body.appendChild(div);

    const partsDiv = collectTextParts(div, window.getComputedStyle(div), 1);
    expect(partsDiv[0].options.highlight).toBeUndefined();

    // Clean up
    document.body.removeChild(span);
    document.body.removeChild(div);
  });
});

describe('Bug 3: No duplicate rendering of inline elements', () => {
  it('should not render independent shape+text for span child inside text container', async () => {
    mockAddText.mockClear();

    const container = document.createElement('div');
    container.className = 'slide';
    container.style.width = '960px';
    container.style.height = '540px';

    const div = document.createElement('div');
    div.innerHTML = 'Some text <span>PMA</span> other text';
    container.appendChild(div);
    document.body.appendChild(container);

    // Mock layout measurements
    container.getBoundingClientRect = () => ({ width: 960, height: 540, left: 0, top: 0, right: 960, bottom: 540 });
    div.getBoundingClientRect = () => ({ width: 900, height: 100, left: 30, top: 30, right: 930, bottom: 130 });
    const span = div.querySelector('span');
    span.getBoundingClientRect = () => ({ width: 50, height: 20, left: 150, top: 35, right: 200, bottom: 55 });

    await exportToPptx(container, { skipDownload: true, skipNormalize: true });

    // Assert that we don't have separate text box for 'PMA'
    // The text 'PMA' should only be present inside the main text box containing the full parts list.
    const pmaCalls = mockAddText.mock.calls.filter((call) => {
      const [textParts] = call;
      if (Array.isArray(textParts)) {
        const textStr = textParts
          .map((p) => p.text)
          .join('')
          .trim();
        return textStr === 'PMA';
      }
      return false;
    });

    expect(pmaCalls.length).toBe(0);

    document.body.removeChild(container);
  });
});

describe('Bug 4: Image opacity is preserved in PPTX', () => {
  function setRect(element, { width = 960, height = 540, left = 0, top = 0 } = {}) {
    element.getBoundingClientRect = () => ({
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    });
  }

  async function exportElement(element) {
    const container = document.createElement('div');
    container.style.width = '960px';
    container.style.height = '540px';
    setRect(container);
    setRect(element);
    container.appendChild(element);
    document.body.appendChild(container);

    mockAddImage.mockClear();
    mockAddShape.mockClear();
    await exportToPptx(container, { skipDownload: true, skipNormalize: true });
    document.body.removeChild(container);

    return mockAddImage.mock.calls.map(([options]) => options);
  }

  it('applies an img element opacity as image transparency', async () => {
    const image = document.createElement('img');
    image.src = 'https://example.com/background.png';
    image.style.opacity = '0.15';

    const imageOptions = await exportElement(image);

    expect(imageOptions).toHaveLength(1);
    expect(imageOptions[0].transparency).toBeCloseTo(85);
  });

  it('combines parent and img opacity as image transparency', async () => {
    const wrapper = document.createElement('div');
    wrapper.style.opacity = '0.5';
    setRect(wrapper);

    const image = document.createElement('img');
    image.src = 'https://example.com/background.png';
    image.style.opacity = '0.5';
    setRect(image);
    wrapper.appendChild(image);

    const imageOptions = await exportElement(wrapper);

    expect(imageOptions).toHaveLength(1);
    expect(imageOptions[0].transparency).toBeCloseTo(75);
  });

  it('applies element opacity to a CSS background image', async () => {
    const background = document.createElement('div');
    background.style.backgroundImage = 'url("https://example.com/background.png")';
    background.style.backgroundSize = 'cover';
    background.style.opacity = '0.05';

    const imageOptions = await exportElement(background);

    expect(imageOptions).toHaveLength(1);
    expect(imageOptions[0].transparency).toBeCloseTo(95);
  });

  it('does not add transparency to an opaque image', async () => {
    const image = document.createElement('img');
    image.src = 'https://example.com/background.png';

    const imageOptions = await exportElement(image);

    expect(imageOptions).toHaveLength(1);
    expect(imageOptions[0]).not.toHaveProperty('transparency');
  });

  it('passes a complete SVG data URL with an internal fragment to image processing', async () => {
    const background = document.createElement('div');
    const dataUrl =
      'data:image/svg+xml,%3Csvg viewBox="0 0 200 200"%3E%3Cfilter id="noiseFilter"/%3E%3Crect filter="url(%23noiseFilter)"/%3E%3C/svg%3E';
    background.style.backgroundImage = `url('${dataUrl}')`;
    vi.mocked(getProcessedImage).mockClear();

    await exportElement(background);

    expect(getProcessedImage).toHaveBeenCalledOnce();
    expect(vi.mocked(getProcessedImage).mock.calls[0][0]).toBe(dataUrl);
  });

  it('keeps a solid background below a transparent gradient background', async () => {
    const background = document.createElement('div');
    background.style.backgroundColor = 'rgb(245, 241, 227)';
    background.style.backgroundImage = 'radial-gradient(rgba(0, 0, 0, 0.02) 2%, transparent 2%)';

    const imageOptions = await exportElement(background);

    expect(mockAddShape).toHaveBeenCalledOnce();
    expect(mockAddShape.mock.calls[0][1].fill).toMatchObject({ color: 'F5F1E3', transparency: 0 });
    expect(imageOptions).toHaveLength(1);
    expect(mockAddShape.mock.invocationCallOrder[0]).toBeLessThan(mockAddImage.mock.invocationCallOrder[0]);
  });

  it('keeps a solid background below a URL background image', async () => {
    const background = document.createElement('div');
    background.style.backgroundColor = 'rgb(245, 241, 227)';
    background.style.backgroundImage = 'url("https://example.com/transparent-background.png")';

    const imageOptions = await exportElement(background);

    expect(mockAddShape).toHaveBeenCalledOnce();
    expect(mockAddShape.mock.calls[0][1].fill).toMatchObject({ color: 'F5F1E3', transparency: 0 });
    expect(imageOptions).toHaveLength(1);
    expect(mockAddShape.mock.invocationCallOrder[0]).toBeLessThan(mockAddImage.mock.invocationCallOrder[0]);
  });

  it('renders a background border and shadow only once around layered backgrounds', async () => {
    const background = document.createElement('div');
    background.style.backgroundColor = 'rgb(245, 241, 227)';
    background.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.1), transparent)';
    background.style.border = '2px solid rgb(30, 40, 50)';
    background.style.borderRadius = '12px';
    background.style.boxShadow = 'rgb(0, 0, 0) 2px 3px 4px';

    await exportElement(background);

    const shapeOptions = mockAddShape.mock.calls.map(([, options]) => options);
    expect(shapeOptions.filter((options) => options.fill?.color === 'F5F1E3')).toHaveLength(1);
    expect(shapeOptions.filter((options) => options.line)).toHaveLength(1);
    expect(shapeOptions.filter((options) => options.shadow)).toHaveLength(1);

    const borderCallIndex = shapeOptions.findIndex((options) => options.line);
    expect(mockAddImage.mock.invocationCallOrder[0]).toBeLessThan(
      mockAddShape.mock.invocationCallOrder[borderCallIndex]
    );
  });

  it('keeps the solid background and skips explicitly sized repeating gradient textures', async () => {
    const background = document.createElement('div');
    background.style.backgroundColor = 'rgb(245, 241, 227)';
    background.style.backgroundImage = 'radial-gradient(rgb(0, 0, 0) 1px, transparent 0px)';
    background.style.backgroundSize = '40px 40px';
    background.style.backgroundRepeat = 'repeat';
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const imageOptions = await exportElement(background);

    expect(imageOptions).toHaveLength(0);
    expect(mockAddShape).toHaveBeenCalledOnce();
    expect(mockAddShape.mock.calls[0][1].fill).toMatchObject({ color: 'F5F1E3', transparency: 0 });
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
