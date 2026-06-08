import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAgentSessionCacheMissDelayMs,
  isAgentSessionCacheMissMessage,
  nextAgentSessionCacheMissRetry,
  type AgentSessionCacheMissRetryState,
} from "../../src/agent/agentSessionRetry.ts";

describe("Agent Session Cache Miss retry policy", () => {
  it("matches only the narrow cache miss platform message", () => {
    assert.equal(
      isAgentSessionCacheMissMessage(
        "no cached app_session token; create a new session",
      ),
      true,
    );
    assert.equal(
      isAgentSessionCacheMissMessage(
        "ERROR: no cached app_session token; create a new session.",
      ),
      true,
    );
    assert.equal(isAgentSessionCacheMissMessage("invalid app_session_token"), false);
    assert.equal(isAgentSessionCacheMissMessage("HTTP 429 session.mint failed"), false);
    assert.equal(isAgentSessionCacheMissMessage("no cached user token"), false);
  });

  it("uses fixed first retries and then capped exponential backoff", () => {
    const random = () => 0.5;

    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 1, random }),
      1000,
    );
    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 10, random }),
      1000,
    );
    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 11, random }),
      2000,
    );
    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 12, random }),
      4000,
    );
    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 15, random }),
      32000,
    );
    assert.equal(
      calculateAgentSessionCacheMissDelayMs({ retryNumber: 16, random }),
      60000,
    );
  });

  it("stops when retry count or total wait budget is exhausted", () => {
    const byCount: AgentSessionCacheMissRetryState = {
      retries: 2,
      totalWaitMs: 2000,
    };
    assert.deepEqual(
      nextAgentSessionCacheMissRetry({
        state: byCount,
        config: { maxRetries: 2 },
        random: () => 0.5,
      }),
      {
        retry: false,
        retries: 2,
        totalWaitMs: 2000,
        reason: "max_retries",
      },
    );

    const byWait: AgentSessionCacheMissRetryState = {
      retries: 2,
      totalWaitMs: 2000,
    };
    assert.deepEqual(
      nextAgentSessionCacheMissRetry({
        state: byWait,
        config: { maxRetries: 100, maxTotalWaitMs: 2500 },
        random: () => 0.5,
      }),
      {
        retry: false,
        retries: 2,
        totalWaitMs: 2000,
        reason: "max_total_wait",
      },
    );
  });
});
