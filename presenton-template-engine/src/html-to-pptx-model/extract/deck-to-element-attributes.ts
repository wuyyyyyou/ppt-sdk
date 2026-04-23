import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ElementHandleLike, PageLike } from "../types/browser.js";
import type {
  ElementAttributes,
  ElementBorderSideAttributes,
  SlideAttributesResult,
} from "../types/element-attributes.js";

export interface ExtractDeckPageToSlideAttributesInput {
  page: PageLike;
  deckSelector?: string;
  slideSelector?: string;
  screenshotsDir?: string;
}

interface GetAllChildElementsAttributesArgs {
  element: ElementHandleLike;
  rootRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  depth?: number;
  inheritedFont?: ElementAttributes["font"];
  inheritedBackground?: ElementAttributes["background"];
  inheritedBorderRadius?: number[];
  inheritedZIndex?: number;
  inheritedOpacity?: number;
  traceLabel?: string;
}

export type OrderedExtractedElement = {
  attributes: ElementAttributes;
  depth: number;
};

const DEFAULT_DECK_SELECTOR = "#presentation-slides-wrapper";
const DEFAULT_SLIDE_SELECTOR = ":scope > div > div";
const DEBUG_HTML_TO_PPTX = process.env.PRESENTON_DEBUG_HTML_TO_PPTX === "1";
const SUPPORTED_SEMANTIC_INLINE_RICH_TEXT_TAGS = [
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "br",
] as const;

function debugLog(...args: unknown[]) {
  if (!DEBUG_HTML_TO_PPTX) {
    return;
  }
  console.error("[ppt-engine html-to-model]", ...args);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function extractDeckPageToSlideAttributes(
  input: ExtractDeckPageToSlideAttributesInput,
): Promise<SlideAttributesResult[]> {
  debugLog("extract.getSlidesWrapper.start");
  const slidesWrapper = await getSlidesWrapper(
    input.page,
    input.deckSelector ?? DEFAULT_DECK_SELECTOR,
  );
  debugLog("extract.getSlidesWrapper.done");
  debugLog("extract.getSpeakerNotes.start");
  const speakerNotes = await getSpeakerNotes(slidesWrapper);
  debugLog("extract.getSpeakerNotes.done", { speakerNoteCount: speakerNotes.length });
  debugLog("extract.querySlides.start");
  const slides = await slidesWrapper.$$(input.slideSelector ?? DEFAULT_SLIDE_SELECTOR);
  debugLog("extract.querySlides.done", { slideCount: slides.length });
  const screenshotsDir = getScreenshotsDir(input.screenshotsDir);
  debugLog("extract.start", {
    slideCount: slides.length,
    screenshotsDir,
  });
  const slideAttributes: SlideAttributesResult[] = [];
  for (const [slideIndex, slide] of slides.entries()) {
    debugLog("extract.slide.start", { slideIndex });
    const extracted = await getAllChildElementsAttributes({
      element: slide,
      traceLabel: `slide:${slideIndex}`,
    });
    slideAttributes.push(extracted);
    debugLog("extract.slide.done", {
      slideIndex,
      elementCount: extracted.elements.length,
    });
  }

  await postProcessSlidesAttributes(slideAttributes, screenshotsDir, speakerNotes);
  return slideAttributes;
}

async function getSlidesWrapper(
  page: PageLike,
  deckSelector: string,
): Promise<ElementHandleLike> {
  const slidesWrapper = await page.$(deckSelector);
  if (!slidesWrapper) {
    throw new Error(`Presentation slides wrapper not found: ${deckSelector}`);
  }
  return slidesWrapper;
}

async function getSpeakerNotes(
  slidesWrapper: ElementHandleLike,
): Promise<string[]> {
  return slidesWrapper.evaluate((el) => {
    return Array.from<Element>(el.querySelectorAll("[data-speaker-note]")).map(
      (node) => node.getAttribute("data-speaker-note") || "",
    );
  });
}

function getScreenshotsDir(explicitDir?: string): string {
  const screenshotsDir =
    explicitDir ??
    join(tmpdir(), "presenton-template-engine", "html-to-pptx-model", "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });
  return screenshotsDir;
}

async function postProcessSlidesAttributes(
  slidesAttributes: SlideAttributesResult[],
  screenshotsDir: string,
  speakerNotes: string[],
) {
  for (const [index, slideAttributes] of slidesAttributes.entries()) {
    for (const element of slideAttributes.elements) {
      if (element.should_screenshot) {
        const screenshotPath = await screenshotElement(element, screenshotsDir);
        element.imageSrc = screenshotPath;
        element.should_screenshot = false;
        element.objectFit = "cover";
        element.element = undefined;
      }
    }
    slideAttributes.speakerNote = speakerNotes[index];
  }
}

async function screenshotElement(
  element: ElementAttributes,
  screenshotsDir: string,
): Promise<string> {
  const screenshotPath = join(screenshotsDir, `${randomUUID()}.png`);

  if (element.tagName === "svg") {
    const pngBuffer = await convertSvgToPng(element);
    writeFileSync(screenshotPath, pngBuffer);
    return screenshotPath;
  }

  await element.element?.evaluate((el) => {
    const originalOpacities = new Map();

    const hideAllExcept = (targetElement: Element) => {
      const allElements = document.querySelectorAll("*");

      allElements.forEach((elem) => {
        const computedStyle = window.getComputedStyle(elem);
        originalOpacities.set(elem, computedStyle.opacity);

        if (
          targetElement === elem ||
          targetElement.contains(elem) ||
          elem.contains(targetElement)
        ) {
          (elem as HTMLElement).style.opacity = computedStyle.opacity || "1";
          return;
        }

        (elem as HTMLElement).style.opacity = "0";
      });
    };

    hideAllExcept(el);

    (el as any).__restorePresentonHtmlToPptxModelStyles = () => {
      originalOpacities.forEach((opacity, elem) => {
        (elem as HTMLElement).style.opacity = opacity;
      });
    };
  });

  const screenshot = await element.element?.screenshot({
    path: screenshotPath,
  });
  if (!screenshot) {
    throw new Error(`Failed to screenshot element: ${element.tagName}`);
  }

  await element.element?.evaluate((el) => {
    if ((el as any).__restorePresentonHtmlToPptxModelStyles) {
      (el as any).__restorePresentonHtmlToPptxModelStyles();
    }
  });

  return screenshotPath;
}

async function convertSvgToPng(element: ElementAttributes): Promise<Buffer> {
  const svgHtml =
    (await element.element?.evaluate((el) => {
      const fontColor = window.getComputedStyle(el).color;
      (el as HTMLElement).style.color = fontColor;
      return el.outerHTML;
    })) ?? "";

  const sharpModule = await import("sharp");
  const sharp = sharpModule.default ?? sharpModule;
  const svgBuffer = Buffer.from(svgHtml);

  return sharp(svgBuffer)
    .resize(
      Math.round(element.position?.width ?? 0),
      Math.round(element.position?.height ?? 0),
    )
    .toFormat("png")
    .toBuffer();
}

function shouldScreenshotChartContainer(
  attributes: ElementAttributes,
): boolean {
  return attributes.pptxExport === "screenshot";
}

function countVisibleBorderSides(
  borderSides?: ElementAttributes["borderSides"],
): number {
  if (!borderSides) {
    return 0;
  }

  return ["top", "right", "bottom", "left"].filter((side) => {
    const borderSide = borderSides[side as keyof typeof borderSides] as ElementBorderSideAttributes | undefined;
    return Boolean(
      borderSide &&
      borderSide.width !== undefined &&
      borderSide.width > 0 &&
      borderSide.color,
    );
  }).length;
}

export function resolveAutoConnectorType(
  attributes: ElementAttributes,
): string | undefined {
  if (!attributes.position || !attributes.borderSides) {
    return undefined;
  }

  const visibleSideCount = countVisibleBorderSides(attributes.borderSides);
  if (visibleSideCount !== 1) {
    return undefined;
  }

  const hasText = Boolean(attributes.innerText && attributes.innerText.trim().length > 0);
  const hasFill = Boolean(attributes.background?.color);
  const hasImage = Boolean(attributes.imageSrc);
  if (hasText || hasFill || hasImage) {
    return undefined;
  }

  const { width = 0, height = 0 } = attributes.position;
  const maxThinDimension = 12;
  const minLongDimension = 24;

  if (
    attributes.borderSides.left &&
    width <= maxThinDimension &&
    height >= minLongDimension
  ) {
    return "border-left";
  }

  if (
    attributes.borderSides.right &&
    width <= maxThinDimension &&
    height >= minLongDimension
  ) {
    return "border-right";
  }

  if (
    attributes.borderSides.top &&
    height <= maxThinDimension &&
    width >= minLongDimension
  ) {
    return "border-top";
  }

  if (
    attributes.borderSides.bottom &&
    height <= maxThinDimension &&
    width >= minLongDimension
  ) {
    return "border-bottom";
  }

  return undefined;
}

export function shouldAutoScreenshotDecorativeElement(
  attributes: ElementAttributes,
): boolean {
  if (!attributes.position) {
    return false;
  }

  if (attributes.pptxExport === "screenshot") {
    return false;
  }

  if (attributes.tagName === "svg" || attributes.tagName === "canvas" || attributes.tagName === "table") {
    return false;
  }

  if (attributes.imageSrc || attributes.tagName === "img") {
    return false;
  }

  const textLength = attributes.textLength ?? 0;
  const directTextLength = attributes.directTextLength ?? 0;
  const graphicSignalCount = attributes.graphicSignalCount ?? 0;
  const childElementCount = attributes.childElementCount ?? 0;
  const width = attributes.position.width ?? 0;
  const height = attributes.position.height ?? 0;

  return (
    width >= 80 &&
    height >= 80 &&
    graphicSignalCount >= 10 &&
    textLength <= 24 &&
    directTextLength <= 8 &&
    childElementCount > 0
  );
}

export function supportsSemanticInlineRichTextNode(input: {
  tagName: string;
  attributeNames?: string[];
}): boolean {
  const tagName = input.tagName.toLowerCase();
  if (!SUPPORTED_SEMANTIC_INLINE_RICH_TEXT_TAGS.includes(
    tagName as typeof SUPPORTED_SEMANTIC_INLINE_RICH_TEXT_TAGS[number],
  )) {
    return false;
  }

  return (input.attributeNames ?? []).length === 0;
}

export function shouldSkipChildTraversal(
  attributes: ElementAttributes,
): boolean {
  if (attributes.textHtml) {
    return true;
  }

  return Boolean(attributes.should_screenshot && attributes.tagName !== "svg");
}

export function shouldKeepRootLevelElement(
  attributes: ElementAttributes,
  rootRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
): boolean {
  const hasBackground = Boolean(attributes.background?.color);
  const hasBorder = Boolean(attributes.border?.color);
  const hasShadow = Boolean(attributes.shadow?.color);
  const hasText = Boolean(
    attributes.innerText && attributes.innerText.trim().length > 0,
  );
  const hasImage = Boolean(attributes.imageSrc);
  const isSvg = attributes.tagName === "svg";
  const isCanvas = attributes.tagName === "canvas";
  const isTable = attributes.tagName === "table";
  const isExplicitScreenshotTarget =
    attributes.pptxExport === "screenshot" || attributes.should_screenshot === true;

  const occupiesRoot =
    attributes.position &&
    attributes.position.left === 0 &&
    attributes.position.top === 0 &&
    attributes.position.width === rootRect.width &&
    attributes.position.height === rootRect.height;

  const hasVisualProperties =
    hasBackground || hasBorder || hasShadow || hasText;
  const hasSpecialContent =
    hasImage || isSvg || isCanvas || isTable || isExplicitScreenshotTarget;

  return (hasVisualProperties && !occupiesRoot) || hasSpecialContent;
}

export function sortElementsForPpt(
  elements: OrderedExtractedElement[],
): ElementAttributes[] {
  return elements
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => {
      const zIndexA = a.attributes.zIndex || 0;
      const zIndexB = b.attributes.zIndex || 0;

      if (zIndexA !== zIndexB) {
        return zIndexA - zIndexB;
      }

      return a.index - b.index;
    })
    .map(({ attributes }) => attributes);
}

async function getAllChildElementsAttributes({
  element,
  rootRect = null,
  depth = 0,
  inheritedFont,
  inheritedBackground,
  inheritedBorderRadius,
  inheritedZIndex,
  inheritedOpacity,
  traceLabel = "root",
}: GetAllChildElementsAttributesArgs): Promise<SlideAttributesResult> {
  if (!rootRect) {
    let rootAttributes;
    try {
      rootAttributes = await getElementAttributes(element);
    } catch (error) {
      throw new Error(
        `Failed to read root element attributes for ${traceLabel}: ${errorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
    inheritedFont = rootAttributes.font;
    inheritedBackground = rootAttributes.background;
    inheritedZIndex = rootAttributes.zIndex;
    inheritedOpacity = rootAttributes.opacity;
    rootRect = {
      left: rootAttributes.position?.left ?? 0,
      top: rootAttributes.position?.top ?? 0,
      width: rootAttributes.position?.width ?? 1280,
      height: rootAttributes.position?.height ?? 720,
    };
  }

  const directChildElementHandles = await element.$$(":scope > *");
  const allResults: { attributes: ElementAttributes; depth: number }[] = [];

  for (const [childIndex, childElementHandle] of directChildElementHandles.entries()) {
    debugLog("extract.element.start", { traceLabel, depth, childIndex });
    let attributes;
    try {
      attributes = await getElementAttributes(childElementHandle);
    } catch (error) {
      throw new Error(
        `Failed to read element attributes at ${traceLabel} depth=${depth} child_index=${childIndex}: ${errorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }

    if (["style", "script", "link", "meta", "path"].includes(attributes.tagName)) {
      continue;
    }

    if (
      inheritedFont &&
      !attributes.font &&
      attributes.innerText &&
      attributes.innerText.trim().length > 0
    ) {
      attributes.font = inheritedFont;
    }
    if (inheritedBackground && !attributes.background && attributes.shadow) {
      attributes.background = inheritedBackground;
    }
    if (inheritedBorderRadius && !attributes.borderRadius) {
      attributes.borderRadius = inheritedBorderRadius;
    }
    if (inheritedZIndex !== undefined && attributes.zIndex === 0) {
      attributes.zIndex = inheritedZIndex;
    }
    if (
      inheritedOpacity !== undefined &&
      (attributes.opacity === undefined || attributes.opacity === 1)
    ) {
      attributes.opacity = inheritedOpacity;
    }

    if (
      attributes.position &&
      attributes.position.left !== undefined &&
      attributes.position.top !== undefined
    ) {
      attributes.position = {
        left: attributes.position.left - rootRect.left,
        top: attributes.position.top - rootRect.top,
        width: attributes.position.width,
        height: attributes.position.height,
      };
    }

    if (
      attributes.position === undefined ||
      attributes.position.width === undefined ||
      attributes.position.height === undefined ||
      attributes.position.width === 0 ||
      attributes.position.height === 0
    ) {
      const childResults = await getAllChildElementsAttributes({
        element: childElementHandle,
        rootRect,
        depth: depth + 1,
        inheritedFont: attributes.font || inheritedFont,
        inheritedBackground: attributes.background || inheritedBackground,
        inheritedBorderRadius: attributes.borderRadius || inheritedBorderRadius,
        inheritedZIndex: attributes.zIndex || inheritedZIndex,
        inheritedOpacity: attributes.opacity || inheritedOpacity,
      });
      allResults.push(
        ...childResults.elements.map((attr) => ({
          attributes: attr,
          depth: depth + 1,
        })),
      );
      continue;
    }

    if (!attributes.connectorType) {
      attributes.connectorType = resolveAutoConnectorType(attributes);
    }

    const shouldScreenshotChartWrapper =
      !attributes.should_screenshot &&
      shouldScreenshotChartContainer(attributes);
    const shouldScreenshotDecorativeModule =
      !attributes.should_screenshot &&
      shouldAutoScreenshotDecorativeElement(attributes);

    if (
      shouldScreenshotChartWrapper ||
      shouldScreenshotDecorativeModule ||
      (attributes.imageSrc &&
        attributes.tagName !== "img" &&
        (!attributes.innerText || attributes.innerText.trim().length === 0)) ||
      attributes.tagName === "svg" ||
      attributes.tagName === "canvas" ||
      attributes.tagName === "table"
    ) {
      attributes.should_screenshot = true;
      attributes.element = childElementHandle;
    }

    allResults.push({ attributes, depth });

    if (shouldSkipChildTraversal(attributes)) {
      continue;
    }

    const childResults = await getAllChildElementsAttributes({
      element: childElementHandle,
      rootRect,
      depth: depth + 1,
      inheritedFont: attributes.font || inheritedFont,
      inheritedBackground: attributes.background || inheritedBackground,
      inheritedBorderRadius: attributes.borderRadius || inheritedBorderRadius,
      inheritedZIndex: attributes.zIndex || inheritedZIndex,
      inheritedOpacity: attributes.opacity || inheritedOpacity,
      traceLabel: `${traceLabel}>${attributes.tagName}[${childIndex}]`,
    });
    allResults.push(
      ...childResults.elements.map((attr) => ({
        attributes: attr,
        depth: depth + 1,
      })),
    );
  }

  let backgroundColor = inheritedBackground?.color;
  if (depth === 0) {
    const elementsWithRootPosition = allResults.filter(({ attributes }) => {
      return (
        attributes.position &&
        attributes.position.left === 0 &&
        attributes.position.top === 0 &&
        attributes.position.width === rootRect.width &&
        attributes.position.height === rootRect.height
      );
    });

    for (const { attributes } of elementsWithRootPosition) {
      if (attributes.background?.color) {
        backgroundColor = attributes.background.color;
        break;
      }
    }
  }

  const filteredResults =
    depth === 0
      ? allResults.filter(({ attributes }) =>
          shouldKeepRootLevelElement(attributes, rootRect),
        )
      : allResults;

  if (depth === 0) {
    const sortedElements = sortElementsForPpt(filteredResults).map((attributes) => {
        if (attributes.shadow?.color && !attributes.background?.color && backgroundColor) {
          attributes.background = {
            color: backgroundColor,
            opacity: undefined,
          };
        }
        return attributes;
      });

    return {
      elements: sortedElements,
      backgroundColor,
    };
  }

  return {
    elements: filteredResults.map(({ attributes }) => attributes),
    backgroundColor,
  };
}

async function getElementAttributes(
  element: ElementHandleLike,
): Promise<ElementAttributes> {
  return element.evaluate((el: Element) => {
    function colorToHex(color: string): {
      hex: string | undefined;
      opacity: number | undefined;
    } {
      if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
        return { hex: undefined, opacity: undefined };
      }

      if (color.startsWith("rgba(") || color.startsWith("hsla(")) {
        const match = color.match(/rgba?\(([^)]+)\)|hsla?\(([^)]+)\)/);
        if (match) {
          const values = match[1] || match[2];
          const parts = values.split(",").map((part) => part.trim());

          if (parts.length >= 4) {
            const opacity = parseFloat(parts[3]);
            const rgbColor = color
              .replace(/rgba?\(|hsla?\(|\)/g, "")
              .split(",")
              .slice(0, 3)
              .join(",");
            const rgbString = color.startsWith("rgba")
              ? `rgb(${rgbColor})`
              : `hsl(${rgbColor})`;

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = rgbString;
              const hexColor = ctx.fillStyle;
              const hex = hexColor.startsWith("#")
                ? hexColor.substring(1)
                : hexColor;
              return {
                hex,
                opacity: Number.isNaN(opacity) ? undefined : opacity,
              };
            }
          }
        }
      }

      if (color.startsWith("rgb(") || color.startsWith("hsl(")) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = color;
          const hexColor = ctx.fillStyle;
          const hex = hexColor.startsWith("#")
            ? hexColor.substring(1)
            : hexColor;
          return { hex, opacity: undefined };
        }
      }

      if (color.startsWith("#")) {
        return { hex: color.substring(1), opacity: undefined };
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { hex: color, opacity: undefined };
      }

      ctx.fillStyle = color;
      const hexColor = ctx.fillStyle;
      const hex = hexColor.startsWith("#") ? hexColor.substring(1) : hexColor;
      return { hex, opacity: undefined };
    }

    const supportedInlineTextTags = new Set([
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "del",
      "code",
      "br",
    ]);
    const supportedTextContainers = new Set([
      "p",
      "span",
      "div",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);

    function hasOnlyTextNodes(node: Element): boolean {
      const children = node.childNodes;
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        if (child.nodeType === Node.ELEMENT_NODE) {
          return false;
        }
      }
      return true;
    }

    function getNormalizedTextLength(value: string | null | undefined): number {
      return (value ?? "").replace(/\s+/g, " ").trim().length;
    }

    function getDirectTextLength(node: Element): number {
      return Array.from(node.childNodes)
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .length;
    }

    function isSupportedInlineTextNode(node: Node): boolean {
      if (node.nodeType === Node.TEXT_NODE) {
        return true;
      }

      if (!(node instanceof HTMLElement)) {
        return false;
      }

      const tagName = node.tagName.toLowerCase();
      if (!supportedInlineTextTags.has(tagName)) {
        return false;
      }

      if (node.getAttributeNames().length > 0) {
        return false;
      }

      if (tagName === "br") {
        return true;
      }

      return Array.from(node.childNodes).every((child) => isSupportedInlineTextNode(child));
    }

    function hasAggregatableMixedText(node: Element): boolean {
      if (!(node instanceof HTMLElement)) {
        return false;
      }

      const tagName = node.tagName.toLowerCase();
      if (!supportedTextContainers.has(tagName)) {
        return false;
      }

      if (hasOnlyTextNodes(node)) {
        return false;
      }

      if (getNormalizedTextLength(node.textContent) === 0) {
        return false;
      }

      return Array.from(node.childNodes).every((child) => isSupportedInlineTextNode(child));
    }

    function isTextSemanticNode(node: Element): boolean {
      return hasOnlyTextNodes(node) || hasAggregatableMixedText(node);
    }

    function parsePosition(node: Element) {
      const rect = node.getBoundingClientRect();
      return {
        left: Number.isFinite(rect.left) ? rect.left : 0,
        top: Number.isFinite(rect.top) ? rect.top : 0,
        width: Number.isFinite(rect.width) ? rect.width : 0,
        height: Number.isFinite(rect.height) ? rect.height : 0,
      };
    }

    function parseBackground(computedStyles: CSSStyleDeclaration) {
      const backgroundColorResult = colorToHex(computedStyles.backgroundColor);
      const background = {
        color: backgroundColorResult.hex,
        opacity: backgroundColorResult.opacity,
      };

      if (!background.color && background.opacity === undefined) {
        return undefined;
      }

      return background;
    }

    function parseBackgroundImage(computedStyles: CSSStyleDeclaration) {
      const backgroundImage = computedStyles.backgroundImage;

      if (!backgroundImage || backgroundImage === "none") {
        return undefined;
      }

      const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }

      return undefined;
    }

    function parseBorder(computedStyles: CSSStyleDeclaration) {
      const borderColorResult = colorToHex(computedStyles.borderColor);
      const borderWidth = parseFloat(computedStyles.borderWidth);

      if (borderWidth === 0) {
        return undefined;
      }

      const border = {
        color: borderColorResult.hex,
        width: Number.isNaN(borderWidth) ? undefined : borderWidth,
        opacity: borderColorResult.opacity,
      };

      if (
        !border.color &&
        border.width === undefined &&
        border.opacity === undefined
      ) {
        return undefined;
      }

      return border;
    }

    function parseShadow(computedStyles: CSSStyleDeclaration) {
      const boxShadow = computedStyles.boxShadow;
      let shadow: {
        offset?: [number, number];
        color?: string;
        opacity?: number;
        radius?: number;
        angle?: number;
        spread?: number;
        inset?: boolean;
      } = {};

      if (boxShadow && boxShadow !== "none") {
        const shadows: string[] = [];
        let currentShadow = "";
        let parenCount = 0;

        for (let index = 0; index < boxShadow.length; index += 1) {
          const char = boxShadow[index];
          if (char === "(") {
            parenCount += 1;
          } else if (char === ")") {
            parenCount -= 1;
          } else if (char === "," && parenCount === 0) {
            shadows.push(currentShadow.trim());
            currentShadow = "";
            continue;
          }
          currentShadow += char;
        }

        if (currentShadow.trim()) {
          shadows.push(currentShadow.trim());
        }

        let selectedShadow = "";
        let bestShadowScore = -1;

        for (const shadowStr of shadows) {
          const shadowParts = shadowStr.split(" ");
          const numericParts: number[] = [];
          const colorParts: string[] = [];
          let currentColor = "";
          let inColorFunction = false;

          for (const part of shadowParts) {
            const trimmedPart = part.trim();
            if (trimmedPart === "") {
              continue;
            }

            if (trimmedPart.match(/^(rgba?|hsla?)\s*\(/i)) {
              inColorFunction = true;
              currentColor = trimmedPart;
              continue;
            }

            if (inColorFunction) {
              currentColor += ` ${trimmedPart}`;

              const openParens = (currentColor.match(/\(/g) || []).length;
              const closeParens = (currentColor.match(/\)/g) || []).length;
              if (openParens <= closeParens) {
                colorParts.push(currentColor);
                currentColor = "";
                inColorFunction = false;
              }
              continue;
            }

            const numericValue = parseFloat(trimmedPart);
            if (!Number.isNaN(numericValue)) {
              numericParts.push(numericValue);
            } else if (trimmedPart.toLowerCase() !== "inset") {
              colorParts.push(trimmedPart);
            }
          }

          let hasVisibleColor = false;
          if (colorParts.length > 0) {
            const shadowColor = colorParts.join(" ");
            const colorResult = colorToHex(shadowColor);
            hasVisibleColor = Boolean(
              colorResult.hex &&
                colorResult.hex !== "000000" &&
                colorResult.opacity !== 0,
            );
          }

          const hasNonZeroValues = numericParts.some((value) => value !== 0);
          let shadowScore = 0;
          if (hasNonZeroValues) {
            shadowScore += numericParts.filter((value) => value !== 0).length;
          }
          if (hasVisibleColor) {
            shadowScore += 2;
          }

          if (
            (hasNonZeroValues || hasVisibleColor) &&
            shadowScore > bestShadowScore
          ) {
            selectedShadow = shadowStr;
            bestShadowScore = shadowScore;
          }
        }

        if (!selectedShadow && shadows.length > 0) {
          selectedShadow = shadows[0];
        }

        if (selectedShadow) {
          const shadowParts = selectedShadow.split(" ");
          const numericParts: number[] = [];
          const colorParts: string[] = [];
          let isInset = false;
          let currentColor = "";
          let inColorFunction = false;

          for (const part of shadowParts) {
            const trimmedPart = part.trim();
            if (trimmedPart === "") {
              continue;
            }

            if (trimmedPart.toLowerCase() === "inset") {
              isInset = true;
              continue;
            }

            if (trimmedPart.match(/^(rgba?|hsla?)\s*\(/i)) {
              inColorFunction = true;
              currentColor = trimmedPart;
              continue;
            }

            if (inColorFunction) {
              currentColor += ` ${trimmedPart}`;
              const openParens = (currentColor.match(/\(/g) || []).length;
              const closeParens = (currentColor.match(/\)/g) || []).length;
              if (openParens <= closeParens) {
                colorParts.push(currentColor);
                currentColor = "";
                inColorFunction = false;
              }
              continue;
            }

            const numericValue = parseFloat(trimmedPart);
            if (!Number.isNaN(numericValue)) {
              numericParts.push(numericValue);
            } else {
              colorParts.push(trimmedPart);
            }
          }

          if (numericParts.length >= 2 && colorParts.length > 0) {
            const shadowColorResult = colorToHex(colorParts.join(" "));
            if (shadowColorResult.hex) {
              const offsetX = numericParts[0];
              const offsetY = numericParts[1];
              const blurRadius = numericParts.length >= 3 ? numericParts[2] : 0;
              const spreadRadius =
                numericParts.length >= 4 ? numericParts[3] : 0;

              shadow = {
                offset: [offsetX, offsetY],
                color: shadowColorResult.hex,
                opacity: shadowColorResult.opacity,
                radius: blurRadius,
                spread: spreadRadius,
                inset: isInset,
                angle: Math.atan2(offsetY, offsetX) * (180 / Math.PI),
              };
            }
          }
        }
      }

      return Object.keys(shadow).length > 0 ? shadow : undefined;
    }

    function parseFont(computedStyles: CSSStyleDeclaration) {
      const fontSize = parseFloat(computedStyles.fontSize);
      const fontWeight = parseInt(computedStyles.fontWeight, 10);
      const fontColorResult = colorToHex(computedStyles.color);
      const fontFamily = computedStyles.fontFamily;
      const fontStyle = computedStyles.fontStyle;

      let fontName: string | undefined;
      if (fontFamily !== "initial") {
        fontName = fontFamily.split(",")[0]?.trim().replace(/['"]/g, "");
      }

      const font = {
        name: fontName,
        size: Number.isNaN(fontSize) ? undefined : fontSize,
        weight: Number.isNaN(fontWeight) ? undefined : fontWeight,
        color: fontColorResult.hex,
        italic: fontStyle === "italic",
      };

      if (
        !font.name &&
        font.size === undefined &&
        font.weight === undefined &&
        !font.color &&
        !font.italic
      ) {
        return undefined;
      }

      return font;
    }

    function parseLineHeight(computedStyles: CSSStyleDeclaration, node: Element) {
      const lineHeight = computedStyles.lineHeight;
      const innerText = node.textContent || "";
      const htmlNode = node as HTMLElement;

      const fontSize = parseFloat(computedStyles.fontSize);
      const computedLineHeight = parseFloat(computedStyles.lineHeight);
      const singleLineHeight = !Number.isNaN(computedLineHeight)
        ? computedLineHeight
        : fontSize * 1.2;

      const hasExplicitLineBreaks =
        innerText.includes("\n") ||
        innerText.includes("\r") ||
        innerText.includes("\r\n");
      const hasTextWrapping = htmlNode.offsetHeight > singleLineHeight * 2;
      const hasOverflow = htmlNode.scrollHeight > htmlNode.clientHeight;

      const isMultiline =
        hasExplicitLineBreaks || hasTextWrapping || hasOverflow;

      if (isMultiline && lineHeight && lineHeight !== "normal") {
        const parsedLineHeight = parseFloat(lineHeight);
        if (!Number.isNaN(parsedLineHeight)) {
          return parsedLineHeight;
        }
      }

      return undefined;
    }

    function parseBoxSpacing(
      computedStyles: CSSStyleDeclaration,
      kind: "margin" | "padding",
    ) {
      const top = parseFloat(computedStyles[`${kind}Top` as keyof CSSStyleDeclaration] as string);
      const bottom = parseFloat(
        computedStyles[`${kind}Bottom` as keyof CSSStyleDeclaration] as string,
      );
      const left = parseFloat(
        computedStyles[`${kind}Left` as keyof CSSStyleDeclaration] as string,
      );
      const right = parseFloat(
        computedStyles[`${kind}Right` as keyof CSSStyleDeclaration] as string,
      );
      const spacing = {
        top: Number.isNaN(top) ? undefined : top,
        bottom: Number.isNaN(bottom) ? undefined : bottom,
        left: Number.isNaN(left) ? undefined : left,
        right: Number.isNaN(right) ? undefined : right,
      };

      return spacing.top === 0 &&
        spacing.bottom === 0 &&
        spacing.left === 0 &&
        spacing.right === 0
        ? undefined
        : spacing;
    }

    function parseBorderRadius(computedStyles: CSSStyleDeclaration, node: Element) {
      const borderRadius = computedStyles.borderRadius;
      let borderRadiusValue: number[] | undefined;

      if (borderRadius && borderRadius !== "0px") {
        const radiusParts = borderRadius.split(" ").map((part) => parseFloat(part));

        if (radiusParts.length === 1) {
          borderRadiusValue = [
            radiusParts[0],
            radiusParts[0],
            radiusParts[0],
            radiusParts[0],
          ];
        } else if (radiusParts.length === 2) {
          borderRadiusValue = [
            radiusParts[0],
            radiusParts[1],
            radiusParts[0],
            radiusParts[1],
          ];
        } else if (radiusParts.length === 3) {
          borderRadiusValue = [
            radiusParts[0],
            radiusParts[1],
            radiusParts[2],
            radiusParts[1],
          ];
        } else if (radiusParts.length === 4) {
          borderRadiusValue = radiusParts;
        }

        if (borderRadiusValue) {
          const rect = node.getBoundingClientRect();
          const maxRadiusX = rect.width / 2;
          const maxRadiusY = rect.height / 2;

          borderRadiusValue = borderRadiusValue.map((radius, index) => {
            const maxRadius = index === 0 || index === 2 ? maxRadiusX : maxRadiusY;
            return Math.max(0, Math.min(radius, maxRadius));
          });
        }
      }

      return borderRadiusValue;
    }

    function parseShape(node: Element, borderRadiusValue: number[] | undefined) {
      if (node.tagName.toLowerCase() === "img") {
        return borderRadiusValue &&
          borderRadiusValue.length === 4 &&
          borderRadiusValue.every((radius) => radius === 50)
          ? "circle"
          : "rectangle";
      }
      return undefined;
    }

    function parseFilters(computedStyles: CSSStyleDeclaration) {
      const filter = computedStyles.filter;
      if (!filter || filter === "none") {
        return undefined;
      }

      const filters: Record<string, number> = {};
      const filterFunctions = filter.match(/[a-zA-Z-]+\([^)]*\)/g);
      if (filterFunctions) {
        filterFunctions.forEach((func) => {
          const match = func.match(/([a-zA-Z-]+)\(([^)]*)\)/);
          if (!match) {
            return;
          }

          const filterType = match[1];
          const value = parseFloat(match[2]);
          if (Number.isNaN(value)) {
            return;
          }

          switch (filterType) {
            case "invert":
              filters.invert = value;
              break;
            case "brightness":
              filters.brightness = value;
              break;
            case "contrast":
              filters.contrast = value;
              break;
            case "saturate":
              filters.saturate = value;
              break;
            case "hue-rotate":
              filters.hueRotate = value;
              break;
            case "blur":
              filters.blur = value;
              break;
            case "grayscale":
              filters.grayscale = value;
              break;
            case "sepia":
              filters.sepia = value;
              break;
            case "opacity":
              filters.opacity = value;
              break;
          }
        });
      }

      return Object.keys(filters).length > 0 ? filters : undefined;
    }

    function parseFlexTextAlignmentHints(
      computedStyles: CSSStyleDeclaration,
      node: Element,
    ) {
      if (!isTextSemanticNode(node) || !(node instanceof HTMLElement)) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      if (
        computedStyles.display !== "flex" &&
        computedStyles.display !== "inline-flex"
      ) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      const isRowDirection = !computedStyles.flexDirection.startsWith("column");
      let textAlignHint: "center" | undefined;
      let textVerticalAlignHint: "middle" | undefined;

      if (isRowDirection) {
        if (computedStyles.justifyContent.includes("center")) {
          textAlignHint = "center";
        }
        if (computedStyles.alignItems.includes("center")) {
          textVerticalAlignHint = "middle";
        }
      } else {
        if (computedStyles.alignItems.includes("center")) {
          textAlignHint = "center";
        }
        if (computedStyles.justifyContent.includes("center")) {
          textVerticalAlignHint = "middle";
        }
      }

      return {
        textAlignHint,
        textVerticalAlignHint,
      };
    }

    function parseCenteredTextGeometryHint(node: Element) {
      if (!isTextSemanticNode(node) || !(node instanceof HTMLElement)) {
        return undefined;
      }

      if (!(node.textContent || "").trim()) {
        return undefined;
      }

      const nodeRect = node.getBoundingClientRect();
      if (nodeRect.width <= 0 || nodeRect.height <= 0) {
        return undefined;
      }

      const range = document.createRange();
      range.selectNodeContents(node);
      const textRect = range.getBoundingClientRect();

      if (textRect.width <= 0 || textRect.height <= 0) {
        return undefined;
      }

      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const textCenterX = textRect.left + textRect.width / 2;
      const centerDelta = Math.abs(nodeCenterX - textCenterX);
      const leftInset = textRect.left - nodeRect.left;
      const rightInset = nodeRect.right - textRect.right;
      const hasVisibleHorizontalGutters = leftInset >= 2 && rightInset >= 2;

      return centerDelta <= 2 && hasVisibleHorizontalGutters
        ? "center"
        : undefined;
    }

    function parseMeasuredTextWidth(node: Element) {
      if (!isTextSemanticNode(node) || !(node instanceof HTMLElement)) {
        return undefined;
      }

      if (!(node.textContent || "").trim()) {
        return undefined;
      }

      const range = document.createRange();
      range.selectNodeContents(node);

      const measuredTextWidth = Math.max(
        range.getBoundingClientRect().width,
        node.scrollWidth,
      );

      return measuredTextWidth > 0 ? measuredTextWidth : undefined;
    }

    function parseTextAlign(
      computedStyles: CSSStyleDeclaration,
    ): "center" | "right" | "justify" | undefined {
      const textAlign = computedStyles.textAlign.toLowerCase();

      if (
        textAlign === "right" ||
        textAlign === "center" ||
        textAlign === "justify"
      ) {
        return textAlign;
      }

      if (textAlign === "end") {
        return "right";
      }

      return undefined;
    }

    function parseParentTextAlignmentHints(node: Element) {
      if (!isTextSemanticNode(node) || !(node instanceof HTMLElement)) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      const parent = node.parentElement;
      if (!parent) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      const parentStyles = window.getComputedStyle(parent);
      if (
        parentStyles.display !== "flex" &&
        parentStyles.display !== "inline-flex"
      ) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      const parentRect = parent.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      if (parentRect.width <= 0 || nodeRect.width <= 0) {
        return {
          textAlignHint: undefined,
          textVerticalAlignHint: undefined,
        };
      }

      const isRowDirection = !parentStyles.flexDirection.startsWith("column");
      const parentCenterX = parentRect.left + parentRect.width / 2;
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const centerDelta = Math.abs(parentCenterX - nodeCenterX);

      let textAlignHint: "center" | undefined;
      let textVerticalAlignHint: "middle" | undefined;

      if (isRowDirection) {
        if (parentStyles.justifyContent.includes("center") && centerDelta <= 6) {
          textAlignHint = "center";
        }
        if (parentStyles.alignItems.includes("center")) {
          textVerticalAlignHint = "middle";
        }
      } else {
        if (parentStyles.alignItems.includes("center") && centerDelta <= 6) {
          textAlignHint = "center";
        }
        if (parentStyles.justifyContent.includes("center")) {
          textVerticalAlignHint = "middle";
        }
      }

      return {
        textAlignHint,
        textVerticalAlignHint,
      };
    }

    function parseRichTextHtml(node: Element): string | undefined {
      if (!hasAggregatableMixedText(node) || !(node instanceof HTMLElement)) {
        return undefined;
      }

      const html = node.innerHTML.trim();
      return html.length > 0 ? html : undefined;
    }

    function parseBorderSides(computedStyles: CSSStyleDeclaration) {
      const parseSide = (side: "Top" | "Right" | "Bottom" | "Left") => {
        const widthValue = parseFloat(computedStyles[`border${side}Width` as keyof CSSStyleDeclaration] as string);
        const styleValue = String(
          computedStyles[`border${side}Style` as keyof CSSStyleDeclaration] ?? "",
        ).toLowerCase();
        if (Number.isNaN(widthValue) || widthValue <= 0 || styleValue === "none" || styleValue === "hidden") {
          return undefined;
        }

        const colorResult = colorToHex(
          String(computedStyles[`border${side}Color` as keyof CSSStyleDeclaration] ?? ""),
        );
        if (!colorResult.hex) {
          return undefined;
        }

        return {
          color: colorResult.hex,
          width: widthValue,
          opacity: colorResult.opacity,
        };
      };

      const borderSides = {
        top: parseSide("Top"),
        right: parseSide("Right"),
        bottom: parseSide("Bottom"),
        left: parseSide("Left"),
      };

      return Object.values(borderSides).some(Boolean) ? borderSides : undefined;
    }

    function sumGraphicSignals(node: Element): number {
      const selectors = ["svg", "canvas", "path", "line", "polyline", "polygon", "circle", "rect"];
      return selectors.reduce((sum, selector) => {
        const selfCount = node.matches(selector) ? 1 : 0;
        return sum + selfCount + node.querySelectorAll(selector).length;
      }, 0);
    }

    function parseElementAttributes(node: Element) {
      const computedStyles = window.getComputedStyle(node);
      const position = parsePosition(node);
      const borderRadiusValue = parseBorderRadius(computedStyles, node);
      const parsedBackgroundImage = parseBackgroundImage(computedStyles);
      const opacity = parseFloat(computedStyles.opacity);
      const textOnly = hasOnlyTextNodes(node);
      const textSemanticNode = isTextSemanticNode(node);
      const { textAlignHint: flexTextAlignHint, textVerticalAlignHint } =
        parseFlexTextAlignmentHints(computedStyles, node);
      const {
        textAlignHint: parentTextAlignHint,
        textVerticalAlignHint: parentTextVerticalAlignHint,
      } = parseParentTextAlignmentHints(node);
      const textAlignHint =
        flexTextAlignHint ?? parentTextAlignHint ?? parseCenteredTextGeometryHint(node);
      const richTextHtml = parseRichTextHtml(node);
      const borderSides = parseBorderSides(computedStyles);
      const plainText = textSemanticNode ? (node.textContent || undefined) : undefined;

      return {
        tagName: node.tagName.toLowerCase(),
        id: node.id,
        className:
          node.className && typeof node.className === "string"
            ? node.className
            : node.className
              ? node.className.toString()
              : undefined,
        innerText: plainText,
        textHtml: richTextHtml,
        textLength: getNormalizedTextLength(node.textContent),
        directTextLength: getDirectTextLength(node),
        childElementCount: node.children.length,
        graphicSignalCount: sumGraphicSignals(node),
        opacity: Number.isNaN(opacity) ? undefined : opacity,
        background: parseBackground(computedStyles),
        border: parseBorder(computedStyles),
        borderSides,
        shadow: parseShadow(computedStyles),
        font: parseFont(computedStyles),
        position,
        margin: parseBoxSpacing(computedStyles, "margin"),
        padding: parseBoxSpacing(computedStyles, "padding"),
        zIndex: Number.isNaN(parseInt(computedStyles.zIndex, 10))
          ? 0
          : parseInt(computedStyles.zIndex, 10),
        textAlign: parseTextAlign(computedStyles),
        textAlignHint,
        textVerticalAlignHint: textVerticalAlignHint ?? parentTextVerticalAlignHint,
        lineHeight: parseLineHeight(computedStyles, node),
        measuredTextWidth: parseMeasuredTextWidth(node),
        borderRadius: borderRadiusValue,
        imageSrc:
          (node as HTMLImageElement).src || parsedBackgroundImage || undefined,
        objectFit:
          (computedStyles.objectFit as "contain" | "cover" | "fill" | undefined),
        clip: false,
        overlay: undefined,
        shape: parseShape(node, borderRadiusValue) as
          | "rectangle"
          | "circle"
          | undefined,
        connectorType: undefined,
        textWrap: computedStyles.whiteSpace !== "nowrap",
        pptxExport:
          node.getAttribute("data-pptx-export") === "screenshot"
            ? ("screenshot" as const)
            : undefined,
        should_screenshot: false,
        element: undefined,
        filters: parseFilters(computedStyles) as any,
      };
    }

    return parseElementAttributes(el);
  }).catch((error: unknown) => {
    throw new Error(`element.evaluate failed: ${errorMessage(error)}`, {
      cause: error instanceof Error ? error : undefined,
    });
  });
}
