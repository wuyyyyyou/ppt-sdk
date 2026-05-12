import path from "node:path";

import {
  listDiscoveredTemplateGroupSummaries,
  type DiscoveredTemplateGroupSummaryInfo,
} from "../../discovery/index.js";
import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskPromoteDocumentReference,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import type { OpenTaskProjectResult } from "./project.js";
import { ensureTaskPromoteDocument } from "../promote/index.js";
import { readOptionalRequirementsRecord } from "../storage/records.js";

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
  promote: TaskPromoteDocumentReference;
  promotePath: string;
  promoteKind: TaskPromoteDocumentReference["kind"];
  promoteVersion: string;
  promoteFreshness: TaskPromoteDocumentReference["freshness"];
  promoteEntryPath: string;
  availableTemplateGroups?: DiscoveredTemplateGroupSummaryInfo[];
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

function getDefaultRecommendedAction(result: OpenTaskProjectResult): TaskRecommendedAction {
  const { state, currentPage } = result;

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
      return { type: "write_outline", summary: "先阅读 promote/current.md，再写内容大纲。", requiresUserInput: true };
    case "outline_ready":
      return { type: "start_page_authoring", summary: "先阅读 promote/current.md，再直接开始第一页的精细生成。", requiresUserInput: false };
    case "page_plan_ready":
      return { type: "start_page_authoring", summary: "先阅读 promote/current.md，再开始逐页实现。", requiresUserInput: false };
    case "page_iteration_active":
      switch (currentPage?.pageState) {
        case "page_selected":
          return {
            type: "author_current_page",
            summary: "先阅读 promote/current.md 和当前页作业单，完成当前页 TSX、data 和 manifest 的初始实现；完成后记录 page_authoring。",
            requiresUserInput: false,
          };
        case "page_authoring":
          return {
            type: "render_current_page",
            summary: "先阅读 promote/current.md，再用当前页的 TSX 和 data 生成单页 HTML 与 PNG。",
            requiresUserInput: false,
          };
        case "page_rendered":
          return {
            type: "review_page_png",
            summary: "先阅读 promote/current.md，再打开当前页 PNG 进行自审；通过则记录 page_review_pending 并继续判断是否 page_accepted，发现问题则记录 page_fix_required。",
            requiresUserInput: false,
          };
        case "page_review_pending":
          return {
            type: "review_page_png",
            summary: "先阅读 promote/current.md，基于当前页 PNG 做最终审查；通过则记录 page_accepted，发现问题则记录 page_fix_required。",
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
    case "deck_html_ready":
      return { type: "request_deck_html_approval", summary: "先阅读 promote/current.md，再请求用户确认整套 HTML。", requiresUserInput: true };
    case "deck_review_pending":
      return { type: "review_page_png", summary: "先阅读 promote/current.md，再等待 deck HTML 审阅结果。", requiresUserInput: true };
    case "deck_reviewed":
      return { type: "convert_deck_html_to_model", summary: "先阅读 promote/current.md，再将 HTML 转成 PPT 模型。", requiresUserInput: false };
    case "model_ready":
      return { type: "generate_pptx", summary: "先阅读 promote/current.md，再生成最终 PPTX。", requiresUserInput: false };
    case "pptx_ready":
      return { type: "complete_task", summary: "先阅读 promote/current.md，再完成任务归档。", requiresUserInput: false };
    case "completed":
      return { type: "complete_task", summary: "任务已完成，可先阅读 promote/current.md 复核历史。", requiresUserInput: false };
    case "failed":
      return { type: "recover_from_failure", summary: "先阅读 promote/current.md，再从失败状态恢复。", requiresUserInput: true };
    default:
      return { type: "complete_task", summary: "先阅读 promote/current.md，再继续处理任务。", requiresUserInput: false };
  }
}

function getRequiredInputs(
  result: OpenTaskProjectResult,
  recommendedAction: TaskRecommendedAction,
  requirements: Awaited<ReturnType<typeof readOptionalRequirementsRecord>>,
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
    if (!Number.isInteger(payload.pageCount) || payload.pageCount <= 0) missing.push("requirements.pageCount");
    return missing.length > 0 ? missing : requirementFields;
  }

  if (recommendedAction.type === "select_template_group") {
    return ["template_group"];
  }

  if (recommendedAction.type === "write_outline") {
    return ["outline.narrative", "outline.sections", "outline.pages"];
  }

  if (recommendedAction.type === "author_current_page") {
    return result.currentPage ? [] : ["current_page"];
  }

  if (recommendedAction.type === "start_page_authoring") {
    if (result.currentPage) {
      return [];
    }

    return result.pagePlan?.pages.length ? [] : ["current_page"];
  }

  if (recommendedAction.type === "review_page_png") {
    return result.currentPage ? ["page_png_review_result"] : ["current_page"];
  }

  if (recommendedAction.type === "recover_from_failure") {
    return ["recovery_decision"];
  }

  return recommendedAction.requiresUserInput ? ["user_confirmation"] : [];
}

function getExpectedArtifacts(
  result: OpenTaskProjectResult,
  recommendedAction: TaskRecommendedAction,
): string[] {
  const projectDir = result.projectDir;
  const pageId = result.currentPage?.pageId;

  switch (recommendedAction.type) {
    case "collect_requirements":
      return [path.join(projectDir, "task-state", "requirements.json")];
    case "write_outline":
      return [path.join(projectDir, "task-state", "outline.json")];
    case "start_page_authoring":
    case "render_current_page":
    case "review_page_png":
    case "fix_current_page":
    case "lock_current_page":
      return pageId
        ? [path.join(projectDir, "output", "screenshots", `${pageId}.png`)]
        : [];
    case "request_deck_html_approval":
      return [path.join(projectDir, "output", "deck.html")];
    case "convert_deck_html_to_model":
      return [path.join(projectDir, "output", "ppt-model.json")];
    case "generate_pptx":
      return [path.join(projectDir, "output", "deck.pptx")];
    default:
      return [];
  }
}

export async function getRecommendedActionResult(
  result: OpenTaskProjectResult,
): Promise<RecommendedActionResult> {
  const recommendedAction = getDefaultRecommendedAction(result);
  const requirements = await readOptionalRequirementsRecord(result.projectDir);
  const requiredInputs = getRequiredInputs(result, recommendedAction, requirements);
  const expectedArtifacts = getExpectedArtifacts(result, recommendedAction);
  const availableTemplateGroups = recommendedAction.type === "select_template_group"
    ? await listDiscoveredTemplateGroupSummaries({ include_builtin: true })
    : undefined;
  const promote = await ensureTaskPromoteDocument(result, {
    type: recommendedAction.type,
    summary: recommendedAction.summary,
    requiredInputs,
    expectedArtifacts,
    allowedOperations: result.state.allowedTransitions,
    availableTemplateGroups,
  });
  return {
    deckState: result.state.deckState,
    pageState: result.state.pageState,
    recommendedAction,
    blockedBy: result.state.blockedBy,
    requiredInputs,
    expectedArtifacts,
    allowedOperations: result.state.allowedTransitions,
    agentInstruction: `先阅读 ${promote.entryPath}，再按 ${promote.path} 中的步骤执行。`,
    promote,
    promotePath: promote.path,
    promoteKind: promote.kind,
    promoteVersion: promote.version,
    promoteFreshness: promote.freshness,
    promoteEntryPath: promote.entryPath,
    availableTemplateGroups,
  };
}
