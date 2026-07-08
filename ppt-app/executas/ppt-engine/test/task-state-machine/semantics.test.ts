import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPageProgressFromPlan,
  deriveEffectiveTaskState,
  getTaskRecommendation,
  normalizePageState,
} from "../../src/task-state-machine/semantics/index.ts";
import type {
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskPageProgressRecord,
  TaskRuntimeStateRecord,
} from "../../src/task-state-machine/types.ts";

const NOW = "2026-05-23T00:00:00.000Z";

function baseState(patch: Partial<TaskRuntimeStateRecord> = {}): TaskRuntimeStateRecord {
  return {
    projectId: "ppt-test",
    updatedAt: NOW,
    deckState: "page_iteration_active",
    blockedBy: [],
    allowedTransitions: [],
    allPagesLocked: false,
    recoverable: true,
    ...patch,
  };
}

function pagePlan(): TaskPagePlanRecord {
  return {
    projectId: "ppt-test",
    updatedAt: NOW,
    pages: [
      {
        pageId: "page-1",
        pageNumber: 1,
        title: "第一阶段",
        goal: "说明问题",
        coreMessage: "问题明确",
      },
      {
        pageId: "page-2",
        pageNumber: 2,
        title: "第二阶段",
        goal: "说明方案",
        coreMessage: "方案明确",
      },
    ],
  };
}

test("normalizePageState accepts legacy rendered review states", () => {
  assert.equal(normalizePageState("page_rendered"), "page_review");
  assert.equal(normalizePageState("page_review_pending"), "page_review");
  assert.equal(normalizePageState("page_authoring"), "page_authoring");
  assert.equal(normalizePageState("not-a-state"), undefined);
});

test("buildPageProgressFromPlan fills missing pages and preserves existing progress", () => {
  const existing: TaskPageProgressRecord = {
    projectId: "ppt-test",
    updatedAt: "old",
    pages: [
      {
        pageId: "page-2",
        pageNumber: 2,
        pageState: "page_review",
        locked: false,
        summary: "已渲染",
        reviewNotes: "待审查",
        lastRenderedPngPath: "/tmp/page-2.png",
        updatedAt: "old",
      },
    ],
  };

  const progress = buildPageProgressFromPlan({
    projectId: "ppt-test",
    pagePlan: pagePlan(),
    existing,
    now: NOW,
  });

  assert.deepEqual(progress.pages.map((page) => page.pageId), ["page-1", "page-2"]);
  assert.equal(progress.pages[0].pageState, "page_selected");
  assert.equal(progress.pages[1].pageState, "page_review");
  assert.equal(progress.pages[1].summary, "已渲染");
  assert.equal(progress.pages[1].lastRenderedPngPath, "/tmp/page-2.png");
});

test("deriveEffectiveTaskState centralizes page review blockers and transitions", () => {
  const currentPage: TaskCurrentPageRecord = {
    projectId: "ppt-test",
    updatedAt: NOW,
    pageId: "page-1",
    pageNumber: 1,
    pageState: "page_review",
    locked: false,
    lastRenderedPngPath: "/tmp/page-1.png",
  };
  const progress = buildPageProgressFromPlan({
    projectId: "ppt-test",
    pagePlan: pagePlan(),
    existing: null,
    currentPage,
    now: NOW,
  });

  const effective = deriveEffectiveTaskState({
    projectDir: "/tmp/ppt-test",
    state: baseState({ allowedTransitions: ["page_authoring"] }),
    currentPage,
    pagePlan: pagePlan(),
    pageProgress: progress,
  });

  assert.equal(effective.state.pageState, "page_review");
  assert.deepEqual(effective.allowedOperations, ["page_accepted", "page_fix_required"]);
  assert.deepEqual(effective.blockedBy, ["page_png_review"]);
});

test("deriveEffectiveTaskState lifts fully locked page progress to deck_html_ready", () => {
  const progress: TaskPageProgressRecord = {
    projectId: "ppt-test",
    updatedAt: NOW,
    pages: pagePlan().pages.map((page) => ({
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      pageState: "page_locked",
      locked: true,
      updatedAt: NOW,
    })),
  };

  const effective = deriveEffectiveTaskState({
    projectDir: "/tmp/ppt-test",
    state: baseState({ pageState: "page_locked", currentPageId: "page-2" }),
    currentPage: {
      projectId: "ppt-test",
      updatedAt: NOW,
      pageId: "page-2",
      pageNumber: 2,
      pageState: "page_locked",
      locked: true,
    },
    pagePlan: pagePlan(),
    pageProgress: progress,
  });

  assert.equal(effective.state.deckState, "deck_html_ready");
  assert.equal(effective.state.allPagesLocked, true);
});

test("getTaskRecommendation covers deck and page state recommendations", () => {
  const collectRequirements = getTaskRecommendation({
    projectDir: "/tmp/ppt-test",
    state: baseState({ deckState: "project_ready", allowedTransitions: ["requirements_collected"] }),
    currentPage: null,
    pagePlan: null,
    pageProgress: null,
    requirements: null,
  });
  assert.equal(collectRequirements.recommendedAction.type, "collect_requirements");
  assert.deepEqual(collectRequirements.requiredInputs, [
    "requirements.topic",
    "requirements.audience",
    "requirements.scenario",
    "requirements.pageCount",
  ]);

  const reviewPage = getTaskRecommendation({
    projectDir: "/tmp/ppt-test",
    state: baseState({ pageState: "page_review" }),
    currentPage: {
      projectId: "ppt-test",
      updatedAt: NOW,
      pageId: "page-1",
      pageNumber: 1,
      pageState: "page_review",
      locked: false,
    },
    pagePlan: pagePlan(),
    pageProgress: null,
    requirements: null,
  });
  assert.equal(reviewPage.recommendedAction.type, "review_page_png");
  assert.deepEqual(reviewPage.allowedOperations, ["page_accepted", "page_fix_required"]);

  const failed = getTaskRecommendation({
    projectDir: "/tmp/ppt-test",
    state: baseState({ deckState: "failed", blockedBy: ["manual_recovery"] }),
    currentPage: null,
    pagePlan: null,
    pageProgress: null,
    requirements: null,
  });
  assert.equal(failed.recommendedAction.type, "recover_from_failure");
  assert.deepEqual(failed.requiredInputs, ["recovery_decision"]);
});
