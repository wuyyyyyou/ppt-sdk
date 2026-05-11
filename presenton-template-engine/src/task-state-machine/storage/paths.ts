import path from "node:path";

import { TASK_STATE_MACHINE_STATE_DIRNAME } from "../constants.js";

export function resolveTaskStateDir(projectDir: string): string {
  return path.join(projectDir, TASK_STATE_MACHINE_STATE_DIRNAME);
}

export function resolveTaskStateFilePath(projectDir: string, fileName: string): string {
  return path.join(resolveTaskStateDir(projectDir), fileName);
}

export function resolveTaskStateCheckpointDir(projectDir: string): string {
  return path.join(resolveTaskStateDir(projectDir), "checkpoints");
}

export function resolveTaskStateBranchDir(projectDir: string): string {
  return path.join(resolveTaskStateDir(projectDir), "branches");
}
