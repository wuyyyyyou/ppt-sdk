import os from "node:os";
import path from "node:path";

/**
 * Resolve the persistent base directory supplied by Anna Cloud Agent.
 *
 * Cloud Agent injects ANNA_WORKSPACE_DIR for Executa processes. Local
 * development keeps the historical home-directory fallback so existing
 * workspaces remain discoverable when the variable is not set.
 */
export function getPptWorkspaceRoot(): string {
  const configuredRoot = process.env.ANNA_WORKSPACE_DIR?.trim();
  if (!configuredRoot) {
    return path.join(os.homedir(), "anna-workspace", "ppt");
  }

  if (!path.isAbsolute(configuredRoot)) {
    throw new Error("ANNA_WORKSPACE_DIR must be an absolute path");
  }

  return path.join(path.normalize(configuredRoot), "ppt");
}
