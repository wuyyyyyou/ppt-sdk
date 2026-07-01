import type { PageRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PagePlanItem,
  PageProgress,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import type { RunDeckRefinementInput } from "./types";
import { recordDeckRecovery } from "./runtimeSupport";

export function normalizeResearchQueryKey(query: string): string {
  return query
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export function applyTargetOutlineRevision(input: {
  outline: WorkspaceOutline;
  pageIndex: number;
  revisedItem: { title: string; outline: string };
  now: string;
}): WorkspaceOutline {
  return {
    ...input.outline,
    status: "confirmed",
    items: input.outline.items.map((item, index) =>
      index === input.pageIndex
        ? {
            title: input.revisedItem.title,
            outline: input.revisedItem.outline,
          }
        : item,
    ),
    updated_at: input.now,
  };
}

export function reviseTargetPagePlanEntry(input: {
  pagePlan: PagePlan;
  targetPage: PagePlanItem;
  activeOutline: WorkspaceOutline;
  now: string;
}): PagePlan {
  const outlineItem = input.activeOutline.items[input.targetPage.index];
  return {
    ...input.pagePlan,
    title: input.activeOutline.title || input.pagePlan.title,
    source: {
      ...input.pagePlan.source,
      outline_updated_at: input.activeOutline.updated_at,
    },
    pages: input.pagePlan.pages.map((page) => {
      if (page.page_id !== input.targetPage.page_id) return page;
      return {
        ...page,
        title: outlineItem?.title || page.title,
        outline: outlineItem?.outline || page.outline,
      };
    }),
    updated_at: input.now,
  };
}

export async function persistPageRefinementArtifacts(input: {
  flowInput: RunDeckRefinementInput;
  pagePlan: PagePlan;
  progress: PageProgress;
  targetPage: PagePlanItem;
  review: PageRefinementIntentReviewResult;
  now: string;
}): Promise<{
  activeOutline: WorkspaceOutline;
  activeWorkspace: WorkspaceResult;
  activePagePlan: PagePlan;
  activeProgress: PageProgress;
  activeTargetPage: PagePlanItem;
}> {
  const { flowInput, pagePlan, progress, targetPage, review, now } = input;
  let activeOutline = flowInput.confirmedOutline;
  let activeWorkspace = flowInput.workspace;
  let activePagePlan = pagePlan;
  let activeProgress = progress;

  if (review.outline_change_required && review.target_outline_item) {
    activeOutline = applyTargetOutlineRevision({
      outline: flowInput.confirmedOutline,
      pageIndex: targetPage.index,
      revisedItem: review.target_outline_item,
      now,
    });
    const updatedWorkspace = await flowInput.backend.updateWorkspaceOutline({
      workspace_dir: flowInput.workspace.workspace_dir,
      outline: {
        title: activeOutline.title,
        output_language: activeOutline.output_language,
        status: "confirmed",
        items: activeOutline.items,
        source: {
          prompt: activeOutline.source.prompt,
          context: activeOutline.source.context,
          task_context: activeOutline.source.task_context,
          setting: activeOutline.source.setting,
        },
      },
    });
    if (updatedWorkspace.outline) {
      activeOutline = updatedWorkspace.outline as WorkspaceOutline;
    }
    activeWorkspace = {
      ...updatedWorkspace,
      outline: activeOutline,
    };
  }

  if (review.outline_change_required) {
    activePagePlan = reviseTargetPagePlanEntry({
      pagePlan,
      targetPage,
      activeOutline,
      now: new Date().toISOString(),
    });
    activePagePlan = await flowInput.backend.recordPagePlan({
      workspace_dir: flowInput.workspace.workspace_dir,
      page_plan: activePagePlan,
    });
    activeProgress = await flowInput.backend.getPageProgress({
      workspace_dir: flowInput.workspace.workspace_dir,
    });
  }

  const activeTargetPage = activePagePlan.pages.find((page) => page.page_id === targetPage.page_id) ?? targetPage;

  return {
    activeOutline,
    activeWorkspace,
    activePagePlan,
    activeProgress,
    activeTargetPage,
  };
}

export async function recordPageRefinementRecovery(input: {
  flowInput: RunDeckRefinementInput;
  instruction: string;
  pageRefinementRequests: Record<string, string>;
}) {
  await recordDeckRecovery(input.flowInput, {
    status: "running",
    run_kind: "page-refinement",
    step: "page-authoring",
    target_page_ids: Object.keys(input.pageRefinementRequests),
    page_refinement_request: input.instruction,
    page_refinement_requests: input.pageRefinementRequests,
    error: null,
    deck_status: "running",
  });
}
