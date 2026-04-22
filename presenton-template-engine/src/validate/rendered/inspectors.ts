import type {
  RenderedElementSummary,
  RenderedSlideInfo,
  RenderedSlideInspection,
  ValidationContext,
} from "../types.js";
import { prepareRenderedValidationContext } from "./runtime.js";

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

  const snapshot = await shellElement.evaluate((shell, rootSelector) => {
    const shellElement = shell as HTMLElement;
    const slideRoot = (rootSelector
      ? shellElement.querySelector(rootSelector)
      : null) as HTMLElement | null;
    const inspectionRoot = slideRoot ?? shellElement;

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
        const parent = current.parentElement;
        if (!parent) {
          break;
        }

        const siblings = Array.from(parent.children).filter((candidate) =>
          candidate.tagName === current?.tagName
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
      const graphicCounts = {
        svg: element.querySelectorAll("svg").length + (element.tagName.toLowerCase() === "svg" ? 1 : 0),
        canvas: element.querySelectorAll("canvas").length + (element.tagName.toLowerCase() === "canvas" ? 1 : 0),
        path: element.querySelectorAll("path").length + (element.tagName.toLowerCase() === "path" ? 1 : 0),
        line: element.querySelectorAll("line").length + (element.tagName.toLowerCase() === "line" ? 1 : 0),
        polyline: element.querySelectorAll("polyline").length + (element.tagName.toLowerCase() === "polyline" ? 1 : 0),
        polygon: element.querySelectorAll("polygon").length + (element.tagName.toLowerCase() === "polygon" ? 1 : 0),
        circle: element.querySelectorAll("circle").length + (element.tagName.toLowerCase() === "circle" ? 1 : 0),
        rect: element.querySelectorAll("rect").length + (element.tagName.toLowerCase() === "rect" ? 1 : 0),
      };
      const svgNodes = Array.from(element.querySelectorAll("svg"));
      const svgUsesCurrentColor = svgNodes.some((svgNode) => {
        const rawMarkup = svgNode.outerHTML;
        const className = svgNode.getAttribute("class") ?? "";
        return /currentColor/.test(rawMarkup)
          || /\b(?:fill-current|stroke-current|text-current)\b/.test(className);
      });

      return {
        selector: buildSelector(element),
        parentSelector: parentElement ? buildSelector(parentElement) : null,
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

    const elements = [inspectionRoot, ...Array.from(inspectionRoot.querySelectorAll("*"))]
      .map((element) => summarizeElement(element));
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
      elements,
    };
  }, slide.rootSelector);

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
    return renderedContext.slideInspections;
  }

  if (renderedContext.inspectSlides) {
    const inspections = await renderedContext.inspectSlides();
    renderedContext.slideInspections = inspections;
    return inspections;
  }

  const inspections = await Promise.all(
    renderedContext.slides.map((slide) => inspectSlide(context, slide)),
  );
  renderedContext.slideInspections = inspections;
  return inspections;
}
