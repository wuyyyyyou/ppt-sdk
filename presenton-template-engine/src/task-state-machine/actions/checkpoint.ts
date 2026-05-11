import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalArtifactsRecord,
  readOptionalCurrentPageRecord,
  readOptionalPagePlanRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writeArtifactsRecord,
  writeCurrentPageRecord,
  writePagePlanRecord,
  writeStateRecord,
  writeTaskRecord,
} from "../storage/records.js";
import { resolveTaskStateBranchDir, resolveTaskStateCheckpointDir } from "../storage/paths.js";

export interface CheckpointRecord {
  checkpointId: string;
  createdAt: string;
  source: string;
  task: TaskStateRecord;
  state: TaskRuntimeStateRecord;
  currentPage: TaskCurrentPageRecord | null;
  pagePlan: TaskPagePlanRecord | null;
  artifacts: TaskArtifactIndexRecord | null;
}

export interface AdvanceTaskStateInput {
  projectDir: string;
  targetDeckState?: TaskRuntimeStateRecord["deckState"];
  targetPageState?: TaskRuntimeStateRecord["pageState"];
  reason: string;
  relatedArtifacts?: string[];
  relatedCheckpoint?: string;
}

export interface RewindTaskStateInput {
  projectDir: string;
  targetState?: TaskRuntimeStateRecord["deckState"];
  checkpointId?: string;
  reason: string;
  invalidateDownstreamArtifacts?: boolean;
}

export interface BranchTaskProjectInput {
  projectDir: string;
  checkpointId?: string;
  branchName?: string;
  reason: string;
}

export interface ListTaskCheckpointsInput {
  projectDir: string;
  includeBranches?: boolean;
}

export interface RestoreTaskStateInput {
  projectDir: string;
  checkpointId: string;
  reason: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function writeCheckpointRecord(
  projectDir: string,
  checkpoint: CheckpointRecord,
): Promise<void> {
  const checkpointDir = resolveTaskStateCheckpointDir(projectDir);
  await mkdir(checkpointDir, { recursive: true });
  await writeFile(
    path.join(checkpointDir, `${checkpoint.checkpointId}.json`),
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    "utf8",
  );
}

async function readCheckpointRecord(
  projectDir: string,
  checkpointId: string,
): Promise<CheckpointRecord | null> {
  try {
    const raw = await readFile(
      path.join(resolveTaskStateCheckpointDir(projectDir), `${checkpointId}.json`),
      "utf8",
    );
    return JSON.parse(raw) as CheckpointRecord;
  } catch {
    return null;
  }
}

function cloneState(state: TaskRuntimeStateRecord): TaskRuntimeStateRecord {
  return {
    ...state,
    allowedTransitions: [...state.allowedTransitions],
    blockedBy: [...state.blockedBy],
  };
}

export async function createCheckpointFromCurrentState(
  projectDir: string,
  source: string,
): Promise<CheckpointRecord> {
  const task = await readOptionalTaskRecord(projectDir);
  const state = await readOptionalStateRecord(projectDir);
  if (!task || !state) {
    throw new Error(`Cannot create checkpoint without task/state in ${projectDir}`);
  }

  const checkpoint: CheckpointRecord = {
    checkpointId: randomUUID(),
    createdAt: nowIso(),
    source,
    task,
    state,
    currentPage: await readOptionalCurrentPageRecord(projectDir),
    pagePlan: await readOptionalPagePlanRecord(projectDir),
    artifacts: await readOptionalArtifactsRecord(projectDir),
  };

  await writeCheckpointRecord(projectDir, checkpoint);
  await appendTaskEvent(projectDir, {
    eventId: randomUUID(),
    eventType: "checkpoint_created",
    projectId: task.projectId,
    timestamp: checkpoint.createdAt,
    actor: "system",
    payload: {
      checkpointId: checkpoint.checkpointId,
      source,
    },
  });

  return checkpoint;
}

export async function advanceTaskState(
  input: AdvanceTaskStateInput,
): Promise<CheckpointRecord> {
  const task = await readOptionalTaskRecord(input.projectDir);
  const state = await readOptionalStateRecord(input.projectDir);
  if (!task || !state) {
    throw new Error(`Cannot advance state without task/state in ${input.projectDir}`);
  }

  const nextState: TaskRuntimeStateRecord = {
    ...cloneState(state),
    updatedAt: nowIso(),
    deckState: input.targetDeckState ?? state.deckState,
    pageState: input.targetPageState ?? state.pageState,
    allowedTransitions: [],
    blockedBy: [],
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  if (input.targetPageState) {
    const currentPage = await readOptionalCurrentPageRecord(input.projectDir);
    if (currentPage) {
      currentPage.pageState = input.targetPageState;
      currentPage.updatedAt = nowIso();
      currentPage.locked = input.targetPageState === "page_locked";
      await writeCurrentPageRecord(input.projectDir, currentPage);
    }
  }

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "state_advanced",
    projectId: task.projectId,
    timestamp: nowIso(),
    actor: "agent",
    payload: {
      reason: input.reason,
      targetDeckState: input.targetDeckState ?? null,
      targetPageState: input.targetPageState ?? null,
      relatedArtifacts: input.relatedArtifacts ?? [],
      relatedCheckpoint: input.relatedCheckpoint ?? null,
    },
  });

  return createCheckpointFromCurrentState(input.projectDir, "advanceTaskState");
}

export async function restoreTaskState(
  input: RestoreTaskStateInput,
): Promise<CheckpointRecord> {
  const checkpoint = await readCheckpointRecord(input.projectDir, input.checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${input.checkpointId}`);
  }

  await writeTaskRecord(input.projectDir, checkpoint.task);
  await writeStateRecord(input.projectDir, {
    ...checkpoint.state,
    updatedAt: nowIso(),
    recoverable: true,
  });

  if (checkpoint.currentPage) {
    await writeCurrentPageRecord(input.projectDir, checkpoint.currentPage);
  }

  if (checkpoint.pagePlan) {
    await writePagePlanRecord(input.projectDir, checkpoint.pagePlan);
  }

  if (checkpoint.artifacts) {
    await writeArtifactsRecord(input.projectDir, checkpoint.artifacts);
  }

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "state_rewound",
    projectId: checkpoint.task.projectId,
    timestamp: nowIso(),
    actor: "agent",
    payload: {
      reason: input.reason,
      checkpointId: checkpoint.checkpointId,
      restored: true,
    },
  });

  return checkpoint;
}

export async function rewindTaskState(
  input: RewindTaskStateInput,
): Promise<CheckpointRecord> {
  const task = await readOptionalTaskRecord(input.projectDir);
  const state = await readOptionalStateRecord(input.projectDir);
  if (!task || !state) {
    throw new Error(`Cannot rewind without task/state in ${input.projectDir}`);
  }

  if (input.checkpointId) {
    const restored = await restoreTaskState({
      projectDir: input.projectDir,
      checkpointId: input.checkpointId,
      reason: input.reason,
    });
    const rewrittenState: TaskRuntimeStateRecord = {
      ...restored.state,
      updatedAt: nowIso(),
      deckState: input.targetState ?? restored.state.deckState,
      recoverable: true,
    };
    await writeStateRecord(input.projectDir, rewrittenState);
    return {
      ...restored,
      state: rewrittenState,
    };
  }

  const checkpoint = await createCheckpointFromCurrentState(input.projectDir, "rewindTaskState");
  const nextState: TaskRuntimeStateRecord = {
    ...cloneState(state),
    updatedAt: nowIso(),
    deckState: input.targetState ?? state.deckState,
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "state_rewound",
    projectId: task.projectId,
    timestamp: nowIso(),
    actor: "agent",
    payload: {
      reason: input.reason,
      checkpointId: checkpoint.checkpointId,
      invalidateDownstreamArtifacts: input.invalidateDownstreamArtifacts ?? true,
      targetState: input.targetState ?? null,
    },
  });

  return checkpoint;
}

export async function branchTaskProject(
  input: BranchTaskProjectInput,
): Promise<CheckpointRecord> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const checkpoint = input.checkpointId
    ? await readCheckpointRecord(input.projectDir, input.checkpointId)
    : await createCheckpointFromCurrentState(input.projectDir, "branchTaskProject");
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${input.checkpointId}`);
  }

  const branchId = input.branchName?.trim().length
    ? input.branchName.trim()
    : `branch-${checkpoint.checkpointId.slice(0, 8)}`;
  const branchDir = path.join(resolveTaskStateBranchDir(input.projectDir), branchId);
  await mkdir(branchDir, { recursive: true });
  await writeFile(
    path.join(branchDir, "branch.json"),
    `${JSON.stringify(
      {
        branchId,
        sourceCheckpointId: checkpoint.checkpointId,
        reason: input.reason,
        createdAt: nowIso(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "branch_created",
    projectId: task.projectId,
    timestamp: nowIso(),
    actor: "agent",
    payload: {
      branchId,
      sourceCheckpointId: checkpoint.checkpointId,
      reason: input.reason,
    },
  });

  return checkpoint;
}

export async function listTaskCheckpoints(input: ListTaskCheckpointsInput): Promise<{
  checkpoints: CheckpointRecord[];
  branches: string[];
}> {
  const checkpointDir = resolveTaskStateCheckpointDir(input.projectDir);
  const branchDir = resolveTaskStateBranchDir(input.projectDir);
  const checkpoints: CheckpointRecord[] = [];
  const branches: string[] = [];

  try {
    const entries = await readdir(checkpointDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const raw = await readFile(path.join(checkpointDir, entry.name), "utf8");
      checkpoints.push(JSON.parse(raw) as CheckpointRecord);
    }
  } catch {
    // ignore missing checkpoint dir
  }

  checkpoints.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  if (input.includeBranches) {
    try {
      const entries = await readdir(branchDir, { withFileTypes: true });
      for (const entry of entries) {
        branches.push(entry.name);
      }
    } catch {
      // ignore missing branch dir
    }
  }

  branches.sort((left, right) => left.localeCompare(right));
  return { checkpoints, branches };
}
