import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PageProgress } from "../../src/api/types.ts";
import { restoreDeckGenerationProgress } from "../../src/features/deck-workspace/workspaceRecovery.ts";

function makeProgress(statuses = ["accepted"]): PageProgress {
  return {
    version: 1,
    status: "prepared",
    pages: statuses.map((status, index) => ({
        page_id: `page-${String(index + 1).padStart(2, "0")}`,
        index,
        title: index === 0 ? "What is AI?" : `Page ${index + 1}`,
        status,
        render_attempts: 0,
        visual_review_attempts: 0,
        content_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        slide_path: `./slides/page-${String(index + 1).padStart(2, "0")}.tsx`,
        data_path: `./data/page-${String(index + 1).padStart(2, "0")}.json`,
        last_html_path: `/tmp/page-${String(index + 1).padStart(2, "0")}.html`,
        last_screenshot_path: `/tmp/page-${String(index + 1).padStart(2, "0")}.png`,
        last_error: "",
        review: null,
        updated_at: "2026-06-02T03:47:38.344Z",
      })),
    updated_at: "2026-06-02T03:47:38.344Z",
  };
}

describe("Workspace Recovery", () => {
  it("restores completed generation progress for already rendered workspaces", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: makeProgress(),
      locale: "zh",
    });

    assert.equal(progress?.step, "complete");
    assert.equal(progress?.totalPages, 1);
    assert.equal(progress?.pages[0]?.status, "accepted");
  });

  it("does not mark accepted pages complete when final deck render failed", () => {
    const storedProgress = makeProgress(["accepted", "accepted"]);
    storedProgress.final_deck_render = {
      status: "failed",
      message: "Final render failed",
      error: "Final render failed",
      output_dir: null,
      deck_html_path: null,
      pages_path: null,
      rendered_at: null,
      updated_at: "2026-06-02T03:47:38.344Z",
    };
    storedProgress.recovery = {
      status: "failed",
      run_kind: "final-deck-render",
      step: "final-render",
      target_page_ids: [],
      page_refinement_request: null,
      page_refinement_requests: {},
      error: "Final render failed",
      updated_at: "2026-06-02T03:47:38.344Z",
    };

    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: storedProgress,
      locale: "zh",
    });

    assert.equal(progress?.step, "final-render");
    assert.equal(progress?.recoveryRunKind, "final-deck-render");
    assert.equal(progress?.totalPages, 2);
  });

  it("does not restore generation progress for stale workspaces", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: true,
      pageProgress: makeProgress(),
      locale: "zh",
    });

    assert.equal(progress, null);
  });

  it("restores interrupted progress when resumable pages remain", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: makeProgress(["accepted", "interrupted", "pending"]),
      locale: "zh",
    });

    assert.equal(progress?.step, "interrupted");
    assert.equal(progress?.currentPageIndex, 1);
  });

  it("restores interrupted progress when genuinely failed pages remain", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: makeProgress(["accepted", "render_failed"]),
      locale: "zh",
    });

    assert.equal(progress?.step, "interrupted");
    assert.equal(progress?.currentPageIndex, 1);
  });

  it("restores interrupted progress for orphaned active page generation statuses", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: makeProgress(["accepted", "visual_review"]),
      locale: "zh",
    });

    assert.equal(progress?.step, "interrupted");
    assert.equal(progress?.currentPageIndex, 1);
  });
});
