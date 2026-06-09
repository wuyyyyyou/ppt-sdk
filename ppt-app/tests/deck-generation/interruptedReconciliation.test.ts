import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PageProgress, PageProgressItem } from "../../src/api/types.ts";
import { reconcileInterruptedPageProgress } from "../../src/features/deck-generation/interruptedReconciliation.ts";

function makePage(status: string, index = 0): PageProgressItem {
  return {
    page_id: `page-${index + 1}`,
    index,
    title: `Page ${index + 1}`,
    status,
    render_attempts: 3,
    visual_review_attempts: 2,
    content_review_attempts: 1,
    agent_failures: 4,
    agent_infrastructure_failures: 1,
    slide_path: `./slides/page-${index + 1}.tsx`,
    data_path: `./data/page-${index + 1}.json`,
    last_html_path: "/tmp/page.html",
    last_screenshot_path: "/tmp/page.png",
    last_error: "stale error",
    review: { pass: false },
    updated_at: "2026-06-02T03:47:38.344Z",
  };
}

function makeProgress(statuses: string[]): PageProgress {
  return {
    version: 1,
    status: "prepared",
    pages: statuses.map((status, index) => makePage(status, index)),
    updated_at: "2026-06-02T03:47:38.344Z",
  };
}

describe("Interrupted Reconciliation", () => {
  it("marks active page generations as interrupted and resets counters", () => {
    const result = reconcileInterruptedPageProgress(makeProgress(["authoring", "rendering"]));

    assert.deepEqual(result.patches.map((patch) => patch.pageId), ["page-1", "page-2"]);
    for (const page of result.progress.pages) {
      assert.equal(page.status, "interrupted");
      assert.equal(page.render_attempts, 0);
      assert.equal(page.visual_review_attempts, 0);
      assert.equal(page.content_review_attempts, 0);
      assert.equal(page.agent_failures, 0);
      assert.equal(page.agent_infrastructure_failures, 0);
      assert.equal(page.last_error, "");
      assert.equal(page.review, null);
    }
  });

  it("leaves pending, accepted, and genuinely failed pages unchanged", () => {
    const progress = makeProgress([
      "pending",
      "accepted",
      "render_failed",
      "agent_failed",
      "needs_user_review",
      "agent_infrastructure_failed",
    ]);
    const result = reconcileInterruptedPageProgress(progress);

    assert.equal(result.patches.length, 0);
    assert.deepEqual(result.progress, progress);
  });
});
