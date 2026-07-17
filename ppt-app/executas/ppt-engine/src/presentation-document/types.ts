import type {
  PptxAutoShapeBoxModel,
  PptxFillModel,
  PptxPictureBoxModel,
  PptxPresentationModel,
  PptxTextBoxModel,
} from "../html-to-pptx-model/types/pptx-models.js";

export const PRESENTATION_WIDTH = 1280;
export const PRESENTATION_HEIGHT = 720;

export type PresentationElement =
  | PresentationTextElement
  | PresentationImageElement
  | PresentationShapeElement
  | PresentationTableElement
  | PresentationUnsupportedElement;

export interface PresentationDocument {
  id: string;
  revision: number;
  title: string;
  width: number;
  height: number;
  aspectRatio: string;
  slides: PresentationSlideDocument[];
  metadata: {
    sourceModelVersion: 1;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PresentationSlideDocument {
  id: string;
  order: number;
  background?: PptxFillModel;
  elements: PresentationElement[];
  metadata: {
    sourceSlideIndex: number;
    note?: string;
  };
}

export interface PresentationBaseElement {
  id: string;
  sourceElementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  /** Element-level hyperlink applied to the whole text box / shape / image. */
  hyperlink?: string;
  metadata: {
    sourceShapeIndex: number;
    sourceShapeType: string;
  };
}

export interface PresentationTextElement extends PresentationBaseElement {
  type: "text";
  text: string;
  sourceData: PptxTextBoxModel;
}

export interface PresentationImageElement extends PresentationBaseElement {
  type: "image";
  src: string;
  sourceData: PptxPictureBoxModel;
}

export interface PresentationShapeElement extends PresentationBaseElement {
  type: "shape";
  shapeType: "rectangle" | "rounded_rectangle";
  text: string;
  sourceData: PptxAutoShapeBoxModel;
}

export interface PresentationTableStyle {
  /** Hex colors without the leading '#', consistent with PptxFontModel. */
  borderColor: string;
  textColor: string;
  fontSize: number;
  fontName: string;
}

export interface PresentationTableCell {
  /** Run-level paragraphs, same shape as textbox sourceData.paragraphs. */
  paragraphs: Array<Record<string, unknown>>;
  /** Optional cell fill color (hex without '#'). */
  fill?: string;
}

export interface PresentationTableData {
  /** cells[rowIndex][columnIndex]. All rows share the same length. */
  cells: PresentationTableCell[][];
  style: PresentationTableStyle;
}

/**
 * Editor-native table. Model0 has no table shape, so on export the table is
 * expanded into one autoshape per cell (the same flat structure the
 * HTML-to-model extractor produces for template tables).
 */
export interface PresentationTableElement extends PresentationBaseElement {
  type: "table";
  table: PresentationTableData;
  /** Tables are editor-native; kept optional so generic sourceData reads type-check. */
  sourceData?: Record<string, unknown>;
}

export interface PresentationUnsupportedElement extends PresentationBaseElement {
  type: "unsupported";
  editable: false;
  sourceData: unknown;
}

export interface PresentationSourceMapEntry {
  slideId: string;
  slideIndex: number;
  elementId: string;
  shapeIndex: number;
  shapeType: string;
  fingerprint: string;
}

export interface PresentationSourceMap {
  presentationId: string;
  entries: PresentationSourceMapEntry[];
}

export interface PresentationRevision {
  presentationId: string;
  revision: number;
  baseRevision: number;
  document: PresentationDocument;
  updatedAt: string;
}

export interface PresentationSnapshot {
  document: PresentationDocument;
  originalModel: PptxPresentationModel;
  sourceMap: PresentationSourceMap;
}

export type PresentationSaveStatus =
  | "saved"
  | "saving"
  | "unsaved"
  | "conflict"
  | "error";

export type ValidationIssueSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationIssueSeverity;
  slideId?: string;
  elementId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface PresentationConversionResult {
  model: PptxPresentationModel | null;
  validation: ValidationResult;
}
