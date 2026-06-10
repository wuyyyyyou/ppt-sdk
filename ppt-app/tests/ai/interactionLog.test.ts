import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAiInteractionLogger,
  type AiOperationLogContext,
} from "../../src/ai/interactionLog.ts";

describe("AI Interaction Log facade", () => {
  it("writes started and finished interaction records with stable ids", async () => {
    const entries: unknown[] = [];
    const logger = createAiInteractionLogger({
      appendWorkspaceLog: async (input) => {
        entries.push(input);
      },
    });
    const context: AiOperationLogContext = {
      logger,
      workspace_dir: "/tmp/workspace",
      domain: "outline",
      operation: "generate_outline",
      provider: "test",
      runtime_mode: "test",
    };

    const handle = await logger.startInteraction(context, {
      request: { messages: [{ role: "user", content: { type: "text", text: "brief" } }] },
    });
    await logger.finishInteraction(handle, {
      status: "succeeded",
      response: { content: { type: "text", text: "{\"title\":\"Demo\"}" }, model: "mock" },
      output: "{\"title\":\"Demo\"}",
    });

    assert.equal(entries.length, 2);
    const started = entries[0] as { channel?: string; entry?: Record<string, unknown>; payload_keys?: string[] };
    const finished = entries[1] as { channel?: string; entry?: Record<string, unknown>; payload_keys?: string[] };

    assert.equal(started.channel, "ai-outline-interactions");
    assert.equal(started.entry?.event, "ai.outline.interaction.started");
    assert.equal(started.entry?.schema_version, 1);
    assert.equal(started.entry?.status, "started");
    assert.equal(typeof started.entry?.operation_id, "string");
    assert.equal(typeof started.entry?.interaction_id, "string");
    assert.deepEqual(started.payload_keys, ["request", "prompt"]);

    assert.equal(finished.channel, "ai-outline-interactions");
    assert.equal(finished.entry?.event, "ai.outline.interaction.finished");
    assert.equal(finished.entry?.operation_id, started.entry?.operation_id);
    assert.equal(finished.entry?.interaction_id, started.entry?.interaction_id);
    assert.equal(finished.entry?.status, "succeeded");
    assert.equal(finished.entry?.model, "mock");
    assert.equal(typeof finished.entry?.output_hash, "string");
    assert.deepEqual(finished.payload_keys, ["response", "output", "session_history"]);
  });
});
