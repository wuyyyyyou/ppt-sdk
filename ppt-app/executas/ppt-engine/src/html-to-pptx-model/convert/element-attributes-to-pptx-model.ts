import type {
  ElementAttributes,
  SlideAttributesResult,
} from "../types/element-attributes.js";
import {
  PptxAlignment,
  PptxBoxShapeEnum,
  PptxConnectorType,
  PptxObjectFitEnum,
  PptxShapeType,
  PptxVerticalAlignment,
  type PptxAutoShapeBoxModel,
  type PptxConnectorModel,
  type PptxFillModel,
  type PptxFontModel,
  type PptxObjectFitModel,
  type PptxParagraphModel,
  type PptxPictureBoxModel,
  type PptxPictureModel,
  type PptxPositionModel,
  type PptxPresentationModel,
  type PptxShadowModel,
  type PptxSlideModel,
  type PptxStrokeModel,
  type PptxTextBoxModel,
} from "../types/pptx-models.js";

function convertTextAlignToPptxAlignment(
  textAlign?: string,
): PptxAlignment | undefined {
  if (!textAlign) {
    return undefined;
  }

  switch (textAlign.toLowerCase()) {
    case "left":
      return PptxAlignment.LEFT;
    case "center":
      return PptxAlignment.CENTER;
    case "right":
      return PptxAlignment.RIGHT;
    case "end":
      return PptxAlignment.RIGHT;
    case "justify":
      return PptxAlignment.JUSTIFY;
    default:
      return undefined;
  }
}

function convertTextVerticalAlignHintToPptxVerticalAlignment(
  textVerticalAlignHint?: string,
): PptxVerticalAlignment | undefined {
  if (!textVerticalAlignHint) {
    return undefined;
  }

  switch (textVerticalAlignHint.toLowerCase()) {
    case "middle":
      return PptxVerticalAlignment.MIDDLE;
    case "top":
      return PptxVerticalAlignment.TOP;
    case "bottom":
      return PptxVerticalAlignment.BOTTOM;
    default:
      return undefined;
  }
}

function convertLineHeightToRelative(
  lineHeight?: number,
  fontSize?: number,
): number | undefined {
  if (!lineHeight) {
    return undefined;
  }

  let calculatedLineHeight = 1.2;
  if (lineHeight < 10) {
    calculatedLineHeight = lineHeight;
  }

  if (fontSize && fontSize > 0) {
    calculatedLineHeight = Math.round((lineHeight / fontSize) * 100) / 100;
  }

  return calculatedLineHeight - 0.3;
}

function resolveParagraphAlignment(
  element: ElementAttributes,
): PptxAlignment | undefined {
  const explicitAlignment = convertTextAlignToPptxAlignment(element.textAlign);
  if (explicitAlignment !== undefined) {
    return explicitAlignment;
  }

  return convertTextAlignToPptxAlignment(element.textAlignHint);
}

function resolveVerticalAlignment(
  element: ElementAttributes,
): PptxVerticalAlignment | undefined {
  return convertTextVerticalAlignHintToPptxVerticalAlignment(
    element.textVerticalAlignHint,
  );
}

function hasTextualContent(element: ElementAttributes): boolean {
  return Boolean(
    (element.textHtml && element.textHtml.trim().length > 0) ||
    (element.innerText && element.innerText.trim().length > 0),
  );
}

function resolveParagraphTextContent(element: ElementAttributes): string | undefined {
  if (element.textHtml && element.textHtml.trim().length > 0) {
    return element.textHtml;
  }

  return element.innerText;
}

function isCompactPageNumberText(text?: string): boolean {
  if (!text) {
    return false;
  }

  return /^\d{1,2}(?:\s*\/\s*\d{1,2})?$/.test(text.trim());
}

function isCompactYearText(text?: string): boolean {
  if (!text) {
    return false;
  }

  return /^\d{4}$/.test(text.trim());
}

function isLikelySingleLineText(element: ElementAttributes): boolean {
  if (!element.innerText?.trim() || element.position?.height === undefined) {
    return false;
  }

  const fontSize = element.font?.size ?? 16;
  const maxSingleLineHeight = Math.max(fontSize * 1.7, fontSize + 8);

  return element.position.height <= maxSingleLineHeight;
}

function getSingleLineSafetyPadding(
  element: ElementAttributes,
  isCompactPageNumber: boolean,
): number {
  const fontSize = element.font?.size ?? 16;

  if (isCompactYearText(element.innerText)) {
    return Math.max(12, Math.round(fontSize * 0.6));
  }

  if (isCompactPageNumber) {
    return Math.max(5, Math.round(fontSize * 0.25));
  }

  // PowerPoint often lays out tight single-line labels slightly wider than the
  // browser, especially for mixed digit/CJK text. Keep a larger guard band here.
  return Math.max(8, Math.round(fontSize * 0.4));
}

function shouldDisableCompactTextWrap(element: ElementAttributes): boolean {
  return (
    isCompactPageNumberText(element.innerText) ||
    isCompactYearText(element.innerText)
  );
}

export function convertSlideElementAttributesToPptxSlideModel(
  slideAttributes: SlideAttributesResult,
): PptxSlideModel {
  const shapes = slideAttributes.elements
    .map((element) => convertElementToPptxShape(element))
    .filter(Boolean) as PptxSlideModel["shapes"];

  const slide: PptxSlideModel = {
    shapes,
    note: slideAttributes.speakerNote,
  };

  if (slideAttributes.backgroundColor) {
    slide.background = {
      color: slideAttributes.backgroundColor,
      opacity: 1,
    };
  }

  return slide;
}

export function convertElementAttributesToPptxSlides(
  slidesAttributes: SlideAttributesResult[],
): PptxSlideModel[] {
  return slidesAttributes.map((slideAttributes) =>
    convertSlideElementAttributesToPptxSlideModel(slideAttributes),
  );
}

export function createPresentationPptxModel(input: {
  name?: string;
  slidesAttributes: SlideAttributesResult[];
}): PptxPresentationModel {
  return {
    name: input.name,
    slides: convertElementAttributesToPptxSlides(input.slidesAttributes),
  };
}

function convertElementToPptxShape(
  element: ElementAttributes,
):
  | PptxTextBoxModel
  | PptxAutoShapeBoxModel
  | PptxConnectorModel
  | PptxPictureBoxModel
  | null {
  if (!element.position) {
    return null;
  }

  if (
    element.tagName === "img" ||
    (typeof element.className === "string" &&
      element.className.includes("image")) ||
    element.imageSrc
  ) {
    return convertToPictureBox(element);
  }

  if (element.connectorType) {
    return convertToConnector(element);
  }

  if (hasTextualContent(element)) {
    if (
      element.background?.color &&
      element.borderRadius &&
      element.borderRadius.some((radius) => radius > 0)
    ) {
      return convertToAutoShapeBox(element);
    }
    return convertToTextBox(element);
  }

  if (element.tagName === "hr") {
    return convertToConnector(element);
  }

  return convertToAutoShapeBox(element);
}

function toRoundedPosition(element: ElementAttributes): PptxPositionModel {
  return {
    left: Math.round(element.position?.left ?? 0),
    top: Math.round(element.position?.top ?? 0),
    width: Math.round(element.position?.width ?? 0),
    height: Math.round(element.position?.height ?? 0),
  };
}

function getAdjustedTextBoxPosition(
  element: ElementAttributes,
): PptxPositionModel {
  const position = toRoundedPosition(element);
  const alignment = resolveParagraphAlignment(element);
  const isCompactPageNumber = isCompactPageNumberText(element.innerText);
  const shouldProtectSingleLineWidth = isCompactPageNumber
    ? true
    : isLikelySingleLineText(element);

  if (
    !shouldProtectSingleLineWidth ||
    element.measuredTextWidth === undefined
  ) {
    return position;
  }

  const minSafeWidth =
    Math.ceil(element.measuredTextWidth) +
    getSingleLineSafetyPadding(element, isCompactPageNumber);

  if (position.width >= minSafeWidth) {
    return position;
  }

  const widthDelta = minSafeWidth - position.width;
  if (alignment === PptxAlignment.RIGHT) {
    return {
      ...position,
      left: position.left - widthDelta,
      width: minSafeWidth,
    };
  }

  if (alignment === PptxAlignment.CENTER) {
    return {
      ...position,
      left: position.left - Math.round(widthDelta / 2),
      width: minSafeWidth,
    };
  }

  return {
    ...position,
    width: minSafeWidth,
  };
}

function toFont(element: ElementAttributes): PptxFontModel | undefined {
  if (!element.font) {
    return undefined;
  }

  return {
    name: element.font.name ?? "Inter",
    size: Math.round(element.font.size ?? 16),
    font_weight: element.font.weight ?? 400,
    italic: element.font.italic ?? false,
    color: element.font.color ?? "000000",
  };
}

function toParagraph(element: ElementAttributes): PptxParagraphModel {
  return {
    spacing: undefined,
    alignment: resolveParagraphAlignment(element),
    font: toFont(element),
    line_height: convertLineHeightToRelative(
      element.lineHeight,
      element.font?.size,
    ),
    text: resolveParagraphTextContent(element),
  };
}

function convertToTextBox(element: ElementAttributes): PptxTextBoxModel {
  const fill: PptxFillModel | undefined = element.background?.color
    ? {
        color: element.background.color,
        opacity: element.background.opacity ?? 1,
      }
    : undefined;

  return {
    shape_type: "textbox",
    margin: undefined,
    fill,
    position: getAdjustedTextBoxPosition(element),
    text_wrap: shouldDisableCompactTextWrap(element)
      ? false
      : (element.textWrap ?? true),
    vertical_alignment: resolveVerticalAlignment(element),
    paragraphs: [toParagraph(element)],
  };
}

function convertToAutoShapeBox(
  element: ElementAttributes,
): PptxAutoShapeBoxModel {
  const fill: PptxFillModel | undefined = element.background?.color
    ? {
        color: element.background.color,
        opacity: element.background.opacity ?? 1,
      }
    : undefined;

  const stroke: PptxStrokeModel | undefined = element.border?.color
    ? {
        color: element.border.color,
        thickness: element.border.width ?? 1,
        opacity: element.border.opacity ?? 1,
      }
    : undefined;

  const shadow: PptxShadowModel | undefined = element.shadow?.color
    ? {
        radius: Math.round(element.shadow.radius ?? 4),
        offset: Math.round(
          element.shadow.offset
            ? Math.sqrt(
                element.shadow.offset[0] ** 2 + element.shadow.offset[1] ** 2,
              )
            : 0,
        ),
        color: element.shadow.color,
        opacity: element.shadow.opacity ?? 0.5,
        angle: Math.round(element.shadow.angle ?? 0),
      }
    : undefined;

  const shapeType = element.borderRadius
    ? PptxShapeType.ROUNDED_RECTANGLE
    : PptxShapeType.RECTANGLE;

  let borderRadius: number | undefined;
  for (const cornerRadius of element.borderRadius ?? []) {
    if (cornerRadius > 0) {
      borderRadius = Math.max(borderRadius ?? 0, cornerRadius);
    }
  }

  return {
    shape_type: "autoshape",
    type: shapeType,
    margin: undefined,
    fill,
    stroke,
    shadow,
    position: toRoundedPosition(element),
    text_wrap: element.textWrap ?? true,
    vertical_alignment: resolveVerticalAlignment(element),
    border_radius: borderRadius,
    paragraphs: hasTextualContent(element) ? [toParagraph(element)] : undefined,
  };
}

function convertToPictureBox(element: ElementAttributes): PptxPictureBoxModel {
  const isScreenshotExport = element.pptxExport === "screenshot";
  const objectFit: PptxObjectFitModel | undefined = isScreenshotExport
    ? undefined
    : {
      fit: element.objectFit
        ? (element.objectFit as PptxObjectFitEnum)
        : PptxObjectFitEnum.CONTAIN,
    };

  const picture: PptxPictureModel = {
    is_network: element.imageSrc ? element.imageSrc.startsWith("http") : false,
    path: element.imageSrc ?? "",
  };

  return {
    shape_type: "picture",
    position: toRoundedPosition(element),
    margin: undefined,
    clip: isScreenshotExport ? false : element.clip ?? true,
    invert: element.filters?.invert === 1,
    opacity: element.opacity,
    border_radius: element.borderRadius
      ? element.borderRadius.map((radius) => Math.round(radius))
      : undefined,
    shape: element.shape
      ? (element.shape as PptxBoxShapeEnum)
      : PptxBoxShapeEnum.RECTANGLE,
    object_fit: objectFit,
    picture,
  };
}

function convertToConnector(element: ElementAttributes): PptxConnectorModel {
  const position = toRoundedPosition(element);
  const connectorBorderSide = element.connectorType?.startsWith("border-")
    ? element.connectorType.slice("border-".length)
    : undefined;
  const borderSide = connectorBorderSide
    ? element.borderSides?.[connectorBorderSide as keyof typeof element.borderSides]
    : undefined;
  const thickness = Math.round(borderSide?.width ?? element.border?.width ?? 1);

  if (connectorBorderSide === "left") {
    position.width = thickness;
  } else if (connectorBorderSide === "right") {
    position.left = position.left + Math.max(position.width - thickness, 0);
    position.width = thickness;
  } else if (connectorBorderSide === "top") {
    position.height = thickness;
  } else if (connectorBorderSide === "bottom") {
    position.top = position.top + Math.max(position.height - thickness, 0);
    position.height = thickness;
  }

  return {
    shape_type: "connector",
    type: PptxConnectorType.STRAIGHT,
    position,
    thickness,
    color: borderSide?.color || element.border?.color || element.background?.color || "000000",
    opacity: borderSide?.opacity ?? element.border?.opacity ?? 1,
  };
}
