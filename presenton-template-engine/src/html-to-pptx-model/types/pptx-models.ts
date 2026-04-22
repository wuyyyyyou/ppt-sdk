export enum PptxBoxShapeEnum {
  RECTANGLE = "rectangle",
  CIRCLE = "circle",
}

export enum PptxObjectFitEnum {
  CONTAIN = "contain",
  COVER = "cover",
  FILL = "fill",
}

export enum PptxAlignment {
  CENTER = 2,
  DISTRIBUTE = 5,
  JUSTIFY = 4,
  JUSTIFY_LOW = 7,
  LEFT = 1,
  RIGHT = 3,
  THAI_DISTRIBUTE = 6,
  MIXED = -2,
}

export enum PptxVerticalAlignment {
  TOP = 1,
  MIDDLE = 3,
  BOTTOM = 4,
  MIXED = -2,
}

export enum PptxShapeType {
  RECTANGLE = 1,
  ROUNDED_RECTANGLE = 5,
}

export enum PptxConnectorType {
  CURVE = 3,
  ELBOW = 2,
  STRAIGHT = 1,
  MIXED = -2,
}

export interface PptxSpacingModel {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PptxPositionModel {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptxFontModel {
  name: string;
  size: number;
  font_weight: number;
  italic: boolean;
  color: string;
  underline?: boolean;
  strike?: boolean;
}

export interface PptxFillModel {
  color: string;
  opacity: number;
}

export interface PptxStrokeModel {
  color: string;
  thickness: number;
  opacity: number;
}

export interface PptxShadowModel {
  radius: number;
  offset: number;
  color: string;
  opacity: number;
  angle: number;
}

export interface PptxTextRunModel {
  text: string;
  font?: PptxFontModel;
}

export interface PptxParagraphModel {
  spacing?: PptxSpacingModel;
  alignment?: PptxAlignment;
  font?: PptxFontModel;
  line_height?: number;
  text?: string;
  text_runs?: PptxTextRunModel[];
}

export interface PptxObjectFitModel {
  fit?: PptxObjectFitEnum;
  focus?: [number | null, number | null];
}

export interface PptxPictureModel {
  is_network: boolean;
  path: string;
}

export interface PptxShapeModel {}

export interface PptxTextBoxModel extends PptxShapeModel {
  shape_type: "textbox";
  margin?: PptxSpacingModel;
  fill?: PptxFillModel;
  position: PptxPositionModel;
  text_wrap: boolean;
  vertical_alignment?: PptxVerticalAlignment;
  paragraphs: PptxParagraphModel[];
}

export interface PptxAutoShapeBoxModel extends PptxShapeModel {
  shape_type: "autoshape";
  type?: PptxShapeType;
  margin?: PptxSpacingModel;
  fill?: PptxFillModel;
  stroke?: PptxStrokeModel;
  shadow?: PptxShadowModel;
  position: PptxPositionModel;
  text_wrap: boolean;
  vertical_alignment?: PptxVerticalAlignment;
  border_radius?: number;
  paragraphs?: PptxParagraphModel[];
}

export interface PptxPictureBoxModel extends PptxShapeModel {
  shape_type: "picture";
  position: PptxPositionModel;
  margin?: PptxSpacingModel;
  clip: boolean;
  opacity?: number;
  invert?: boolean;
  border_radius?: number[];
  shape?: PptxBoxShapeEnum;
  object_fit?: PptxObjectFitModel;
  picture: PptxPictureModel;
}

export interface PptxConnectorModel extends PptxShapeModel {
  shape_type: "connector";
  type?: PptxConnectorType;
  position: PptxPositionModel;
  thickness: number;
  color: string;
  opacity: number;
}

export interface PptxSlideModel {
  background?: PptxFillModel;
  shapes: (
    | PptxTextBoxModel
    | PptxAutoShapeBoxModel
    | PptxConnectorModel
    | PptxPictureBoxModel
  )[];
  note?: string;
}

export interface PptxPresentationModel {
  name?: string;
  shapes?: PptxShapeModel[];
  slides: PptxSlideModel[];
}
