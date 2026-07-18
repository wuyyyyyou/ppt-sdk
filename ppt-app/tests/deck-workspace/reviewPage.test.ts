import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewPage } from "../../src/features/deck-workspace/components/ReviewPage.tsx";
import type { DeckReviewRenderState, PreviewMode } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

const deck = [
  {
    title: "AI Foundations",
    subtitle: "template:cover-statement",
  },
];

const loadingReviewRender: DeckReviewRenderState = {
  status: "loading",
  error: "",
  renderKey: "loading",
  result: null,
};

const readyReviewRender: DeckReviewRenderState = {
  status: "ready",
  error: "",
  renderKey: "ready",
  result: {
    workspace_dir: "/tmp/workspace",
    title: "AI Foundations",
    slide_count: 1,
    output_dir: "/tmp/workspace/rendered",
    deck_html_path: "/tmp/workspace/rendered/deck.html",
    slides: [{
      page_id: "page-01",
      index: 0,
      title: "AI Foundations",
      html_path: "/tmp/workspace/rendered/page-01.html",
      screenshot_path: "/tmp/workspace/rendered/page-01.png",
      screenshot_upload: {
        transport: "host_upload",
        r2_key: "preview/page-01.png",
        url: "https://example.com/page-01.png",
        mime_type: "image/png",
        size_bytes: 1024,
      },
    }],
  },
};

function renderReviewPage(
  previewMode: PreviewMode,
  reviewRender: DeckReviewRenderState = loadingReviewRender,
) {
  return renderToStaticMarkup(
    createElement(ReviewPage, {
      t: messages.zh,
      deck,
      currentSlide: 0,
      setCurrentSlide: () => undefined,
      previewMode,
      setPreviewMode: () => undefined,
      reviewRender,
      renderDeckHtml: async () => undefined,
      onBack: () => undefined,
      updateDeckTitle: () => undefined,
      moveSlide: async () => undefined,
      duplicateSlide: async () => undefined,
      deleteSlide: async () => undefined,
      addSlide: () => undefined,
      onRefineSlide: () => undefined,
    }),
  );
}

describe("ReviewPage", () => {
  it("hides template subtitles and shows loading previews in grid mode", () => {
    const html = renderReviewPage("grid");

    assert.match(html, /preview-loading-frame compact/);
    assert.match(html, /role="status"/);
    assert.match(html, /正在渲染 HTML 预览/);
    assert.doesNotMatch(html, /template:cover-statement/);
  });

  it("shows loading previews in present mode and thumbnails while screenshots are rendering", () => {
    const html = renderReviewPage("present");

    assert.match(html, /preview-loading-frame/);
    assert.match(html, /thumb-html-frame/);
    assert.match(html, /slide-preview-loading/);
    assert.doesNotMatch(html, /slide-preview-card large/);
  });

  it("constrains rendered screenshots inside grid preview frames", () => {
    const html = renderReviewPage("grid", readyReviewRender);

    assert.match(html, /class="grid-card-html-frame"><img/);
  });

  it("constrains the selected screenshot inside the present preview frame", () => {
    const html = renderReviewPage("present", readyReviewRender);

    assert.match(html, /class="present-html-frame"><img/);
  });

  it("keeps grid, present, and loading preview frames at the slide aspect ratio", async () => {
    const css = await readFile(
      new URL("../../src/features/deck-workspace/styles/deck-workspace.css", import.meta.url),
      "utf8",
    );
    function combinedRules(selector: string) {
      const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return Array.from(css.matchAll(new RegExp(`${escapedSelector} \\{([^}]*)\\}`, "g")))
        .map((match) => match[1])
        .join("\n");
    }
    const gridRule = combinedRules(".grid-card-html-frame");
    const presentRule = combinedRules(".present-html-frame");
    const compactLoadingRule = combinedRules(".preview-loading-frame.compact");

    for (const rule of [gridRule, presentRule, compactLoadingRule]) {
      assert.match(rule, /aspect-ratio:\s*16\s*\/\s*9/);
      assert.doesNotMatch(rule, /height:\s*\d+px/);
    }
  });
});
