import { randomUUID } from "node:crypto";

import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskOutlineRecord,
  TaskPagePlanRecord,
  TaskPageProgressRecord,
  TaskRequirementsRecord,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalArtifactsRecord,
  readOptionalCurrentPageRecord,
  readOptionalOutlineRecord,
  readOptionalPagePlanRecord,
  readOptionalPageProgressRecord,
  readOptionalRequirementsRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writeArtifactsRecord,
  writeCurrentPageRecord,
  writeOutlineRecord,
  writePagePlanRecord,
  writePageProgressRecord,
  writeRequirementsRecord,
  writeStateRecord,
  writeTaskRecord,
} from "../storage/records.js";
import { listTaskCheckpoints, type CheckpointRecord } from "../actions/checkpoint.js";
import {
  buildPageProgressFromPlan,
  deriveEffectiveTaskState,
} from "../semantics/index.js";

export interface RecoveryIssue {
  file: string;
  level: "repairable" | "fatal";
  message: string;
}

export interface RecoveryResult {
  projectId: string;
  recovered: boolean;
  repairedFiles: string[];
  issues: RecoveryIssue[];
  state: TaskRuntimeStateRecord;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildDefaultState(task: TaskStateRecord): TaskRuntimeStateRecord {
  return {
    projectId: task.projectId,
    updatedAt: nowIso(),
    deckState: "project_ready",
    blockedBy: [],
    allowedTransitions: ["requirements_collected"],
    allPagesLocked: false,
    recoverable: true,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pickLatestCheckpoint(checkpoints: CheckpointRecord[]): CheckpointRecord | null {
  return checkpoints.at(-1) ?? null;
}

function syncDeckStateFromArtifacts(
  state: TaskRuntimeStateRecord,
  currentPage: TaskCurrentPageRecord | null,
  pagePlan: TaskPagePlanRecord | null,
  pageProgress: TaskPageProgressRecord | null,
): TaskRuntimeStateRecord {
  return {
    ...deriveEffectiveTaskState({
      projectDir: state.projectId,
      state,
      currentPage,
      pagePlan,
      pageProgress,
    }).state,
    updatedAt: nowIso(),
  };
}

function buildPageProgressFromArtifacts(
  task: TaskStateRecord,
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
  existing: TaskPageProgressRecord | null,
): TaskPageProgressRecord {
  return buildPageProgressFromPlan({
    projectId: task.projectId,
    pagePlan,
    existing,
    currentPage,
    now: nowIso(),
  });
}

export async function recoverTaskProject(projectDir: string): Promise<RecoveryResult> {
  const issues: RecoveryIssue[] = [];
  const repairedFiles: string[] = [];

  let task = await readOptionalTaskRecord(projectDir);
  if (!task) {
    const checkpoints = await listTaskCheckpoints({ projectDir, includeBranches: false });
    const latest = pickLatestCheckpoint(checkpoints.checkpoints);
    if (!latest) {
      throw new Error(`Cannot recover missing task.json without checkpoint history in ${projectDir}`);
    }
    task = clone(latest.task);
    task.updatedAt = nowIso();
    await writeTaskRecord(projectDir, task);
    repairedFiles.push("task.json");
    issues.push({ file: "task.json", level: "repairable", message: "Recovered from latest checkpoint." });
  }

  let state = await readOptionalStateRecord(projectDir);
  if (!state) {
    state = buildDefaultState(task);
    await writeStateRecord(projectDir, state);
    repairedFiles.push("state.json");
    issues.push({ file: "state.json", level: "repairable", message: "Missing state.json rebuilt with defaults." });
  }

  const currentPage = await readOptionalCurrentPageRecord(projectDir);
  const pagePlan = await readOptionalPagePlanRecord(projectDir);
  let pageProgress = await readOptionalPageProgressRecord(projectDir);
  const requirements = await readOptionalRequirementsRecord(projectDir);
  const outline = await readOptionalOutlineRecord(projectDir);
  const artifacts = await readOptionalArtifactsRecord(projectDir);

  if (pagePlan && !pageProgress) {
    pageProgress = buildPageProgressFromArtifacts(task, pagePlan, currentPage, null);
    await writePageProgressRecord(projectDir, pageProgress);
    repairedFiles.push("page-progress.json");
    issues.push({ file: "page-progress.json", level: "repairable", message: "Missing page-progress.json rebuilt from page-plan/current-page." });
  }

  if (currentPage && pagePlan) {
    state = syncDeckStateFromArtifacts(state, currentPage, pagePlan, pageProgress);
    await writeStateRecord(projectDir, state);
    repairedFiles.push("state.json");
  } else if (state.deckState === "page_iteration_active" && !currentPage) {
    issues.push({
      file: "current-page.json",
      level: "repairable",
      message: "Current page missing; state was downgraded to a safe recovery state.",
    });
    state = {
      ...state,
      deckState: "outline_ready",
      pageState: undefined,
      currentPageId: undefined,
      allPagesLocked: false,
      blockedBy: ["current_page_missing"],
      allowedTransitions: ["page_iteration_active"],
      updatedAt: nowIso(),
    };
    await writeStateRecord(projectDir, state);
    repairedFiles.push("state.json");
  }

  if (!requirements && outline) {
    issues.push({
      file: "requirements.json",
      level: "repairable",
      message: "Requirements missing while outline exists; leaving outline untouched.",
    });
  }

  if (requirements && requirements.projectId !== task.projectId) {
    throw new Error("requirements.json projectId mismatch");
  }

  if (outline && outline.projectId !== task.projectId) {
    throw new Error("outline.json projectId mismatch");
  }

  if (pagePlan && pagePlan.projectId !== task.projectId) {
    throw new Error("page-plan.json projectId mismatch");
  }

  if (pageProgress && pageProgress.projectId !== task.projectId) {
    throw new Error("page-progress.json projectId mismatch");
  }

  if (artifacts && artifacts.projectId !== task.projectId) {
    throw new Error("artifacts.json projectId mismatch");
  }

  if (requirements) {
    await writeRequirementsRecord(projectDir, requirements);
  }

  if (outline) {
    await writeOutlineRecord(projectDir, outline);
  }

  if (pagePlan) {
    await writePagePlanRecord(projectDir, pagePlan);
  }

  if (pageProgress) {
    await writePageProgressRecord(projectDir, pageProgress);
  }

  if (artifacts) {
    await writeArtifactsRecord(projectDir, artifacts);
  }

  await appendTaskEvent(projectDir, {
    eventId: randomUUID(),
    eventType: "error_recorded",
    projectId: task.projectId,
    timestamp: nowIso(),
    actor: "system",
    payload: {
      recovered: true,
      repairedFiles,
      issueCount: issues.length,
    },
  });

  return {
    projectId: task.projectId,
    recovered: true,
    repairedFiles,
    issues,
    state,
  };
}

export async function validateTaskProject(projectDir: string): Promise<RecoveryResult> {
  const task = await readOptionalTaskRecord(projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${projectDir}`);
  }

  const state = await readOptionalStateRecord(projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${projectDir}`);
  }

  return {
    projectId: task.projectId,
    recovered: false,
    repairedFiles: [],
    issues: [],
    state,
  };
}
