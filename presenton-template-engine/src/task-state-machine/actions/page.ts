import { randomUUID } from "node:crypto";

import type {
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
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
import {
  buildCurrentPageRecord as buildSemanticCurrentPageRecord,
  buildPageProgressFromPlan as syncPageProgressFromPlan,
  buildRuntimeStateForPage,
  computeAllPagesLocked,
  getPageProgressEventType as getSemanticPageProgressEventType,
  normalizePageState,
  upsertPageProgressItem as upsertSemanticPageProgressItem,
  type LegacyTaskPageProgressState,
} from "../semantics/index.js";

export interface StartPageIterationInput {
  projectDir: string;
  pageId: string;
  pageNumber?: number;
}

export interface RecordPageProgressInput {
  projectDir: string;
  pageId: string;
  pageState: LegacyTaskPageProgressState;
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

function normalizePageProgressState(
  pageState: RecordPageProgressInput["pageState"],
): TaskCurrentPageRecord["pageState"] {
  const normalized = normalizePageState(pageState);
  if (!normalized) {
    throw new Error(`Unsupported page state: ${pageState}`);
  }

  return normalized;
}

async function readSyncedPageProgress(
  projectDir: string,
  projectId: string,
  pagePlan: TaskPagePlanRecord | null,
): Promise<TaskPageProgressRecord> {
  const existing = await readOptionalPageProgressRecord(projectDir);
  return syncPageProgressFromPlan({
    projectId,
    pagePlan,
    existing,
    now: nowIso(),
  });
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
  const currentPage = buildSemanticCurrentPageRecord({
    projectId: task.projectId,
    pageId: input.pageId,
    pageState,
    pageNumber: progressPage?.pageNumber ?? input.pageNumber,
    renderedHtmlPath: progressPage?.lastRenderedHtmlPath,
    renderedPngPath: progressPage?.lastRenderedPngPath,
    now: nowIso(),
  });
  await writeCurrentPageRecord(input.projectDir, currentPage);
  await writePageProgressRecord(input.projectDir, pageProgress);
  const allPagesLocked = computeAllPagesLocked(pagePlan, pageProgress);

  const nextState = buildRuntimeStateForPage({
    state,
    now: nowIso(),
    pageId: input.pageId,
    pageState,
    allPagesLocked,
  });
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
    ...(existingCurrentPage ?? buildSemanticCurrentPageRecord({
      projectId: task.projectId,
      pageId: input.pageId,
      pageState,
      now: timestamp,
    })),
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

  const pageProgress = upsertSemanticPageProgressItem(existingProgress, {
    pageId: input.pageId,
    pageNumber: currentPage.pageNumber,
    pageState,
    locked: pageState === "page_locked",
    summary: input.summary,
    reviewNotes: input.reviewNotes ?? existingProgressPage?.reviewNotes,
    lastRenderedHtmlPath: currentPage.lastRenderedHtmlPath,
    lastRenderedPngPath: currentPage.lastRenderedPngPath,
    updatedAt: timestamp,
  }, timestamp);
  await writePageProgressRecord(input.projectDir, pageProgress);

  const allPagesLocked = computeAllPagesLocked(pagePlan, pageProgress);
  const nextState = buildRuntimeStateForPage({
    state,
    now: nowIso(),
    pageId: input.pageId,
    pageState,
    allPagesLocked,
  });
  await writeStateRecord(input.projectDir, nextState);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: getSemanticPageProgressEventType(pageState),
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

    nextProgress = upsertSemanticPageProgressItem(nextProgress, {
      pageId,
      pageNumber: existingProgressPage?.pageNumber ?? pagePlanItem?.pageNumber,
      pageState: "page_fix_required",
      locked: false,
      summary,
      reviewNotes,
      lastRenderedHtmlPath: existingProgressPage?.lastRenderedHtmlPath,
      lastRenderedPngPath: existingProgressPage?.lastRenderedPngPath,
      updatedAt: timestamp,
    }, timestamp);
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

  const currentPage = buildSemanticCurrentPageRecord({
    projectId: task.projectId,
    pageId: firstPage.pageId,
    pageState: "page_fix_required",
    pageNumber: firstPage.pageNumber,
    renderedHtmlPath: firstPage.lastRenderedHtmlPath,
    renderedPngPath: firstPage.lastRenderedPngPath,
    now: timestamp,
  });
  await writeCurrentPageRecord(input.projectDir, currentPage);

  const nextState = buildRuntimeStateForPage({
    state,
    now: timestamp,
    pageId: firstPage.pageId,
    pageState: "page_fix_required",
    allPagesLocked: false,
  });
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
