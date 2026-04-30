import type {
  RenderedElementSummary,
  RenderedSlideInfo,
  RenderedSlideInspection,
  RenderedValidationInspectionOptions,
  ValidationContext,
} from "../types.js";
import { selectCollectionPageForValidation } from "../page-selection.js";
import { prepareRenderedValidationContext } from "./runtime.js";

const DEFAULT_MAX_ELEMENTS_PER_SLIDE = 450;
const DEFAULT_MAX_INSPECTION_MS_PER_SLIDE = 10_000;
const DEFAULT_SKIP_SELECTOR = [
  "[data-validation-ignore]",
  "[data-presenton-validation-ignore]",
  "[data-presenton-decorative]",
  "[data-pptx-ignore]",
].join(",");

async function inspectSlide(
  context: ValidationContext,
  slide: RenderedSlideInfo,
): Promise<RenderedSlideInspection> {
  const page = context.rendered?.page;
  if (!page) {
    throw new Error("Rendered validation context is missing a loaded page.");
  }

  const shellElement = await page.$(slide.shellSelector);
  if (!shellElement) {
    throw new Error(`Rendered slide shell not found for selector: ${slide.shellSelector}`);
  }

  const inspectionOptions = context.renderedOptions?.inspection ?? {};
  const snapshot = await shellElement.evaluate((shell, rootSelector, options) => {
    const shellElement = shell as HTMLElement;
    const slideRoot = (rootSelector
      ? shellElement.querySelector(rootSelector)
      : null) as HTMLElement | null;
    const inspectionRoot = slideRoot ?? shellElement;
    const normalizedOptions = options as Required<RenderedValidationInspectionOptions>;
    const maxElementsPerSlide = normalizedOptions.maxElementsPerSlide;
    const maxInspectionMsPerSlide = normalizedOptions.maxInspectionMsPerSlide;
    const startedAt = performance.now();

    const getTextLength = (element: Element): number => {
      const textContent = element.textContent ?? "";
      return textContent.replace(/\s+/g, " ").trim().length;
    };

    const getDirectTextLength = (element: Element): number => {
      const text = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ");
      return text.replace(/\s+/g, " ").trim().length;
    };

    const escapeAttributeValue = (value: string): string => {
      return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    };

    const buildSelector = (element: Element): string => {
      if (element === inspectionRoot) {
        return rootSelector || "[data-presenton-slide-shell=\"true\"]";
      }

      if (element.id) {
        return `#${element.id}`;
      }

      if (element.hasAttribute("data-manifest-slide-id")) {
        const value = element.getAttribute("data-manifest-slide-id");
        return `[data-manifest-slide-id="${escapeAttributeValue(value ?? "")}"]`;
      }

      if (element.hasAttribute("data-pptx-export")) {
        const value = element.getAttribute("data-pptx-export");
        return `[data-pptx-export="${escapeAttributeValue(value ?? "")}"]`;
      }

      const segments: string[] = [];
      let current: Element | null = element;
      while (current && current !== inspectionRoot && segments.length < 4) {
        const parent: Element | null = current.parentElement;
        if (!parent) {
          break;
        }

        const currentTagName = current.tagName;
        const siblings = Array.from(parent.children).filter((candidate): candidate is Element =>
          candidate.tagName === currentTagName
        );
        const segment = `${current.tagName.toLowerCase()}:nth-of-type(${
          siblings.indexOf(current) + 1
        })`;
        segments.unshift(segment);
        current = parent;
      }

      const prefix = rootSelector || "[data-presenton-slide-shell=\"true\"]";
      return segments.length > 0 ? `${prefix} > ${segments.join(" > ")}` : prefix;
    };

    const shouldSkipSubtree = (element: Element): boolean => {
      if (element === inspectionRoot) {
        return false;
      }

      if (
        normalizedOptions.skipScreenshotChildren
        && element.matches('[data-pptx-export="screenshot"]')
      ) {
        return false;
      }

      if (normalizedOptions.skipSelector && element.matches(normalizedOptions.skipSelector)) {
        return true;
      }

      if (
        normalizedOptions.skipAriaHidden
        && element.getAttribute("aria-hidden") === "true"
      ) {
        return true;
      }

      if (
        normalizedOptions.skipScreenshotChildren
        && element.parentElement?.closest('[data-pptx-export="screenshot"]')
      ) {
        return true;
      }

      return false;
    };

    const getOwnGraphicCounts = (element: Element) => {
      const tagName = element.tagName.toLowerCase();
      return {
        svg: tagName === "svg" ? 1 : 0,
        canvas: tagName === "canvas" ? 1 : 0,
        path: tagName === "path" ? 1 : 0,
        line: tagName === "line" ? 1 : 0,
        polyline: tagName === "polyline" ? 1 : 0,
        polygon: tagName === "polygon" ? 1 : 0,
        circle: tagName === "circle" ? 1 : 0,
        rect: tagName === "rect" ? 1 : 0,
      };
    };

    const mergeGraphicCounts = (
      target: ReturnType<typeof getOwnGraphicCounts>,
      source: ReturnType<typeof getOwnGraphicCounts>,
    ) => {
      target.svg += source.svg;
      target.canvas += source.canvas;
      target.path += source.path;
      target.line += source.line;
      target.polyline += source.polyline;
      target.polygon += source.polygon;
      target.circle += source.circle;
      target.rect += source.rect;
    };

    const getGraphicSignalCount = (counts: ReturnType<typeof getOwnGraphicCounts>): number =>
      Object.values(counts).reduce((sum, value) => sum + value, 0);

    const shouldInspectElement = (
      element: Element,
      graphicCounts: ReturnType<typeof getOwnGraphicCounts>,
    ): boolean => {
      if (element === inspectionRoot) {
        return true;
      }

      const textLength = getTextLength(element);
      if (textLength > 0 || getGraphicSignalCount(graphicCounts) > 0) {
        return true;
      }

      if (
        element.hasAttribute("data-pptx-export")
        || element.hasAttribute("data-validation-role")
        || element.hasAttribute("data-chart-like")
        || element.hasAttribute("data-manifest-slide-id")
      ) {
        return true;
      }

      return false;
    };

    const elementRecords: Array<{
      element: Element;
      graphicCounts: ReturnType<typeof getOwnGraphicCounts>;
      svgUsesCurrentColor: boolean;
    }> = [];
    const graphicCountsByElement = new Map<Element, ReturnType<typeof getOwnGraphicCounts>>();
    const svgUsesCurrentColorByElement = new Map<Element, boolean>();
    let skippedElementCount = 0;
    let truncated = false;

    const visitElement = (element: Element): ReturnType<typeof getOwnGraphicCounts> => {
      const ownGraphicCounts = getOwnGraphicCounts(element);
      const aggregateGraphicCounts = { ...ownGraphicCounts };
      const rawSvgMarkup = element.tagName.toLowerCase() === "svg" ? element.outerHTML : "";
      const className = element.getAttribute("class") ?? "";
      let svgUsesCurrentColor = /currentColor/.test(rawSvgMarkup)
        || /\b(?:fill-current|stroke-current|text-current)\b/.test(className);

      if (
        elementRecords.length >= maxElementsPerSlide
        || performance.now() - startedAt > maxInspectionMsPerSlide
      ) {
        truncated = true;
        skippedElementCount += element.querySelectorAll("*").length;
        graphicCountsByElement.set(element, aggregateGraphicCounts);
        svgUsesCurrentColorByElement.set(element, svgUsesCurrentColor);
        return aggregateGraphicCounts;
      }

      if (!shouldSkipSubtree(element)) {
        // Keep traversing below. The element is added to records after children
        // have contributed aggregate graphic counts.
      } else {
        skippedElementCount += 1 + element.querySelectorAll("*").length;
        graphicCountsByElement.set(element, aggregateGraphicCounts);
        svgUsesCurrentColorByElement.set(element, svgUsesCurrentColor);
        return aggregateGraphicCounts;
      }

      for (const child of Array.from(element.children)) {
        const childGraphicCounts = visitElement(child);
        mergeGraphicCounts(aggregateGraphicCounts, childGraphicCounts);
        svgUsesCurrentColor = svgUsesCurrentColor || Boolean(svgUsesCurrentColorByElement.get(child));
      }

      graphicCountsByElement.set(element, aggregateGraphicCounts);
      svgUsesCurrentColorByElement.set(element, svgUsesCurrentColor);
      if (shouldInspectElement(element, aggregateGraphicCounts)) {
        const record = {
          element,
          graphicCounts: aggregateGraphicCounts,
          svgUsesCurrentColor,
        };
        elementRecords.push(record);
      } else {
        skippedElementCount += 1;
      }
      return aggregateGraphicCounts;
    };

    visitElement(inspectionRoot);

    const summarizeElement = (element: Element): RenderedElementSummary => {
      const htmlElement = element as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      const parentElement = htmlElement.parentElement;
      const parentRect = parentElement?.getBoundingClientRect() ?? null;
      const parentStyle = parentElement ? window.getComputedStyle(parentElement) : null;
      const screenshotHost = htmlElement.closest("[data-pptx-export]");
      const attributeEntries = Array.from(element.attributes).map((attribute) => [
        attribute.name,
        attribute.value,
      ]);
      const graphicCounts = graphicCountsByElement.get(element) ?? getOwnGraphicCounts(element);
      const svgUsesCurrentColor = Boolean(svgUsesCurrentColorByElement.get(element));

      return {
        selector: buildSelector(element),
        parentSelector:
          parentElement && inspectionRoot.contains(parentElement)
            ? buildSelector(parentElement)
            : null,
        tagName: element.tagName.toLowerCase(),
        className: htmlElement.className || null,
        textContent: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
        textLength: getTextLength(element),
        directTextLength: getDirectTextLength(element),
        childElementCount: element.children.length,
        screenshotExport: screenshotHost?.getAttribute("data-pptx-export") ?? null,
        attributes: Object.fromEntries(attributeEntries),
        styles: {
          display: computedStyle.display || null,
          position: computedStyle.position || null,
          whiteSpace: computedStyle.whiteSpace || null,
          textAlign: computedStyle.textAlign || null,
          justifyContent: computedStyle.justifyContent || null,
          alignItems: computedStyle.alignItems || null,
          overflowX: computedStyle.overflowX || null,
          overflowY: computedStyle.overflowY || null,
          backgroundImage: computedStyle.backgroundImage || null,
          backgroundColor: computedStyle.backgroundColor || null,
          color: computedStyle.color || null,
          webkitTextStrokeWidth: computedStyle.webkitTextStrokeWidth || null,
          webkitTextStrokeColor: computedStyle.webkitTextStrokeColor || null,
          transform: computedStyle.transform || null,
          left: computedStyle.left || null,
          top: computedStyle.top || null,
          width: computedStyle.width || null,
          height: computedStyle.height || null,
        },
        rect: {
          width: rect.width,
          height: rect.height,
        },
        parentRect: parentRect
          ? {
            width: parentRect.width,
            height: parentRect.height,
          }
          : null,
        parentStyles: parentStyle
          ? {
            display: parentStyle.display || null,
            justifyContent: parentStyle.justifyContent || null,
            alignItems: parentStyle.alignItems || null,
          }
          : null,
        scroll: {
          width: htmlElement.scrollWidth,
          height: htmlElement.scrollHeight,
          clientWidth: htmlElement.clientWidth,
          clientHeight: htmlElement.clientHeight,
        },
        graphicCounts,
        svgUsesCurrentColor,
      };
    };

    const elements = elementRecords.map(({ element }) => summarizeElement(element));
    const screenshotRegionCount = elements.filter((element) =>
      element.attributes["data-pptx-export"] === "screenshot"
    ).length;
    const totalTextElements = elements.filter((element) => element.textLength > 0);

    return {
      totalTextLength: totalTextElements.reduce((sum, element) => sum + element.directTextLength, 0),
      totalTextElementCount: totalTextElements.length,
      screenshotRegionCount,
      graphicSignalCount: elements.reduce((sum, element) =>
        sum + Object.values(element.graphicCounts).reduce((inner, value) => inner + value, 0), 0
      ),
      inspectedElementCount: elements.length,
      skippedElementCount,
      truncated,
      elements,
    };
  }, slide.rootSelector, {
    maxElementsPerSlide:
      inspectionOptions.maxElementsPerSlide ?? DEFAULT_MAX_ELEMENTS_PER_SLIDE,
    maxInspectionMsPerSlide:
      inspectionOptions.maxInspectionMsPerSlide ?? DEFAULT_MAX_INSPECTION_MS_PER_SLIDE,
    skipSelector: inspectionOptions.skipSelector ?? DEFAULT_SKIP_SELECTOR,
    skipAriaHidden: inspectionOptions.skipAriaHidden ?? true,
    skipScreenshotChildren: inspectionOptions.skipScreenshotChildren ?? true,
  } satisfies Required<RenderedValidationInspectionOptions>);

  return {
    slideIndex: slide.slideIndex,
    slideId: slide.slideId,
    layoutId: slide.layoutId,
    templateGroup: slide.templateGroup,
    ...snapshot,
  };
}

export async function inspectRenderedSlides(
  context: ValidationContext,
): Promise<RenderedSlideInspection[]> {
  const renderedContext = context.rendered ?? await prepareRenderedValidationContext(context);
  if (renderedContext.slideInspections) {
    return renderedContext.slideInspectionsArePageScoped
      ? renderedContext.slideInspections
      : selectCollectionPageForValidation(renderedContext.slideInspections, context);
  }

  if (renderedContext.inspectSlides) {
    const inspections = selectCollectionPageForValidation(
      await renderedContext.inspectSlides(),
      context,
    );
    renderedContext.slideInspections = inspections;
    renderedContext.slideInspectionsArePageScoped = Boolean(context.singlePage);
    return inspections;
  }

  const inspections: RenderedSlideInspection[] = [];
  for (const slide of selectCollectionPageForValidation(renderedContext.slides, context)) {
    inspections.push(await inspectSlide(context, slide));
  }
  renderedContext.slideInspections = inspections;
  renderedContext.slideInspectionsArePageScoped = Boolean(context.singlePage);
  return inspections;
}
