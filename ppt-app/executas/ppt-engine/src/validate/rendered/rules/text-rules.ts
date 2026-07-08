import type {
  RenderedElementSummary,
  StabilityDiagnostic,
  StabilityRule,
} from "../../types.js";
import { createRuleDiagnostic } from "../../static/helpers.js";
import { inspectRenderedSlides } from "../inspectors.js";

function isSingleLineTextCandidate(element: RenderedElementSummary): boolean {
  const role = element.attributes["data-validation-role"];
  if (role === "multi-line-body-text") {
    return false;
  }

  const textBoxHeight = parseFloat(element.styles.height ?? "") || 0;
  const looksLikeSingleLine = element.rect.height <= 30 || element.styles.whiteSpace === "nowrap";

  return (
    role === "single-line-key-text"
    || role === "single-line-box"
    || (
      element.directTextLength > 0
      && element.childElementCount === 0
      && element.textLength <= 80
      && element.rect.height > 0
      && element.rect.height <= 96
      && element.rect.width > 0
      && (looksLikeSingleLine || textBoxHeight <= 30)
    )
  );
}

function isCenteredTextCandidate(element: RenderedElementSummary): boolean {
  const role = element.attributes["data-validation-role"];
  return role === "centered-key-text"
    || (
      element.directTextLength > 0
      && element.textLength <= 80
      && element.childElementCount === 0
      && element.parentRect !== null
      && element.parentRect.width > 0
    );
}

function isParentCenteredFlex(element: RenderedElementSummary): boolean {
  return element.parentSelector !== null
    && (
      element.parentStyles?.display === "flex"
      || element.parentStyles?.display === "inline-flex"
    )
    && element.parentStyles?.justifyContent === "center";
}

export const SINGLE_LINE_KEY_TEXT_RULE: StabilityRule = {
  id: "DOM-005",
  title: "Key single-line text must stay nowrap and have enough width",
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
      for (const element of slide.elements.filter(isSingleLineTextCandidate)) {
        const isNowrap = element.styles.whiteSpace === "nowrap";
        const hasOverflow = element.scroll.width > element.scroll.clientWidth + 1;
        if (isNowrap && !hasOverflow) {
          continue;
        }

        diagnostics.push(createRuleDiagnostic(this, {
          message: `Single-line key text may wrap or overflow on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Add whitespace-nowrap to the real text node and give it enough explicit width so scrollWidth does not exceed clientWidth.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            whiteSpace: element.styles.whiteSpace,
            scrollWidth: element.scroll.width,
            clientWidth: element.scroll.clientWidth,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const FIXED_HEIGHT_VERTICAL_ALIGN_RULE: StabilityRule = {
  id: "DOM-006",
  title: "Fixed-height single-line text boxes must center text vertically",
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
      for (const element of slide.elements.filter((item) =>
        item.attributes["data-validation-role"] === "single-line-box"
          || (
            isSingleLineTextCandidate(item)
            && item.rect.height >= 32
            && item.rect.height <= 120
          )
      )) {
        const isFlex = element.styles.display === "flex" || element.styles.display === "inline-flex";
        const isVerticallyCentered = isFlex && element.styles.alignItems === "center";
        if (isVerticallyCentered) {
          continue;
        }

        diagnostics.push(createRuleDiagnostic(this, {
          message: `Fixed-height single-line text box is missing explicit vertical centering on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Use a dedicated text box with explicit width and height, then set display:flex or inline-flex together with align-items:center.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            display: element.styles.display,
            alignItems: element.styles.alignItems,
            height: element.rect.height,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const CENTERED_TEXT_SEMANTICS_RULE: StabilityRule = {
  id: "DOM-007",
  title: "Centered key text must carry center semantics on the real text node",
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
      for (const element of slide.elements.filter(isCenteredTextCandidate)) {
        const wantsCenteredText = element.attributes["data-validation-role"] === "centered-key-text"
          || isParentCenteredFlex(element);
        if (!wantsCenteredText) {
          continue;
        }

        const widthRatio = element.parentRect && element.parentRect.width > 0
          ? element.rect.width / element.parentRect.width
          : 1;
        const hasCenteredSemantics = element.styles.textAlign === "center" && widthRatio >= 0.7;
        if (hasCenteredSemantics) {
          continue;
        }

        diagnostics.push(createRuleDiagnostic(this, {
          message: `Centered key text depends on parent centering instead of the text node itself on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Apply text-center and an explicit content width on the real text node instead of relying only on the parent flex container.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            textAlign: element.styles.textAlign,
            widthRatio,
            parentWidth: element.parentRect?.width ?? null,
            elementWidth: element.rect.width,
          },
        }));
      }
    }

    return diagnostics;
  },
};
