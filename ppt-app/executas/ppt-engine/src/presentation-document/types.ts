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
