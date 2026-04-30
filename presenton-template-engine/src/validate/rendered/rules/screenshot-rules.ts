import type { RenderedElementSummary, StabilityDiagnostic, StabilityRule } from "../../types.js";
import { createRuleDiagnostic } from "../../static/helpers.js";
import { inspectRenderedSlides } from "../inspectors.js";

const NON_CONTAINER_TAGS = new Set([
  "path",
  "line",
  "polyline",
  "polygon",
  "circle",
  "rect",
]);

function getGraphicSignalCount(element: RenderedElementSummary): number {
  return Object.values(element.graphicCounts).reduce((sum, value) => sum + value, 0);
}

function isGraphicDominantCandidate(element: RenderedElementSummary): boolean {
  const graphicSignalCount = getGraphicSignalCount(element);
  return !NON_CONTAINER_TAGS.has(element.tagName)
    && element.screenshotExport !== "screenshot"
    && element.rect.width >= 80
    && element.rect.height >= 80
    && (
      element.attributes["data-chart-like"] === "true"
      || (graphicSignalCount >= 8 && element.textLength <= 80)
      || (
        (element.graphicCounts.svg > 0 || element.graphicCounts.canvas > 0)
        && graphicSignalCount >= 4
        && element.textLength <= 80
      )
    );
}

function selectGraphicDominantTargets(
  elements: RenderedElementSummary[],
): RenderedElementSummary[] {
  const elementsBySelector = new Map(
    elements.map((element) => [element.selector, element]),
  );
  const candidates = elements.filter(isGraphicDominantCandidate);
  const candidateSelectorSet = new Set(candidates.map((candidate) => candidate.selector));
  const ancestorCandidateSelectors = new Set<string>();

  for (const candidate of candidates) {
    const visitedParentSelectors = new Set<string>();
    let currentParentSelector = candidate.parentSelector;
    while (currentParentSelector) {
      if (visitedParentSelectors.has(currentParentSelector)) {
        break;
      }
      visitedParentSelectors.add(currentParentSelector);

      if (candidateSelectorSet.has(currentParentSelector)) {
        ancestorCandidateSelectors.add(currentParentSelector);
      }
      currentParentSelector =
        elementsBySelector.get(currentParentSelector)?.parentSelector ?? null;
    }
  }

  return candidates.filter((candidate) =>
    !ancestorCandidateSelectors.has(candidate.selector)
  );
}

function isTextDominantScreenshot(element: RenderedElementSummary): boolean {
  const graphicSignalCount = getGraphicSignalCount(element);
  if (element.attributes["data-pptx-export"] !== "screenshot") {
    return false;
  }

  return (
    element.textLength >= 120
    || (
      element.textLength >= 60
      && graphicSignalCount <= 6
      && element.directTextLength >= 24
    )
  );
}

export const GRAPHIC_MODULE_SCREENSHOT_RULE: StabilityRule = {
  id: "DOM-003",
  title: "Graphic-dominant modules must opt into screenshot export",
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
      for (const element of selectGraphicDominantTargets(slide.elements)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Graphic-dominant module is missing data-pptx-export="screenshot" on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Wrap chart-like or geometry-heavy modules with a bounded container and set data-pptx-export=\"screenshot\" on that container.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            textLength: element.textLength,
            graphicSignalCount: getGraphicSignalCount(element),
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const TEXT_MODULE_SCREENSHOT_RULE: StabilityRule = {
  id: "DOM-004",
  title: "Text-dominant modules must not be exported as one screenshot",
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
      for (const element of slide.elements.filter(isTextDominantScreenshot)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Screenshot region contains too much editable text on slide "${slide.slideId ?? slide.slideIndex}"`,
          suggestion: "Keep screenshot export only for the pure chart/graphic area, and leave titles, bullets, metrics, and body text as normal DOM text nodes.",
          locations: [{
            slideId: slide.slideId ?? undefined,
            layoutId: slide.layoutId ?? undefined,
            selector: element.selector,
          }],
          evidence: {
            textLength: element.textLength,
            graphicSignalCount: getGraphicSignalCount(element),
          },
        }));
      }
    }

    return diagnostics;
  },
};
