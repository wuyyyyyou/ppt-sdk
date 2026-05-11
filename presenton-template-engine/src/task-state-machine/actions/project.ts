import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

import {
  TASK_STATE_MACHINE_EVENTS_FILE_NAME,
} from "../constants.js";
import type {
  TaskRuntimeStateRecord,
  TaskStateRecord,
  TaskStateMachineDeckState,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalArtifactsRecord,
  readOptionalCurrentPageRecord,
  readOptionalPagePlanRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writeArtifactsRecord,
  writeStateRecord,
  writeTaskRecord,
} from "../storage/records.js";
import { resolveTaskStateDir } from "../storage/paths.js";
import type { TaskStateMachineEventRecord } from "../types.js";
import { resolveTaskStateFilePath } from "../storage/paths.js";

export interface CreateTaskProjectInput {
  projectDir: string;
  title?: string;
  initialRequest?: string;
}

export interface CreateTaskProjectResult {
  projectId: string;
  projectDir: string;
  stateDir: string;
  task: TaskStateRecord;
  state: TaskRuntimeStateRecord;
}

export interface OpenTaskProjectInput {
  projectDir: string;
}

export interface OpenTaskProjectResult {
  projectId: string;
  projectDir: string;
  stateDir: string;
  task: TaskStateRecord;
  state: TaskRuntimeStateRecord;
  currentPage: Awaited<ReturnType<typeof readOptionalCurrentPageRecord>>;
  pagePlan: Awaited<ReturnType<typeof readOptionalPagePlanRecord>>;
  artifacts: Awaited<ReturnType<typeof readOptionalArtifactsRecord>>;
}

function ensureAbsolutePath(value: string, fieldName: string): void {
  if (!path.isAbsolute(value)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
}

async function ensureDirectoryEmptyOrMissing(projectDir: string): Promise<void> {
  try {
    const currentStat = await stat(projectDir);
    if (!currentStat.isDirectory()) {
      throw new Error(`Project path must be a directory: ${projectDir}`);
    }

    const entries = await readdir(projectDir);
    if (entries.length > 0) {
      throw new Error(`Project directory is not empty: ${projectDir}`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function buildInitialDeckState(): TaskStateMachineDeckState {
  return "project_ready";
}

function createTaskRecord(projectDir: string, title?: string): TaskStateRecord {
  const now = new Date().toISOString();
  const projectId = `ppt-${now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "-")}-${randomUUID().slice(0, 8)}`;

  return {
    projectId,
    projectDir,
    title: title?.trim().length ? title.trim() : undefined,
    createdAt: now,
    updatedAt: now,
    status: buildInitialDeckState(),
    activeRevision: "main",
    completed: false,
  };
}

function createStateRecord(projectId: string, deckState: TaskStateMachineDeckState): TaskRuntimeStateRecord {
  const now = new Date().toISOString();

  return {
    projectId,
    updatedAt: now,
    deckState,
    blockedBy: [],
    allowedTransitions: deckState === "project_ready"
      ? ["requirements_collected"]
      : [],
    allPagesLocked: false,
    recoverable: true,
  };
}

async function initializeProjectFiles(projectDir: string, task: TaskStateRecord, state: TaskRuntimeStateRecord): Promise<void> {
  const stateDir = resolveTaskStateDir(projectDir);
  await mkdir(stateDir, { recursive: true });
  await mkdir(path.join(stateDir, "checkpoints"), { recursive: true });
  await mkdir(path.join(stateDir, "branches"), { recursive: true });

  await writeTaskRecord(projectDir, task);
  await writeStateRecord(projectDir, state);
  await writeArtifactsRecord(projectDir, {
    projectId: task.projectId,
    updatedAt: task.updatedAt,
    artifacts: [],
  });

  await appendTaskEvent(projectDir, {
    eventId: randomUUID(),
    eventType: "project_created",
    projectId: task.projectId,
    timestamp: task.createdAt,
    actor: "system",
    payload: {
      projectDir,
      title: task.title ?? null,
    },
  });
}

export async function createTaskProject(
  input: CreateTaskProjectInput,
): Promise<CreateTaskProjectResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Create task project input must be an object");
  }

  if (!input.projectDir || typeof input.projectDir !== "string") {
    throw new Error('Field "projectDir" is required');
  }

  ensureAbsolutePath(input.projectDir, "projectDir");
  await ensureDirectoryEmptyOrMissing(input.projectDir);
  await mkdir(input.projectDir, { recursive: true });

  const task = createTaskRecord(input.projectDir, input.title);
  const state = createStateRecord(task.projectId, task.status);
  await initializeProjectFiles(input.projectDir, task, state);

  return {
    projectId: task.projectId,
    projectDir: input.projectDir,
    stateDir: resolveTaskStateDir(input.projectDir),
    task,
    state,
  };
}

export async function openTaskProject(
  input: OpenTaskProjectInput,
): Promise<OpenTaskProjectResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Open task project input must be an object");
  }

  if (!input.projectDir || typeof input.projectDir !== "string") {
    throw new Error('Field "projectDir" is required');
  }

  ensureAbsolutePath(input.projectDir, "projectDir");

  const stateDir = resolveTaskStateDir(input.projectDir);
  await access(stateDir, fsConstants.R_OK);

  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${stateDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${stateDir}`);
  }

  const currentPage = await readOptionalCurrentPageRecord(input.projectDir);
  const pagePlan = await readOptionalPagePlanRecord(input.projectDir);
  const artifacts = await readOptionalArtifactsRecord(input.projectDir);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "project_opened",
    projectId: task.projectId,
    timestamp: new Date().toISOString(),
    actor: "system",
    payload: {
      projectDir: input.projectDir,
      activeRevision: task.activeRevision,
    },
  });

  return {
    projectId: task.projectId,
    projectDir: input.projectDir,
    stateDir,
    task,
    state,
    currentPage,
    pagePlan,
    artifacts,
  };
}

export function getTaskStatePaths(projectDir: string) {
  return {
    taskPath: resolveTaskStateFilePath(projectDir, "task.json"),
    statePath: resolveTaskStateFilePath(projectDir, "state.json"),
    currentPagePath: resolveTaskStateFilePath(projectDir, "current-page.json"),
    pagePlanPath: resolveTaskStateFilePath(projectDir, "page-plan.json"),
    artifactsPath: resolveTaskStateFilePath(projectDir, "artifacts.json"),
    eventsPath: resolveTaskStateFilePath(projectDir, "events.jsonl"),
    stateDir: resolveTaskStateDir(projectDir),
  };
}
