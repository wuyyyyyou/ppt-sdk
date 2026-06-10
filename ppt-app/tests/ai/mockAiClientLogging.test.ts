import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAiInteractionLogger, type AiOperationLogContext } from "../../src/ai/interactionLog.ts";
import { createMockAiClient } from "../../src/ai/mockAiClient.ts";

describe("MockAiClient AI Interaction Log", () => {
  it("writes mock provider metadata with the shared interaction schema", async () => {
    (globalThis as typeof globalThis & { window?: unknown }).window = {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
    const logs: unknown[] = [];
    const logger = createAiInteractionLogger({
      appendWorkspaceLog: async (input) => {
        logs.push(input);
      },
    });
    const logContext: AiOperationLogContext = {
      logger,
      workspace_dir: "/tmp/workspace",
      domain: "outline",
      operation: "generate_outline",
      provider: "anna",
      runtime_mode: "anna",
    };

    const client = createMockAiClient();
    await client.generateOutline({
      prompt: "demo",
      contextRows: [],
      locale: "zh",
      setting: { output_language: "中文" },
      logContext,
    });

    assert.equal(logs.length, 2);
    const started = logs[0] as { entry?: Record<string, unknown> };
    const finished = logs[1] as { entry?: Record<string, unknown> };
    assert.equal(started.entry?.provider, "mock");
    assert.equal(started.entry?.runtime_mode, "mock");
    assert.equal(finished.entry?.provider, "mock");
    assert.equal(finished.entry?.runtime_mode, "mock");
  });
});
