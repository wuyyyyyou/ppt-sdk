export {
  alignDeckRefinementPagePlanToOutline,
  applyDeckRefinementSettingUpdates,
  mergeDeckRefinementResearchPlan,
  reconcileDeckRefinement,
  type DeckRefinementReconciliationResult,
} from "./deckRefinementWorkflow";

import type { DeckRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PageProgress,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import { createEmptyResearchPlan } from "./researchWorkflow";
import {
  alignDeckRefinementPagePlanToOutline,
  applyDeckRefinementSettingUpdates,
  mergeDeckRefinementResearchPlan,
  type DeckRefinementReconciliationResult,
} from "./deckRefinementWorkflow";
import { emit as emitProgress } from "./progressProjection";
import { getAttemptLimits, readWorkspaceSetting } from "./settings";
import {
  recordDeckRecovery,
  throwIfCancelled,
} from "./runtimeSupport";
import {
  readResearchEvidenceSafe,
  readResearchPlanSafe,
} from "./researchArtifacts";
import {
  ATTEMPT_LIMITS,
  type DeckGenerationContext,
  type DeckGenerationProgress,
  type DeckGenerationStream,
  type RunDeckRefinementInput,
} from "./types";

function emit(
  input: Pick<DeckGenerationContext, "onProgress"> & Partial<Pick<DeckGenerationContext, "workspace">>,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
) {
  emitProgress(
    input,
    value,
    progress,
    stream,
    activeStreams,
    input.workspace ? getAttemptLimits({ workspace: input.workspace }) : ATTEMPT_LIMITS,
  );
}

export async function persistDeckRefinementArtifacts(input: {
  flowInput: RunDeckRefinementInput;
  review: DeckRefinementIntentReviewResult;
  reconciliation: DeckRefinementReconciliationResult;
  now: string;
}): Promise<{
  activeWorkspace: WorkspaceResult;
  persistedOutline: WorkspaceOutline;
  activePagePlan: PagePlan;
}> {
  const { flowInput, review, reconciliation, now } = input;
  let activeWorkspace = flowInput.workspace;
  if (review.output_language_change.changed) {
    activeWorkspace = await flowInput.backend.updateWorkspaceSettings({
      workspace_dir: flowInput.workspace.workspace_dir,
      setting: applyDeckRefinementSettingUpdates({
        setting: readWorkspaceSetting(flowInput.workspace),
        review,
        now,
      }),
    });
  }
  const updatedWorkspace = await flowInput.backend.updateWorkspaceOutline({
    workspace_dir: flowInput.workspace.workspace_dir,
    outline: {
      title: reconciliation.outline.title,
      output_language: reconciliation.outline.output_language,
      status: "confirmed",
      items: reconciliation.outline.items,
      source: {
        prompt: reconciliation.outline.source.prompt,
        context: reconciliation.outline.source.context,
        task_context: reconciliation.outline.source.task_context,
        setting: reconciliation.outline.source.setting,
      },
    },
  });
  const persistedOutline = updatedWorkspace.outline as WorkspaceOutline;
  const persistedPagePlan = alignDeckRefinementPagePlanToOutline({
    pagePlan: reconciliation.pagePlan,
    outline: persistedOutline,
  });
  activeWorkspace = {
    ...activeWorkspace,
    ...updatedWorkspace,
    outline: persistedOutline,
  };
  const activePagePlan = await flowInput.backend.recordPagePlan({
    workspace_dir: flowInput.workspace.workspace_dir,
    page_plan: persistedPagePlan,
  });
  throwIfCancelled(flowInput);

  const existingResearchPlan = await readResearchPlanSafe(flowInput) ?? createEmptyResearchPlan({
    outline: persistedOutline,
    pagePlan: activePagePlan,
    generatedBy: "deck-refinement-fallback",
  });
  const needsResearchPlanning = Object.keys(reconciliation.researchReviews).length > 0;
  const generatedResearchPlan = needsResearchPlanning
    ? await flowInput.aiClient.generateResearchPlan({
        outline: persistedOutline,
        pagePlan: activePagePlan,
        locale: flowInput.locale,
        logContext: flowInput.aiLogger
          ? {
              logger: flowInput.aiLogger,
              workspace_dir: flowInput.workspace.workspace_dir,
              domain: "page_plan" as const,
              operation: "deck_refinement_research_plan",
              operation_id: flowInput.aiLogger.createOperationId("page_plan", "deck_refinement_research_plan"),
              provider: "anna",
              runtime_mode: "anna",
            }
          : undefined,
      })
    : null;
  const mergedResearchPlan = mergeDeckRefinementResearchPlan({
    existingPlan: existingResearchPlan,
    generatedPlan: generatedResearchPlan,
    pagePlan: activePagePlan,
    researchReviews: reconciliation.researchReviews,
    now: new Date().toISOString(),
  });
  await flowInput.backend.recordResearchPlan({
    workspace_dir: flowInput.workspace.workspace_dir,
    research_plan: mergedResearchPlan,
  });
  const activePageIds = new Set(activePagePlan.pages.map((page) => page.page_id));
  const existingEvidence = await readResearchEvidenceSafe(flowInput);
  if (existingEvidence) {
    await flowInput.backend.recordResearchEvidence({
      workspace_dir: flowInput.workspace.workspace_dir,
      evidence: {
        ...existingEvidence,
        pages: existingEvidence.pages.filter((page) => activePageIds.has(page.page_id)),
        updated_at: new Date().toISOString(),
      },
    });
  }
  try {
    const status = await flowInput.backend.getResearchStatus({
      workspace_dir: flowInput.workspace.workspace_dir,
    });
    await flowInput.backend.recordResearchStatus({
      workspace_dir: flowInput.workspace.workspace_dir,
      status: {
        ...status,
        pages: status.pages.filter((page) => activePageIds.has(page.page_id)),
        collection_ledger: status.collection_ledger
          ? {
              ...status.collection_ledger,
              pages: status.collection_ledger.pages.filter((page) => activePageIds.has(page.page_id)),
            }
          : undefined,
        updated_at: new Date().toISOString(),
      },
    });
  } catch {
    // Research status cleanup should not block Deck Refinement.
  }

  return {
    activeWorkspace,
    persistedOutline,
    activePagePlan,
  };
}

export async function prepareDeckRefinementGenerationArtifacts(input: {
  flowInput: RunDeckRefinementInput;
  instruction: string;
  pagePlan: PagePlan;
  review: DeckRefinementIntentReviewResult;
  reconciliation: DeckRefinementReconciliationResult;
  prepareMessage: string;
}): Promise<PageProgress> {
  const { flowInput, instruction, pagePlan, review, reconciliation } = input;
  let activeProgress = await recordDeckRecovery(flowInput, {
    status: "running",
    run_kind: "deck-refinement",
    step: "prepare",
    target_page_ids: reconciliation.targetPageIds,
    page_refinement_request: instruction,
    page_refinement_requests: reconciliation.pageRefinementRequests,
    deck_refinement_review: review,
    error: null,
    final_deck_render: {
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      pages_path: null,
      rendered_at: null,
    },
    deck_status: "running",
  });
  emit(
    flowInput,
    {
      step: "prepare",
      message: input.prepareMessage,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    activeProgress,
  );
  await flowInput.backend.prepareDeckRefinementPageFiles({
    workspace_dir: flowInput.workspace.workspace_dir,
    new_page_ids: reconciliation.addedPageIds,
  });
  activeProgress = await flowInput.backend.getPageProgress({
    workspace_dir: flowInput.workspace.workspace_dir,
  });
  throwIfCancelled(flowInput);

  await recordDeckRecovery(flowInput, {
    status: "running",
    run_kind: "deck-refinement",
    step: "page-authoring",
    target_page_ids: reconciliation.targetPageIds,
    page_refinement_request: instruction,
    page_refinement_requests: reconciliation.pageRefinementRequests,
    deck_refinement_review: review,
    error: null,
    deck_status: "running",
  });

  return activeProgress;
}
