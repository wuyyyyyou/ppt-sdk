import assert from "node:assert/strict";
import test from "node:test";

import { buildLlmInput, invokeAnnaLlm, selectLlmInvocationPath } from "../src/anna-llm.js";

test("buildLlmInput omits an empty system prompt", () => {
  assert.deepEqual(buildLlmInput("", "hello"), {
    messages: [{ role: "user", content: { type: "text", text: "hello" } }],
  });
  assert.equal(buildLlmInput("system", "hello").messages[0].role, "system");
});

test("invokeAnnaLlm prefers runtime.call and forwards timeoutMs", async () => {
  let received;
  const runtime = {
    call: async (...args) => {
      received = args;
      return { text: "ok" };
    },
    llm: { complete: async () => { throw new Error("fallback should not run"); } },
  };
  const input = buildLlmInput("", "hello");
  const result = await invokeAnnaLlm(runtime, input, 120_000);
  assert.equal(result.invocationPath, "runtime.call");
  assert.equal(result.timeoutAppliedByRuntime, true);
  assert.deepEqual(received, ["llm", "complete", input, { timeoutMs: 120_000 }]);
});

test("invokeAnnaLlm falls back without applying a frontend timeout", async () => {
  const runtime = { llm: { complete: async (input) => ({ input }) } };
  const result = await invokeAnnaLlm(runtime, { messages: [] }, 600_000);
  assert.equal(selectLlmInvocationPath(runtime), "runtime.llm.complete");
  assert.equal(result.invocationPath, "runtime.llm.complete");
  assert.equal(result.timeoutAppliedByRuntime, false);
});
