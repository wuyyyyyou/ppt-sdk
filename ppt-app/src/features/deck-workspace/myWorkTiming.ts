/**
 * WORK-001: My Works has to stay fast, so every visit records how long the
 * list call, the cover loading and the whole refresh took. The record is kept
 * as one structured console entry plus the latest value on `window`, which is
 * enough to compare a slow machine against the baseline without shipping a
 * metrics pipeline.
 */
export interface MyWorkTimingRecord {
  /** Backend `listWorkspaces()` round trip. */
  listMs: number;
  /** Wall clock spent loading every cover of this refresh. */
  coversMs: number;
  /** Slowest single cover, which is what a user perceives as a stuck card. */
  slowestCoverMs: number;
  /** List call plus cover loading. */
  totalMs: number;
  workspaceCount: number;
  coverCount: number;
}

export const MY_WORK_TIMING_GLOBAL = "__PPT_MY_WORK_TIMING__";

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

export function createMyWorkTimingRecord(input: {
  listMs: number;
  coversMs: number;
  slowestCoverMs: number;
  workspaceCount: number;
  coverCount: number;
}): MyWorkTimingRecord {
  const listMs = roundMs(input.listMs);
  const coversMs = roundMs(input.coversMs);
  return {
    listMs,
    coversMs,
    slowestCoverMs: roundMs(input.slowestCoverMs),
    totalMs: listMs + coversMs,
    workspaceCount: Math.max(0, Math.trunc(input.workspaceCount)),
    coverCount: Math.max(0, Math.trunc(input.coverCount)),
  };
}

export function formatMyWorkTiming(record: MyWorkTimingRecord): string {
  return [
    "[my-work] refresh",
    `total=${record.totalMs}ms`,
    `list=${record.listMs}ms`,
    `covers=${record.coversMs}ms`,
    `slowestCover=${record.slowestCoverMs}ms`,
    `workspaces=${record.workspaceCount}`,
    `coversLoaded=${record.coverCount}`,
  ].join(" ");
}

export function publishMyWorkTiming(record: MyWorkTimingRecord): void {
  if (typeof console !== "undefined") console.info(formatMyWorkTiming(record));
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>)[MY_WORK_TIMING_GLOBAL] = record;
  }
}
