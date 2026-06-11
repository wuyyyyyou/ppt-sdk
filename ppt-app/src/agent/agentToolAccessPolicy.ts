export type AgentToolAccessPolicy = "strict" | "warn" | "off";

export const DEFAULT_AGENT_TOOL_ACCESS_POLICY: AgentToolAccessPolicy = "strict";

const VALID_AGENT_TOOL_ACCESS_POLICIES = new Set<AgentToolAccessPolicy>([
  "strict",
  "warn",
  "off",
]);

let warnedInvalidPolicy = false;

export function resolveAgentToolAccessPolicy(
  value: unknown,
  options: {
    warn?: (message: string) => void;
  } = {},
): AgentToolAccessPolicy {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_AGENT_TOOL_ACCESS_POLICY;
  }

  const policy = value.trim().toLowerCase();
  if (VALID_AGENT_TOOL_ACCESS_POLICIES.has(policy as AgentToolAccessPolicy)) {
    return policy as AgentToolAccessPolicy;
  }

  if (!warnedInvalidPolicy) {
    warnedInvalidPolicy = true;
    options.warn?.(
      `Invalid VITE_AGENT_TOOL_ACCESS_POLICY "${value}". Falling back to "${DEFAULT_AGENT_TOOL_ACCESS_POLICY}".`,
    );
  }

  return DEFAULT_AGENT_TOOL_ACCESS_POLICY;
}
