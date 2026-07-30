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
  it("normalizes an unreadable visual attachment to a failed low-confidence review", async () => {
    const harness = createRuntime([[{
      event: "message",
      text: '{"pass":true,"score":9,"image_description":"IMAGE_UNAVAILABLE","issues":[],"revision_request":"","confidence":"high"}',
    }, { event: "complete" }]]);
    const client = await createAgentClient(harness.runtime);

    const result = await client.runPageVisualReviewPrompt("review");

    assert.equal(result.pass, false);
    assert.equal(result.score, 0);
    assert.equal(result.image_description, "IMAGE_UNAVAILABLE");
    assert.equal(result.confidence, "low");
  });

  it("passes native image attachments only to the initial visual review run", async () => {
    const runInputs: Array<{ content: string; attachments?: unknown[] }> = [];
    const responses = [
      [{ event: "message", text: "not json" }, { event: "complete" }],
      [{ event: "message", text: '{"pass":true,"score":9,"image_description":"A clear title above three readable cards on a light canvas.","issues":[],"revision_request":"","confidence":"high"}' }, { event: "complete" }],
    ] as AnnaAgentRunFrame[][];
    let sessionIndex = 0;
    const runtime: AnnaRuntime = {
      tools: { invoke: async () => ({}) },
      llm: { complete: async () => ({}) },
      agent: {
        session: async () => {
          const frames = responses[sessionIndex++] ?? [];
          return {
            run: (input) => {
              runInputs.push(input);
              return (async function* () {
                for (const frame of frames) yield frame;
              })();
            },
            delete: async () => undefined,
          };
        },
      },
    };
    const client = await createAgentClient(runtime);
    await client.runPageVisualReviewPrompt("review", {
      attachments: [{
        type: "image/png",
        url: "https://uploads.example/page.png",
        filename: "page.png",
        detail: "auto",
      }],
    });

    assert.equal(runInputs.length, 2);
    assert.equal(runInputs[0]?.attachments?.length, 1);
    assert.equal(runInputs[1]?.attachments, undefined);
  });
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

  it("continues when session create resolves no tools in warn policy", async () => {
    const harness = createRuntime([authoringSuccessFrames()], {
      sessionPatch: {
        granted_tools: [],
        inherit_host_tools: false,
      },
    });
    const client = await createAgentClient(harness.runtime, {
      toolAccessPolicy: "warn",
    });

    await client.checkToolAccess();
    const result = await client.runAuthoringPrompt("write a page");

    assert.equal(result.status, "ready_for_render");
    assert.equal(harness.sessionCreations, 2);
    assert.equal(harness.sessionDeletes, 2);
  });

  it("ignores session create tool access surface in off policy", async () => {
    const harness = createRuntime([authoringSuccessFrames()], {
      sessionPatch: {
        granted_tools: [],
        inherit_host_tools: false,
        warnings: [
          {
            code: "NO_TOOLS_AVAILABLE",
            message: "This agent session resolved ZERO executable tools.",
          },
        ],
      },
    });
    const client = await createAgentClient(harness.runtime, {
      toolAccessPolicy: "off",
    });

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

  it("emits activity and continues when run_meta reports no tools in warn policy", async () => {
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
    const events: AgentStreamEvent[] = [];
    const client = await createAgentClient(harness.runtime, {
      toolAccessPolicy: "warn",
    });

    const result = await client.runAuthoringPrompt("write a page", {
      onStreamEvent: (event) => events.push(event),
    });

    assert.equal(result.status, "ready_for_render");
    assert.equal(
      events.some(
        (event) =>
          event.type === "activity" &&
          event.message.includes("Agent tool access warning"),
      ),
      true,
    );
    assert.equal(harness.sessionCreations, 1);
    assert.equal(harness.sessionDeletes, 1);
  });

  it("ignores run_meta tool access surface in off policy", async () => {
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
    const events: AgentStreamEvent[] = [];
    const client = await createAgentClient(harness.runtime, {
      toolAccessPolicy: "off",
    });

    const result = await client.runAuthoringPrompt("write a page", {
      onStreamEvent: (event) => events.push(event),
    });

    assert.equal(result.status, "ready_for_render");
    assert.equal(
      events.some(
        (event) =>
          event.type === "activity" &&
          event.message.includes("Agent tool access warning"),
      ),
      false,
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

  it("repairs malformed image JSON in the same Session without resending attachments", async () => {
    let sessionCreations = 0;
    let runCount = 0;
    const runInputs: Array<{ content: string; attachments?: unknown[] }> = [];
    const runtime: AnnaRuntime = {
      tools: { invoke: async () => ({}) },
      llm: { complete: async () => ({}) },
      agent: {
        session: async () => {
          sessionCreations += 1;
          return {
            run: (input: { content: string; attachments?: unknown[] }) => {
              runCount += 1;
              runInputs.push(input);
              const text = runCount === 1
                ? "not json"
                : "```json\n{\"candidates\":[{\"candidate_id\":\"image-1\",\"use_in_ppt\":true,\"description\":\"A room\",\"reason\":\"Relevant\"}]}\n```";
              return (async function* () {
                yield { event: "message", text };
                yield { event: "complete" };
              })();
            },
            delete: async () => undefined,
          } as AnnaAgentSession;
        },
      },
    };
    const client = await createAgentClient(runtime);
    const result = await client.runImageResearchPrompt("select images", {
      attachments: [{ type: "image/jpeg", url: "https://example.com/image.jpg", filename: "image-1", detail: "auto" }],
    });

    assert.equal(sessionCreations, 1);
    assert.equal(runCount, 2);
    assert.equal(runInputs[0]?.attachments?.length, 1);
    assert.equal(runInputs[1]?.attachments, undefined);
    assert.deepEqual(result.candidates, [{
      candidate_id: "image-1",
      use_in_ppt: true,
      description: "A room",
      reason: "Relevant",
    }]);
  });
});
