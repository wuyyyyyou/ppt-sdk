import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectRenderedSlideInfos,
  disposeRenderedValidationContext,
  prepareRenderedValidationArtifacts,
  prepareRenderedValidationContext,
  waitForDeckRenderReady,
} from "../../src/validate/index.ts";
import type {
  ValidationElementHandleLike,
  ValidationPageLike,
} from "../../src/validate/types.ts";

const VALID_SLIDE = `import React from "react";
import * as z from "zod";

export const Schema = z.object({
  title: z.string().default("Title"),
});

export const layoutId = "rendered-runtime";
export const layoutName = "Rendered Runtime";
export const layoutDescription = "Rendered validation runtime fixture.";

export default function RenderedRuntimeSlide({ data }) {
  const parsed = Schema.parse(data ?? {});
  return (
    <div
      data-manifest-slide-id="slide-1"
      data-layout={layoutId}
      data-group="local"
      className="w-[1280px] h-[720px]"
    >
      <h1>{parsed.title}</h1>
    </div>
  );
}
`;

type AttributeMap = Record<string, string>;

class MockElementNode {
  tagName: string;
  attributes: AttributeMap;
  children: MockElementNode[];

  constructor(
    tagName: string,
    attributes: AttributeMap = {},
    children: MockElementNode[] = [],
  ) {
    this.tagName = tagName.toLowerCase();
    this.attributes = { ...attributes };
    this.children = children;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  querySelector(selector: string): MockElementNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MockElementNode[] {
    const selectors = selector.split(",").map((part) => part.trim()).filter(Boolean);
    const matches: MockElementNode[] = [];

    const visit = (node: MockElementNode) => {
      if (selectors.some((entry) => matchesSelector(node, entry))) {
        matches.push(node);
      }

      node.children.forEach((child) => visit(child));
    };

    this.children.forEach((child) => visit(child));
    return matches;
  }
}

function matchesSelector(node: MockElementNode, selector: string): boolean {
  const attrMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (!attrMatch) {
    return false;
  }

  const [, attributeName, attributeValue] = attrMatch;
  const actualValue = node.getAttribute(attributeName);
  if (actualValue === null) {
    return false;
  }

  return attributeValue === undefined ? true : actualValue === attributeValue;
}

class MockElementHandle implements ValidationElementHandleLike {
  constructor(private readonly node: MockElementNode) {}

  async $(selector: string) {
    const match = this.node.querySelector(selector);
    return match ? new MockElementHandle(match) : null;
  }

  async $$(selector: string) {
    return this.node.querySelectorAll(selector).map((node) => new MockElementHandle(node));
  }

  async evaluate<T>(pageFunction: (...args: any[]) => T, ...args: any[]) {
    return pageFunction(this.node as unknown as Element, ...args);
  }
}

class MockPage implements ValidationPageLike {
  setViewportCalls: Array<Record<string, unknown>> = [];
  setContentCalls: Array<{ html: string; options?: { waitUntil?: string | string[]; timeout?: number } }> = [];

  constructor(
    private readonly selectors: Record<string, MockElementHandle | null>,
  ) {}

  async setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }) {
    this.setViewportCalls.push(viewport);
  }

  async setContent(
    html: string,
    options?: { waitUntil?: string | string[]; timeout?: number },
  ) {
    this.setContentCalls.push({ html, options });
  }

  async $(selector: string) {
    return this.selectors[selector] ?? null;
  }
}

async function withDeckFixture(
  fn: (input: { manifestPath: string; outputDir: string }) => Promise<void>,
) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rootDir = await mkdtemp(path.join(tempRoot, "presenton-ve-rendered-"));
  const deckDir = path.join(rootDir, "deck");
  const outputDir = path.join(rootDir, "out");

  try {
    await mkdir(path.join(deckDir, "slides"), { recursive: true });
    await writeFile(
      path.join(deckDir, "group.json"),
      `${JSON.stringify({
        group_id: "deck-group",
        group_name: "Deck Group",
        group_description: "Rendered validation runtime fixture group",
        ordered: false,
        default: false,
      }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(path.join(deckDir, "slides", "Slide.tsx"), VALID_SLIDE, "utf8");

    const manifestPath = path.join(deckDir, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Rendered Runtime Fixture",
        slides: [
          {
            id: "slide-1",
            source: {
              type: "local",
              path: "./slides/Slide.tsx",
            },
            data: {
              title: "Fixture title",
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    await fn({ manifestPath, outputDir });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function createDeckWrapperHandle() {
  const shell = new MockElementNode(
    "div",
    { "data-presenton-slide-shell": "true" },
    [
      new MockElementNode(
        "div",
        { "data-presenton-static-slide": "true" },
        [
          new MockElementNode("div", {
            "data-manifest-slide-id": "slide-1",
            "data-layout": "rendered-runtime",
            "data-group": "local",
          }, [
            new MockElementNode("div", { "data-pptx-export": "screenshot" }),
          ]),
        ],
      ),
    ],
  );

  const wrapper = new MockElementNode(
    "div",
    { "data-presenton-render-status": "ready" },
    [shell],
  );

  return new MockElementHandle(wrapper);
}

test("prepareRenderedValidationArtifacts builds deck html artifacts from manifest", async () => {
  await withDeckFixture(async ({ manifestPath, outputDir }) => {
    const context = { manifestPath, outputDir };
    const artifacts = await prepareRenderedValidationArtifacts(context);

    assert.ok(artifacts.deckBuildResult);
    assert.equal(artifacts.deckBuildResult?.slideCount, 1);
    assert.ok(artifacts.deckHtmlPath);

    const deckHtml = await readFile(artifacts.deckHtmlPath as string, "utf8");
    assert.match(deckHtml, /presentation-slides-wrapper/);
  });
});

test("waitForDeckRenderReady returns deck wrapper when status is ready", async () => {
  const wrapperHandle = createDeckWrapperHandle();
  const page = new MockPage({
    "#presentation-slides-wrapper": wrapperHandle,
  });

  const deckElement = await waitForDeckRenderReady(page, "#presentation-slides-wrapper", 100);
  const status = await deckElement.evaluate((el) => el.getAttribute("data-presenton-render-status"));
  assert.equal(status, "ready");
});

test("collectRenderedSlideInfos extracts slide metadata from rendered shell", async () => {
  const wrapperHandle = createDeckWrapperHandle();

  const slides = await collectRenderedSlideInfos(wrapperHandle);
  assert.deepEqual(slides, [{
    slideIndex: 0,
    slideId: "slide-1",
    layoutId: "rendered-runtime",
    templateGroup: "local",
    shellSelector: '[data-presenton-slide-shell="true"]:nth-of-type(1)',
    rootSelector: '[data-manifest-slide-id="slide-1"]',
    childElementCount: 1,
    screenshotRegionCount: 1,
  }]);
});

test("prepareRenderedValidationContext loads deck html into injected page and collects slides", async () => {
  await withDeckFixture(async ({ manifestPath, outputDir }) => {
    const wrapperHandle = createDeckWrapperHandle();
    const page = new MockPage({
      "#presentation-slides-wrapper": wrapperHandle,
    });
    const context = {
      manifestPath,
      outputDir,
      renderedOptions: {
        page,
      },
    };

    const renderedContext = await prepareRenderedValidationContext(context);
    assert.equal(page.setViewportCalls.length, 1);
    assert.equal(page.setContentCalls.length, 1);
    assert.match(page.setContentCalls[0]?.html ?? "", /presentation-slides-wrapper/);
    assert.equal(renderedContext.slides.length, 1);
    assert.equal(renderedContext.slides[0]?.slideId, "slide-1");

    await disposeRenderedValidationContext(context);
  });
});
