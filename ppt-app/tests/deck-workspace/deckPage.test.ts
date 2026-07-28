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
      onPreview: () => undefined,
      onBack: () => undefined,
      onExport: () => undefined,
      onEdit: () => undefined,
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
    assert.doesNotMatch(html, /复制页面|删除页面|更改布局/);
  });

  it("opens the top actions row with a back entry", () => {
    const html = renderDeckPage();

    assert.match(html, /deck-top-actions"><button class="secondary-btn deck-back-btn"/);
    assert.match(html, new RegExp(`deck-back-btn[\\s\\S]*${messages.zh.controls.back}`));
  });

  it("drops the unlabelled preview refresh button from the top actions", () => {
    const html = renderDeckPage();

    assert.doesNotMatch(html, /deck-refresh-btn/);
    assert.doesNotMatch(html, /重新渲染/);
  });

  it("labels the manual editor entry from the locale bundle", () => {
    const zh = renderDeckPage();
    const en = renderToStaticMarkup(
      createElement(DeckPage, {
        t: messages.en,
        deck,
        currentSlide: 0,
        setCurrentSlide: () => undefined,
        reviewRender: loadingReviewRender,
        loading: "none",
        onRefineDeck: () => undefined,
        onRefineSlide: () => undefined,
        onPreview: () => undefined,
        onBack: () => undefined,
        onExport: () => undefined,
        onEdit: () => undefined,
      }),
    );

    assert.match(zh, new RegExp(`aria-label="${messages.zh.controls.edit}"`));
    assert.match(en, new RegExp(`aria-label="${messages.en.controls.edit}"`));
    assert.doesNotMatch(zh, /编辑 PPT/);
    assert.doesNotMatch(en, /Edit deck/);
  });

  it("gives every action-bar entry a leading icon", () => {
    const html = renderDeckPage();
    const bar = html.slice(html.indexOf(`class="action-bar"`));

    for (const icon of ["lucide-pen-line", "lucide-eye", "lucide-download"]) {
      assert.match(bar, new RegExp(icon), icon);
    }
    assert.match(bar, new RegExp(`lucide-eye[\\s\\S]*${messages.zh.controls.preview}`));
    assert.match(bar, new RegExp(`lucide-download[\\s\\S]*${messages.zh.controls.export}`));
  });

  it("gives the slide navigation arrows localized accessible names", () => {
    const html = renderDeckPage();

    assert.match(html, /class="nav-arrow"[^>]*aria-label="上一页"/);
    assert.match(html, /class="nav-arrow"[^>]*aria-label="下一页"/);
  });
});
