import type {
  RenderedElementSummary,
  StabilityDiagnostic,
  StabilityRule,
} from "../../types.js";
import { createRuleDiagnostic } from "../../static/helpers.js";
import { inspectRenderedSlides } from "../inspectors.js";

function isTransparentStrokeText(element: RenderedElementSummary): boolean {
  const color = element.styles.color?.toLowerCase() ?? "";
  const strokeWidth = element.styles.webkitTextStrokeWidth ?? "0px";
  return element.textLength > 0
    && strokeWidth !== "0px"
    && (
      color === "transparent"
      || color.endsWith(", 0)")
      || color.endsWith(", 0.0)")
    );
}

function isGradientCard(element: RenderedElementSummary): boolean {
  const backgroundImage = element.styles.backgroundImage?.toLowerCase() ?? "";
  return backgroundImage.includes("gradient(")
    && element.rect.width >= 80
    && element.rect.height >= 40
    && (element.rect.width < 1200 || element.rect.height < 680)
    && element.textLength > 0;
}

function usesTranslateCentering(element: RenderedElementSummary): boolean {
  const inlineStyle = element.attributes.style ?? "";
  const className = element.className ?? "";
  const transform = element.styles.transform ?? "";
  const hasLeftFifty = /left\s*:\s*50%/i.test(inlineStyle) || /\bleft-\[50%\]/.test(className);
  const hasTranslateBack = /translateX\(-50%\)/i.test(inlineStyle)
    || /\b-translate-x-1\/2\b/.test(className)
    || /\b-translate-x-\[50%\]\b/.test(className)
    || transform !== "none";

  return element.textLength > 0 && hasLeftFifty && hasTranslateBack;
}

function usesCurrentColorSvg(element: RenderedElementSummary): boolean {
  if (!element.svgUsesCurrentColor) {
    return false;
  }

  return element.tagName === "svg" || element.graphicCounts.svg > 0;
}

export const TEXT_STROKE_RISK_RULE: StabilityRule = {
  id: "VALIDATE-004",
  title: "Transparent text with text-stroke must not carry key content",
  phase: "rendered",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-export-rules.md",
  ],
  appliesTo: ["dom"],
  async run(context) {
    const inspections = await inspectRenderedSlides(context);
    const diagnostics: StabilityDiagnostic[] = [];

    for (const slide of inspections) {
      for (const element of slide.elements.filter(isTransparentStrokeText)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Key text depends on transparent fill plus text-stroke on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Replace text-stroke styling with real layered text nodes or convert that decorative region into a screenshot-only module.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            color: element.styles.color,
            webkitTextStrokeWidth: element.styles.webkitTextStrokeWidth,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const SVG_CURRENT_COLOR_RULE: StabilityRule = {
  id: "VALIDATE-005",
  title: "Inline SVG must not depend on currentColor or external classes",
  phase: "rendered",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-export-rules.md",
  ],
  appliesTo: ["dom"],
  async run(context) {
    const inspections = await inspectRenderedSlides(context);
    const diagnostics: StabilityDiagnostic[] = [];

    for (const slide of inspections) {
      for (const element of slide.elements.filter(usesCurrentColorSvg)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Inline SVG depends on currentColor or utility classes on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Write explicit fill and stroke values inside the SVG, switch to an img asset, or export that pure graphic block as a screenshot.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            className: element.className,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const GRADIENT_CARD_RISK_RULE: StabilityRule = {
  id: "VALIDATE-008",
  title: "Key cards must not rely on gradient backgrounds",
  phase: "rendered",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-export-rules.md",
  ],
  appliesTo: ["dom"],
  async run(context) {
    const inspections = await inspectRenderedSlides(context);
    const diagnostics: StabilityDiagnostic[] = [];

    for (const slide of inspections) {
      for (const element of slide.elements.filter(isGradientCard)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Key content container relies on a gradient background on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Use a solid or semi-transparent backgroundColor for cards and keep gradient atmosphere on separate non-critical background layers.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            backgroundImage: element.styles.backgroundImage,
            width: element.rect.width,
            height: element.rect.height,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const TRANSLATE_CENTER_RISK_RULE: StabilityRule = {
  id: "VALIDATE-012",
  title: "Centered key text must not rely on left:50% plus translateX(-50%)",
  phase: "rendered",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-export-rules.md",
  ],
  appliesTo: ["dom"],
  async run(context) {
    const inspections = await inspectRenderedSlides(context);
    const diagnostics: StabilityDiagnostic[] = [];

    for (const slide of inspections) {
      for (const element of slide.elements.filter(usesTranslateCentering)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Centered key text relies on translate-based centering on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Give the real text node an explicit width and text-center, or center it with a width-aware flex container instead of translateX(-50%).",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            className: element.className,
            inlineStyle: element.attributes.style ?? null,
            transform: element.styles.transform,
          },
        }));
      }
    }

    return diagnostics;
  },
};
