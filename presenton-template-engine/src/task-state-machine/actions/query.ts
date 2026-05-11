import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import type { OpenTaskProjectResult } from "./project.js";

export interface TaskRecommendedAction {
  type:
    | "collect_requirements"
    | "select_template_group"
    | "fork_template_group"
    | "write_outline"
    | "write_page_plan"
    | "start_page_authoring"
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

export interface TaskStateSnapshot {
  task: TaskStateRecord;
  state: TaskRuntimeStateRecord;
  currentPage: TaskCurrentPageRecord | null;
  pagePlan: TaskPagePlanRecord | null;
  artifacts: TaskArtifactIndexRecord | null;
}

export interface TaskStateQueryResult extends TaskStateSnapshot {
  blockedBy: string[];
  allowedTransitions: Array<string>;
}

export interface RecommendedActionResult {
  deckState: TaskRuntimeStateRecord["deckState"];
  pageState?: TaskRuntimeStateRecord["pageState"];
  recommendedAction: TaskRecommendedAction;
  blockedBy: string[];
  requiredInputs: string[];
  expectedArtifacts: string[];
  allowedOperations: string[];
  agentInstruction: string;
}

export function buildTaskStateSnapshot(result: OpenTaskProjectResult): TaskStateSnapshot {
  return {
    task: result.task,
    state: result.state,
    currentPage: result.currentPage,
    pagePlan: result.pagePlan,
    artifacts: result.artifacts,
  };
}

export function getTaskStateQueryResult(result: OpenTaskProjectResult): TaskStateQueryResult {
  return {
    ...buildTaskStateSnapshot(result),
    blockedBy: result.state.blockedBy,
    allowedTransitions: result.state.allowedTransitions,
  };
}

function getDefaultRecommendedAction(deckState: TaskRuntimeStateRecord["deckState"]): TaskRecommendedAction {
  switch (deckState) {
    case "initialized":
      return { type: "collect_requirements", summary: "先收集用户需求。", requiresUserInput: true };
    case "project_ready":
      return { type: "collect_requirements", summary: "继续收集并确认需求。", requiresUserInput: true };
    case "requirements_collected":
      return { type: "select_template_group", summary: "选择内部模板组。", requiresUserInput: true };
    case "template_selected":
      return { type: "fork_template_group", summary: "fork 模板组到任务目录。", requiresUserInput: false };
    case "project_forked":
      return { type: "write_outline", summary: "先写内容大纲。", requiresUserInput: true };
    case "outline_ready":
      return { type: "write_page_plan", summary: "生成页面实现计划。", requiresUserInput: false };
    case "page_plan_ready":
      return { type: "start_page_authoring", summary: "开始逐页实现。", requiresUserInput: false };
    case "page_iteration_active":
      return { type: "render_current_page", summary: "对当前页进行单页渲染。", requiresUserInput: false };
    case "deck_html_ready":
      return { type: "request_deck_html_approval", summary: "请求用户确认整套 HTML。", requiresUserInput: true };
    case "deck_review_pending":
      return { type: "review_page_png", summary: "等待 deck HTML 审阅结果。", requiresUserInput: true };
    case "deck_reviewed":
      return { type: "convert_deck_html_to_model", summary: "将 HTML 转成 PPT 模型。", requiresUserInput: false };
    case "model_ready":
      return { type: "generate_pptx", summary: "生成最终 PPTX。", requiresUserInput: false };
    case "pptx_ready":
      return { type: "complete_task", summary: "任务完成并归档。", requiresUserInput: false };
    case "completed":
      return { type: "complete_task", summary: "任务已完成。", requiresUserInput: false };
    case "failed":
      return { type: "recover_from_failure", summary: "从失败状态恢复。", requiresUserInput: true };
  }
}

export function getRecommendedActionResult(
  result: OpenTaskProjectResult,
): RecommendedActionResult {
  const recommendedAction = getDefaultRecommendedAction(result.state.deckState);
  return {
    deckState: result.state.deckState,
    pageState: result.state.pageState,
    recommendedAction,
    blockedBy: result.state.blockedBy,
    requiredInputs: recommendedAction.requiresUserInput ? ["user_confirmation"] : [],
    expectedArtifacts: [],
    allowedOperations: result.state.allowedTransitions,
    agentInstruction: recommendedAction.summary,
  };
}

