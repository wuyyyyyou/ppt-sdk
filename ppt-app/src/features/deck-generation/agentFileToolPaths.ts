export interface AgentFileToolPathContext {
  pptTaskDir: string;
  agentFileToolRoot: string | null;
  inferenceFailedReason?: string;
}

export interface AgentFileToolPath {
  canonicalAbsolutePath: string;
  agentFileToolPath: string | null;
}

function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.replace(/\/+$/, "");
  }
  return normalized;
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "/";
  return normalized.slice(0, index);
}

function isPathInsideOrEqual(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  return normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent === "/" ? "" : normalizedParent}/`);
}

function relativePath(from: string, to: string): string | null {
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);
  if (!isPathInsideOrEqual(normalizedFrom, normalizedTo)) return null;
  if (normalizedTo === normalizedFrom) return ".";
  return normalizedTo.slice(normalizedFrom === "/" ? 1 : normalizedFrom.length + 1);
}

export function createAgentFileToolPathContext(input: {
  workspaceRoot?: string;
  workspaceDir: string;
}): AgentFileToolPathContext {
  const workspaceRoot = normalizePath(input.workspaceRoot ?? "");
  const workspaceDir = normalizePath(input.workspaceDir);
  const base = { pptTaskDir: workspaceDir };

  if (!workspaceDir) {
    return {
      ...base,
      agentFileToolRoot: null,
      inferenceFailedReason: "workspaceDir is empty.",
    };
  }
  if (!workspaceRoot) {
    return {
      ...base,
      agentFileToolRoot: null,
      inferenceFailedReason: "workspaceRoot is empty.",
    };
  }
  if (!isPathInsideOrEqual(workspaceRoot, workspaceDir)) {
    return {
      ...base,
      agentFileToolRoot: null,
      inferenceFailedReason: `workspaceDir is not under workspaceRoot: ${workspaceDir} is outside ${workspaceRoot}.`,
    };
  }

  const agentFileToolRoot = dirname(workspaceRoot);
  if (!isPathInsideOrEqual(agentFileToolRoot, workspaceDir)) {
    return {
      ...base,
      agentFileToolRoot: null,
      inferenceFailedReason: `workspaceDir is not under inferred Agent file-tool root: ${workspaceDir} is outside ${agentFileToolRoot}.`,
    };
  }

  return {
    ...base,
    agentFileToolRoot,
  };
}

export function describeAgentFileToolPathContext(
  context: AgentFileToolPathContext,
): string {
  if (!context.agentFileToolRoot) {
    return [
      "Path handling for Agent tools:",
      `- PPT task directory: ${context.pptTaskDir}`,
      `- Agent file-tool root could not be inferred: ${context.inferenceFailedReason ?? "unknown reason"}`,
      "- Use canonical absolute paths exactly as provided.",
      '- If an fs_* tool rejects an absolute path, list "." first and find the matching task directory before reading or writing.',
    ].join("\n");
  }

  return [
    "Path handling for Agent tools:",
    `- PPT task directory: ${context.pptTaskDir}`,
    `- Agent file-tool root: ${context.agentFileToolRoot}`,
    "- Use Agent file-tool paths, not PPT-task-relative paths, when calling fs_* tools or upload_local_file.",
    "- Canonical absolute paths are for identity/reference/backend validation only.",
  ].join("\n");
}

export function toAgentFileToolPath(
  context: AgentFileToolPathContext,
  absolutePath: string,
): AgentFileToolPath {
  const canonicalAbsolutePath = normalizePath(absolutePath);
  if (!context.agentFileToolRoot) {
    return {
      canonicalAbsolutePath,
      agentFileToolPath: null,
    };
  }
  return {
    canonicalAbsolutePath,
    agentFileToolPath: relativePath(context.agentFileToolRoot, canonicalAbsolutePath),
  };
}

export function formatAgentFileToolPathBlock(input: {
  label: string;
  path: AgentFileToolPath;
}): string {
  const lines = [
    `${input.label}:`,
    `- Canonical absolute path: ${input.path.canonicalAbsolutePath}`,
  ];
  if (input.path.agentFileToolPath) {
    lines.push(`- Agent file-tool path: ${input.path.agentFileToolPath}`);
  } else {
    lines.push("- Agent file-tool path: unavailable; use the canonical absolute path exactly as provided.");
  }
  return lines.join("\n");
}
