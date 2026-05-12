import { randomUUID } from "node:crypto";

import type {
  TaskPagePlanItem,
  TaskPagePlanRecord,
  TaskOutlineRecord,
  TaskRequirementsRecord,
  TaskRuntimeStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalPagePlanRecord,
  readOptionalRequirementsRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writePagePlanRecord,
  writeOutlineRecord,
  writeRequirementsRecord,
  writeStateRecord,
} from "../storage/records.js";

type RequirementsPayload = TaskRequirementsRecord["requirements"];
type RecordRequirementsMode = "merge" | "replace_all";

export interface RecordRequirementsInput {
  projectDir: string;
  mode?: RecordRequirementsMode;
  requirements: Partial<RequirementsPayload>;
  source?: string;
}

export interface RecordOutlineInput {
  projectDir: string;
  outline: {
    narrative: string;
    sections: string[];
    pages: Array<{
      pageId: string;
      pageNumber: number;
      title: string;
      goal: string;
      coreMessage: string;
    }>;
  };
}

export interface RecordPagePlanInput {
  projectDir: string;
  mode: "replace_all" | "update_page";
  pagePlan:
    | {
        pages: TaskPagePlanItem[];
      }
    | {
        pageId: string;
        patch: Partial<TaskPagePlanItem>;
      };
}

export interface RecordPlanResult {
  projectId: string;
  path: string;
  deckState: TaskRuntimeStateRecord["deckState"];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clonePagePlan(record: TaskPagePlanRecord): TaskPagePlanRecord {
  return {
    projectId: record.projectId,
    updatedAt: record.updatedAt,
    pages: record.pages.map((page) => ({ ...page })),
  };
}

function ensureProjectIdConsistency(existingProjectId: string, nextProjectId: string): void {
  if (existingProjectId !== nextProjectId) {
    throw new Error(`Project id mismatch: ${existingProjectId} !== ${nextProjectId}`);
  }
}

function updateDeckState(
  current: TaskRuntimeStateRecord,
  deckState: TaskRuntimeStateRecord["deckState"],
  allowedTransitions: TaskRuntimeStateRecord["allowedTransitions"],
): TaskRuntimeStateRecord {
  return {
    ...current,
    updatedAt: nowIso(),
    deckState,
    allowedTransitions,
  };
}

function buildRequirementsPayload(input: RecordRequirementsInput) {
  return {
    mode: input.mode ?? "merge",
    requirements: input.requirements,
    source: input.source ?? "user",
  };
}

function assertRecordRequirementsMode(mode: string | undefined): asserts mode is RecordRequirementsMode | undefined {
  if (mode !== undefined && mode !== "merge" && mode !== "replace_all") {
    throw new Error(`Unsupported record requirements mode: ${mode}`);
  }
}

function assertStringField(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required requirements field: ${fieldName}`);
  }
}

function assertRequirementsPayload(payload: Partial<RequirementsPayload>): asserts payload is RequirementsPayload {
  assertStringField(payload.topic, "topic");
  assertStringField(payload.audience, "audience");
  assertStringField(payload.scenario, "scenario");

  if (!Number.isInteger(payload.pageCount) || Number(payload.pageCount) <= 0) {
    throw new Error("Missing required requirements field: pageCount");
  }

  if (payload.mustCover !== undefined && !Array.isArray(payload.mustCover)) {
    throw new Error("requirements.mustCover must be an array when provided");
  }
}

function resolveRequirementsPayload(
  existing: TaskRequirementsRecord | null,
  input: RecordRequirementsInput,
): RequirementsPayload {
  assertRecordRequirementsMode(input.mode);

  const mode = input.mode ?? "merge";
  const requirements = mode === "merge"
    ? {
        ...(existing?.requirements ?? {}),
        ...input.requirements,
      }
    : input.requirements;

  assertRequirementsPayload(requirements);
  return requirements;
}

function buildOutlinePayload(input: RecordOutlineInput) {
  return {
    outline: input.outline,
  };
}

function toPascalCase(value: string): string {
  const parts = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const joined = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return joined.length > 0 ? (/[a-zA-Z]/.test(joined[0]) ? joined : `Slide${joined}`) : "SlidePage";
}

function buildPageTargetPaths(pageId: string): { slidePath: string; dataPath: string } {
  const slideName = toPascalCase(pageId);
  return {
    slidePath: `./slides/${slideName}.tsx`,
    dataPath: `./data/${pageId}.json`,
  };
}

function buildPagePlanFromOutline(
  projectId: string,
  outlinePages: RecordOutlineInput["outline"]["pages"],
): TaskPagePlanRecord {
  const pages: TaskPagePlanItem[] = outlinePages.map((page) => ({
    pageId: page.pageId,
    pageNumber: page.pageNumber,
    title: page.title,
    goal: page.goal,
    coreMessage: page.coreMessage,
    ...buildPageTargetPaths(page.pageId),
    candidateComponentFamilies: [],
    openQuestions: [],
  }));

  return {
    projectId,
    updatedAt: nowIso(),
    pages,
  };
}

export async function recordRequirements(
  input: RecordRequirementsInput,
): Promise<RecordPlanResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const existingRequirements = await readOptionalRequirementsRecord(input.projectDir);
  const requirements = resolveRequirementsPayload(existingRequirements, input);
  const requirementsRecord: TaskRequirementsRecord = {
    projectId: task.projectId,
    updatedAt: nowIso(),
    requirements,
    source: input.source ?? existingRequirements?.source ?? "user",
  };
  await writeRequirementsRecord(input.projectDir, requirementsRecord);

  const nextState = updateDeckState(state, "requirements_collected", ["project_forked"]);
  await writeStateRecord(input.projectDir, nextState);

  const timestamp = nowIso();
  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "requirements_recorded",
    projectId: task.projectId,
    timestamp,
    actor: "agent",
    payload: buildRequirementsPayload(input),
  });

  return {
    projectId: task.projectId,
    path: input.projectDir,
    deckState: nextState.deckState,
    updatedAt: timestamp,
  };
}

export async function recordOutline(
  input: RecordOutlineInput,
): Promise<RecordPlanResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const outlineRecord: TaskOutlineRecord = {
    projectId: task.projectId,
    updatedAt: nowIso(),
    outline: input.outline,
  };
  await writeOutlineRecord(input.projectDir, outlineRecord);

  const pagePlan = buildPagePlanFromOutline(task.projectId, input.outline.pages);
  const nextState = updateDeckState(state, "outline_ready", ["page_iteration_active"]);
  await writePagePlanRecord(input.projectDir, pagePlan);
  await writeStateRecord(input.projectDir, nextState);

  const timestamp = nowIso();
  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "outline_recorded",
    projectId: task.projectId,
    timestamp,
    actor: "agent",
    payload: buildOutlinePayload(input),
  });

  return {
    projectId: task.projectId,
    path: input.projectDir,
    deckState: nextState.deckState,
    updatedAt: timestamp,
  };
}

export async function recordPagePlan(
  input: RecordPagePlanInput,
): Promise<RecordPlanResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const existing = await readOptionalPagePlanRecord(input.projectDir);
  if (!existing) {
    throw new Error(`page-plan.json not found in ${input.projectDir}`);
  }

  ensureProjectIdConsistency(existing.projectId, task.projectId);
  const nextPlan = clonePagePlan(existing);

  if (input.mode === "replace_all") {
    const pages = (input.pagePlan as { pages: TaskPagePlanItem[] }).pages;
    nextPlan.pages = pages.map((page) => ({ ...page }));
  } else {
    const { pageId, patch } = input.pagePlan as { pageId: string; patch: Partial<TaskPagePlanItem> };
    const target = nextPlan.pages.find((page) => page.pageId === pageId);
    if (!target) {
      throw new Error(`page "${pageId}" not found in page-plan.json`);
    }

    Object.assign(target, patch, {
      openQuestions: patch.openQuestions ?? target.openQuestions ?? [],
      candidateComponentFamilies:
        patch.candidateComponentFamilies ?? target.candidateComponentFamilies ?? [],
    });
  }

  nextPlan.updatedAt = nowIso();
  await writePagePlanRecord(input.projectDir, nextPlan);

  const nextState = {
    ...state,
    updatedAt: nowIso(),
  };
  await writeStateRecord(input.projectDir, nextState);

  const timestamp = nowIso();
  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "page_plan_recorded",
    projectId: task.projectId,
    timestamp,
    actor: "agent",
    payload: {
      mode: input.mode,
      pagePlan: input.pagePlan,
    },
  });

  return {
    projectId: task.projectId,
    path: input.projectDir,
    deckState: nextState.deckState,
    updatedAt: timestamp,
  };
}
