import test from "node:test";
import assert from "node:assert/strict";

import {
  CENTERED_TEXT_SEMANTICS_RULE,
  FIXED_HEIGHT_VERTICAL_ALIGN_RULE,
  GRAPHIC_MODULE_SCREENSHOT_RULE,
  GRADIENT_CARD_RISK_RULE,
  SINGLE_LINE_KEY_TEXT_RULE,
  SVG_CURRENT_COLOR_RULE,
  TEXT_MODULE_SCREENSHOT_RULE,
  TEXT_STROKE_RISK_RULE,
  TRANSLATE_CENTER_RISK_RULE,
  runRenderedRules,
} from "../../src/validate/index.ts";
import type {
  RenderedElementSummary,
  RenderedSlideInspection,
  StabilityRule,
} from "../../src/validate/types.ts";

function createBaseElement(
  overrides: Partial<RenderedElementSummary> = {},
): RenderedElementSummary {
  return {
    selector: '[data-test="element"]',
    parentSelector: '[data-test="parent"]',
    tagName: "div",
    className: null,
    textContent: "",
    textLength: 0,
    directTextLength: 0,
    childElementCount: 0,
    screenshotExport: null,
    attributes: {},
    styles: {
      display: "block",
      position: "relative",
      whiteSpace: "normal",
      textAlign: "left",
      justifyContent: "flex-start",
      alignItems: "stretch",
      overflowX: "visible",
      overflowY: "visible",
      backgroundImage: "none",
      backgroundColor: "rgba(255, 255, 255, 0)",
      color: "rgb(17, 24, 39)",
      webkitTextStrokeWidth: "0px",
      webkitTextStrokeColor: "rgb(17, 24, 39)",
      transform: "none",
      left: "0px",
      top: "0px",
      width: "200px",
      height: "40px",
    },
    rect: {
      width: 200,
      height: 40,
    },
    parentRect: {
      width: 300,
      height: 80,
    },
    parentStyles: {
      display: "block",
      justifyContent: "flex-start",
      alignItems: "stretch",
    },
    scroll: {
      width: 200,
      height: 40,
      clientWidth: 200,
      clientHeight: 40,
    },
    graphicCounts: {
      svg: 0,
      canvas: 0,
      path: 0,
      line: 0,
      polyline: 0,
      polygon: 0,
      circle: 0,
      rect: 0,
    },
    svgUsesCurrentColor: false,
    ...overrides,
  };
}

function createInspection(
  elements: RenderedElementSummary[],
): RenderedSlideInspection {
  return {
    slideIndex: 0,
    slideId: "slide-1",
    layoutId: "test-layout",
    templateGroup: "local",
    totalTextLength: elements.reduce((sum, element) => sum + element.directTextLength, 0),
    totalTextElementCount: elements.filter((element) => element.textLength > 0).length,
    screenshotRegionCount: elements.filter((element) =>
      element.attributes["data-pptx-export"] === "screenshot"
    ).length,
    graphicSignalCount: elements.reduce((sum, element) =>
      sum + Object.values(element.graphicCounts).reduce((inner, value) => inner + value, 0), 0
    ),
    elements,
  };
}

async function runSingleRule(rule: StabilityRule, elements: RenderedElementSummary[]) {
  const diagnostics = await runRenderedRules({
    manifestPath: "/tmp/manifest.json",
    rendered: {
      page: {
        async setContent() {},
        async $() {
          return null;
        },
      },
      deckSelector: "#presentation-slides-wrapper",
      slideSelector: '[data-presenton-slide-shell="true"]',
      slides: [],
      slideInspections: [createInspection(elements)],
      ownedPage: false,
      async close() {},
    },
  }, { rules: [rule] });

  return diagnostics;
}

test("DOM-003 reports chart-like modules without screenshot export", async () => {
  const diagnostics = await runSingleRule(GRAPHIC_MODULE_SCREENSHOT_RULE, [
    createBaseElement({
      selector: '[data-chart-like="true"]',
      attributes: { "data-chart-like": "true" },
      textLength: 24,
      directTextLength: 24,
      rect: { width: 360, height: 220 },
      graphicCounts: {
        svg: 1,
        canvas: 0,
        path: 8,
        line: 2,
        polyline: 0,
        polygon: 0,
        circle: 0,
        rect: 1,
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "DOM-003");
});

test("DOM-004 reports screenshot regions that contain text-heavy content", async () => {
  const diagnostics = await runSingleRule(TEXT_MODULE_SCREENSHOT_RULE, [
    createBaseElement({
      selector: '[data-pptx-export="screenshot"]',
      attributes: { "data-pptx-export": "screenshot" },
      screenshotExport: "screenshot",
      textContent: "Dense editable text block",
      textLength: 180,
      directTextLength: 180,
      rect: { width: 420, height: 180 },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "DOM-004");
});

test("DOM-005 reports single-line text that can wrap or overflow", async () => {
  const diagnostics = await runSingleRule(SINGLE_LINE_KEY_TEXT_RULE, [
    createBaseElement({
      selector: '[data-validation-role="single-line-key-text"]',
      attributes: { "data-validation-role": "single-line-key-text" },
      textContent: "Operational Status Label",
      textLength: 24,
      directTextLength: 24,
      scroll: {
        width: 260,
        height: 40,
        clientWidth: 180,
        clientHeight: 40,
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "DOM-005");
});

test("DOM-006 reports fixed-height single-line boxes without explicit vertical centering", async () => {
  const diagnostics = await runSingleRule(FIXED_HEIGHT_VERTICAL_ALIGN_RULE, [
    createBaseElement({
      selector: '[data-validation-role="single-line-box"]',
      attributes: { "data-validation-role": "single-line-box" },
      textContent: "Centered badge",
      textLength: 13,
      directTextLength: 13,
      rect: { width: 240, height: 52 },
      styles: {
        ...createBaseElement().styles,
        display: "block",
        alignItems: "stretch",
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "DOM-006");
});

test("DOM-007 reports centered key text that lacks center semantics on the text node", async () => {
  const diagnostics = await runSingleRule(CENTERED_TEXT_SEMANTICS_RULE, [
    createBaseElement({
      selector: '[data-validation-role="centered-key-text"]',
      attributes: { "data-validation-role": "centered-key-text" },
      textContent: "Centered Subtitle",
      textLength: 17,
      directTextLength: 17,
      rect: { width: 120, height: 36 },
      parentRect: { width: 420, height: 72 },
      parentStyles: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "DOM-007");
});

test("VALIDATE-004 reports transparent stroke text", async () => {
  const diagnostics = await runSingleRule(TEXT_STROKE_RISK_RULE, [
    createBaseElement({
      selector: ".stroke-title",
      textContent: "Outlined title",
      textLength: 13,
      directTextLength: 13,
      styles: {
        ...createBaseElement().styles,
        color: "transparent",
        webkitTextStrokeWidth: "2px",
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "VALIDATE-004");
});

test("VALIDATE-005 reports inline SVG that depends on currentColor", async () => {
  const diagnostics = await runSingleRule(SVG_CURRENT_COLOR_RULE, [
    createBaseElement({
      selector: "svg:nth-of-type(1)",
      tagName: "svg",
      svgUsesCurrentColor: true,
      graphicCounts: {
        svg: 1,
        canvas: 0,
        path: 2,
        line: 0,
        polyline: 0,
        polygon: 0,
        circle: 0,
        rect: 0,
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "VALIDATE-005");
});

test("VALIDATE-008 reports gradient-backed key cards", async () => {
  const diagnostics = await runSingleRule(GRADIENT_CARD_RISK_RULE, [
    createBaseElement({
      selector: ".metric-card",
      textContent: "Metric Card",
      textLength: 11,
      directTextLength: 11,
      rect: { width: 320, height: 180 },
      styles: {
        ...createBaseElement().styles,
        backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)",
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "VALIDATE-008");
});

test("VALIDATE-012 reports translate-based centering for key text", async () => {
  const diagnostics = await runSingleRule(TRANSLATE_CENTER_RISK_RULE, [
    createBaseElement({
      selector: ".centered-title",
      className: "left-[50%] -translate-x-1/2",
      textContent: "Centered Title",
      textLength: 14,
      directTextLength: 14,
      attributes: {
        style: "left: 50%; transform: translateX(-50%);",
      },
      styles: {
        ...createBaseElement().styles,
        transform: "matrix(1, 0, 0, 1, -20, 0)",
      },
    }),
  ]);

  assert.equal(diagnostics[0]?.ruleId, "VALIDATE-012");
});
