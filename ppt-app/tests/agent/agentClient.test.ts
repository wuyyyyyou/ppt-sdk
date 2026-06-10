import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentInfrastructureError,
  isAgentRunCancelledError,
  createAgentClient,
  type AgentStreamEvent,
} from "../../src/agent/agentClient.ts";
import type {
  AnnaAgentRunFrame,
  AnnaAgentSession,
  AnnaRuntime,
} from "../../src/runtime/annaRuntime.ts";

const CACHE_MISS_MESSAGE = "no cached app_session token; create a new session";

function createRuntime(
  runs: AnnaAgentRunFrame[][],
  options: {
    sessionPatch?: Partial<AnnaAgentSession>;
  } = {},
) {
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
          ...options.sessionPatch,
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

function createRuntimeFromStreams(streams: Array<() => AsyncIterable<AnnaAgentRunFrame>>) {
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
        const run = streams[sessionCreations] ?? streams.at(-1);
        sessionCreations += 1;
        const session: AnnaAgentSession = {
          run: () => run?.() ?? (async function* () {})(),
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
  it("throws AgentInfrastructureError when session create resolves no tools", async () => {
    const harness = createRuntime([authoringSuccessFrames()], {
      sessionPatch: {
        granted_tools: [],
        inherit_host_tools: false,
      },
    });
    const client = await createAgentClient(harness.runtime);

    await assert.rejects(
      () => client.runAuthoringPrompt("write a page"),
      (error) => {
        assert.equal(error instanceof AgentInfrastructureError, true);
        const infrastructureError = error as AgentInfrastructureError;
        assert.equal(infrastructureError.code, "NO_TOOLS_AVAILABLE");
        assert.equal(infrastructureError.noToolsAvailable, true);
        assert.match(infrastructureError.message, /cannot use executable tools/);
        return true;
      },
    );
    assert.equal(harness.sessionCreations, 1);
    assert.equal(harness.sessionDeletes, 1);
  });

  it("keeps older runtimes compatible when session create omits tool surface", async () => {
    const harness = createRuntime([authoringSuccessFrames()]);
    const client = await createAgentClient(harness.runtime);

    await client.checkToolAccess();
    const result = await client.runAuthoringPrompt("write a page");

    assert.equal(result.status, "ready_for_render");
    assert.equal(harness.sessionCreations, 2);
    assert.equal(harness.sessionDeletes, 2);
  });

  it("throws AgentInfrastructureError when run_meta reports no tools", async () => {
    const harness = createRuntime([
      [
        {
          event: "run_meta",
          granted_tools: [],
          inherit_host_tools: false,
          warnings: [
            {
              code: "NO_TOOLS_AVAILABLE",
              message: "This agent session resolved ZERO executable tools.",
            },
          ],
        },
        ...authoringSuccessFrames(),
      ],
    ]);
    const client = await createAgentClient(harness.runtime);

    await assert.rejects(
      () => client.runAuthoringPrompt("write a page"),
      (error) => {
        assert.equal(error instanceof AgentInfrastructureError, true);
        const infrastructureError = error as AgentInfrastructureError;
        assert.equal(infrastructureError.code, "NO_TOOLS_AVAILABLE");
        assert.equal(infrastructureError.noToolsAvailable, true);
        return true;
      },
    );
    assert.equal(harness.sessionCreations, 1);
    assert.equal(harness.sessionDeletes, 1);
  });

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

  it("rebuilds one session after stream idle timeout and then succeeds", async () => {
    const harness = createRuntimeFromStreams([
      async function* () {
        await new Promise(() => undefined);
      },
      async function* () {
        for (const frame of authoringSuccessFrames()) yield frame;
      },
    ]);
    const events: AgentStreamEvent[] = [];
    const client = await createAgentClient(harness.runtime, {
      streamIdleTimeoutMs: 5,
    });

    const result = await client.runAuthoringPrompt("write a page", {
      onStreamEvent: (event) => events.push(event),
    });

    assert.equal(result.status, "ready_for_render");
    assert.equal(harness.sessionCreations, 2);
    assert.equal(harness.sessionDeletes, 2);
    assert.equal(
      events.some(
        (event) =>
          event.type === "activity" &&
          event.message.includes("Agent unresponsive; rebuilding session"),
      ),
      true,
    );
  });

  it("throws AgentInfrastructureError when stream idle retry is exhausted", async () => {
    const harness = createRuntimeFromStreams([
      async function* () {
        await new Promise(() => undefined);
      },
      async function* () {
        await new Promise(() => undefined);
      },
    ]);
    const client = await createAgentClient(harness.runtime, {
      streamIdleTimeoutMs: 5,
    });

    await assert.rejects(
      () => client.runAuthoringPrompt("write a page"),
      (error) => {
        assert.equal(error instanceof AgentInfrastructureError, true);
        assert.equal((error as AgentInfrastructureError).code, "idle_timeout");
        return true;
      },
    );
    assert.equal(harness.sessionCreations, 2);
    assert.equal(harness.sessionDeletes, 2);
  });

  it("maps cancellation to AgentRunCancelledError and deletes the session", async () => {
    const harness = createRuntimeFromStreams([
      async function* () {
        await new Promise(() => undefined);
      },
    ]);
    const controller = new AbortController();
    const client = await createAgentClient(harness.runtime, {
      streamIdleTimeoutMs: 100,
    });
    const result = client.runAuthoringPrompt("write a page", {
      signal: controller.signal,
    });
    controller.abort();

    await assert.rejects(
      () => result,
      (error) => {
        assert.equal(isAgentRunCancelledError(error), true);
        return true;
      },
    );
    assert.equal(harness.sessionDeletes, 1);
  });
});
