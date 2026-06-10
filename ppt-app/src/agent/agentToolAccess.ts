export const NO_TOOLS_AVAILABLE_CODE = "NO_TOOLS_AVAILABLE";

export const AGENT_TOOLS_UNAVAILABLE_MESSAGE =
  "Agent sessions cannot use executable tools. Enable the app grant for agent session tools, then retry.";

export interface AgentToolAccessWarning {
  code: string;
  message: string;
}

interface AgentToolSurface {
  granted_tools?: unknown;
  inherit_host_tools?: unknown;
  warnings?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readGrantedTools(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function readNoToolsWarning(value: unknown): AgentToolAccessWarning | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (item.code !== NO_TOOLS_AVAILABLE_CODE) continue;
    return {
      code: NO_TOOLS_AVAILABLE_CODE,
      message:
        typeof item.message === "string" && item.message.length > 0
          ? item.message
          : AGENT_TOOLS_UNAVAILABLE_MESSAGE,
    };
  }
  return null;
}

export function getAgentToolAccessWarning(
  value: AgentToolSurface | unknown,
): AgentToolAccessWarning | null {
  if (!isRecord(value)) return null;

  const noToolsWarning = readNoToolsWarning(value.warnings);
  if (noToolsWarning) return noToolsWarning;

  const grantedTools = readGrantedTools(value.granted_tools);
  if (grantedTools === null) {
    return null;
  }

  const inheritsHostTools =
    value.inherit_host_tools === true || grantedTools.includes("*");
  if (inheritsHostTools || grantedTools.length > 0) {
    return null;
  }

  return {
    code: NO_TOOLS_AVAILABLE_CODE,
    message: AGENT_TOOLS_UNAVAILABLE_MESSAGE,
  };
}
