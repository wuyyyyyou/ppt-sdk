import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAiInteractionLogger, type AiOperationLogContext } from "../../src/ai/interactionLog.ts";
import { createAgentClient } from "../../src/agent/agentClient.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

describe("AgentClient AI Interaction Log", () => {
  it("records Agent prompt and output for a session run", async () => {
    const logs: unknown[] = [];
    const logger = createAiInteractionLogger({
      appendWorkspaceLog: async (input) => {
        logs.push(input);
      },
    });
    const runtime: AnnaRuntime = {
      tools: { invoke: async () => ({}) },
      llm: { complete: async () => ({}) },
      agent: {
        session: async () => ({
          run: () =>
            (async function* () {
              yield {
                event: "message",
                text: JSON.stringify({
                  status: "ready_for_render",
                  changed_files: [],
                  summary: "ok",
                  needs_render: true,
                  notes: [],
                }),
              };
              yield { event: "complete", task_complete: { token_usage: { total: 1 } } };
            })(),
          history: async () => ({ frames: 2 }),
          delete: async () => undefined,
        }),
      },
    };
    const context: AiOperationLogContext = {
      logger,
      workspace_dir: "/tmp/workspace",
      domain: "page_agent",
      operation: "authoring",
      operation_id: "op-1",
      page_id: "page-01",
      page_index: 0,
      kind: "authoring",
    };

    const client = await createAgentClient(runtime);
    await client.runAuthoringPrompt("write the slide", { logContext: context });

    assert.equal(logs.length, 2);
    const started = logs[0] as { channel?: string; entry?: Record<string, unknown> };
    const finished = logs[1] as { channel?: string; entry?: Record<string, unknown> };
    assert.equal(started.channel, "ai-page-agent-interactions");
    assert.equal(started.entry?.prompt, "write the slide");
    assert.equal(finished.channel, "ai-page-agent-interactions");
    assert.equal(finished.entry?.status, "succeeded");
    assert.match(String(finished.entry?.output), /ready_for_render/);
    assert.deepEqual(finished.entry?.session_history, { frames: 2 });
    assert.equal(finished.entry?.operation_id, "op-1");
  });
});
