import { randomUUID } from "node:crypto";

import type {
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskRuntimeStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalCurrentPageRecord,
  readOptionalPagePlanRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  readTaskEvents,
  writeCurrentPageRecord,
  writeStateRecord,
} from "../storage/records.js";

export interface StartPageIterationInput {
  projectDir: string;
  pageId: string;
  pageNumber?: number;
}

export interface RecordPageProgressInput {
  projectDir: string;
  pageId: string;
  pageState:
    | "page_selected"
    | "page_authoring"
    | "page_rendered"
    | "page_review_pending"
    | "page_fix_required"
    | "page_accepted"
    | "page_locked";
  summary: string;
  reviewNotes?: string;
  changedFiles?: string[];
  renderedHtmlPath?: string;
  renderedPngPath?: string;
}

export interface PageProgressResult {
  projectId: string;
  pageId: string;
  pageState: TaskCurrentPageRecord["pageState"];
  allPagesLocked: boolean;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildAllowedTransitions(
  pageState: RecordPageProgressInput["pageState"],
): TaskRuntimeStateRecord["allowedTransitions"] {
  switch (pageState) {
    case "page_selected":
      return ["page_authoring"];
    case "page_authoring":
      return ["page_rendered"];
    case "page_rendered":
      return ["page_review_pending"];
    case "page_review_pending":
      return ["page_accepted", "page_fix_required"];
    case "page_fix_required":
      return ["page_authoring"];
    case "page_accepted":
      return ["page_locked"];
    case "page_locked":
      return [];
  }
}

function getPageProgressEventType(
  pageState: RecordPageProgressInput["pageState"],
): "page_selected" | "page_authoring_started" | "page_rendered" | "page_reviewed" | "page_fixed" | "page_accepted" | "page_locked" {
  switch (pageState) {
    case "page_selected":
      return "page_selected";
    case "page_authoring":
      return "page_authoring_started";
    case "page_rendered":
      return "page_rendered";
    case "page_review_pending":
      return "page_reviewed";
    case "page_fix_required":
      return "page_fixed";
    case "page_accepted":
      return "page_accepted";
    case "page_locked":
      return "page_locked";
  }
}

async function isAllPagesLocked(
  projectDir: string,
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
): Promise<boolean> {
  if (!pagePlan || pagePlan.pages.length === 0) {
    return false;
  }

  const lockedPageIds = new Set<string>();
  const events = await readTaskEvents(projectDir);
  for (const event of events) {
    if (event.eventType !== "page_locked") {
      continue;
    }

    const pageId = event.payload.pageId;
    if (typeof pageId === "string" && pageId.length > 0) {
      lockedPageIds.add(pageId);
    }
  }

  if (currentPage?.locked) {
    lockedPageIds.add(currentPage.pageId);
  }

  return pagePlan.pages.every((page) => lockedPageIds.has(page.pageId));
}

function buildPageStateRecord(
  projectId: string,
  pageId: string,
  pageState: RecordPageProgressInput["pageState"],
  pageNumber?: number,
  renderedHtmlPath?: string,
  renderedPngPath?: string,
): TaskCurrentPageRecord {
  const now = nowIso();
  return {
    projectId,
    updatedAt: now,
    pageId,
    pageNumber,
    pageState,
    locked: pageState === "page_locked",
    lastRenderedHtmlPath: renderedHtmlPath,
    lastRenderedPngPath: renderedPngPath,
  };
}

export async function startPageIteration(
  input: StartPageIterationInput,
): Promise<PageProgressResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const currentPage = buildPageStateRecord(task.projectId, input.pageId, "page_selected", input.pageNumber);
  await writeCurrentPageRecord(input.projectDir, currentPage);

  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt: nowIso(),
    deckState: "page_iteration_active",
    pageState: "page_selected",
    currentPageId: input.pageId,
    blockedBy: [],
    allowedTransitions: ["page_authoring"],
    allPagesLocked: false,
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  const timestamp = nowIso();
  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "page_iteration_started",
    projectId: task.projectId,
    timestamp,
    actor: "agent",
    payload: {
      pageId: input.pageId,
      pageNumber: input.pageNumber ?? null,
    },
  });

  return {
    projectId: task.projectId,
    pageId: input.pageId,
    pageState: currentPage.pageState,
    allPagesLocked: false,
    updatedAt: timestamp,
  };
}

export async function recordPageProgress(
  input: RecordPageProgressInput,
): Promise<PageProgressResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const existingPage = await readOptionalCurrentPageRecord(input.projectDir);
  const currentPage = {
    ...(existingPage ?? buildPageStateRecord(task.projectId, input.pageId, input.pageState)),
    projectId: task.projectId,
    pageId: input.pageId,
    pageState: input.pageState,
    updatedAt: nowIso(),
    locked: input.pageState === "page_locked",
    lastRenderedHtmlPath: input.renderedHtmlPath ?? existingPage?.lastRenderedHtmlPath,
    lastRenderedPngPath: input.renderedPngPath ?? existingPage?.lastRenderedPngPath,
  };

  await writeCurrentPageRecord(input.projectDir, currentPage);

  const pagePlan = await readOptionalPagePlanRecord(input.projectDir);
  const allPagesLocked = await isAllPagesLocked(input.projectDir, pagePlan, currentPage);
  const nextDeckState: TaskRuntimeStateRecord["deckState"] =
    allPagesLocked && input.pageState === "page_locked" ? "deck_html_ready" : "page_iteration_active";

  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt: nowIso(),
    deckState: nextDeckState,
    pageState: input.pageState,
    currentPageId: input.pageId,
    blockedBy:
      input.pageState === "page_review_pending" ? ["page_png_review"] : [],
    allowedTransitions: buildAllowedTransitions(input.pageState),
    allPagesLocked,
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  const timestamp = nowIso();
  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: getPageProgressEventType(input.pageState),
    projectId: task.projectId,
    timestamp,
    actor: "agent",
    payload: {
      pageId: input.pageId,
      summary: input.summary,
      reviewNotes: input.reviewNotes ?? null,
      changedFiles: input.changedFiles ?? [],
      renderedHtmlPath: input.renderedHtmlPath ?? null,
      renderedPngPath: input.renderedPngPath ?? null,
    },
  });

  return {
    projectId: task.projectId,
    pageId: input.pageId,
    pageState: currentPage.pageState,
    allPagesLocked,
    updatedAt: timestamp,
  };
}
