import test from "node:test";
import assert from "node:assert/strict";

import { convertSlideElementAttributesToPptxSlideModel } from "../../src/html-to-pptx-model/convert/element-attributes-to-pptx-model.ts";
import {
  resolveAutoConnectorType,
  supportsSemanticInlineRichTextNode,
  shouldSkipChildTraversal,
  shouldAutoScreenshotDecorativeElement,
} from "../../src/html-to-pptx-model/extract/deck-to-element-attributes.ts";
import type { ElementAttributes } from "../../src/html-to-pptx-model/types/element-attributes.ts";
import { PptxAlignment } from "../../src/html-to-pptx-model/types/pptx-models.ts";

function createElementAttributes(
  overrides: Partial<ElementAttributes> = {},
): ElementAttributes {
  return {
    tagName: "div",
    innerText: "Text",
    position: {
      left: 100,
      top: 80,
      width: 180,
      height: 40,
    },
    font: {
      name: "Inter",
      size: 24,
      weight: 400,
      color: "111111",
    },
    textWrap: true,
    ...overrides,
  };
}

test("mixed text containers preserve html for ppt text runs", () => {
  const slide = convertSlideElementAttributesToPptxSlideModel({
    elements: [
      createElementAttributes({
        innerText: "Alpha Beta Gamma",
        textHtml: 'Alpha<br><strong>Beta</strong> <em>Gamma</em>',
      }),
    ],
  });

  assert.equal(slide.shapes.length, 1);
  const textShape = slide.shapes[0];
  assert.equal(textShape?.shape_type, "textbox");
  assert.equal(textShape?.paragraphs[0]?.text, 'Alpha<br><strong>Beta</strong> <em>Gamma</em>');
});

test("semantic rich text only accepts supported tags without attributes", () => {
  assert.equal(supportsSemanticInlineRichTextNode({
    tagName: "strong",
  }), true);

  assert.equal(supportsSemanticInlineRichTextNode({
    tagName: "span",
  }), false);

  assert.equal(supportsSemanticInlineRichTextNode({
    tagName: "em",
    attributeNames: ["class"],
  }), false);

  assert.equal(supportsSemanticInlineRichTextNode({
    tagName: "br",
    attributeNames: ["style"],
  }), false);
});

test("center alignment hints remain on textbox paragraphs and width protection stays centered", () => {
  const slide = convertSlideElementAttributesToPptxSlideModel({
    elements: [
      createElementAttributes({
        innerText: "Centered label",
        textAlignHint: "center",
        measuredTextWidth: 220,
        position: {
          left: 200,
          top: 120,
          width: 120,
          height: 40,
        },
      }),
    ],
  });

  const textShape = slide.shapes[0];
  assert.equal(textShape?.shape_type, "textbox");
  assert.equal(textShape?.paragraphs[0]?.alignment, PptxAlignment.CENTER);
  assert.equal(textShape?.position.width, 230);
  assert.equal(textShape?.position.left, 145);
});

test("simple single-side borders can be recognized as connector candidates", () => {
  const connectorType = resolveAutoConnectorType(createElementAttributes({
    innerText: undefined,
    background: undefined,
    imageSrc: undefined,
    position: {
      left: 40,
      top: 60,
      width: 4,
      height: 160,
    },
    borderSides: {
      left: {
        color: "FF0000",
        width: 4,
        opacity: 1,
      },
    },
  }));

  assert.equal(connectorType, "border-left");
});

test("single-side border connector maps to a narrow ppt connector line", () => {
  const slide = convertSlideElementAttributesToPptxSlideModel({
    elements: [
      createElementAttributes({
        innerText: undefined,
        connectorType: "border-bottom",
        position: {
          left: 60,
          top: 100,
          width: 280,
          height: 6,
        },
        border: {
          color: "FF0000",
          width: 2,
          opacity: 1,
        },
        borderSides: {
          bottom: {
            color: "FF0000",
            width: 2,
            opacity: 1,
          },
        },
      }),
    ],
  });

  const connector = slide.shapes[0];
  assert.equal(connector?.shape_type, "connector");
  assert.equal(connector?.position.height, 2);
  assert.equal(connector?.position.top, 104);
  assert.equal(connector?.color, "FF0000");
});

test("decorative auto-screenshot heuristic stays conservative for text-heavy modules", () => {
  assert.equal(shouldAutoScreenshotDecorativeElement(createElementAttributes({
    innerText: undefined,
    textLength: 8,
    directTextLength: 0,
    childElementCount: 6,
    graphicSignalCount: 14,
    position: {
      left: 0,
      top: 0,
      width: 220,
      height: 160,
    },
  })), true);

  assert.equal(shouldAutoScreenshotDecorativeElement(createElementAttributes({
    innerText: "Editable summary block",
    textLength: 120,
    directTextLength: 36,
    childElementCount: 6,
    graphicSignalCount: 14,
    position: {
      left: 0,
      top: 0,
      width: 320,
      height: 180,
    },
  })), false);
});

test("decorative auto-screenshot ignores complex containers with lots of descendant text", () => {
  assert.equal(shouldAutoScreenshotDecorativeElement(createElementAttributes({
    innerText: undefined,
    textLength: 96,
    directTextLength: 0,
    childElementCount: 8,
    graphicSignalCount: 18,
    position: {
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    },
  })), false);
});

test("mixed text containers become atomic extraction nodes", () => {
  assert.equal(shouldSkipChildTraversal(createElementAttributes({
    innerText: "60%+ 数字渠道渗透率",
    textHtml: '<strong>60%+</strong><em>数字渠道渗透率</em>',
    should_screenshot: false,
  })), true);
});
