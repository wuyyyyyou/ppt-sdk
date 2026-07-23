import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOperationScopedProgressHandler } from "../../src/features/deck-workspace/generationProgressGuard.ts";

describe("generation progress operation guard", () => {
  it("drops progress emitted by an invalidated operation", () => {
    const controller = new AbortController();
    let currentOperation = 1;
    const received: string[] = [];
    const handler = createOperationScopedProgressHandler(
      controller.signal,
      () => currentOperation === 1,
      (progress: string) => received.push(progress),
    );

    handler("old progress");
    currentOperation = 2;
    handler("late old progress");

    assert.deepEqual(received, ["old progress"]);
  });

  it("allows progress from the current operation", () => {
    const controller = new AbortController();
    const received: string[] = [];
    const handler = createOperationScopedProgressHandler(
      controller.signal,
      () => true,
      (progress: string) => received.push(progress),
    );

    handler("current progress");

    assert.deepEqual(received, ["current progress"]);
  });
});
