import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeckGenerationProgress, DeckGenerationProgressPage } from "../../src/features/deck-generation/index.ts";
import {
  orderGenerationPagePreviews,
  reconcileGenerationPagePreviews,
  resolveGenerationPreviewSelection,
  selectGenerationPagePreviewSources,
  type GenerationPagePreviewEntry,
  type GenerationPagePreviews,
} from "../../src/features/deck-workspace/generationPagePreviews.ts";

function makePage(patch: Partial<DeckGenerationProgressPage>): DeckGenerationProgressPage {
  return {
    page_id: "page-1",
    index: 0,
    title: "Page 1",
    status: "accepted",
    render_attempts: 0,
    render_attempt_limit: 10,
    visual_review_attempts: 0,
    visual_review_attempt_limit: 5,
    agent_failures: 0,
    agent_failure_limit: 5,
    agent_infrastructure_failures: 0,
    ...patch,
  };
}

function makeProgress(pages: DeckGenerationProgressPage[]): DeckGenerationProgress {
  return {
    step: "page-render",
    message: "rendering",
    currentPageIndex: 0,
    totalPages: pages.length,
    pages,
  };
}

describe("selectGenerationPagePreviewSources", () => {
  it("only offers pages that already rendered, in deck order", () => {
    const sources = selectGenerationPagePreviewSources(
      makeProgress([
        makePage({ page_id: "page-2", index: 1, title: "Two", last_screenshot_path: "/tmp/two.png" }),
        makePage({ page_id: "page-1", index: 0, title: "One", last_screenshot_path: "/tmp/one.png" }),
        makePage({ page_id: "page-3", index: 2, title: "Three", status: "authoring" }),
        makePage({ page_id: "page-4", index: 3, title: "Four", last_screenshot_path: "   " }),
      ]),
    );

    assert.deepEqual(
      sources.map((source) => [source.pageId, source.pageIndex, source.screenshotPath]),
      [
        ["page-1", 0, "/tmp/one.png"],
        ["page-2", 1, "/tmp/two.png"],
      ],
    );
  });

  it("returns nothing before any progress arrives", () => {
    assert.deepEqual(selectGenerationPagePreviewSources(null), []);
  });
});

describe("reconcileGenerationPagePreviews", () => {
  const source = {
    pageId: "page-1",
    pageIndex: 0,
    title: "One",
    screenshotPath: "/tmp/one.png",
  };

  it("requests previews for newly rendered pages", () => {
    const { previews, pending, changed } = reconcileGenerationPagePreviews({}, [source]);

    assert.equal(changed, true);
    assert.deepEqual(pending, [source]);
    assert.equal(previews["page-1"]?.status, "loading");
  });

  it("stays a no-op while the same pages keep polling", () => {
    const ready: GenerationPagePreviews = {
      "page-1": { ...source, status: "ready", url: "https://example.test/one.webp" },
    };

    const { pending, changed, previews } = reconcileGenerationPagePreviews(ready, [source]);

    assert.equal(changed, false);
    assert.deepEqual(pending, []);
    assert.equal(previews["page-1"]?.url, "https://example.test/one.webp");
  });

  it("re-requests a page once it re-renders to new bytes", () => {
    const ready: GenerationPagePreviews = {
      "page-1": { ...source, status: "ready", url: "https://example.test/one.webp" },
    };

    const { pending, previews, changed } = reconcileGenerationPagePreviews(ready, [
      { ...source, screenshotPath: "/tmp/one-v2.png" },
    ]);

    assert.equal(changed, true);
    assert.equal(pending.length, 1);
    assert.equal(previews["page-1"]?.status, "loading");
    assert.equal(previews["page-1"]?.url, undefined);
  });

  it("drops pages that no longer exist", () => {
    const ready: GenerationPagePreviews = {
      "page-1": { ...source, status: "ready", url: "https://example.test/one.webp" },
      "page-2": {
        pageId: "page-2",
        pageIndex: 1,
        title: "Two",
        screenshotPath: "/tmp/two.png",
        status: "ready",
        url: "https://example.test/two.webp",
      },
    };

    const { previews, changed } = reconcileGenerationPagePreviews(ready, [source]);

    assert.equal(changed, true);
    assert.deepEqual(Object.keys(previews), ["page-1"]);
  });

  it("keeps a failed preview until the page re-renders", () => {
    const failed: GenerationPagePreviews = {
      "page-1": { ...source, status: "error" },
    };

    const { pending, previews, changed } = reconcileGenerationPagePreviews(failed, [source]);

    assert.equal(changed, false);
    assert.deepEqual(pending, []);
    assert.equal(previews["page-1"]?.status, "error");
  });
});

describe("resolveGenerationPreviewSelection", () => {
  const entries: GenerationPagePreviewEntry[] = [
    { pageId: "page-1", pageIndex: 0, title: "One", screenshotPath: "/tmp/one.png", status: "ready", url: "one" },
    { pageId: "page-2", pageIndex: 1, title: "Two", screenshotPath: "/tmp/two.png", status: "ready", url: "two" },
    { pageId: "page-3", pageIndex: 2, title: "Three", screenshotPath: "/tmp/three.png", status: "loading" },
  ];

  it("follows the newest ready page while nothing is pinned", () => {
    const selected = resolveGenerationPreviewSelection({ entries, pinnedPageId: null });
    assert.equal(selected?.pageId, "page-2");
  });

  it("keeps the page the user picked", () => {
    const selected = resolveGenerationPreviewSelection({ entries, pinnedPageId: "page-1" });
    assert.equal(selected?.pageId, "page-1");
  });

  it("falls back to the newest entry when nothing is ready", () => {
    const selected = resolveGenerationPreviewSelection({
      entries: [entries[2]],
      pinnedPageId: "page-gone",
    });
    assert.equal(selected?.pageId, "page-3");
  });

  it("has nothing to show before the first page renders", () => {
    assert.equal(resolveGenerationPreviewSelection({ entries: [], pinnedPageId: null }), null);
  });
});

describe("orderGenerationPagePreviews", () => {
  it("sorts by deck order and skips holes", () => {
    const previews: GenerationPagePreviews = {
      "page-2": {
        pageId: "page-2",
        pageIndex: 1,
        title: "Two",
        screenshotPath: "/tmp/two.png",
        status: "ready",
        url: "two",
      },
      "page-1": {
        pageId: "page-1",
        pageIndex: 0,
        title: "One",
        screenshotPath: "/tmp/one.png",
        status: "loading",
      },
      "page-3": undefined,
    };

    assert.deepEqual(
      orderGenerationPagePreviews(previews).map((entry) => entry.pageId),
      ["page-1", "page-2"],
    );
  });
});
