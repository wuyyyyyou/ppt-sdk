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
    preview_url: "file:///tmp/workspaces/demo/output/app-render/page-01.html",
    slide_count: 1,
    title: "Demo",
    rendered_at: "2026-06-02T00:00:00.000Z",
    slides: [
      {
        slide_id: "page-01",
        layout_id: "timeline-plan",
        title: slide.title,
        html_path: "/tmp/workspaces/demo/output/app-render/page-01.html",
        preview_url: "file:///tmp/workspaces/demo/output/app-render/page-01.html",
        screenshot_url: "http://127.0.0.1:4173/preview/page-01.png",
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
    workspaceSettingsSaving?: boolean;
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
      researchSearchControlSettings: {
        disableWebResearch: false,
        disableImageResearch: false,
      },
      workspaceSettingsSaving: options.workspaceSettingsSaving ?? false,
      onBack: () => undefined,
      setResearchSearchControlSettings: async () => undefined,
      onRefineDeck: () => undefined,
      onRefineSlide: () => undefined,
    }),
  );
}

function assertDisabledButtonWithLabel(html: string, label: string) {
  assert.match(
    html,
    new RegExp(`<button(?=[^>]*disabled="")[^>]*>[\\s\\S]*?${label}[\\s\\S]*?</button>`),
  );
}

describe("RefinePage", () => {
  it("shows the rendered slide image when a screenshot URL is available", () => {
    const html = renderRefinePage(readyReviewRender);

    assert.match(html, /<img/);
    assert.match(html, /src="http:\/\/127\.0\.0\.1:4173\/preview\/page-01\.png"/);
    assert.doesNotMatch(html, /slide-preview-card/);
  });

  it("falls back to the text preview when no rendered preview is available", () => {
    const html = renderRefinePage(idleReviewRender);

    assert.doesNotMatch(html, /<iframe/);
    assert.match(html, /slide-preview-card/);
    assert.match(html, /The Future with AI/);
  });

  it("shows persistent research search controls on refinement entry pages", () => {
    const html = renderRefinePage(idleReviewRender);

    assert.match(html, /禁止网络资料搜索/);
    assert.match(html, /禁止图片搜索/);
  });

  it("disables research search controls while deck refinement settings are saving", () => {
    const html = renderRefinePage(idleReviewRender, {
      refineScope: "deck",
      workspaceSettingsSaving: true,
    });

    assertDisabledButtonWithLabel(html, "禁止网络资料搜索");
    assertDisabledButtonWithLabel(html, "禁止图片搜索");
  });

  it("disables research search controls while slide refinement settings are saving", () => {
    const html = renderRefinePage(idleReviewRender, {
      refineScope: "slide",
      workspaceSettingsSaving: true,
    });

    assertDisabledButtonWithLabel(html, "禁止网络资料搜索");
    assertDisabledButtonWithLabel(html, "禁止图片搜索");
  });
});
