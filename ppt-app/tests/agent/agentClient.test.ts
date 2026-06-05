import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createAgentClient, AgentInfrastructureError } from "../../src/agent/agentClient.ts";
import { resetAgentSessionGateForTests } from "../../src/agent/agentSessionGate.ts";
import type {
  AnnaAgentRunFrame,
  AnnaAgentSession,
  AnnaRuntime,
} from "../../src/runtime/annaRuntime.ts";

class ManualClock {
  timeMs = 0;
  sleeps: number[] = [];

  now() {
    return this.timeMs;
  }

  async sleep(ms: number) {
    this.sleeps.push(ms);
    this.timeMs += ms;
  }
}

function makeSession(input: {
  uuid: string;
  frames?: AnnaAgentRunFrame[];
  run?: () => AsyncIterable<AnnaAgentRunFrame>;
  delete?: () => Promise<unknown>;
}): AnnaAgentSession {
  return {
    appSessionUuid: input.uuid,
    expires_in: 600,
    run: input.run ?? (async function* () {
      for (const frame of input.frames ?? [
        { event: "raw", text: '{"status":"ready_for_render","changed_files":[],"summary":"ok","needs_render":true,"notes":[]}' },
        { event: "complete" },
      ]) {
        yield frame;
      }
    }),
    delete: input.delete ?? (async () => undefined),
  };
}

function createRuntime(sessions: AnnaAgentSession[]): AnnaRuntime {
  const queue = [...sessions];
  return {
    tools: {
      invoke: async () => ({}),
    },
    llm: {
      complete: async () => ({}),
    },
    agent: {
      session: async () => {
        const session = queue.shift();
        if (!session) throw new Error("No test session queued.");
        return session;
      },
    },
  };
}

describe("AgentClient session gate", () => {
  afterEach(() => {
    resetAgentSessionGateForTests();
  });

  it("waits for the create cooldown between stage sessions", async () => {
    const clock = new ManualClock();
    const deleted: string[] = [];
    const runtime = createRuntime([
      makeSession({ uuid: "s1", delete: async () => deleted.push("s1") }),
      makeSession({ uuid: "s2", delete: async () => deleted.push("s2") }),
    ]);
    const client = await createAgentClient(runtime, {
      sessionClock: clock,
      sessionTimings: {
        createCooldownMs: 70,
        runWatchdogMs: 1_000,
        deleteRetryDelaysMs: [],
      },
    });

    await client.runAuthoringPrompt("first");
    await client.runAuthoringPrompt("second");

    assert.deepEqual(deleted, ["s1", "s2"]);
    assert.deepEqual(clock.sleeps, [70]);
  });

  it("retries once after a recoverable cached-token run error", async () => {
    const clock = new ManualClock();
    const activities: string[] = [];
    const deleted: string[] = [];
    const runtime = createRuntime([
      makeSession({
        uuid: "bad",
        frames: [
          {
            event: "error",
            message: "no cached app_session token; create a new session",
            code: "http",
          },
        ],
        delete: async () => deleted.push("bad"),
      }),
      makeSession({
        uuid: "good",
        delete: async () => deleted.push("good"),
      }),
    ]);
    const client = await createAgentClient(runtime, {
      sessionClock: clock,
      sessionTimings: {
        createCooldownMs: 70,
        runWatchdogMs: 1_000,
        deleteRetryDelaysMs: [],
        maxSessionRetries: 1,
      },
    });

    const result = await client.runAuthoringPrompt("prompt", {
      onStreamEvent: (event) => {
        if (event.type === "activity") activities.push(event.message);
      },
    });

    assert.equal(result.session_retries, 1);
    assert.deepEqual(deleted, ["bad", "good"]);
    assert.ok(clock.sleeps.includes(70));
    assert.ok(activities.some((message) => message.includes("waiting before retrying")));
  });

  it("guards against reused session uuid during retry", async () => {
    const clock = new ManualClock();
    const deleted: string[] = [];
    const runtime = createRuntime([
      makeSession({
        uuid: "same",
        frames: [
          {
            event: "error",
            message: "no cached app_session token; create a new session",
            code: "http",
          },
        ],
        delete: async () => deleted.push("same-1"),
      }),
      makeSession({
        uuid: "same",
        delete: async () => deleted.push("same-2"),
      }),
      makeSession({
        uuid: "next",
        delete: async () => deleted.push("next"),
      }),
    ]);
    const client = await createAgentClient(runtime, {
      sessionClock: clock,
      sessionTimings: {
        createCooldownMs: 70,
        runWatchdogMs: 1_000,
        deleteRetryDelaysMs: [],
        maxSessionRetries: 1,
        maxSameUuidGuardRetries: 2,
      },
    });

    await client.runAuthoringPrompt("prompt");

    assert.deepEqual(deleted, ["same-1", "same-2", "next"]);
    assert.deepEqual(clock.sleeps, [70, 70]);
  });

  it("stops when session delete fails after retries", async () => {
    const clock = new ManualClock();
    const runtime = createRuntime([
      makeSession({
        uuid: "leaky",
        delete: async () => {
          throw new Error("delete endpoint failed");
        },
      }),
    ]);
    const client = await createAgentClient(runtime, {
      sessionClock: clock,
      sessionTimings: {
        createCooldownMs: 70,
        runWatchdogMs: 1_000,
        deleteRetryDelaysMs: [1, 3],
      },
    });

    await assert.rejects(
      () => client.runAuthoringPrompt("prompt"),
      (error) =>
        error instanceof AgentInfrastructureError &&
        /delete failed/i.test(error.message),
    );
    assert.deepEqual(clock.sleeps, [1, 3]);
  });

  it("deletes and retries once after the local run watchdog fires", async () => {
    const clock = new ManualClock();
    const deleted: string[] = [];
    const neverCompletes = async function* () {
      await new Promise(() => undefined);
    };
    const runtime = createRuntime([
      makeSession({
        uuid: "slow",
        run: neverCompletes,
        delete: async () => deleted.push("slow"),
      }),
      makeSession({
        uuid: "fast",
        delete: async () => deleted.push("fast"),
      }),
    ]);
    const client = await createAgentClient(runtime, {
      sessionClock: clock,
      sessionTimings: {
        createCooldownMs: 5,
        runWatchdogMs: 1,
        deleteRetryDelaysMs: [],
        maxSessionRetries: 1,
      },
    });

    const result = await client.runAuthoringPrompt("prompt");

    assert.equal(result.session_retries, 1);
    assert.deepEqual(deleted, ["slow", "fast"]);
    assert.deepEqual(clock.sleeps, [5]);
  });
});
