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
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writePagePlanRecord,
  writeOutlineRecord,
  writeRequirementsRecord,
  writeStateRecord,
} from "../storage/records.js";

export interface RecordRequirementsInput {
  projectDir: string;
  requirements: {
    topic: string;
    audience: string;
    scenario: string;
    pageCount: number;
    tone?: string;
    language?: string;
    mustCover?: string[];
  };
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
    requirements: input.requirements,
    source: input.source ?? "user",
  };
}

function buildOutlinePayload(input: RecordOutlineInput) {
  return {
    outline: input.outline,
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

  const requirementsRecord: TaskRequirementsRecord = {
    projectId: task.projectId,
    updatedAt: nowIso(),
    requirements: input.requirements,
    source: input.source ?? "user",
  };
  await writeRequirementsRecord(input.projectDir, requirementsRecord);

  const nextState = updateDeckState(state, "requirements_collected", ["template_selected"]);
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
  const nextState = updateDeckState(state, "outline_ready", ["page_plan_ready"]);
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

  const nextState = updateDeckState(state, "page_plan_ready", ["page_iteration_active"]);
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
