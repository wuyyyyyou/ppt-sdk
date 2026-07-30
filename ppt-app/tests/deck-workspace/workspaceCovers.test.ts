import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkspaceSummary } from "../../src/api/types.ts";
import {
  mapWithConcurrencyLimit,
  reconcileWorkspaceCovers,
  type WorkspaceCovers,
} from "../../src/features/deck-workspace/workspaceCovers.ts";

function workspace(id: string, hasDeckHtml: boolean): WorkspaceSummary {
  return {
    workspace_id: id,
    workspace_dir: `/tmp/workspaces/${id}`,
    title: id,
    status: hasDeckHtml ? "ready" : "initialized",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-23T10:00:00Z",
    has_deck_html: hasDeckHtml,
  } as WorkspaceSummary;
}

describe("reconcileWorkspaceCovers", () => {
  it("only requests covers for finished works", () => {
    const { covers, pending } = reconcileWorkspaceCovers({}, [
      workspace("done", true),
      workspace("draft", false),
    ]);

    assert.deepEqual(Object.keys(covers), ["done"]);
    assert.deepEqual(pending.map((item) => item.workspace_id), ["done"]);
  });

  it("reuses covers already resolved in this session", () => {
    const previous: WorkspaceCovers = { done: { status: "ready", url: "https://example.test/a.png" } };

    const { covers, pending } = reconcileWorkspaceCovers(previous, [
      workspace("done", true),
      workspace("fresh", true),
    ]);

    assert.deepEqual(covers.done, { status: "ready", url: "https://example.test/a.png" });
    assert.deepEqual(covers.fresh, { status: "loading" });
    assert.deepEqual(pending.map((item) => item.workspace_id), ["fresh"]);
  });

  it("retries covers that previously failed", () => {
    const { pending } = reconcileWorkspaceCovers({ done: { status: "error" } }, [workspace("done", true)]);

    assert.deepEqual(pending.map((item) => item.workspace_id), ["done"]);
  });

  it("drops covers for works that no longer exist", () => {
    const previous: WorkspaceCovers = { gone: { status: "ready", url: "https://example.test/gone.png" } };

    const { covers } = reconcileWorkspaceCovers(previous, [workspace("done", true)]);

    assert.equal(covers.gone, undefined);
  });
});

describe("mapWithConcurrencyLimit", () => {
  it("never exceeds the requested number of in-flight requests", async () => {
    const items = Array.from({ length: 9 }, (_, index) => index);
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrencyLimit(items, 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    assert.equal(peak, 3);
  });

  it("visits every item exactly once", async () => {
    const seen: number[] = [];

    await mapWithConcurrencyLimit([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });

    assert.deepEqual(seen.sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });
});
