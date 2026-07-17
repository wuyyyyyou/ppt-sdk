import { isAgentRunCancelledError } from "../../agent/agentClient";
import type {
  PagePlan,
  PageProgress,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import { outlineDetailToText } from "../../data/mockDeck";
import { generationText } from "./messages";
import { emit } from "./progressProjection";
import {
  type RunDeckGenerationInput,
} from "./types";
import {
  appendWorkspaceLogSafe,
  recordDeckRecovery,
  recordProgress,
  throwIfCancelled,
} from "./runtimeSupport";
import { getAttemptLimits } from "./settings";

function readWorkspaceTemplate(workspace: WorkspaceResult) {
  return workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
    ? (workspace.template as { selected_template_group?: unknown; manifest_path?: unknown })
    : null;
}

export function progressMatchesPlan(pagePlan: PagePlan, progress: PageProgress) {
  const progressIds = new Set(progress.pages.map((page) => page.page_id));
  return pagePlan.pages.every((page) => progressIds.has(page.page_id));
}

function pagePlanMatchesOutlineItems(pagePlan: PagePlan, outline: WorkspaceOutline) {
  return pagePlan.pages.every((page, index) => {
    const item = outline.items[index];
    return (
      item &&
      page.title.trim() === item.title.trim() &&
      page.outline.trim() === outlineDetailToText(item).trim()
    );
  });
}

export function pagePlanMatchesOutlineAndTemplate(
  workspace: WorkspaceResult,
  pagePlan: PagePlan,
  progress: PageProgress | null,
  outline: WorkspaceOutline,
) {
  if (
    pagePlan.source.outline_updated_at &&
    outline.updated_at &&
    pagePlan.source.outline_updated_at !== outline.updated_at
  ) {
    if (!pagePlanMatchesOutlineItems(pagePlan, outline)) {
      return false;
    }
  }

  if (pagePlan.pages.length !== outline.items.length) {
    return false;
  }

  const template = readWorkspaceTemplate(workspace);
  const selectedTemplate =
    typeof template?.selected_template_group === "string" ? template.selected_template_group : "";
  const manifestPath = typeof template?.manifest_path === "string" ? template.manifest_path : "";
  if (manifestPath && pagePlan.source.template_manifest_path !== manifestPath) {
    return false;
  }
  if (!manifestPath && selectedTemplate && pagePlan.source.template_group !== selectedTemplate) {
    return false;
  }

  return progress ? progressMatchesPlan(pagePlan, progress) : true;
}

export function alignPagePlanWithOutline(pagePlan: PagePlan, outline: WorkspaceOutline): PagePlan {
  return {
    ...pagePlan,
    title: outline.title,
    source: {
      ...pagePlan.source,
      outline_updated_at: outline.updated_at,
    },
    pages: pagePlan.pages.map((page, index) => {
      const outlineItem = outline.items[index];
      if (!outlineItem) return page;

      return {
        ...page,
        title: outlineItem.title,
        outline: outlineDetailToText(outlineItem),
      };
    }),
  };
}

export async function loadResumeArtifacts(input: RunDeckGenerationInput) {
  try {
    let pagePlan = await input.backend.getPagePlan({
      workspace_dir: input.workspace.workspace_dir,
    });
    let progress = await input.backend.getPageProgress({
      workspace_dir: input.workspace.workspace_dir,
    });
    const hasUsablePagePlan = pagePlan.pages.length === input.confirmedOutline.items.length && pagePlan.pages.length > 0;
    if (!hasUsablePagePlan) {
      if (pagePlan.pages.length > 0) return null;
      return await createRestartArtifacts(input);
    }
    if (!pagePlanMatchesOutlineAndTemplate(input.workspace, pagePlan, null, input.confirmedOutline)) {
      return null;
    }

    if (!progressMatchesPlan(pagePlan, progress)) {
      await recordDeckRecovery(input, {
        status: "running",
        run_kind: "deck-generation",
        step: "prepare",
        target_page_ids: pagePlan.pages.map((page) => page.page_id),
        error: null,
        deck_status: "running",
      });
      await input.backend.preparePageFiles({
        workspace_dir: input.workspace.workspace_dir,
      });
      progress = await input.backend.getPageProgress({
        workspace_dir: input.workspace.workspace_dir,
      });
    }

    pagePlan = alignPagePlanWithOutline(pagePlan, input.confirmedOutline);
    return { pagePlan, progress };
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    return null;
  }
}

export async function createRestartArtifacts(input: RunDeckGenerationInput) {
  const text = generationText(input.locale);
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "page-plan",
    target_page_ids: [],
    page_refinement_request: null,
    page_refinement_requests: {},
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
    input,
    {
      step: "page-plan",
      message: text.pagePlan,
      currentPageIndex: null,
      totalPages: input.confirmedOutline.items.length,
    },
    null,
    undefined,
    undefined,
    getAttemptLimits(input),
  );

  const planningContext = await input.backend.getTemplatePlanningContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const pagePlanLogContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "generate_page_plan",
        operation_id: input.aiLogger.createOperationId("page_plan", "generate_page_plan"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
  const pagePlan = await input.aiClient.generatePagePlan({
    outline: input.confirmedOutline,
    planningContext,
    locale: input.locale,
    logContext: pagePlanLogContext,
  });
  throwIfCancelled(input);
  const alignedPagePlan = alignPagePlanWithOutline(pagePlan, input.confirmedOutline);
  if (input.aiLogger && pagePlanLogContext) {
    await input.aiLogger.appendSemanticLog(pagePlanLogContext, {
      event: "ai.page_plan.operation.finished",
      status: "succeeded",
      title: alignedPagePlan.title,
      page_count: alignedPagePlan.pages.length,
      template_group: alignedPagePlan.source.template_group,
      interaction_ids: pagePlanLogContext.interaction_ids ?? [],
      artifact: {
        kind: "page_plan",
        path: "page-plan.json",
      },
    });
  } else {
    await appendWorkspaceLogSafe(input, "ai-page-plan", {
      event: "ai.page_plan.operation.finished",
      schema_version: 1,
      operation: "generate_page_plan",
      status: "succeeded",
      title: alignedPagePlan.title,
      page_count: alignedPagePlan.pages.length,
      template_group: alignedPagePlan.source.template_group,
      artifact: {
        kind: "page_plan",
        path: "page-plan.json",
      },
    });
  }
  await input.backend.recordPagePlan({
    workspace_dir: input.workspace.workspace_dir,
    page_plan: alignedPagePlan,
  });
  throwIfCancelled(input);

  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "prepare",
    target_page_ids: alignedPagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "prepare",
      message: text.prepare,
      currentPageIndex: null,
      totalPages: alignedPagePlan.pages.length,
    },
    null,
    undefined,
    undefined,
    getAttemptLimits(input),
  );

  await input.backend.preparePageFiles({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  let progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  for (const page of alignedPagePlan.pages) {
    progress = await recordProgress(input, page, {
      status: "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      content_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_error: "",
      last_html_path: "",
      last_screenshot_path: "",
      content_review: null,
      visual_review: null,
      review: null,
    });
  }

  return { pagePlan: alignedPagePlan, progress };
}
