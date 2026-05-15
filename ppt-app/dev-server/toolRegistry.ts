import path from "node:path";
import { localToolPaths } from "./localToolPaths";

export interface LocalToolDefinition {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export const localToolRegistry: Record<string, LocalToolDefinition> = {
  "tool-local-ppt-engine": {
    command: process.execPath,
    args: ["example_plugin.js"],
    cwd: localToolPaths.pptEngineDir,
    timeoutMs: 15 * 60 * 1000
  },
  "tool-local-ppt-gener": {
    command: path.join(
      localToolPaths.pptGenerDir,
      ".venv",
      "bin",
      "python"
    ),
    args: ["example_plugin.py"],
    cwd: localToolPaths.pptGenerDir,
    timeoutMs: 15 * 60 * 1000
  }
};
