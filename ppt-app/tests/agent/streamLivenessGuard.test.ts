import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  guardStreamLiveness,
  StreamCancelledError,
  StreamIdleTimeoutError,
} from "../../src/agent/streamLivenessGuard.ts";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

describe("Stream Liveness Guard", () => {
  it("passes through a normal stream", async () => {
    async function* stream() {
      yield "a";
      yield "b";
    }

    assert.deepEqual(
      await collect(guardStreamLiveness(stream(), { idleMs: 25 })),
      ["a", "b"],
    );
  });

  it("throws a typed idle timeout when no frame arrives", async () => {
    async function* stream() {
      await new Promise(() => undefined);
    }

    await assert.rejects(
      () => collect(guardStreamLiveness(stream(), { idleMs: 5 })),
      StreamIdleTimeoutError,
    );
  });

  it("resets the idle timer after each frame", async () => {
    async function* stream() {
      await wait(3);
      yield "a";
      await wait(3);
      yield "b";
    }

    assert.deepEqual(
      await collect(guardStreamLiveness(stream(), { idleMs: 20 })),
      ["a", "b"],
    );
  });

  it("throws a typed cancellation error and calls iterator return", async () => {
    let returned = false;
    const controller = new AbortController();
    const stream: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<string>>(() => undefined),
          return: async () => {
            returned = true;
            return { done: true, value: undefined };
          },
        };
      },
    };

    const result = collect(guardStreamLiveness(stream, { idleMs: 100, signal: controller.signal }));
    controller.abort();

    await assert.rejects(() => result, StreamCancelledError);
    assert.equal(returned, true);
  });
});
