import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DeckPage } from "../../src/features/deck-workspace/components/DeckPage.tsx";
import type { DeckReviewRenderState } from "../../src/features/deck-workspace/types.ts";
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

function renderDeckPage(reviewRender: DeckReviewRenderState = loadingReviewRender) {
  return renderToStaticMarkup(
    createElement(DeckPage, {
      t: messages.zh,
      deck,
      currentSlide: 0,
      setCurrentSlide: () => undefined,
      reviewRender,
      loading: "none",
      onRefineDeck: () => undefined,
      onRefineSlide: () => undefined,
      onRewriteSlide: () => undefined,
      onChangeSlideLayout: () => undefined,
      onRefreshPreview: () => undefined,
      onPreview: () => undefined,
      onExport: () => undefined,
    }),
  );
}

describe("DeckPage", () => {
  it("shows a loading preview instead of the text fallback while screenshots are rendering", () => {
    const html = renderDeckPage();

    assert.match(html, /slide-preview-loading/);
    assert.match(html, /spinner/);
    assert.doesNotMatch(html, /slide-preview-card large/);
    assert.doesNotMatch(html, /template:cover-statement/);
  });

  it("does not render the deck title row under the main preview", () => {
    const html = renderDeckPage();

    assert.doesNotMatch(html, /deck-title-label/);
    assert.doesNotMatch(html, /AI Deck/);
    assert.doesNotMatch(html, /deck-title-editor/);
    assert.doesNotMatch(html, /aria-label="Deck title"/);
  });

  it("exposes the current-page and whole-deck refinement entry actions", () => {
    const html = renderDeckPage();
    assert.match(html, /deck-top-actions[\s\S]*优化当前页[\s\S]*优化整套/);
    assert.doesNotMatch(html, /action-bar[\s\S]*优化当前页/);
    assert.match(html, /aria-label="重新渲染"/);
    assert.doesNotMatch(html, />重新渲染</);
    assert.doesNotMatch(html, /复制页面|删除页面|更改布局/);
  });
});
