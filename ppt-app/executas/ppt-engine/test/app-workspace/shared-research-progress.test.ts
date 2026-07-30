import test from "node:test";
import assert from "node:assert/strict";

import {
  applySharedResearchProgressOperations,
  createDefaultSharedResearchProgress,
} from "../../src/app-workspace/shared-research-progress.ts";

test("shared research progress increments revision only for a material change", () => {
  const initial = createDefaultSharedResearchProgress("2026-07-29T00:00:00.000Z");
  const changed = applySharedResearchProgressOperations(
    initial,
    [{ op: "set_stage", stage: "web_decision", state: "running" }],
    "2026-07-29T00:01:00.000Z",
  );
  assert.equal(changed.updated, true);
  assert.equal(changed.revision, 1);

  const repeated = applySharedResearchProgressOperations(
    changed.progress,
    [{ op: "set_stage", stage: "web_decision", state: "running" }],
    "2026-07-29T00:02:00.000Z",
  );
  assert.equal(repeated.updated, false);
  assert.equal(repeated.revision, 1);
  assert.equal(repeated.updated_at, "2026-07-29T00:01:00.000Z");
});

test("shared research progress rejects backward stage transitions", () => {
  const initial = createDefaultSharedResearchProgress();
  const running = applySharedResearchProgressOperations(initial, [
    { op: "set_stage", stage: "web_decision", state: "running" },
  ]).progress;
  const completed = applySharedResearchProgressOperations(running, [
    { op: "set_stage", stage: "web_decision", state: "completed" },
  ]).progress;
  assert.throws(
    () => applySharedResearchProgressOperations(completed, [
      { op: "set_stage", stage: "web_decision", state: "running" },
    ]),
    /Invalid shared research stage transition/,
  );
});

test("shared research completion requires prepared evidence to be published", () => {
  const initial = createDefaultSharedResearchProgress();
  const prepared = applySharedResearchProgressOperations(initial, [
    { op: "set_web_prepared_batch", markdown: "## Evidence" },
  ]).progress;
  const terminal = structuredClone(prepared);
  terminal.stages = Object.fromEntries(Object.keys(terminal.stages).map((stage) => [stage, "skipped"]));
  assert.throws(
    () => applySharedResearchProgressOperations(terminal, [{ op: "finalize_shared_research" }]),
    /has not been published/,
  );
});

test("shared research progress rejects unknown operations", () => {
  assert.throws(
    () => applySharedResearchProgressOperations(
      createDefaultSharedResearchProgress(),
      [{ op: "replace_everything" } as never],
    ),
    /Unsupported shared research progress operation/,
  );
});
