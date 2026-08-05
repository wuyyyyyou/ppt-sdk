import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Messages } from "../../src/i18n/messages.ts";
import { messages } from "../../src/i18n/messages.ts";
import { GenerationPagePreviewPanel } from "../../src/features/deck-workspace/components/GenerationPagePreviewPanel.tsx";
import type { GenerationPagePreviews } from "../../src/features/deck-workspace/generationPagePreviews.ts";

const t = messages.zh as Messages;

function renderPanel(previews: GenerationPagePreviews, pinnedPageId: string | null = null) {
  return renderToStaticMarkup(
    createElement(GenerationPagePreviewPanel, {
      t,
      previews,
      pinnedPageId,
      onSelectPage: () => undefined,
    }),
  );
}

const readyPreviews: GenerationPagePreviews = {
  "page-1": {
    pageId: "page-1",
    pageIndex: 0,
    title: "开场",
    screenshotPath: "/tmp/one.png",
    status: "ready",
    imageUpload: {
      transport: "host_upload",
      r2_key: "preview-one",
      url: "https://example.test/one.webp",
      mime_type: "image/webp",
      size_bytes: 123,
    },
  },
  "page-2": {
    pageId: "page-2",
    pageIndex: 1,
    title: "方案",
    screenshotPath: "/tmp/two.png",
    status: "ready",
    imageUpload: {
      transport: "host_upload",
      r2_key: "preview-two",
      url: "https://example.test/two.webp",
      mime_type: "image/webp",
      size_bytes: 123,
    },
  },
};

describe("GenerationPagePreviewPanel", () => {
  it("keeps spinning before anything rendered instead of looking unfinished", () => {
    const html = renderPanel({});

    assert.match(html, new RegExp(t.generating.preview.loading));
    assert.match(html, /generation-running-icon/);
    assert.match(html, /role="status"/);
    // The heading used to repeat this sentence, so it showed up twice on screen.
    assert.doesNotMatch(html, new RegExp(t.generating.preview.waiting));
    assert.doesNotMatch(html, /generation-preview-thumbnails/);
  });

  it("shows the newest rendered page and one thumbnail per page", () => {
    const html = renderPanel(readyPreviews);

    assert.match(html, /<img src="https:\/\/example\.test\/two\.webp"/);
    assert.match(html, /generation-preview-thumbnails/);
    assert.equal(html.match(/generation-preview-thumbnail /g)?.length, 2);
    assert.match(html, /generation-preview-thumbnail ready active[\s\S]*two\.webp/);
    assert.match(html, new RegExp(t.generating.preview.followingLatest));
  });

  it("keeps a pinned page selected and offers a way back to the newest one", () => {
    const html = renderPanel(readyPreviews, "page-1");

    assert.match(html, /generation-preview-stage"><img src="https:\/\/example\.test\/one\.webp"/);
    assert.match(html, new RegExp(t.generating.preview.backToLatest));
    assert.doesNotMatch(html, new RegExp(t.generating.preview.followingLatest));
  });

  it("reports pages whose preview is still loading or failed", () => {
    const loading = renderPanel({
      "page-1": {
        pageId: "page-1",
        pageIndex: 0,
        title: "开场",
        screenshotPath: "/tmp/one.png",
        status: "loading",
      },
    });
    assert.match(loading, new RegExp(t.generating.preview.loading));

    const failed = renderPanel({
      "page-1": {
        pageId: "page-1",
        pageIndex: 0,
        title: "开场",
        screenshotPath: "/tmp/one.png",
        status: "error",
      },
    });
    assert.match(failed, new RegExp(t.generating.preview.failed));
  });

  it("labels the selected page with its deck position and title", () => {
    const html = renderPanel(readyPreviews);

    assert.match(html, /2\. 方案/);
    assert.match(html, /aria-label="查看第 1 页"/);
  });
});
