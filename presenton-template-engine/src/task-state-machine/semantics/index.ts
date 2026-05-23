import path from "node:path";

import type {
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskPageProgressItem,
  TaskPageProgressRecord,
  TaskRequirementsRecord,
  TaskRuntimeStateRecord,
  TaskStateMachineEventType,
  TaskStateMachinePageState,
} from "../types.js";

export type LegacyTaskPageProgressState =
  | TaskStateMachinePageState
  | "page_rendered"
  | "page_review_pending";

export interface TaskRecommendedAction {
  type:
    | "collect_requirements"
    | "select_template_group"
    | "fork_template_group"
    | "write_outline"
    | "start_page_authoring"
    | "author_current_page"
    | "render_current_page"
    | "review_page_png"
    | "fix_current_page"
    | "lock_current_page"
    | "render_full_deck_html"
    | "request_deck_html_approval"
    | "convert_deck_html_to_model"
    | "generate_pptx"
    | "complete_task"
    | "recover_from_failure";
  summary: string;
  requiresUserInput: boolean;
}

export interface TaskStateSemanticsInput {
  projectDir: string;
  state: TaskRuntimeStateRecord;
  currentPage: TaskCurrentPageRecord | null;
  pagePlan: TaskPagePlanRecord | null;
  pageProgress: TaskPageProgressRecord | null;
}

export interface EffectiveTaskStateResult {
  state: TaskRuntimeStateRecord;
  blockedBy: string[];
  allowedOperations: Array<TaskRuntimeStateRecord["allowedTransitions"][number]>;
}

export interface TaskRecommendationInput extends TaskStateSemanticsInput {
  requirements: TaskRequirementsRecord | null;
}

export interface TaskRecommendationResult {
  recommendedAction: TaskRecommendedAction;
  requiredInputs: string[];
  expectedArtifacts: string[];
  allowedOperations: Array<TaskRuntimeStateRecord["allowedTransitions"][number]>;
  blockedBy: string[];
  effectiveState: TaskRuntimeStateRecord;
}

export function normalizePageState(
  pageState: LegacyTaskPageProgressState | string | undefined,
): TaskStateMachinePageState | undefined {
  if (pageState === "page_rendered" || pageState === "page_review_pending") {
    return "page_review";
  }

  if (
    pageState === "page_selected"
    || pageState === "page_authoring"
    || pageState === "page_review"
    || pageState === "page_fix_required"
    || pageState === "page_accepted"
    || pageState === "page_locked"
  ) {
    return pageState;
  }

  return undefined;
}

export function buildAllowedTransitionsForPageState(
  pageState: TaskStateMachinePageState | undefined,
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
    default:
      return ["page_authoring"];
  }
}

export function getPageProgressEventType(
  pageState: TaskStateMachinePageState,
): Extract<
  TaskStateMachineEventType,
  | "page_selected"
  | "page_authoring_started"
  | "page_rendered"
  | "page_fixed"
  | "page_accepted"
  | "page_locked"
> {
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

export function buildPageProgressFromPlan(input: {
  projectId: string;
  pagePlan: TaskPagePlanRecord | null;
  existing: TaskPageProgressRecord | null;
  currentPage?: TaskCurrentPageRecord | null;
  now: string;
}): TaskPageProgressRecord {
  const existingByPageId = new Map(
    input.existing?.pages.map((page) => [page.pageId, page]) ?? [],
  );
  const currentPage = input.currentPage ?? null;
  const pages = input.pagePlan
    ? input.pagePlan.pages.map((page): TaskPageProgressItem => {
      const existingPage = existingByPageId.get(page.pageId);
      const current = currentPage?.pageId === page.pageId ? currentPage : null;
      const pageState = normalizePageState(current?.pageState ?? existingPage?.pageState)
        ?? "page_selected";

      return {
        pageId: page.pageId,
        pageNumber: page.pageNumber,
        pageState,
        locked: current?.locked ?? existingPage?.locked ?? pageState === "page_locked",
        summary: existingPage?.summary,
        reviewNotes: existingPage?.reviewNotes,
        lastRenderedHtmlPath: current?.lastRenderedHtmlPath ?? existingPage?.lastRenderedHtmlPath,
        lastRenderedPngPath: current?.lastRenderedPngPath ?? existingPage?.lastRenderedPngPath,
        updatedAt: current?.updatedAt ?? existingPage?.updatedAt ?? input.now,
      };
    })
    : [...(input.existing?.pages ?? [])];

  return {
    projectId: input.projectId,
    updatedAt: input.now,
    pages: sortPageProgressItems(pages),
  };
}

export function sortPageProgressItems(
  pages: TaskPageProgressItem[],
): TaskPageProgressItem[] {
  return [...pages].sort((left, right) => {
    const leftNumber = left.pageNumber ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.pageNumber ?? Number.MAX_SAFE_INTEGER;
    return leftNumber === rightNumber
      ? left.pageId.localeCompare(right.pageId)
      : leftNumber - rightNumber;
  });
}

export function upsertPageProgressItem(
  record: TaskPageProgressRecord,
  item: TaskPageProgressItem,
  now: string,
): TaskPageProgressRecord {
  return {
    ...record,
    updatedAt: now,
    pages: sortPageProgressItems([
      ...record.pages.filter((page) => page.pageId !== item.pageId),
      item,
    ]),
  };
}

export function computeAllPagesLocked(
  pagePlan: TaskPagePlanRecord | null,
  pageProgress: TaskPageProgressRecord | null,
): boolean {
  if (!pagePlan || pagePlan.pages.length === 0 || !pageProgress) {
    return false;
  }

  const progressByPageId = new Map(pageProgress.pages.map((page) => [page.pageId, page]));
  return pagePlan.pages.every((page) => progressByPageId.get(page.pageId)?.locked === true);
}

export function buildCurrentPageRecord(input: {
  projectId: string;
  pageId: string;
  pageState: TaskStateMachinePageState;
  now: string;
  pageNumber?: number;
  renderedHtmlPath?: string;
  renderedPngPath?: string;
}): TaskCurrentPageRecord {
  return {
    projectId: input.projectId,
    updatedAt: input.now,
    pageId: input.pageId,
    pageNumber: input.pageNumber,
    pageState: input.pageState,
    locked: input.pageState === "page_locked",
    lastRenderedHtmlPath: input.renderedHtmlPath,
    lastRenderedPngPath: input.renderedPngPath,
  };
}

export function buildRuntimeStateForPage(input: {
  state: TaskRuntimeStateRecord;
  pageId: string;
  pageState: TaskStateMachinePageState;
  allPagesLocked: boolean;
  now: string;
}): TaskRuntimeStateRecord {
  return {
    ...input.state,
    updatedAt: input.now,
    deckState:
      input.allPagesLocked && input.pageState === "page_locked"
        ? "deck_html_ready"
        : "page_iteration_active",
    pageState: input.pageState,
    currentPageId: input.pageId,
    blockedBy: input.pageState === "page_review" ? ["page_png_review"] : [],
    allowedTransitions: buildAllowedTransitionsForPageState(input.pageState),
    allPagesLocked: input.allPagesLocked,
    recoverable: true,
  };
}

export function getEffectivePageState(
  input: Pick<TaskStateSemanticsInput, "state" | "currentPage">,
): TaskStateMachinePageState | undefined {
  return normalizePageState(input.currentPage?.pageState ?? input.state.pageState);
}

export function deriveEffectiveTaskState(
  input: TaskStateSemanticsInput,
): EffectiveTaskStateResult {
  const pageState = getEffectivePageState(input);
  const allPagesLocked = computeAllPagesLocked(input.pagePlan, input.pageProgress);
  const currentPageId = input.currentPage?.pageId ?? input.state.currentPageId;
  const deckState =
    input.state.deckState === "page_iteration_active" && allPagesLocked
      ? "deck_html_ready"
      : input.state.deckState;
  const blockedBy =
    deckState === "failed" || !input.state.recoverable
      ? input.state.blockedBy
      : pageState === "page_review"
        ? ["page_png_review"]
        : input.state.blockedBy.filter((item) => item !== "page_png_review");
  const allowedOperations =
    deckState === "page_iteration_active"
      ? buildAllowedTransitionsForPageState(pageState)
      : normalizeAllowedTransitions(input.state.allowedTransitions);
  const state: TaskRuntimeStateRecord = {
    ...input.state,
    deckState,
    pageState: pageState ?? input.state.pageState,
    currentPageId,
    blockedBy,
    allowedTransitions: allowedOperations,
    allPagesLocked,
  };

  return {
    state,
    blockedBy,
    allowedOperations,
  };
}

function normalizeAllowedTransitions(
  allowedTransitions: TaskRuntimeStateRecord["allowedTransitions"],
): TaskRuntimeStateRecord["allowedTransitions"] {
  return allowedTransitions.map((operation) => {
    const normalized = normalizePageState(String(operation));
    return normalized ?? operation;
  });
}

export function getDefaultRecommendedAction(
  input: TaskStateSemanticsInput,
): TaskRecommendedAction {
  const effective = deriveEffectiveTaskState(input);
  const { state } = effective;

  switch (state.deckState) {
    case "initialized":
      return {
        type: "collect_requirements",
        summary: "先阅读 promote/current.md，再收集并确认用户需求。",
        requiresUserInput: true,
      };
    case "project_ready":
      return {
        type: "collect_requirements",
        summary: "先阅读 promote/current.md，继续收集并确认需求。",
        requiresUserInput: true,
      };
    case "requirements_collected":
      return {
        type: "select_template_group",
        summary: "先阅读 promote/current.md，再列出全部可用模板组，让用户确认使用哪一组。",
        requiresUserInput: true,
      };
    case "template_selected":
      return {
        type: "fork_template_group",
        summary: "先阅读 promote/current.md，然后 fork 已选模板组到任务目录。",
        requiresUserInput: false,
      };
    case "project_forked":
      return {
        type: "write_outline",
        summary: "先阅读 promote/current.md，再写内容大纲。",
        requiresUserInput: true,
      };
    case "outline_ready":
    case "page_plan_ready":
      return {
        type: "start_page_authoring",
        summary: "先阅读 promote/current.md，再开始逐页实现。",
        requiresUserInput: false,
      };
    case "page_iteration_active":
      return getPageIterationRecommendedAction(state.pageState);
    case "deck_html_ready":
      return {
        type: "render_full_deck_html",
        summary: "先阅读 promote/current.md，再生成整套 deck HTML；生成成功后进入用户审阅阶段。",
        requiresUserInput: false,
      };
    case "deck_review_pending":
      return {
        type: "request_deck_html_approval",
        summary: "先阅读 promote/current.md，再让用户审阅整套 deck HTML；确认通过则进入 deck_reviewed，需要修改则回到页面流程。",
        requiresUserInput: true,
      };
    case "deck_reviewed":
      return {
        type: "convert_deck_html_to_model",
        summary: "先阅读 promote/current.md，再将 HTML 转成 PPT 模型。",
        requiresUserInput: false,
      };
    case "model_ready":
      return {
        type: "generate_pptx",
        summary: "先阅读 promote/current.md，再生成最终 PPTX。",
        requiresUserInput: false,
      };
    case "pptx_ready":
    case "completed":
      return {
        type: "complete_task",
        summary: "先阅读 promote/current.md，再完成任务归档。",
        requiresUserInput: false,
      };
    case "failed":
      return {
        type: "recover_from_failure",
        summary: "先阅读 promote/current.md，再从失败状态恢复。",
        requiresUserInput: true,
      };
    default:
      return {
        type: "complete_task",
        summary: "先阅读 promote/current.md，再继续处理任务。",
        requiresUserInput: false,
      };
  }
}

function getPageIterationRecommendedAction(
  pageState: TaskStateMachinePageState | undefined,
): TaskRecommendedAction {
  switch (pageState) {
    case "page_selected":
      return {
        type: "author_current_page",
        summary: "先阅读 promote/current.md 和当前页作业单，完成当前页 TSX、data 和 manifest 的初始实现；完成后记录 page_authoring。",
        requiresUserInput: false,
      };
    case "page_authoring":
      return {
        type: "render_current_page",
        summary: "先阅读 promote/current.md，再用当前页的 TSX 和 data 生成单页 HTML 与 PNG；成功后进入 page_review。",
        requiresUserInput: false,
      };
    case "page_review":
      return {
        type: "review_page_png",
        summary: "先阅读 promote/current.md，基于当前页 PNG 做截图审查；通过则记录 page_accepted，发现问题则记录 page_fix_required。",
        requiresUserInput: false,
      };
    case "page_fix_required":
      return {
        type: "fix_current_page",
        summary: "先阅读 promote/current.md 和 review_notes，修复当前页 TSX、data 或 manifest；修复完成后回到 page_authoring 再重新渲染。",
        requiresUserInput: false,
      };
    case "page_accepted":
      return {
        type: "lock_current_page",
        summary: "先阅读 promote/current.md，确认当前页通过自审后锁定当前页。",
        requiresUserInput: false,
      };
    case "page_locked":
      return {
        type: "start_page_authoring",
        summary: "当前页已锁定，先阅读 promote/current.md，然后切换到下一页继续逐页实现。",
        requiresUserInput: false,
      };
    default:
      return {
        type: "author_current_page",
        summary: "先阅读 promote/current.md，再继续当前页的实现、渲染和自审闭环。",
        requiresUserInput: false,
      };
  }
}

export function getRequiredInputs(
  input: TaskStateSemanticsInput,
  recommendedAction: TaskRecommendedAction,
  requirements: TaskRequirementsRecord | null,
): string[] {
  if (recommendedAction.type === "collect_requirements") {
    const requirementFields = [
      "requirements.topic",
      "requirements.audience",
      "requirements.scenario",
      "requirements.pageCount",
    ];

    if (!requirements) {
      return requirementFields;
    }

    const payload = requirements.requirements;
    const missing: string[] = [];
    if (!payload.topic?.trim()) missing.push("requirements.topic");
    if (!payload.audience?.trim()) missing.push("requirements.audience");
    if (!payload.scenario?.trim()) missing.push("requirements.scenario");
    if (!Number.isInteger(payload.pageCount) || payload.pageCount <= 0) {
      missing.push("requirements.pageCount");
    }
    return missing.length > 0 ? missing : requirementFields;
  }

  if (recommendedAction.type === "select_template_group") {
    return ["template_group"];
  }

  if (recommendedAction.type === "write_outline") {
    return ["outline.narrative", "outline.sections", "outline.pages"];
  }

  if (recommendedAction.type === "author_current_page") {
    return input.currentPage ? [] : ["current_page"];
  }

  if (recommendedAction.type === "start_page_authoring") {
    if (input.currentPage || input.pagePlan?.pages.length) {
      return [];
    }

    return ["current_page"];
  }

  if (recommendedAction.type === "review_page_png") {
    return input.currentPage ? ["page_png_review_result"] : ["current_page"];
  }

  if (recommendedAction.type === "recover_from_failure") {
    return ["recovery_decision"];
  }

  return recommendedAction.requiresUserInput ? ["user_confirmation"] : [];
}

export function getExpectedArtifacts(
  input: TaskStateSemanticsInput,
  recommendedAction: TaskRecommendedAction,
): string[] {
  const pageId = input.currentPage?.pageId;

  switch (recommendedAction.type) {
    case "collect_requirements":
      return [path.join(input.projectDir, "task-state", "requirements.json")];
    case "write_outline":
      return [path.join(input.projectDir, "task-state", "outline.json")];
    case "start_page_authoring":
    case "render_current_page":
    case "review_page_png":
    case "fix_current_page":
    case "lock_current_page":
      return pageId
        ? [path.join(input.projectDir, "output", "screenshots", `${pageId}.png`)]
        : [];
    case "render_full_deck_html":
    case "request_deck_html_approval":
      return [path.join(input.projectDir, "output", "deck.html")];
    case "convert_deck_html_to_model":
      return [path.join(input.projectDir, "output", "ppt-model.json")];
    case "generate_pptx":
      return [path.join(input.projectDir, "output", "deck.pptx")];
    default:
      return [];
  }
}

export function getTaskRecommendation(
  input: TaskRecommendationInput,
): TaskRecommendationResult {
  const effective = deriveEffectiveTaskState(input);
  const effectiveInput = {
    ...input,
    state: effective.state,
  };
  const recommendedAction = getDefaultRecommendedAction(effectiveInput);
  return {
    recommendedAction,
    requiredInputs: getRequiredInputs(effectiveInput, recommendedAction, input.requirements),
    expectedArtifacts: getExpectedArtifacts(effectiveInput, recommendedAction),
    allowedOperations: effective.allowedOperations,
    blockedBy: effective.blockedBy,
    effectiveState: effective.state,
  };
}
