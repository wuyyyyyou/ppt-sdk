import path from "node:path";

import {
  TASK_STATE_MACHINE_PROMOTE_CURRENT_FILE_NAME,
  TASK_STATE_MACHINE_PROMOTE_DECK_DIRNAME,
  TASK_STATE_MACHINE_PROMOTE_DIRNAME,
  TASK_STATE_MACHINE_PROMOTE_MANIFEST_FILE_NAME,
  TASK_STATE_MACHINE_PROMOTE_PAGES_DIRNAME,
  TASK_STATE_MACHINE_PROMOTE_RECOVERY_FILE_NAME,
  TASK_STATE_MACHINE_PROMOTE_TEMPLATES_DIRNAME,
  TASK_STATE_MACHINE_STATE_DIRNAME,
} from "../constants.js";

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

export function resolvePromoteDir(projectDir: string): string {
  return path.join(projectDir, TASK_STATE_MACHINE_PROMOTE_DIRNAME);
}

export function resolvePromoteManifestFilePath(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_MANIFEST_FILE_NAME);
}

export function resolvePromoteCurrentFilePath(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_CURRENT_FILE_NAME);
}

export function resolvePromoteDeckDir(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_DECK_DIRNAME);
}

export function resolvePromoteDeckFilePath(projectDir: string, fileName: string): string {
  return path.join(resolvePromoteDeckDir(projectDir), fileName);
}

export function resolvePromotePagesDir(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_PAGES_DIRNAME);
}

export function resolvePromotePageFilePath(projectDir: string, pageId: string): string {
  return path.join(resolvePromotePagesDir(projectDir), `${pageId}.md`);
}

export function resolvePromoteTemplatesDir(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_TEMPLATES_DIRNAME);
}

export function resolvePromoteRecoveryFilePath(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), TASK_STATE_MACHINE_PROMOTE_RECOVERY_FILE_NAME);
}
