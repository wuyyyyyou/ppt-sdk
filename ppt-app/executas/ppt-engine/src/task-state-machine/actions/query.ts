import {
  listDiscoveredTemplateGroupSummaries,
  type DiscoveredTemplateGroupSummaryInfo,
} from "../../discovery/index.js";
import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskPagePlanRecord,
  TaskPageProgressRecord,
  TaskPromoteDocumentReference,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import type { OpenTaskProjectResult } from "./project.js";
import { ensureTaskPromoteDocument } from "../promote/index.js";
import { readOptionalRequirementsRecord } from "../storage/records.js";
import {
  deriveEffectiveTaskState,
  getTaskRecommendation,
  type TaskRecommendedAction,
} from "../semantics/index.js";

export interface TaskStateSnapshot {
  task: TaskStateRecord;
  state: TaskRuntimeStateRecord;
  currentPage: TaskCurrentPageRecord | null;
  pagePlan: TaskPagePlanRecord | null;
  pageProgress: TaskPageProgressRecord | null;
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
  const effective = deriveEffectiveTaskState({
    projectDir: result.projectDir,
    state: result.state,
    currentPage: result.currentPage,
    pagePlan: result.pagePlan,
    pageProgress: result.pageProgress,
  });

  return {
    task: result.task,
    state: effective.state,
    currentPage: result.currentPage,
    pagePlan: result.pagePlan,
    pageProgress: result.pageProgress,
    artifacts: result.artifacts,
  };
}

export function getTaskStateQueryResult(result: OpenTaskProjectResult): TaskStateQueryResult {
  const effective = deriveEffectiveTaskState({
    projectDir: result.projectDir,
    state: result.state,
    currentPage: result.currentPage,
    pagePlan: result.pagePlan,
    pageProgress: result.pageProgress,
  });

  return {
    ...buildTaskStateSnapshot(result),
    blockedBy: effective.blockedBy,
    allowedTransitions: effective.allowedOperations,
  };
}

export async function getRecommendedActionResult(
  result: OpenTaskProjectResult,
): Promise<RecommendedActionResult> {
  const requirements = await readOptionalRequirementsRecord(result.projectDir);
  const recommendation = getTaskRecommendation({
    projectDir: result.projectDir,
    state: result.state,
    currentPage: result.currentPage,
    pagePlan: result.pagePlan,
    pageProgress: result.pageProgress,
    requirements,
  });
  const {
    recommendedAction,
    requiredInputs,
    expectedArtifacts,
    allowedOperations,
    blockedBy,
    effectiveState,
  } = recommendation;
  const availableTemplateGroups = recommendedAction.type === "select_template_group"
    ? await listDiscoveredTemplateGroupSummaries({ include_builtin: true })
    : undefined;
  const effectiveResult: OpenTaskProjectResult = {
    ...result,
    state: effectiveState,
    currentPage: result.currentPage
      ? {
        ...result.currentPage,
        pageState: effectiveState.pageState ?? result.currentPage.pageState,
      }
      : result.currentPage,
  };
  const promote = await ensureTaskPromoteDocument(effectiveResult, {
    type: recommendedAction.type,
    summary: recommendedAction.summary,
    requiredInputs,
    expectedArtifacts,
    allowedOperations,
    availableTemplateGroups,
  });
  return {
    deckState: effectiveState.deckState,
    pageState: effectiveState.pageState,
    recommendedAction,
    blockedBy,
    requiredInputs,
    expectedArtifacts,
    allowedOperations,
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
