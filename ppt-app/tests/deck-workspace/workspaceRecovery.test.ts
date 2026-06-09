import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PageProgress } from "../../src/api/types.ts";
import { restoreDeckGenerationProgress } from "../../src/features/deck-workspace/workspaceRecovery.ts";

function makeAcceptedProgress(): PageProgress {
  return {
    version: 1,
    status: "prepared",
    pages: [
      {
        page_id: "page-01",
        index: 0,
        title: "What is AI?",
        status: "accepted",
        render_attempts: 0,
        visual_review_attempts: 0,
        content_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        slide_path: "./slides/page-01.tsx",
        data_path: "./data/page-01.json",
        last_html_path: "/tmp/page-01.html",
        last_screenshot_path: "/tmp/page-01.png",
        last_error: "",
        review: null,
        updated_at: "2026-06-02T03:47:38.344Z",
      },
    ],
    updated_at: "2026-06-02T03:47:38.344Z",
  };
}

describe("Workspace Recovery", () => {
  it("restores completed generation progress for already rendered workspaces", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: false,
      pageProgress: makeAcceptedProgress(),
      locale: "zh",
    });

    assert.equal(progress?.step, "complete");
    assert.equal(progress?.totalPages, 1);
    assert.equal(progress?.pages[0]?.status, "accepted");
  });

  it("does not restore generation progress for stale workspaces", () => {
    const progress = restoreDeckGenerationProgress({
      staleDeck: true,
      pageProgress: makeAcceptedProgress(),
      locale: "zh",
    });

    assert.equal(progress, null);
  });
});
