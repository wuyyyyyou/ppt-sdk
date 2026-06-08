import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentInfrastructureError,
  createAgentClient,
  type AgentStreamEvent,
} from "../../src/agent/agentClient.ts";
import type {
  AnnaAgentRunFrame,
  AnnaAgentSession,
  AnnaRuntime,
} from "../../src/runtime/annaRuntime.ts";

const CACHE_MISS_MESSAGE = "no cached app_session token; create a new session";

function createRuntime(runs: AnnaAgentRunFrame[][]) {
  let sessionCreations = 0;
  let sessionDeletes = 0;

  const runtime: AnnaRuntime = {
    tools: {
      invoke: async () => ({}),
    },
    llm: {
      complete: async () => ({}),
    },
    agent: {
      session: async () => {
        const frames = runs[sessionCreations] ?? [];
        sessionCreations += 1;
        const session: AnnaAgentSession = {
          run: () =>
            (async function* () {
              for (const frame of frames) {
                yield frame;
              }
            })(),
          delete: async () => {
            sessionDeletes += 1;
          },
        };
        return session;
      },
    },
  };

  return {
    runtime,
    get sessionCreations() {
      return sessionCreations;
    },
    get sessionDeletes() {
      return sessionDeletes;
    },
  };
}

function cacheMissFrames(): AnnaAgentRunFrame[] {
  return [{ event: "error", message: CACHE_MISS_MESSAGE }];
}

function authoringSuccessFrames(): AnnaAgentRunFrame[] {
  return [
    {
      event: "message",
      text: JSON.stringify({
        status: "ready_for_render",
        changed_files: [],
        summary: "ok",
        needs_render: true,
        notes: [],
      }),
    },
    { event: "complete" },
  ];
}

describe("AgentClient cache miss retry", () => {
  it("recovers a logical Agent run after Agent Session Cache Miss retries", async () => {
    const harness = createRuntime([
      cacheMissFrames(),
      cacheMissFrames(),
      authoringSuccessFrames(),
    ]);
    const events: AgentStreamEvent[] = [];
    const client = await createAgentClient(harness.runtime, {
      wait: async () => undefined,
      random: () => 0.5,
      cacheMissRetryConfig: {
        maxRetries: 5,
        maxTotalWaitMs: 10_000,
      },
    });

    const result = await client.runAuthoringPrompt("write a page", {
      onStreamEvent: (event) => events.push(event),
    });

    assert.equal(result.status, "ready_for_render");
    assert.equal(result.session_cache_miss_retries, 2);
    assert.equal(harness.sessionCreations, 3);
    assert.equal(harness.sessionDeletes, 3);
    assert.equal(
      events.some(
        (event) =>
          event.type === "activity" &&
          event.message.includes("Agent session cache miss; retry 1"),
      ),
      true,
    );
    assert.equal(
      events.some(
        (event) =>
          event.type === "activity" &&
          event.message.includes("Agent session recovered after 2 retries"),
      ),
      true,
    );
  });

  it("throws sanitized AgentInfrastructureError after cache miss retry exhaustion", async () => {
    const harness = createRuntime([
      cacheMissFrames(),
      cacheMissFrames(),
      cacheMissFrames(),
    ]);
    const client = await createAgentClient(harness.runtime, {
      wait: async () => undefined,
      random: () => 0.5,
      cacheMissRetryConfig: {
        maxRetries: 2,
        maxTotalWaitMs: 10_000,
      },
    });

    await assert.rejects(
      () => client.runAuthoringPrompt("write a page"),
      (error) => {
        assert.equal(error instanceof AgentInfrastructureError, true);
        const infrastructureError = error as AgentInfrastructureError;
        assert.equal(infrastructureError.sessionCacheMiss, true);
        assert.equal(infrastructureError.sessionCacheMissRetries, 2);
        assert.equal(infrastructureError.rawMessage, CACHE_MISS_MESSAGE);
        assert.equal(infrastructureError.message.includes("app_session"), false);
        return true;
      },
    );
    assert.equal(harness.sessionCreations, 3);
    assert.equal(harness.sessionDeletes, 3);
  });
});
