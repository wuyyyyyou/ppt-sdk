import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { DeckRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PageProgress,
  RenderDeckHtmlResult,
  WorkspaceResult,
} from "../../api/types";
import { generationText } from "./messages";
import { createProgress, emit as emitProgress } from "./progressProjection";
import {
  ATTEMPT_LIMITS,
  type DeckGenerationCompletion,
  type DeckGenerationContext,
  type DeckGenerationProgress,
  type DeckGenerationStream,
  type RunDeckRefinementInput,
} from "./types";
import { ensureWorkspaceThemeToken } from "./themeTokenWorkflow";
import { getAttemptLimits, readWorkspaceSetting } from "./settings";
import {
  failedCompletion,
  preflightAgentToolAccess,
} from "./deckGenerationCompletion";
import {
  persistDeckRefinementArtifacts,
  prepareDeckRefinementGenerationArtifacts,
  reconcileDeckRefinement,
} from "./deckRefinementArtifacts";
import { legacyOutlineTextToDetail } from "../../data/mockDeck";
import {
  recordDeckRecovery,
  throwIfCancelled,
} from "./runtimeSupport";
import { runDeckGeneration } from "./deckGenerationWorkflow";

function readRenderedDeckFromWorkspace(workspace: WorkspaceResult): RenderDeckHtmlResult | null {
  const pages = workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
    ? workspace.pages as Record<string, unknown>
    : null;
  const rawSlides = Array.isArray(pages?.pages) ? pages.pages : [];
  if (!pages || rawSlides.length === 0) return null;
  const slides = rawSlides.map((item) => {
    const slide = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    return {
      slide_id: typeof slide.page_id === "string" ? slide.page_id : typeof slide.slide_id === "string" ? slide.slide_id : "",
      layout_id: typeof slide.layout_id === "string" ? slide.layout_id : "",
      title: typeof slide.title === "string" ? slide.title : "",
      html_path: typeof slide.html_path === "string" ? slide.html_path : "",
      screenshot_path: typeof slide.screenshot_path === "string" ? slide.screenshot_path : undefined,
      speaker_note: typeof slide.speaker_note === "string" ? slide.speaker_note : "",
    };
  });
  if (slides.some((slide) => !slide.html_path)) return null;
  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: typeof pages.manifest_path === "string" ? pages.manifest_path : "",
    output_dir: typeof pages.output_dir === "string" ? pages.output_dir : "",
    slides,
    slide_count: slides.length,
    title: typeof pages.title === "string" ? pages.title : "",
    rendered_at: typeof pages.rendered_at === "string" ? pages.rendered_at : new Date().toISOString(),
  };
}

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

function readLlmContextRows(value: unknown): Array<{ id: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const rowValue = typeof record.value === "string" ? record.value.trim() : "";
    return id ? [{ id, value: rowValue }] : [];
  });
}

export async function runDeckRefinementWorkflow(args: {
  input: RunDeckRefinementInput;
  instruction: string;
  pagePlan: PagePlan;
  progress: PageProgress;
}): Promise<DeckGenerationCompletion> {
  const { input, instruction, pagePlan, progress } = args;
  const attemptLimits = getAttemptLimits(input);
  const text = generationText(input.locale);

  if (input.skipIntentReview) {
    const recoveryRequests = progress.recovery?.page_refinement_requests ?? {};
    const targetIds = new Set(input.resumePageIds ?? progress.recovery?.target_page_ids ?? []);
    const pageRefinementRequests = Object.fromEntries(
      Object.entries(recoveryRequests)
        .filter(([pageId]) => targetIds.size === 0 || targetIds.has(pageId))
        .filter(([, request]) => request.trim().length > 0),
    );
    return runDeckGeneration({
      backend: input.backend,
      aiClient: input.aiClient,
      agentClient: input.agentClient,
      aiLogger: input.aiLogger,
      workspace: input.workspace,
      confirmedOutline: input.confirmedOutline,
      locale: input.locale,
      startMode: "resume",
      onProgress: input.onProgress,
      isCancelled: input.isCancelled,
      cancelSignal: input.cancelSignal,
      pageRefinementRequests,
      refinementRunKind: "deck-refinement",
    });
  }

  emit(
    input,
    {
      step: "page-plan",
      message: input.locale === "zh" ? "正在理解整套优化需求" : "Reviewing whole-deck refinement request",
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  const planningContext = await input.backend.getTemplatePlanningContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const reviewLogContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "deck_refinement_intent_review",
        operation_id: input.aiLogger.createOperationId("page_plan", "deck_refinement_intent_review"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;

  let review: DeckRefinementIntentReviewResult;
  try {
    review = await input.aiClient.reviewDeckRefinementIntent({
      instruction,
      outline: input.confirmedOutline,
      pagePlan,
      planningContext,
      setting: readWorkspaceSetting(input.workspace),
      locale: input.locale,
      logContext: reviewLogContext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedProgress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: { type: "page_failed", message },
    });
  }

  if (review.route === "unsupported") {
    const message = review.blocking_reason || (
      input.locale === "zh"
        ? "整套优化无法处理这个需求。"
        : "This request cannot be handled as Deck Refinement."
    );
    const nextProgress = await recordDeckRecovery(input, {
      status: "failed",
      run_kind: "deck-refinement",
      step: "deck-refinement-context-review",
      target_page_ids: [],
      page_refinement_request: instruction,
      page_refinement_requests: {},
      deck_refinement_review: review,
      error: message,
      deck_status: "failed",
    });
    const failedProgress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      nextProgress,
      undefined,
      undefined,
      attemptLimits,
    );
    input.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: { type: "page_failed", message },
    });
  }

  if (review.route === "no_op") {
    const rendered = readRenderedDeckFromWorkspace(input.workspace);
    if (!rendered) {
      const message = input.locale === "zh"
        ? "整套优化无需改动，但现有渲染产物不可用。"
        : "Deck Refinement is a no-op, but existing rendered artifacts are unavailable.";
      const failedProgress = createProgress(
        {
          step: "failed",
          message,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        },
        progress,
        undefined,
        undefined,
        attemptLimits,
      );
      input.onProgress(failedProgress);
      return failedCompletion({
        progress: failedProgress,
        error: { type: "stale_artifacts", message },
      });
    }
    const nextProgress = await recordDeckRecovery(input, {
      status: "completed",
      run_kind: "deck-refinement",
      step: "complete",
      target_page_ids: [],
      page_refinement_request: instruction,
      page_refinement_requests: {},
      deck_refinement_review: review,
      error: null,
      deck_status: "completed",
    });
    emit(
      input,
      {
        step: "complete",
        message: input.locale === "zh" ? "整套优化无需改动" : "Deck Refinement completed with no changes",
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      nextProgress,
    );
    return {
      status: "completed",
      result: {
        outline: input.confirmedOutline,
        authoringDeck: pagePlan,
        progress: nextProgress,
        rendered,
      },
    };
  }

  let flowInput = input;
  if (review.theme_change_required) {
    emit(
      input,
      {
        step: "page-plan",
        message: input.locale === "zh" ? "正在重写工作区主题" : "Regenerating workspace theme",
        currentPageIndex: null,
        totalPages: pagePlan.pages.length,
      },
      progress,
    );
    const themeResult = await ensureWorkspaceThemeToken({
      backend: input.backend,
      aiClient: input.aiClient,
      aiLogger: input.aiLogger,
      workspace: input.workspace,
      prompt: input.confirmedOutline.source?.prompt ?? "",
      contextRows: readLlmContextRows(input.confirmedOutline.source?.context),
      locale: input.locale,
      runKind: "deck-refinement",
      refinementRequest: instruction,
    });
    if (themeResult.fallbackUsed) {
      emit(
        { ...input, workspace: themeResult.workspace },
        {
          step: "page-plan",
          message: input.locale === "zh"
            ? "主题定制失败，已使用模板默认主题继续精修"
            : "Theme customization failed. Continuing refinement with the template default theme.",
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        },
        progress,
      );
    }
    flowInput = {
      ...input,
      workspace: themeResult.workspace,
    };
  }

  const addedOutlineItems = review.operations
    .filter((operation): operation is Extract<typeof operation, { op: "add" }> => operation.op === "add")
    .map((operation) => ({
      ...legacyOutlineTextToDetail(operation.title, operation.outline),
    }));
  const addedPagePlan = addedOutlineItems.length > 0
    ? await flowInput.aiClient.generateAddedPagePlan({
        outlineItems: addedOutlineItems,
        baseOutline: flowInput.confirmedOutline,
        planningContext,
        locale: flowInput.locale,
        logContext: flowInput.aiLogger
          ? {
              logger: flowInput.aiLogger,
              workspace_dir: flowInput.workspace.workspace_dir,
              domain: "page_plan" as const,
              operation: "deck_refinement_added_page_plan",
              operation_id: flowInput.aiLogger.createOperationId("page_plan", "deck_refinement_added_page_plan"),
              provider: "anna",
              runtime_mode: "anna",
            }
          : undefined,
      })
    : null;
  throwIfCancelled(flowInput);

  const now = new Date().toISOString();
  const reconciliation = reconcileDeckRefinement({
    instruction,
    outline: flowInput.confirmedOutline,
    pagePlan,
    review,
    addedPagePlan,
    now,
  });
  if (!reconciliation.renderRequired) {
    const rendered = readRenderedDeckFromWorkspace(flowInput.workspace);
    if (!rendered) {
      const message = input.locale === "zh"
        ? "整套优化没有产生可执行变更，但现有渲染产物不可用。"
        : "Deck Refinement produced no runnable changes, but existing rendered artifacts are unavailable.";
      return failedCompletion({
        progress: createProgress({
          step: "failed",
          message,
          currentPageIndex: null,
          totalPages: pagePlan.pages.length,
        }, progress, undefined, undefined, attemptLimits),
        error: { type: "stale_artifacts", message },
      });
    }
    return {
      status: "completed",
      result: {
        outline: flowInput.confirmedOutline,
        authoringDeck: pagePlan,
        progress,
        rendered,
      },
    };
  }

  const needsAuthoring = Object.keys(reconciliation.pageRefinementRequests).length > 0;
  if (needsAuthoring) {
    const preflightFailure = await preflightAgentToolAccess({
      agentClient: input.agentClient,
      locale: flowInput.locale,
      onProgress: flowInput.onProgress,
      progress,
      attemptLimits,
      totalPages: pagePlan.pages.length,
      currentPageIndex: null,
    });
    if (preflightFailure) return preflightFailure;
  }

  const persisted = await persistDeckRefinementArtifacts({
    flowInput,
    review,
    reconciliation,
    now,
  });
  await prepareDeckRefinementGenerationArtifacts({
    flowInput,
    instruction,
    pagePlan: persisted.activePagePlan,
    review,
    reconciliation,
    prepareMessage: text.prepare,
  });

  return runDeckGeneration({
    backend: flowInput.backend,
    aiClient: flowInput.aiClient,
    agentClient: flowInput.agentClient,
    aiLogger: flowInput.aiLogger,
    workspace: persisted.activeWorkspace,
    confirmedOutline: persisted.persistedOutline,
    locale: flowInput.locale,
    startMode: "resume",
    onProgress: flowInput.onProgress,
    isCancelled: flowInput.isCancelled,
    cancelSignal: flowInput.cancelSignal,
    pageRefinementRequests: reconciliation.pageRefinementRequests,
    refinementRunKind: "deck-refinement",
  });
}
