import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PptBackend } from "../../src/api/pptBackend.ts";
import type {
  GetWorkspacePageImageResult,
  HostUploadRef,
  RenderDeckHtmlResult,
} from "../../src/api/types.ts";
import type { GenerationPagePreviews } from "../../src/features/deck-workspace/generationPagePreviews.ts";
import { assembleReviewRender } from "../../src/features/deck-workspace/reviewRenderAssembly.ts";

function upload(pageId: string): HostUploadRef {
  return {
    transport: "host_upload",
    r2_key: pageId,
    url: `https://example.test/${pageId}.webp`,
    mime_type: "image/webp",
    size_bytes: 100,
    expires_at: "2026-08-03T01:00:00.000Z",
  };
}

function metadata(pageCount = 5): RenderDeckHtmlResult {
  return {
    workspace_dir: "/official",
    manifest_path: "/official/manifest.json",
    output_dir: "/official/output",
    deck_html_path: "/official/output/deck.html",
    slides: Array.from({ length: pageCount }, (_, index) => {
      const pageId = `page-${index + 1}`;
      return {
        slide_id: pageId,
        layout_id: "",
        title: `Page ${index + 1}`,
        html_path: `/official/output/${pageId}.html`,
        screenshot_path: `/official/output/${pageId}.png`,
        render_source_fingerprint: `source-${pageId}`,
        preview_source_fingerprint: `fingerprint-${pageId}`,
        speaker_note: "",
      };
    }),
    slide_count: pageCount,
    title: "Deck",
    rendered_at: "2026-08-03T00:00:00.000Z",
  };
}

function cachedPreviews(result: RenderDeckHtmlResult, count = result.slide_count): GenerationPagePreviews {
  return Object.fromEntries(result.slides.slice(0, count).map((slide, pageIndex) => [
    slide.slide_id,
    {
      pageId: slide.slide_id,
      pageIndex,
      title: slide.title,
      screenshotPath: `/shadow/output/${slide.slide_id}.png`,
      previewSourceFingerprint: slide.preview_source_fingerprint,
      imageUpload: upload(slide.slide_id),
      receivedAtMs: Date.parse("2026-08-03T00:00:00.000Z"),
      status: "ready" as const,
    },
  ]));
}

function imageResult(pageId: string): GetWorkspacePageImageResult {
  return {
    version: 1,
    workspace_dir: "/official",
    page_id: pageId,
    page_index: Number(pageId.split("-")[1]) - 1,
    page_status: "accepted",
    source_path: `/official/output/${pageId}.png`,
    preview_source_fingerprint: `fingerprint-${pageId}`,
    image_path: `/official/output/page-previews/${pageId}.webp`,
    width: 1280,
    height: 720,
    size_bytes: 100,
    generated_at: "2026-08-03T00:00:00.000Z",
    image_upload: upload(pageId),
  };
}

function backend(calls: string[], failingPageId?: string): Pick<PptBackend, "getWorkspacePageImage"> {
  return {
    getWorkspacePageImage: async ({ page_id }) => {
      calls.push(page_id);
      if (page_id === failingPageId) throw new Error("upload failed");
      return imageResult(page_id);
    },
  };
}

describe("assembleReviewRender", () => {
  const nowMs = Date.parse("2026-08-03T00:10:00.000Z");

  it("reuses all five Shadow Workspace previews without another upload", async () => {
    const deck = metadata();
    const calls: string[] = [];
    const assembled = await assembleReviewRender({
      backend: backend(calls),
      metadata: deck,
      workspaceDir: "/official",
      previews: cachedPreviews(deck),
      nowMs,
    });

    assert.deepEqual(calls, []);
    assert.equal(assembled.result.slides.every((slide) => slide.screenshot_upload), true);
    assert.equal(assembled.result.slides[0]?.screenshot_path, "/official/output/page-1.png");
    assert.equal(assembled.previews["page-1"]?.renderSourceFingerprint, "source-page-1");
  });

  it("fetches only the one missing page", async () => {
    const deck = metadata();
    const calls: string[] = [];
    const assembled = await assembleReviewRender({
      backend: backend(calls),
      metadata: deck,
      workspaceDir: "/official",
      previews: cachedPreviews(deck, 4),
      nowMs,
    });

    assert.deepEqual(calls, ["page-5"]);
    assert.deepEqual(assembled.fetchedPageIds, ["page-5"]);
  });

  it("leaves only a failed page empty so other previews remain visible", async () => {
    const deck = metadata(2);
    const calls: string[] = [];
    const assembled = await assembleReviewRender({
      backend: backend(calls, "page-2"),
      metadata: deck,
      workspaceDir: "/official",
      previews: cachedPreviews(deck, 1),
      nowMs,
    });

    assert.deepEqual(assembled.failedPageIds, ["page-2"]);
    assert.ok(assembled.result.slides[0]?.screenshot_upload);
    assert.equal(assembled.result.slides[1]?.screenshot_upload, undefined);
  });
});
