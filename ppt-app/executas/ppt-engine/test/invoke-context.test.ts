import assert from "node:assert/strict";
import test from "node:test";

import {
  attachInvokeContext,
  bindInvoke,
  getCurrentInvokeId,
} from "../invoke-context.js";

test("invoke context stays isolated across concurrent async handlers", async () => {
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });

  const run = (invokeId: string) => bindInvoke(
    { context: { invoke_id: invokeId } },
    async () => {
      await barrier;
      const params = attachInvokeContext({ mode: "confirm" });
      return {
        current: getCurrentInvokeId(),
        attached: params.context?.invoke_id,
      };
    },
  );

  const first = run("invoke-a");
  const second = run("invoke-b");
  release?.();

  assert.deepEqual(await Promise.all([first, second]), [
    { current: "invoke-a", attached: "invoke-a" },
    { current: "invoke-b", attached: "invoke-b" },
  ]);
  assert.equal(getCurrentInvokeId(), null);
});

test("explicit reverse RPC context is preserved", () => {
  const result = bindInvoke("ambient-invoke", () => attachInvokeContext({
    mode: "confirm",
    context: { invoke_id: "explicit-invoke" },
  }));

  assert.equal(result.context.invoke_id, "explicit-invoke");
});
