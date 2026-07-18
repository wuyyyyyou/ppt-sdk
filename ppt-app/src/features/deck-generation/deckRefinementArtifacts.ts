export {
  alignDeckRefinementPagePlanToOutline,
  applyDeckRefinementSettingUpdates,
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
import {
  alignDeckRefinementPagePlanToOutline,
  applyDeckRefinementSettingUpdates,
  type DeckRefinementReconciliationResult,
} from "./deckRefinementWorkflow";
import { emit as emitProgress } from "./progressProjection";
import { getAttemptLimits, readWorkspaceSetting } from "./settings";
import {
  recordDeckRecovery,
  throwIfCancelled,
} from "./runtimeSupport";
import { readResearchEvidenceSafe } from "./researchArtifacts";
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
    const result = await flowInput.backend.updateWorkspaceSettings({
      workspace_dir: flowInput.workspace.workspace_dir,
      setting: applyDeckRefinementSettingUpdates({
        setting: readWorkspaceSetting(flowInput.workspace),
        review,
        now,
      }),
    });
    activeWorkspace = {
      ...activeWorkspace,
      setting: result.setting,
    };
  }
  const updatedWorkspace = await flowInput.backend.confirmWorkspaceOutline({
    workspace_dir: flowInput.workspace.workspace_dir,
    outline: {
      title: reconciliation.outline.title,
      items: reconciliation.outline.items,
    },
  });
  const persistedOutline = {
    ...updatedWorkspace.outline as WorkspaceOutline,
    output_language: reconciliation.outline.output_language,
    source: reconciliation.outline.source,
  };
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
