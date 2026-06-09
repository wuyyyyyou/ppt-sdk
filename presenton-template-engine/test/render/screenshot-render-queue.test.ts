import test from "node:test";
import assert from "node:assert/strict";

import { withScreenshotRenderQueue } from "../../src/render/screenshot-render-queue.ts";

function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("withScreenshotRenderQueue serializes concurrent operations", async () => {
  const firstRelease = createDeferred();
  const secondRelease = createDeferred();
  const events: string[] = [];
  let active = 0;
  let maxActive = 0;

  const first = withScreenshotRenderQueue(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    events.push("first:start");
    await firstRelease.promise;
    events.push("first:end");
    active -= 1;
  });
  const second = withScreenshotRenderQueue(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    events.push("second:start");
    await secondRelease.promise;
    events.push("second:end");
    active -= 1;
  });

  await flushMicrotasks();
  assert.deepEqual(events, ["first:start"]);

  firstRelease.resolve();
  await first;
  await flushMicrotasks();
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);

  secondRelease.resolve();
  await second;

  assert.equal(maxActive, 1);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("withScreenshotRenderQueue continues after a failed operation", async () => {
  const events: string[] = [];

  const first = withScreenshotRenderQueue(async () => {
    events.push("first:start");
    throw new Error("render failed");
  });
  const second = withScreenshotRenderQueue(async () => {
    events.push("second:start");
    return "ok";
  });

  await assert.rejects(first, /render failed/);
  assert.equal(await second, "ok");
  assert.deepEqual(events, ["first:start", "second:start"]);
});
