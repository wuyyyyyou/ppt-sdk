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
      requirements: {
        version: 1,
        status: "confirmed",
        source: { brief: "demo" },
        candidates: {
          audience: [{ label: "通用受众", description: "面向一般读者。" }],
          purpose: [{ label: "说明", description: "清晰说明主题。" }],
          desired_outcome: [{ label: "理解", description: "让受众理解核心内容。" }],
          slide_count: [3],
          output_language: ["中文"],
          visual_tone: [{ label: "简洁", description: "简洁清晰。" }],
        },
        selections: {
          audience: { label: "通用受众", description: "面向一般读者。" },
          purpose: { label: "说明", description: "清晰说明主题。" },
          desired_outcome: { label: "理解", description: "让受众理解核心内容。" },
          slide_count: 3,
          output_language: "中文",
          visual_tone: { label: "简洁", description: "简洁清晰。" },
        },
        updated_at: "2026-07-17T00:00:00.000Z",
        confirmed_at: "2026-07-17T00:00:00.000Z",
      },
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
