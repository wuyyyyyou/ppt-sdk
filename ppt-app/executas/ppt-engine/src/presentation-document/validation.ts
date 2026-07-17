import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PptxPresentationModel } from "../html-to-pptx-model/types/pptx-models.js";
import type {
  PresentationDocument,
  PresentationElement,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

function issue(
  severity: "error" | "warning",
  code: string,
  message: string,
  location: { slideId?: string; elementId?: string } = {},
): ValidationIssue {
  return { severity, code, message, ...location };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateElement(
  document: PresentationDocument,
  slideId: string,
  element: PresentationElement,
): ValidationIssue[] {
  const location = { slideId, elementId: element.id };
  const issues: ValidationIssue[] = [];
  if (typeof element.id !== "string" || !element.id.trim()) {
    issues.push(issue("error", "element_id_missing", "Element ID is required.", location));
  }
  for (const [field, value] of [
    ["x", element.x],
    ["y", element.y],
    ["width", element.width],
    ["height", element.height],
    ["zIndex", element.zIndex],
  ] as const) {
    if (!isFiniteNumber(value)) {
      issues.push(issue("error", "element_number_invalid", `${field} must be a finite number.`, location));
    }
  }
  if (element.width <= 0 || element.height <= 0) {
    issues.push(issue("error", "element_size_invalid", "Element width and height must be greater than zero.", location));
  }
  if (
    element.x + element.width < 0 ||
    element.y + element.height < 0 ||
    element.x > document.width ||
    element.y > document.height
  ) {
    issues.push(issue("warning", "element_outside_canvas", "Element is completely outside the slide canvas.", location));
  }
  if (element.type === "unsupported" && element.sourceData === undefined) {
    issues.push(issue("error", "unsupported_source_missing", "Unsupported element must preserve sourceData.", location));
  }
  if (element.type === "image" && (typeof element.src !== "string" || !element.src.trim())) {
    issues.push(issue("error", "image_source_missing", "Image source is required.", location));
  }
  if (
    (element.type === "text" || element.type === "shape") &&
    typeof element.text !== "string"
  ) {
    issues.push(issue("error", "element_text_invalid", "Editable text must be a string.", location));
  }
  if (element.type === "table") {
    // Accept both the current `{ cells }` shape and the legacy `{ rows }` shape.
    const table = element.table as {
      cells?: unknown;
      rows?: unknown;
    } | undefined;
    const matrix = Array.isArray(table?.cells) ? table.cells
      : Array.isArray(table?.rows) ? table.rows
        : null;
    const columnCount = Array.isArray(matrix?.[0]) ? (matrix[0] as unknown[]).length : 0;
    const valid =
      Array.isArray(matrix) &&
      matrix.length > 0 &&
      columnCount > 0 &&
      matrix.every((row) =>
        Array.isArray(row) &&
        row.length === columnCount &&
        row.every((cell) => {
          if (typeof cell === "string") return true;
          if (!cell || typeof cell !== "object") return false;
          const paragraphs = (cell as { paragraphs?: unknown }).paragraphs;
          return Array.isArray(paragraphs);
        }));
    if (!valid) {
      issues.push(issue("error", "table_rows_invalid", "Table cells must be a non-empty rectangular matrix.", location));
    }
  }
  if (!["text", "image", "shape", "table", "unsupported"].includes(element.type)) {
    issues.push(issue("error", "element_type_invalid", "Element type is not supported.", location));
  }
  return issues;
}

export function validatePresentationDocument(document: PresentationDocument): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const add = (value: ValidationIssue) => (value.severity === "error" ? errors : warnings).push(value);

  if (typeof document.id !== "string" || !document.id.trim()) {
    add(issue("error", "presentation_id_missing", "Presentation ID is required."));
  }
  if (!Number.isInteger(document.revision) || document.revision < 0) {
    add(issue("error", "revision_invalid", "Revision must be a non-negative integer."));
  }
  if (!isFiniteNumber(document.width) || !isFiniteNumber(document.height) || document.width <= 0 || document.height <= 0) {
    add(issue("error", "page_size_invalid", "Presentation width and height must be greater than zero."));
  }
  if (!Array.isArray(document.slides) || document.slides.length === 0) {
    add(issue("error", "slides_empty", "Presentation must contain at least one slide."));
    return { valid: false, errors, warnings };
  }

  const slideIds = new Set<string>();
  const elementIds = new Set<string>();
  const orders = new Set<number>();
  for (const slide of document.slides) {
    if (typeof slide.id !== "string" || !slide.id.trim()) add(issue("error", "slide_id_missing", "Slide ID is required."));
    if (slideIds.has(slide.id)) add(issue("error", "slide_id_duplicate", `Duplicate slide ID "${slide.id}".`, { slideId: slide.id }));
    slideIds.add(slide.id);
    if (!Number.isInteger(slide.order) || slide.order < 0) {
      add(issue("error", "slide_order_invalid", "Slide order must be a non-negative integer.", { slideId: slide.id }));
    }
    if (orders.has(slide.order)) add(issue("error", "slide_order_duplicate", `Duplicate slide order ${slide.order}.`, { slideId: slide.id }));
    orders.add(slide.order);
    if (!Array.isArray(slide.elements)) {
      add(issue("error", "slide_elements_invalid", "Slide elements must be an array.", { slideId: slide.id }));
      continue;
    }
    if (slide.elements.length === 0) add(issue("warning", "slide_empty", "Slide has no elements.", { slideId: slide.id }));

    for (const element of slide.elements) {
      if (elementIds.has(element.id)) {
        add(issue("error", "element_id_duplicate", `Duplicate element ID "${element.id}".`, {
          slideId: slide.id,
          elementId: element.id,
        }));
      }
      elementIds.add(element.id);
      validateElement(document, slide.id, element).forEach(add);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

function localImagePath(src: string): string | null {
  if (src.startsWith("file://")) {
    try {
      return fileURLToPath(src);
    } catch {
      return null;
    }
  }
  if (/^[a-z]+:/i.test(src) || src.startsWith("data:")) return null;
  return src;
}

export async function validatePresentationAssets(
  document: PresentationDocument,
): Promise<ValidationResult> {
  const result = validatePresentationDocument(document);
  const errors = [...result.errors];
  if (!Array.isArray(document.slides)) return { valid: false, errors, warnings: result.warnings };
  for (const slide of document.slides) {
    if (!Array.isArray(slide.elements)) continue;
    for (const element of slide.elements) {
      if (element.type !== "image" || element.hidden || typeof element.src !== "string") continue;
      const imagePath = localImagePath(element.src);
      if (!imagePath) continue;
      try {
        const imageStat = await stat(imagePath);
        if (!imageStat.isFile()) throw new Error("not a file");
      } catch {
        errors.push(issue("error", "image_source_unavailable", `Image source is unavailable: ${element.src}`, {
          slideId: slide.id,
          elementId: element.id,
        }));
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings: result.warnings };
}

export function validatePptxModelForExport(model: PptxPresentationModel): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!Array.isArray(model.slides) || model.slides.length === 0) {
    errors.push(issue("error", "model_slides_empty", "Generated PPTX model must contain at least one slide."));
  }
  model.slides.forEach((slide, slideIndex) => {
    if (!Array.isArray(slide.shapes)) {
      errors.push(issue("error", "model_shapes_invalid", `Slide ${slideIndex + 1} has an invalid shapes collection.`));
      return;
    }
    slide.shapes.forEach((shape, shapeIndex) => {
      if (!["textbox", "autoshape", "picture", "connector"].includes(shape.shape_type)) {
        errors.push(issue("error", "model_shape_type_invalid", `Slide ${slideIndex + 1}, shape ${shapeIndex + 1} has an unsupported type.`));
      }
      const position = shape.position;
      if (
        !position ||
        ![position.left, position.top, position.width, position.height].every(isFiniteNumber) ||
        position.width <= 0 ||
        position.height <= 0
      ) {
        errors.push(issue("error", "model_position_invalid", `Slide ${slideIndex + 1}, shape ${shapeIndex + 1} has invalid geometry.`));
      }
      if (shape.shape_type === "picture" && !shape.picture.path.trim()) {
        errors.push(issue("error", "model_image_missing", `Slide ${slideIndex + 1}, shape ${shapeIndex + 1} has no image source.`));
      }
    });
  });
  return { valid: errors.length === 0, errors, warnings };
}
