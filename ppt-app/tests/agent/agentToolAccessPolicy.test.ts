import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_AGENT_TOOL_ACCESS_POLICY,
  resolveAgentToolAccessPolicy,
} from "../../src/agent/agentToolAccessPolicy.ts";

describe("Agent tool access policy", () => {
  it("defaults to strict when unset", () => {
    assert.equal(resolveAgentToolAccessPolicy(undefined), DEFAULT_AGENT_TOOL_ACCESS_POLICY);
    assert.equal(resolveAgentToolAccessPolicy(""), DEFAULT_AGENT_TOOL_ACCESS_POLICY);
  });

  it("accepts strict, warn, and off values", () => {
    assert.equal(resolveAgentToolAccessPolicy("strict"), "strict");
    assert.equal(resolveAgentToolAccessPolicy(" WARN "), "warn");
    assert.equal(resolveAgentToolAccessPolicy("off"), "off");
  });

  it("falls back to strict and warns once for invalid values", () => {
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);

    assert.equal(resolveAgentToolAccessPolicy("loose", { warn }), "strict");
    assert.equal(resolveAgentToolAccessPolicy("disabled", { warn }), "strict");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Invalid VITE_AGENT_TOOL_ACCESS_POLICY/);
  });
});
