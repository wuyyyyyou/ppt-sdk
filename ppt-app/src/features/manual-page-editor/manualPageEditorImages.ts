export const IMAGE_CROP_FRAME_ATTRIBUTE = "data-ppt-editor-image-crop";
export const IMAGE_CROP_SOURCE_ATTRIBUTE = "data-ppt-editor-image-source";
export const IMAGE_CROP_MIN_SIZE = 16;
export const IMAGE_CROP_MAX_ZOOM = 3;

export interface ImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FULL_CROP: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };
const EDITOR_DATA_KEYS = [
  "pptEditorCreated",
  "pptEditorDeleted",
  "pptEditorId",
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function imageDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  maximumWidth = 480,
  maximumHeight = 320,
): { width: number; height: number } {
  const width = finitePositive(naturalWidth, 1);
  const height = finitePositive(naturalHeight, 1);
  const factor = Math.min(1, maximumWidth / width, maximumHeight / height);
  return {
    width: width * factor,
    height: height * factor,
  };
}

export function isCroppedImage(element: HTMLElement | null | undefined): boolean {
  return element?.getAttribute(IMAGE_CROP_FRAME_ATTRIBUTE) === "true";
}

export function isEditableImage(element: HTMLElement | null | undefined): boolean {
  return element?.tagName === "IMG" || isCroppedImage(element);
}

export function imageSourceElement(element: HTMLElement): HTMLImageElement | null {
  if (element.tagName === "IMG") return element as HTMLImageElement;
  if (!isCroppedImage(element)) return null;
  return element.querySelector<HTMLImageElement>(`img[${IMAGE_CROP_SOURCE_ATTRIBUTE}="true"]`);
}

export function normalizeCrop(crop: ImageCrop): ImageCrop {
  const minimumSize = 0.000001;
  const x = clamp(Number.isFinite(crop.x) ? crop.x : 0, 0, 1 - minimumSize);
  const y = clamp(Number.isFinite(crop.y) ? crop.y : 0, 0, 1 - minimumSize);
  const width = clamp(finitePositive(crop.width, 1), minimumSize, 1 - x);
  const height = clamp(finitePositive(crop.height, 1), minimumSize, 1 - y);
  return { x, y, width, height };
}

export function readImageCrop(element: HTMLElement): ImageCrop {
  if (!isCroppedImage(element)) return { ...FULL_CROP };
  return normalizeCrop({
    x: Number.parseFloat(element.dataset.pptEditorCropX ?? "0"),
    y: Number.parseFloat(element.dataset.pptEditorCropY ?? "0"),
    width: Number.parseFloat(element.dataset.pptEditorCropWidth ?? "1"),
    height: Number.parseFloat(element.dataset.pptEditorCropHeight ?? "1"),
  });
}

export function sourceBoxForCrop(frame: ImageBox, crop: ImageCrop): ImageBox {
  const normalized = normalizeCrop(crop);
  const width = frame.width / normalized.width;
  const height = frame.height / normalized.height;
  return {
    left: frame.left - normalized.x * width,
    top: frame.top - normalized.y * height,
    width,
    height,
  };
}

export function cropForBoxes(frame: ImageBox, source: ImageBox): ImageCrop {
  return normalizeCrop({
    x: (frame.left - source.left) / source.width,
    y: (frame.top - source.top) / source.height,
    width: frame.width / source.width,
    height: frame.height / source.height,
  });
}

export function clampSourcePosition(source: ImageBox, frame: ImageBox): ImageBox {
  return {
    ...source,
    left: clamp(source.left, frame.left + frame.width - source.width, frame.left),
    top: clamp(source.top, frame.top + frame.height - source.height, frame.top),
  };
}

export function constrainSourceBox(
  candidate: ImageBox,
  frame: ImageBox,
  aspectRatio: number,
): ImageBox {
  const ratio = finitePositive(aspectRatio, finitePositive(candidate.width / candidate.height, 1));
  const minimumWidth = Math.max(frame.width, frame.height * ratio);
  const width = clamp(candidate.width, minimumWidth, minimumWidth * IMAGE_CROP_MAX_ZOOM);
  const height = width / ratio;
  const centerX = candidate.left + candidate.width / 2;
  const centerY = candidate.top + candidate.height / 2;
  return clampSourcePosition({
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  }, frame);
}

export function constrainCropFrame(candidate: ImageBox, source: ImageBox): ImageBox {
  const right = clamp(
    candidate.left + candidate.width,
    source.left + IMAGE_CROP_MIN_SIZE,
    source.left + source.width,
  );
  const bottom = clamp(
    candidate.top + candidate.height,
    source.top + IMAGE_CROP_MIN_SIZE,
    source.top + source.height,
  );
  const left = clamp(candidate.left, source.left, right - IMAGE_CROP_MIN_SIZE);
  const top = clamp(candidate.top, source.top, bottom - IMAGE_CROP_MIN_SIZE);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function cropValue(value: number): string {
  return String(Number(value.toFixed(6)));
}

function applyCropLayout(frame: HTMLElement, crop: ImageCrop): void {
  const normalized = normalizeCrop(crop);
  frame.dataset.pptEditorCropX = cropValue(normalized.x);
  frame.dataset.pptEditorCropY = cropValue(normalized.y);
  frame.dataset.pptEditorCropWidth = cropValue(normalized.width);
  frame.dataset.pptEditorCropHeight = cropValue(normalized.height);
  const image = imageSourceElement(frame);
  if (!image) return;
  image.style.setProperty("position", "absolute", "important");
  image.style.setProperty("left", `${(-normalized.x / normalized.width) * 100}%`, "important");
  image.style.setProperty("top", `${(-normalized.y / normalized.height) * 100}%`, "important");
  image.style.setProperty("width", `${100 / normalized.width}%`, "important");
  image.style.setProperty("height", `${100 / normalized.height}%`, "important");
  image.style.setProperty("max-width", "none", "important");
  image.style.setProperty("max-height", "none", "important");
  image.style.setProperty("margin", "0", "important");
  image.style.setProperty("border", "0", "important");
  image.style.setProperty("border-radius", "0", "important");
  image.style.setProperty("box-shadow", "none", "important");
  image.style.setProperty("filter", "none", "important");
  image.style.setProperty("opacity", "1", "important");
  image.style.setProperty("object-fit", "fill", "important");
  image.style.setProperty("object-position", "50% 50%", "important");
  image.style.setProperty("transform", "none", "important");
  image.style.setProperty("pointer-events", "none", "important");
}

function copyEditorDataset(from: HTMLElement, to: HTMLElement): void {
  for (const key of EDITOR_DATA_KEYS) {
    const value = from.dataset[key];
    if (value !== undefined) to.dataset[key] = value;
    delete from.dataset[key];
  }
}

function copyImageFrameAppearance(
  image: HTMLImageElement,
  frame: HTMLDivElement,
  computed: CSSStyleDeclaration,
): void {
  frame.style.cssText = image.style.cssText;
  const properties = [
    "background",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
    "boxShadow",
    "filter",
    "opacity",
    "transform",
    "transformOrigin",
    "zIndex",
  ] as const;
  for (const property of properties) {
    const value = computed[property];
    if (value && value !== "none" && value !== "normal" && value !== "auto") {
      frame.style[property] = value;
    }
  }
  frame.style.overflow = "hidden";
}

export function wrapImageWithCrop(image: HTMLImageElement, crop: ImageCrop): HTMLElement {
  const parent = image.parentElement;
  if (!parent) return image;
  const view = image.ownerDocument.defaultView;
  const computed = view?.getComputedStyle(image);
  if (!computed) return image;

  const frame = image.ownerDocument.createElement("div");
  frame.setAttribute(IMAGE_CROP_FRAME_ATTRIBUTE, "true");
  copyImageFrameAppearance(image, frame, computed);
  copyEditorDataset(image, frame);
  frame.className = image.className;
  if (image.id) {
    frame.id = image.id;
    image.removeAttribute("id");
  }
  image.className = "";
  image.setAttribute(IMAGE_CROP_SOURCE_ATTRIBUTE, "true");
  parent.insertBefore(frame, image);
  frame.append(image);
  applyCropLayout(frame, crop);
  return frame;
}

export function updateImageCrop(frame: HTMLElement, crop: ImageCrop): void {
  if (!isCroppedImage(frame)) return;
  applyCropLayout(frame, crop);
}

export function resetImageCrop(frame: HTMLElement): HTMLImageElement | null {
  if (!isCroppedImage(frame)) return frame.tagName === "IMG" ? frame as HTMLImageElement : null;
  const image = imageSourceElement(frame);
  if (!image || !frame.parentElement) return null;
  image.style.cssText = frame.style.cssText;
  image.style.overflow = "";
  image.style.objectFit = "fill";
  image.style.objectPosition = "50% 50%";
  image.className = frame.className;
  if (frame.id) image.id = frame.id;
  copyEditorDataset(frame, image);
  image.removeAttribute(IMAGE_CROP_SOURCE_ATTRIBUTE);
  frame.replaceWith(image);
  return image;
}
