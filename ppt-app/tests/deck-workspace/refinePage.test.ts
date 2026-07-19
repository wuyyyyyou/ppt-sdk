import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { messages } from "../../src/i18n/messages.ts";
import type { DeckReviewRenderState, LoadingKind, RefineScope } from "../../src/features/deck-workspace/types.ts";
import { RefinePage } from "../../src/features/deck-workspace/components/RefinePage.tsx";

const slide = {
  title: "The Future with AI",
  subtitle: "template:timeline-plan",
};

const readyReviewRender: DeckReviewRenderState = {
  status: "ready",
  error: "",
  renderKey: "demo",
  result: {
    workspace_dir: "/tmp/workspaces/demo",
    manifest_path: "/tmp/workspaces/demo/template/manifest.json",
    output_dir: "/tmp/workspaces/demo/output/app-render",
    slide_count: 1,
    title: "Demo",
    rendered_at: "2026-06-02T00:00:00.000Z",
    slides: [
      {
        slide_id: "page-01",
        layout_id: "timeline-plan",
        title: slide.title,
        html_path: "/tmp/workspaces/demo/output/app-render/page-01.html",
        screenshot_upload: {
          transport: "host_upload",
          r2_key: "uploads/page-01.png",
          url: "https://upload.example/page-01.png",
          mime_type: "image/png",
          size_bytes: 1024,
          filename: "page-01.png",
          mode: "negotiate+confirm",
        },
        speaker_note: "Future timeline",
      },
    ],
  },
};

const idleReviewRender: DeckReviewRenderState = {
  status: "idle",
  error: "",
  renderKey: "",
  result: null,
};

function renderRefinePage(
  reviewRender: DeckReviewRenderState,
  options: {
    refineScope?: RefineScope;
    loading?: LoadingKind;
  } = {},
) {
  return renderToStaticMarkup(
    createElement(RefinePage, {
      t: messages.zh,
      deck: [slide],
      refineScope: options.refineScope ?? "slide",
      slide,
      slideIndex: 0,
      slideNumber: "01",
      reviewRender,
      loading: options.loading ?? "none",
      onBack: () => undefined,
      onRefineDeck: () => undefined,
      onRefineSlide: () => undefined,
    }),
  );
}

describe("RefinePage", () => {
  it("shows the rendered slide image when a screenshot upload is available", () => {
    const html = renderRefinePage(readyReviewRender);

    assert.match(html, /<img/);
    assert.match(html, /src="https:\/\/upload\.example\/page-01\.png"/);
    assert.doesNotMatch(html, /slide-preview-card/);
  });

  it("falls back to the text preview when no rendered preview is available", () => {
    const html = renderRefinePage(idleReviewRender);

    assert.doesNotMatch(html, /<iframe/);
    assert.match(html, /slide-preview-card/);
    assert.match(html, /The Future with AI/);
  });

  it("does not expose sealed research search controls on refinement entry pages", () => {
    const html = renderRefinePage(idleReviewRender);
    assert.doesNotMatch(html, /禁止网络资料搜索/);
    assert.doesNotMatch(html, /禁止图片搜索/);
  });
});
