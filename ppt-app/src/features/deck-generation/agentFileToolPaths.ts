export interface AgentFileToolPathContext {
  pptTaskDir: string;
}

export interface AgentFileToolPath {
  agentFileToolPath: string;
}

function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.replace(/\/+$/, "");
  }
  return normalized;
}

export function createAgentFileToolPathContext(input: {
  workspaceRoot?: string;
  workspaceDir: string;
}): AgentFileToolPathContext {
  return {
    pptTaskDir: normalizePath(input.workspaceDir),
  };
}

export function describeAgentFileToolPathContext(
  context: AgentFileToolPathContext,
): string {
  return [
    "Path handling for Agent tools:",
    `- PPT task directory (absolute): ${context.pptTaskDir}`,
    "- Use every Agent file-tool absolute path exactly as provided when calling fs_* tools or upload_local_file.",
    "- Do not convert an absolute path to a relative path, prepend or replace its workspace root, or route it through another registered client.",
  ].join("\n");
}

export function toAgentFileToolPath(
  _context: AgentFileToolPathContext,
  absolutePath: string,
): AgentFileToolPath {
  return {
    agentFileToolPath: normalizePath(absolutePath),
  };
}

export function formatAgentFileToolPathBlock(input: {
  label: string;
  path: AgentFileToolPath;
}): string {
  return [
    `${input.label}:`,
    `- Agent file-tool absolute path: ${input.path.agentFileToolPath}`,
  ].join("\n");
}
