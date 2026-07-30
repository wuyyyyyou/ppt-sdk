import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generationInFlight,
  preparationInFlight,
} from "../../src/features/deck-workspace/generationNavigationGuard.ts";
import type { ActiveGenerationRun } from "../../src/features/deck-workspace/generationViewState.ts";

const idle = {
  activeRun: null,
  hasTransaction: false,
  preparing: false,
  loading: "none",
} as const;

const activeRun: ActiveGenerationRun = {
  kind: "deck-generation",
  runId: "run-1",
  officialWorkspaceDir: "/ws",
  shadowWorkspaceDir: "/ws-shadow",
  stopping: false,
  committing: false,
};

describe("Generation navigation guard", () => {
  it("lets navigation through when nothing is in flight", () => {
    assert.equal(generationInFlight({ ...idle }), false);
    assert.equal(generationInFlight({ ...idle, loading: "outline" }), false);
    assert.equal(generationInFlight({ ...idle, loading: "export" }), false);
  });

  it("guards navigation while a registered run is in flight", () => {
    assert.equal(generationInFlight({ ...idle, activeRun }), true);
    assert.equal(generationInFlight({ ...idle, hasTransaction: true }), true);
  });

  it("guards the startup window before the run is registered", () => {
    assert.equal(generationInFlight({ ...idle, preparing: true }), true);
    for (const loading of ["deck", "deckFromOutline", "refineDeck", "refineSlide"] as const) {
      assert.equal(generationInFlight({ ...idle, loading }), true, loading);
    }
  });

  it("guards the long AI steps that run before any generation", () => {
    // These write Workspace state and stage when they land, so leaving them
    // behind silently used to drag the user back onto the step they left.
    for (const loading of ["requirements", "outline", "uploadedSourceAnalysis"] as const) {
      assert.equal(preparationInFlight(loading), true, loading);
      assert.equal(generationInFlight({ ...idle, loading }), false, loading);
    }
    for (const loading of ["none", "template", "theme", "export", "review"] as const) {
      assert.equal(preparationInFlight(loading), false, loading);
    }
  });
});
