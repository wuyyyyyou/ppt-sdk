import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "../src/i18n/messages";
import type { DeckGenerationProgress } from "../src/features/deck-generation";
import { buildPageGenerationStageRecords } from "../src/features/deck-workspace/generationStageRecords";

test("deck refinement stream uses a dedicated stage label", () => {
  const progress: DeckGenerationProgress = {
    step: "page-authoring",
    message: "Generating",
    currentPageIndex: 0,
    totalPages: 1,
    pages: [
      {
        page_id: "page-01",
        index: 0,
        title: "Page 1",
        status: "authoring",
        render_attempts: 0,
        render_attempt_limit: 10,
        visual_review_attempts: 0,
        visual_review_attempt_limit: 5,
        content_review_attempts: 0,
        content_review_attempt_limit: 5,
        agent_failures: 0,
        agent_failure_limit: 5,
        agent_infrastructure_failures: 0,
      },
    ],
    activeStreams: [
      {
        run_id: "run-1",
        kind: "deck-refinement",
        page_id: "page-01",
        page_index: 0,
        status: "completed",
        lines: [],
        activities: [],
        started_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:01.000Z",
      },
    ],
  };

  const records = buildPageGenerationStageRecords({
    t: messages.zh,
    progress,
    history: [],
  });

  assert.equal(records[0].stages[0].stageKey, "deckRefinement");
  assert.equal(records[0].stages[0].label, "整套优化");
});
