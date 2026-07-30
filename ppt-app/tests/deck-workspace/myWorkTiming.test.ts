import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMyWorkTimingRecord,
  formatMyWorkTiming,
} from "../../src/features/deck-workspace/myWorkTiming.ts";

describe("my work timing", () => {
  it("keeps list, cover and total durations apart", () => {
    const record = createMyWorkTimingRecord({
      listMs: 120.4,
      coversMs: 880.6,
      slowestCoverMs: 640.2,
      workspaceCount: 12,
      coverCount: 9,
    });

    assert.equal(record.listMs, 120);
    assert.equal(record.coversMs, 881);
    assert.equal(record.slowestCoverMs, 640);
    assert.equal(record.totalMs, 1001);
    assert.equal(record.workspaceCount, 12);
    assert.equal(record.coverCount, 9);
  });

  it("reports a list-only refresh when every cover was already cached", () => {
    const record = createMyWorkTimingRecord({
      listMs: 90,
      coversMs: 0,
      slowestCoverMs: 0,
      workspaceCount: 3,
      coverCount: 0,
    });

    assert.equal(record.totalMs, 90);
    assert.match(formatMyWorkTiming(record), /total=90ms list=90ms covers=0ms/);
  });

  it("never reports negative durations from a clock that went backwards", () => {
    const record = createMyWorkTimingRecord({
      listMs: -5,
      coversMs: -1,
      slowestCoverMs: -1,
      workspaceCount: -2,
      coverCount: -3,
    });

    assert.deepEqual(record, {
      listMs: 0,
      coversMs: 0,
      slowestCoverMs: 0,
      totalMs: 0,
      workspaceCount: 0,
      coverCount: 0,
    });
  });
});
