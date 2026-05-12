import { randomUUID } from "node:crypto";

import type {
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskPageProgressItem,
  TaskPageProgressRecord,
  TaskRuntimeStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalCurrentPageRecord,
  readOptionalPagePlanRecord,
  readOptionalPageProgressRecord,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writeCurrentPageRecord,
  writePageProgressRecord,
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
    | "page_review"
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

export interface RecordDeckReviewFeedbackInput {
  projectDir: string;
  pages: Array<{
    pageId: string;
    summary?: string;
    reviewNotes?: string;
  }>;
}

export interface DeckReviewFeedbackResult {
  projectId: string;
  pageIds: string[];
  firstPageId: string;
  deckState: TaskRuntimeStateRecord["deckState"];
  pageState: TaskCurrentPageRecord["pageState"];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildAllowedTransitions(
  pageState: TaskCurrentPageRecord["pageState"],
): TaskRuntimeStateRecord["allowedTransitions"] {
  switch (pageState) {
    case "page_selected":
      return ["page_authoring"];
    case "page_authoring":
      return ["page_review"];
    case "page_review":
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
  pageState: TaskCurrentPageRecord["pageState"],
): "page_selected" | "page_authoring_started" | "page_rendered" | "page_reviewed" | "page_fixed" | "page_accepted" | "page_locked" {
  switch (pageState) {
    case "page_selected":
      return "page_selected";
    case "page_authoring":
      return "page_authoring_started";
    case "page_review":
      return "page_rendered";
    case "page_fix_required":
      return "page_fixed";
    case "page_accepted":
      return "page_accepted";
    case "page_locked":
      return "page_locked";
  }
}

function normalizePageProgressState(
  pageState: RecordPageProgressInput["pageState"],
): TaskCurrentPageRecord["pageState"] {
  if (pageState === "page_rendered" || pageState === "page_review_pending") {
    return "page_review";
  }

  return pageState;
}

async function isAllPagesLocked(
  pagePlan: TaskPagePlanRecord | null,
  pageProgress: TaskPageProgressRecord,
): Promise<boolean> {
  if (!pagePlan || pagePlan.pages.length === 0) {
    return false;
  }

  const progressByPageId = new Map(pageProgress.pages.map((page) => [page.pageId, page]));
  return pagePlan.pages.every((page) => progressByPageId.get(page.pageId)?.locked === true);
}

function buildPageProgressFromPlan(
  projectId: string,
  pagePlan: TaskPagePlanRecord | null,
  existing: TaskPageProgressRecord | null,
): TaskPageProgressRecord {
  const now = nowIso();
  const existingByPageId = new Map(existing?.pages.map((page) => [page.pageId, page]) ?? []);
  const pages = pagePlan
    ? pagePlan.pages.map((page): TaskPageProgressItem => {
      const existingPage = existingByPageId.get(page.pageId);
      return {
        pageId: page.pageId,
        pageNumber: page.pageNumber,
        pageState: existingPage?.pageState ?? "page_selected",
        locked: existingPage?.locked ?? false,
        summary: existingPage?.summary,
        reviewNotes: existingPage?.reviewNotes,
        lastRenderedHtmlPath: existingPage?.lastRenderedHtmlPath,
        lastRenderedPngPath: existingPage?.lastRenderedPngPath,
        updatedAt: existingPage?.updatedAt ?? now,
      };
    })
    : [...(existing?.pages ?? [])];

  return {
    projectId,
    updatedAt: now,
    pages,
  };
}

async function readSyncedPageProgress(
  projectDir: string,
  projectId: string,
  pagePlan: TaskPagePlanRecord | null,
): Promise<TaskPageProgressRecord> {
  const existing = await readOptionalPageProgressRecord(projectDir);
  return buildPageProgressFromPlan(projectId, pagePlan, existing);
}

function upsertPageProgressItem(
  record: TaskPageProgressRecord,
  item: TaskPageProgressItem,
): TaskPageProgressRecord {
  const pages = record.pages.filter((page) => page.pageId !== item.pageId);
  pages.push(item);
  pages.sort((left, right) => {
    const leftNumber = left.pageNumber ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.pageNumber ?? Number.MAX_SAFE_INTEGER;
    return leftNumber === rightNumber ? left.pageId.localeCompare(right.pageId) : leftNumber - rightNumber;
  });

  return {
    ...record,
    updatedAt: nowIso(),
    pages,
  };
}

function buildPageStateRecord(
  projectId: string,
  pageId: string,
  pageState: TaskCurrentPageRecord["pageState"],
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

  const pagePlan = await readOptionalPagePlanRecord(input.projectDir);
  const pageProgress = await readSyncedPageProgress(input.projectDir, task.projectId, pagePlan);
  const progressPage = pageProgress.pages.find((page) => page.pageId === input.pageId);
  const pageState = progressPage?.pageState ?? "page_selected";
  const currentPage = buildPageStateRecord(
    task.projectId,
    input.pageId,
    pageState,
    progressPage?.pageNumber ?? input.pageNumber,
    progressPage?.lastRenderedHtmlPath,
    progressPage?.lastRenderedPngPath,
  );
  await writeCurrentPageRecord(input.projectDir, currentPage);
  await writePageProgressRecord(input.projectDir, pageProgress);
  const allPagesLocked = await isAllPagesLocked(pagePlan, pageProgress);

  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt: nowIso(),
    deckState: allPagesLocked && pageState === "page_locked" ? "deck_html_ready" : "page_iteration_active",
    pageState,
    currentPageId: input.pageId,
    blockedBy: pageState === "page_review" ? ["page_png_review"] : [],
    allowedTransitions: buildAllowedTransitions(pageState),
    allPagesLocked,
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
      restoredPageState: pageState,
    },
  });

  return {
    projectId: task.projectId,
    pageId: input.pageId,
    pageState: currentPage.pageState,
    allPagesLocked: nextState.allPagesLocked,
    updatedAt: timestamp,
  };
}

export async function recordPageProgress(
  input: RecordPageProgressInput,
): Promise<PageProgressResult> {
  const pageState = normalizePageProgressState(input.pageState);
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const existingPage = await readOptionalCurrentPageRecord(input.projectDir);
  const existingCurrentPage = existingPage?.pageId === input.pageId ? existingPage : null;
  const pagePlan = await readOptionalPagePlanRecord(input.projectDir);
  const existingProgress = await readSyncedPageProgress(input.projectDir, task.projectId, pagePlan);
  const existingProgressPage = existingProgress.pages.find((page) => page.pageId === input.pageId);
  const timestamp = nowIso();
  const currentPage = {
    ...(existingCurrentPage ?? buildPageStateRecord(task.projectId, input.pageId, pageState)),
    projectId: task.projectId,
    pageId: input.pageId,
    pageNumber: existingProgressPage?.pageNumber ?? existingCurrentPage?.pageNumber,
    pageState,
    updatedAt: timestamp,
    locked: pageState === "page_locked",
    lastRenderedHtmlPath: input.renderedHtmlPath ?? existingCurrentPage?.lastRenderedHtmlPath ?? existingProgressPage?.lastRenderedHtmlPath,
    lastRenderedPngPath: input.renderedPngPath ?? existingCurrentPage?.lastRenderedPngPath ?? existingProgressPage?.lastRenderedPngPath,
  };

  await writeCurrentPageRecord(input.projectDir, currentPage);

  const pageProgress = upsertPageProgressItem(existingProgress, {
    pageId: input.pageId,
    pageNumber: currentPage.pageNumber,
    pageState,
    locked: pageState === "page_locked",
    summary: input.summary,
    reviewNotes: input.reviewNotes ?? existingProgressPage?.reviewNotes,
    lastRenderedHtmlPath: currentPage.lastRenderedHtmlPath,
    lastRenderedPngPath: currentPage.lastRenderedPngPath,
    updatedAt: timestamp,
  });
  await writePageProgressRecord(input.projectDir, pageProgress);

  const allPagesLocked = await isAllPagesLocked(pagePlan, pageProgress);
  const nextDeckState: TaskRuntimeStateRecord["deckState"] =
    allPagesLocked && pageState === "page_locked" ? "deck_html_ready" : "page_iteration_active";

  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt: nowIso(),
    deckState: nextDeckState,
    pageState,
    currentPageId: input.pageId,
    blockedBy:
      pageState === "page_review" ? ["page_png_review"] : [],
    allowedTransitions: buildAllowedTransitions(pageState),
    allPagesLocked,
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: getPageProgressEventType(pageState),
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

export async function recordDeckReviewFeedback(
  input: RecordDeckReviewFeedbackInput,
): Promise<DeckReviewFeedbackResult> {
  if (input.pages.length === 0) {
    throw new Error("At least one page revision is required");
  }

  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const pagePlan = await readOptionalPagePlanRecord(input.projectDir);
  const pageProgress = await readSyncedPageProgress(input.projectDir, task.projectId, pagePlan);
  const pagePlanById = new Map(pagePlan?.pages.map((page) => [page.pageId, page]) ?? []);
  const progressById = new Map(pageProgress.pages.map((page) => [page.pageId, page]));
  const timestamp = nowIso();

  let nextProgress = pageProgress;
  const targetPageIds: string[] = [];
  for (const revision of input.pages) {
    const pageId = revision.pageId.trim();
    if (!pageId) {
      continue;
    }

    const existingProgressPage = progressById.get(pageId);
    const pagePlanItem = pagePlanById.get(pageId);
    if (!existingProgressPage && !pagePlanItem) {
      throw new Error(`page "${pageId}" not found in page-progress.json or page-plan.json`);
    }

    const summary = revision.summary?.trim().length
      ? revision.summary.trim()
      : "用户在整套 deck 审阅中要求返修当前页。";
    const reviewNotes = revision.reviewNotes?.trim().length
      ? revision.reviewNotes.trim()
      : summary;

    nextProgress = upsertPageProgressItem(nextProgress, {
      pageId,
      pageNumber: existingProgressPage?.pageNumber ?? pagePlanItem?.pageNumber,
      pageState: "page_fix_required",
      locked: false,
      summary,
      reviewNotes,
      lastRenderedHtmlPath: existingProgressPage?.lastRenderedHtmlPath,
      lastRenderedPngPath: existingProgressPage?.lastRenderedPngPath,
      updatedAt: timestamp,
    });
    targetPageIds.push(pageId);
  }

  if (targetPageIds.length === 0) {
    throw new Error("At least one page revision must include a page_id");
  }

  await writePageProgressRecord(input.projectDir, nextProgress);

  const firstPage = nextProgress.pages.find((page) => page.pageId === targetPageIds[0]);
  if (!firstPage) {
    throw new Error(`page "${targetPageIds[0]}" not found after deck review feedback update`);
  }

  const currentPage = buildPageStateRecord(
    task.projectId,
    firstPage.pageId,
    "page_fix_required",
    firstPage.pageNumber,
    firstPage.lastRenderedHtmlPath,
    firstPage.lastRenderedPngPath,
  );
  await writeCurrentPageRecord(input.projectDir, currentPage);

  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt: timestamp,
    deckState: "page_iteration_active",
    pageState: "page_fix_required",
    currentPageId: firstPage.pageId,
    blockedBy: [],
    allowedTransitions: buildAllowedTransitions("page_fix_required"),
    allPagesLocked: false,
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "deck_review_feedback_recorded",
    projectId: task.projectId,
    timestamp,
    actor: "user",
    payload: {
      pageIds: targetPageIds,
      pages: input.pages,
      firstPageId: firstPage.pageId,
    },
  });

  return {
    projectId: task.projectId,
    pageIds: targetPageIds,
    firstPageId: firstPage.pageId,
    deckState: nextState.deckState,
    pageState: currentPage.pageState,
    updatedAt: timestamp,
  };
}
