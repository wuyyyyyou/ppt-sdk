import assert from "node:assert/strict";
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

function renderReviewPage(previewMode: PreviewMode) {
  return renderToStaticMarkup(
    createElement(ReviewPage, {
      t: messages.zh,
      deck,
      currentSlide: 0,
      setCurrentSlide: () => undefined,
      previewMode,
      setPreviewMode: () => undefined,
      reviewRender: loadingReviewRender,
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
});
