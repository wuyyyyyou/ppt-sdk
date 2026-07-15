import type {
  PresentationDocument,
  PresentationElement,
  PresentationSlideDocument,
} from "../../../api/types";

export function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function orderedSlides(document: PresentationDocument): PresentationSlideDocument[] {
  return [...document.slides].sort((left, right) => left.order - right.order);
}

export function cloneSlideWithNewIds(
  slide: PresentationSlideDocument,
  order: number,
): PresentationSlideDocument {
  const next = structuredClone(slide);
  next.id = nextId("slide");
  next.order = order;
  next.elements = next.elements.map((element) => ({
    ...element,
    id: nextId("element"),
    sourceElementId: element.sourceElementId,
  }));
  return next;
}

/** Insert a duplicate of the slide right after it. Returns the new slide id. */
export function duplicateSlide(document: PresentationDocument, slideId: string): string | null {
  const source = document.slides.find((item) => item.id === slideId);
  if (!source) return null;
  const duplicate = cloneSlideWithNewIds(source, source.order + 1);
  document.slides.forEach((item) => {
    if (item.order > source.order) item.order += 1;
  });
  document.slides.push(duplicate);
  return duplicate.id;
}

/** Append an empty slide at the end. Returns the new slide id. */
export function addBlankSlide(document: PresentationDocument, template?: PresentationSlideDocument): string {
  const order = document.slides.length;
  const slide: PresentationSlideDocument = {
    id: nextId("slide"),
    order,
    background: template?.background ? structuredClone(template.background) : { color: "FFFFFF", opacity: 1 },
    elements: [],
    metadata: { sourceSlideIndex: template?.metadata.sourceSlideIndex ?? 0 },
  };
  document.slides.push(slide);
  return slide.id;
}

/** Remove a slide and re-pack orders. Returns the id of the nearest remaining slide. */
export function deleteSlide(document: PresentationDocument, slideId: string): string | null {
  if (document.slides.length <= 1) return null;
  const ordered = orderedSlides(document);
  const index = ordered.findIndex((item) => item.id === slideId);
  if (index < 0) return null;
  document.slides = ordered
    .filter((item) => item.id !== slideId)
    .map((item, order) => ({ ...item, order }));
  const nearest = document.slides[Math.min(index, document.slides.length - 1)];
  return nearest?.id ?? null;
}

/** Move a slide to a target position (index within ordered list). */
export function moveSlideTo(document: PresentationDocument, slideId: string, targetIndex: number): void {
  const ordered = orderedSlides(document);
  const fromIndex = ordered.findIndex((item) => item.id === slideId);
  if (fromIndex < 0) return;
  const clamped = Math.max(0, Math.min(targetIndex, ordered.length - 1));
  if (clamped === fromIndex) return;
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(clamped, 0, moved!);
  ordered.forEach((item, index) => {
    const slide = document.slides.find((candidate) => candidate.id === item.id);
    if (slide) slide.order = index;
  });
}

export interface AddElementResult {
  elementId: string;
}

export function addTextElement(document: PresentationDocument, slideId: string): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 420;
  const height = 64;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "text",
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    text: "New text",
    metadata: { sourceShapeIndex: -1, sourceShapeType: "textbox" },
    sourceData: {
      shape_type: "textbox",
      position: { left: x, top: y, width, height },
      text_wrap: true,
      paragraphs: [{
        text: "New text",
        font: { name: "Microsoft YaHei", size: 24, font_weight: 400, italic: false, color: "111827" },
      }],
    },
  });
  return { elementId: id };
}

export function addShapeElement(document: PresentationDocument, slideId: string): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 280;
  const height = 140;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "shape",
    shapeType: "rounded_rectangle",
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    text: "",
    metadata: { sourceShapeIndex: -1, sourceShapeType: "autoshape" },
    sourceData: {
      shape_type: "autoshape",
      type: 5,
      position: { left: x, top: y, width, height },
      text_wrap: true,
      fill: { color: "DDD6FE", opacity: 1 },
      paragraphs: [],
    },
  });
  return { elementId: id };
}

export function addImageElement(
  document: PresentationDocument,
  slideId: string,
  src: string,
): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 480;
  const height = 320;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "image",
    src,
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    metadata: { sourceShapeIndex: -1, sourceShapeType: "picture" },
    sourceData: {
      shape_type: "picture",
      position: { left: x, top: y, width, height },
      clip: false,
      picture: { is_network: /^https?:\/\//i.test(src), path: src },
    },
  });
  return { elementId: id };
}

/** Paste a copied element into the slide with a fresh id and slight offset. */
export function pasteElement(
  document: PresentationDocument,
  slideId: string,
  element: PresentationElement,
): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const copy = structuredClone(element);
  copy.id = id;
  copy.sourceElementId = id;
  copy.x = Math.min(element.x + 16, Math.max(0, document.width - element.width));
  copy.y = Math.min(element.y + 16, Math.max(0, document.height - element.height));
  copy.zIndex = topZIndex(slide) + 1;
  copy.hidden = false;
  copy.metadata = { ...copy.metadata, sourceShapeIndex: -1 };
  slide.elements.push(copy);
  return { elementId: id };
}

/**
 * Delete an element. Elements added in the editor are removed entirely;
 * elements that originate from the source model are hidden so the source
 * mapping stays intact.
 */
export function deleteElement(document: PresentationDocument, slideId: string, elementId: string): void {
  const slide = document.slides.find((item) => item.id === slideId);
  const element = slide?.elements.find((item) => item.id === elementId);
  if (!slide || !element || element.type === "unsupported") return;
  if (element.metadata.sourceShapeIndex === -1) {
    slide.elements = slide.elements.filter((item) => item.id !== elementId);
  } else {
    element.hidden = true;
  }
}

export type ArrangeAction = "front" | "back" | "forward" | "backward";

export function arrangeElement(
  document: PresentationDocument,
  slideId: string,
  elementId: string,
  action: ArrangeAction,
): void {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return;
  const stacked = [...slide.elements].sort((left, right) => left.zIndex - right.zIndex);
  const index = stacked.findIndex((item) => item.id === elementId);
  if (index < 0) return;
  const target = index + (action === "front" ? stacked.length : action === "back" ? -stacked.length : action === "forward" ? 1 : -1);
  const clamped = Math.max(0, Math.min(target, stacked.length - 1));
  if (clamped === index) return;
  const [moved] = stacked.splice(index, 1);
  stacked.splice(clamped, 0, moved!);
  stacked.forEach((item, zIndex) => {
    item.zIndex = zIndex;
  });
}

function topZIndex(slide: PresentationSlideDocument): number {
  return slide.elements.reduce((max, item) => Math.max(max, item.zIndex), -1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const DEFAULT_FONT = {
  name: "Microsoft YaHei",
  size: 20,
  font_weight: 400,
  italic: false,
  color: "111827",
};

/**
 * Apply a font patch to every paragraph (and text run) of a text/shape
 * element's source data so the change survives the round trip back to the
 * PPTX model.
 */
export function patchElementFont(
  element: PresentationElement,
  patch: Partial<{
    name: string;
    size: number;
    font_weight: number;
    italic: boolean;
    color: string;
    underline: boolean;
    strike: boolean;
  }>,
): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (paragraphs.length === 0) {
    source.paragraphs = [{ text: element.text, font: { ...DEFAULT_FONT, ...patch } }];
    element.sourceData = source;
    return;
  }
  for (const entry of paragraphs) {
    const paragraph = asRecord(entry);
    const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
    const baseFont = asRecord(paragraph.font ?? asRecord(runs[0]).font);
    paragraph.font = { ...DEFAULT_FONT, ...baseFont, ...patch };
    for (const runEntry of runs) {
      const run = asRecord(runEntry);
      if (run.font) run.font = { ...DEFAULT_FONT, ...asRecord(run.font), ...patch };
    }
  }
}

export function patchElementAlignment(element: PresentationElement, alignment: 1 | 2 | 3): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (paragraphs.length === 0) {
    source.paragraphs = [{ text: element.text, alignment, font: { ...DEFAULT_FONT } }];
    element.sourceData = source;
    return;
  }
  for (const entry of paragraphs) {
    asRecord(entry).alignment = alignment;
  }
}

export function patchElementFill(
  element: PresentationElement,
  patch: Partial<{ color: string; opacity: number }>,
): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const fill = asRecord(source.fill);
  source.fill = {
    color: typeof fill.color === "string" ? fill.color : "FFFFFF",
    opacity: typeof fill.opacity === "number" ? fill.opacity : 1,
    ...patch,
  };
}

export function clearElementFill(element: PresentationElement): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  delete source.fill;
}

export function patchElementStroke(
  element: PresentationElement,
  patch: Partial<{ color: string; thickness: number; opacity: number }>,
): void {
  if (element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const stroke = asRecord(source.stroke);
  source.stroke = {
    color: typeof stroke.color === "string" ? stroke.color : "111827",
    thickness: typeof stroke.thickness === "number" ? stroke.thickness : 0,
    opacity: typeof stroke.opacity === "number" ? stroke.opacity : 1,
    ...patch,
  };
}

export function patchImageFit(element: PresentationElement, fit: "cover" | "contain" | "fill"): void {
  if (element.type !== "image") return;
  const source = asRecord(element.sourceData);
  const objectFit = asRecord(source.object_fit);
  source.object_fit = { ...objectFit, fit };
}

export function readElementFont(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const paragraph = asRecord(paragraphs[0]);
  const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
  const font = asRecord(paragraph.font ?? asRecord(runs[0]).font);
  return {
    name: typeof font.name === "string" ? font.name : DEFAULT_FONT.name,
    size: typeof font.size === "number" ? font.size : DEFAULT_FONT.size,
    bold: typeof font.font_weight === "number" ? font.font_weight >= 600 : false,
    italic: font.italic === true,
    underline: font.underline === true,
    strike: font.strike === true,
    color: typeof font.color === "string" ? font.color : DEFAULT_FONT.color,
    alignment: paragraph.alignment === 2 ? 2 : paragraph.alignment === 3 ? 3 : 1,
  } as const;
}

export function readElementFill(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const fill = asRecord(source.fill);
  return {
    color: typeof fill.color === "string" ? fill.color : "",
    opacity: typeof fill.opacity === "number" ? fill.opacity : 1,
  };
}

export function readElementStroke(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const stroke = asRecord(source.stroke);
  return {
    color: typeof stroke.color === "string" ? stroke.color : "",
    thickness: typeof stroke.thickness === "number" ? stroke.thickness : 0,
  };
}

export function readImageFit(element: PresentationElement): "cover" | "contain" | "fill" {
  const source = asRecord(element.sourceData);
  const fit = asRecord(source.object_fit).fit;
  return fit === "contain" || fit === "fill" ? fit : "cover";
}

export function cssHexColor(value: string, fallback = "#111827"): string {
  if (!value) return fallback;
  const hex = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

export function modelHexColor(value: string): string {
  return value.replace(/^#/, "").toUpperCase();
}
