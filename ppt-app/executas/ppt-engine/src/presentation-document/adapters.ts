import { createHash } from "node:crypto";
import type {
  PptxAutoShapeBoxModel,
  PptxParagraphModel,
  PptxPictureBoxModel,
  PptxPresentationModel,
  PptxShapeModel,
  PptxSlideModel,
  PptxTextBoxModel,
} from "../html-to-pptx-model/types/pptx-models.js";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type PresentationDocument,
  type PresentationElement,
  type PresentationShapeElement,
  type PresentationSnapshot,
  type PresentationSourceMapEntry,
} from "./types.js";
import { validatePresentationDocument } from "./validation.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readShapeType(shape: PptxShapeModel): string {
  const value = (shape as { shape_type?: unknown }).shape_type;
  return typeof value === "string" ? value : "unsupported";
}

function readPosition(shape: PptxShapeModel) {
  const position = (shape as { position?: Partial<Record<"left" | "top" | "width" | "height", unknown>> }).position;
  return {
    x: typeof position?.left === "number" ? position.left : 0,
    y: typeof position?.top === "number" ? position.top : 0,
    width: typeof position?.width === "number" ? position.width : 1,
    height: typeof position?.height === "number" ? position.height : 1,
  };
}

function paragraphText(paragraph: PptxParagraphModel): string {
  if (typeof paragraph.text === "string") return paragraph.text;
  return paragraph.text_runs?.map((run) => run.text).join("") ?? "";
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}

function shapePlainText(shape: PptxTextBoxModel | PptxAutoShapeBoxModel): string {
  return shape.paragraphs?.map((paragraph) => plainText(paragraphText(paragraph))).join("\n") ?? "";
}

function shapeFingerprint(shape: PptxShapeModel): string {
  return createHash("sha256")
    .update(JSON.stringify(shape))
    .digest("hex")
    .slice(0, 16);
}

function makeElementId(
  slideId: string,
  shapeIndex: number,
  shapeType: string,
  fingerprint: string,
): string {
  const suffix = createHash("sha256")
    .update(`${slideId}:${shapeIndex}:${shapeType}:${fingerprint}`)
    .digest("hex")
    .slice(0, 12);
  return `${slideId}-element-${suffix}`;
}

function toElement(
  slideId: string,
  shape: PptxShapeModel,
  shapeIndex: number,
): { element: PresentationElement; sourceMap: PresentationSourceMapEntry } {
  const shapeType = readShapeType(shape);
  const fingerprint = shapeFingerprint(shape);
  const elementId = makeElementId(slideId, shapeIndex, shapeType, fingerprint);
  const position = readPosition(shape);
  const base = {
    id: elementId,
    sourceElementId: elementId,
    ...position,
    zIndex: shapeIndex,
    metadata: {
      sourceShapeIndex: shapeIndex,
      sourceShapeType: shapeType,
    },
  };
  let element: PresentationElement;

  if (shapeType === "textbox") {
    const sourceData = clone(shape as PptxTextBoxModel);
    element = {
      ...base,
      type: "text",
      text: shapePlainText(sourceData),
      sourceData,
    };
  } else if (shapeType === "picture") {
    const sourceData = clone(shape as PptxPictureBoxModel);
    element = {
      ...base,
      type: "image",
      src: sourceData.picture.path,
      opacity: sourceData.opacity,
      sourceData,
    };
  } else if (shapeType === "autoshape") {
    const sourceData = clone(shape as PptxAutoShapeBoxModel);
    element = {
      ...base,
      type: "shape",
      shapeType: sourceData.type === 5 ? "rounded_rectangle" : "rectangle",
      text: shapePlainText(sourceData),
      sourceData,
    };
  } else {
    element = {
      ...base,
      type: "unsupported",
      editable: false,
      sourceData: clone(shape),
    };
  }

  return {
    element,
    sourceMap: {
      slideId,
      slideIndex: -1,
      elementId,
      shapeIndex,
      shapeType,
      fingerprint,
    },
  };
}

export function pptxModelToPresentationDocument(input: {
  model: PptxPresentationModel;
  presentationId: string;
  slideIds?: string[];
  now?: string;
}): PresentationSnapshot {
  const now = input.now ?? new Date().toISOString();
  const entries: PresentationSourceMapEntry[] = [];
  const slides = input.model.slides.map((slide, slideIndex) => {
    const slideId = input.slideIds?.[slideIndex] || `${input.presentationId}-slide-${slideIndex + 1}`;
    const elements = slide.shapes.map((shape, shapeIndex) => {
      const converted = toElement(slideId, shape, shapeIndex);
      converted.sourceMap.slideIndex = slideIndex;
      entries.push(converted.sourceMap);
      return converted.element;
    });
    return {
      id: slideId,
      order: slideIndex,
      background: slide.background ? clone(slide.background) : undefined,
      elements,
      metadata: {
        sourceSlideIndex: slideIndex,
        note: slide.note,
      },
    };
  });

  return {
    document: {
      id: input.presentationId,
      revision: 0,
      title: input.model.name ?? "",
      width: PRESENTATION_WIDTH,
      height: PRESENTATION_HEIGHT,
      aspectRatio: "16:9",
      slides,
      metadata: {
        sourceModelVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
    },
    originalModel: clone(input.model),
    sourceMap: {
      presentationId: input.presentationId,
      entries,
    },
  };
}

function replaceShapeText<T extends PptxTextBoxModel | PptxAutoShapeBoxModel>(
  source: T,
  text: string,
): T {
  const next = clone(source);
  const originalText = shapePlainText(source);
  if (originalText === text) return next;

  const firstParagraph = next.paragraphs?.[0];
  const paragraphs = text.split("\n").map((line, index): PptxParagraphModel => {
    if (index === 0 && firstParagraph) {
      const { text_runs: _textRuns, ...paragraphStyle } = firstParagraph;
      return { ...paragraphStyle, text: line };
    }
    return {
      ...(firstParagraph?.font ? { font: clone(firstParagraph.font) } : {}),
      text: line,
    };
  });
  next.paragraphs = paragraphs;
  return next;
}

function elementToShape(element: PresentationElement): PptxSlideModel["shapes"][number] {
  if (element.type === "unsupported") {
    return clone(element.sourceData as PptxSlideModel["shapes"][number]);
  }

  let shape: PptxTextBoxModel | PptxPictureBoxModel | PptxAutoShapeBoxModel;
  if (element.type === "text") {
    shape = replaceShapeText(element.sourceData, element.text);
  } else if (element.type === "image") {
    shape = clone(element.sourceData);
    shape.picture.path = element.src;
    shape.picture.is_network = /^https?:\/\//i.test(element.src);
    if (element.opacity !== undefined) shape.opacity = element.opacity;
  } else {
    shape = replaceShapeText(element.sourceData, element.text);
    shape.type = element.shapeType === "rounded_rectangle" ? 5 : 1;
  }

  shape.position = {
    left: Math.round(element.x),
    top: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
  };
  return shape;
}

export function presentationDocumentToPptxModel(input: {
  document: PresentationDocument;
  originalModel: PptxPresentationModel;
}): PptxPresentationModel {
  const validation = validatePresentationDocument(input.document);
  if (!validation.valid) {
    throw new Error(`Presentation Document is invalid: ${validation.errors.map((issue) => issue.message).join("; ")}`);
  }

  const model = clone(input.originalModel);
  if (input.document.title || input.originalModel.name !== undefined) {
    model.name = input.document.title;
  } else {
    delete model.name;
  }
  model.slides = [...input.document.slides]
    .sort((left, right) => left.order - right.order)
    .map((slide) => {
      const sourceSlide = input.originalModel.slides[slide.metadata.sourceSlideIndex];
      if (!sourceSlide) {
        throw new Error(`Missing source slide for "${slide.id}"`);
      }
      const shapes = [...slide.elements]
        .filter((element) => !element.hidden)
        .sort((left, right) => left.zIndex - right.zIndex)
        .map(elementToShape);
      const nextSlide = { ...clone(sourceSlide), shapes };
      if (slide.background) nextSlide.background = clone(slide.background);
      else delete nextSlide.background;
      if (slide.metadata.note !== undefined) nextSlide.note = slide.metadata.note;
      else delete nextSlide.note;
      return nextSlide;
    });
  return model;
}
