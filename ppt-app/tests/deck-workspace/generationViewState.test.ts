import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeckGenerationProgress } from "../../src/features/deck-generation/index.ts";
import { buildGenerationViewState } from "../../src/features/deck-workspace/generationViewState.ts";

function makeProgress(
  step: DeckGenerationProgress["step"],
  statuses: string[],
): DeckGenerationProgress {
  return {
    step,
    message: step,
    currentPageIndex: statuses.length > 0 ? 0 : null,
    totalPages: statuses.length,
    pages: statuses.map((status, index) => ({
      page_id: `page-${index + 1}`,
      index,
      title: `Page ${index + 1}`,
      status,
      render_attempts: 0,
      render_attempt_limit: 10,
      visual_review_attempts: 0,
      visual_review_attempt_limit: 5,
      content_review_attempts: 0,
      content_review_attempt_limit: 5,
      agent_failures: 0,
      agent_failure_limit: 5,
      agent_infrastructure_failures: 0,
    })),
  };
}

describe("Generation View State", () => {
  it("shows running only when an active generation run exists", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("page-authoring", ["authoring"]),
      activeRun: { kind: "deck-generation", stopping: false },
    });

    assert.equal(viewState.status, "running");
    assert.equal(viewState.canStop, true);
    assert.equal(viewState.showResume, false);
  });

  it("does not show running from loading alone", () => {
    const viewState = buildGenerationViewState({
      loading: "deck",
      progress: makeProgress("page-authoring", ["authoring"]),
      activeRun: null,
    });

    assert.equal(viewState.status, "interrupted");
    assert.equal(viewState.canStop, false);
  });

  it("shows stopping while an active run is being cancelled", () => {
    const viewState = buildGenerationViewState({
      loading: "deck",
      progress: makeProgress("cancelled", ["authoring"]),
      activeRun: { kind: "deck-generation", stopping: true },
    });

    assert.equal(viewState.status, "stopping");
    assert.equal(viewState.canStop, false);
    assert.equal(viewState.canResume, false);
  });

  it("shows interrupted for active-looking progress without an active run", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("page-authoring", ["visual_review"]),
      activeRun: null,
    });

    assert.equal(viewState.status, "interrupted");
    assert.equal(viewState.canStop, false);
    assert.equal(viewState.canResume, true);
  });

  it("shows interrupted for failed pages that can be resumed", () => {
    for (const status of ["render_failed", "agent_failed", "needs_user_review", "agent_infrastructure_failed"]) {
      const viewState = buildGenerationViewState({
        loading: "none",
        progress: makeProgress("failed", ["accepted", status]),
        activeRun: null,
      });

      assert.equal(viewState.status, "interrupted", status);
      assert.equal(viewState.showResume, true, status);
    }
  });

  it("can suppress continue generation for interrupted page refinement", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("failed", ["render_failed"]),
      activeRun: null,
      resumeAllowed: false,
    });

    assert.equal(viewState.status, "interrupted");
    assert.equal(viewState.canResume, false);
    assert.equal(viewState.showResume, false);
  });

  it("shows unresumable for stale or invalid artifacts", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("failed", ["accepted", "pending"]),
      activeRun: null,
      unresumable: true,
    });

    assert.equal(viewState.status, "unresumable");
    assert.equal(viewState.canResume, false);
    assert.equal(viewState.canBackToOutline, true);
  });

  it("shows interrupted for final render work that is not done", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("final-render", ["accepted", "accepted"]),
      activeRun: null,
    });

    assert.equal(viewState.status, "interrupted");
    assert.equal(viewState.canResume, true);
  });

  it("shows complete only when progress is complete and all pages are accepted", () => {
    const viewState = buildGenerationViewState({
      loading: "none",
      progress: makeProgress("complete", ["accepted", "accepted"]),
      activeRun: null,
    });

    assert.equal(viewState.status, "complete");
    assert.equal(viewState.showStop, false);
    assert.equal(viewState.canResume, false);
  });
});
