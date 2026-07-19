import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { DeckRefinementOutlineOperation, DeckRefinementPlan } from "../../ai/types";
import type { PageProgress, RenderDeckHtmlResult, WorkspaceOutline, WorkspaceResult } from "../../api/types";
import { createProgress, emit as emitProgress } from "./progressProjection";
import { failedCompletion } from "./deckGenerationCompletion";
import { runDeckGeneration } from "./deckGenerationWorkflow";
import { authoringDeckFromConfirmedOutline } from "./deckGenerationStartArtifacts";
import { getAttemptLimits } from "./settings";
import type { DeckGenerationCompletion, RunDeckRefinementInput } from "./types";

function readRenderedDeck(workspace: WorkspaceResult): RenderDeckHtmlResult | null {
  const pages = workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
    ? workspace.pages as Record<string, unknown>
    : null;
  const rawSlides = Array.isArray(pages?.pages) ? pages.pages : [];
  if (!pages || rawSlides.length === 0) return null;
  const slides = rawSlides.map((value) => {
    const slide = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      slide_id: typeof slide.page_id === "string" ? slide.page_id : "",
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

function emit(input: RunDeckRefinementInput, progress: PageProgress | null, step: "deck-refinement-planning" | "deck-refinement-style-guide" | "deck-refinement-commit", message: string) {
  emitProgress(input, {
    step,
    message,
    currentPageIndex: null,
    totalPages: input.confirmedOutline.items.length,
  }, progress, undefined, undefined, getAttemptLimits(input));
}

function fail(input: RunDeckRefinementInput, progress: PageProgress | null, error: unknown): DeckGenerationCompletion {
  const message = error instanceof Error ? error.message : String(error);
  const failedProgress = createProgress({
    step: "failed",
    message,
    currentPageIndex: null,
    totalPages: input.confirmedOutline.items.length,
  }, progress, undefined, undefined, getAttemptLimits(input));
  input.onProgress(failedProgress);
  return failedCompletion({ progress: failedProgress, error: { type: "page_failed", message } });
}

function provisionalOutline(current: WorkspaceOutline, plan: DeckRefinementPlan): WorkspaceOutline {
  const currentById = new Map(current.items.map((item) => [item.page_id, item]));
  return {
    ...current,
    title: plan.title,
    items: plan.operations.flatMap((operation) => {
      if (operation.op === "delete") return [];
      if (operation.op === "keep") {
        const existing = currentById.get(operation.page_id);
        return existing ? [existing] : [];
      }
      if (operation.op === "update") {
        return [{
          page_id: operation.page_id,
          title: operation.title,
          core_message: operation.core_message,
          required_content: operation.required_content.map((item) => `- ${item}`).join("\n"),
        }];
      }
      return [{
        title: operation.title,
        core_message: operation.core_message,
        required_content: operation.required_content.map((item) => `- ${item}`).join("\n"),
      }];
    }),
  };
}

function refinementReasons(plan: DeckRefinementPlan, targetIds: string[], committedOutline: WorkspaceOutline) {
  const globalReasons = [
    plan.output_language_change.changed ? plan.output_language_change.reason || "Apply the new output language to this page." : "",
    plan.style_guide_change.action === "regenerate" ? plan.style_guide_change.reason : "",
  ].filter(Boolean);
  const byExistingId = new Map(plan.operations.flatMap((operation) => operation.op === "add" ? [] : [[
    operation.page_id,
    [operation.reason, ...globalReasons].filter(Boolean).join(" "),
  ] as const]));
  const addReasons = plan.operations.filter((operation): operation is Extract<DeckRefinementOutlineOperation, { op: "add" }> => operation.op === "add").map((operation) => operation.reason);
  const addedIds = committedOutline.items.map((item) => item.page_id).filter((id): id is string => typeof id === "string" && !byExistingId.has(id));
  const addedReasonById = new Map(addedIds.map((id, index) => [id, addReasons[index] ?? plan.reason]));
  return Object.fromEntries(targetIds.map((id) => [id, byExistingId.get(id) ?? addedReasonById.get(id) ?? plan.reason]));
}

function refinementVisualContexts(progress: PageProgress, targetIds: string[]) {
  const targetSet = new Set(targetIds);
  return Object.fromEntries(progress.pages.filter((page) => targetSet.has(page.page_id)).map((page) => [
    page.page_id,
    page.last_screenshot_path?.trim()
      ? { source: "progress" as const, screenshotPath: page.last_screenshot_path.trim() }
      : { source: "unavailable" as const, unavailableReason: "No previous successful screenshot is available." },
  ]));
}

export async function runDeckRefinementWorkflow(input: RunDeckRefinementInput, instruction: string): Promise<DeckGenerationCompletion> {
  let progress = await input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir });
  if (input.skipIntentReview) {
    const reasons = progress.recovery?.page_refinement_reasons ?? {};
    const workspace = await input.backend.openWorkspace({ workspace_dir: input.workspace.workspace_dir });
    const outline = workspace.outline as WorkspaceOutline;
    return runDeckGeneration({
      ...input,
      workspace,
      confirmedOutline: outline,
      startMode: "resume",
      refinementRequest: progress.recovery?.refinement_request ?? instruction,
      pageRefinementReasons: reasons,
      pageRefinementVisualContexts: refinementVisualContexts(progress, Object.keys(reasons)),
      refinementRunKind: "deck-refinement",
    });
  }

  try {
    emit(input, progress, "deck-refinement-planning", input.locale === "zh" ? "正在规划整套优化" : "Planning deck refinement");
    const styleGuide = await input.backend.getWorkspaceStyleGuide({ workspace_dir: input.workspace.workspace_dir });
    const logContext: AiOperationLogContext | undefined = input.aiLogger ? {
      logger: input.aiLogger,
      workspace_dir: input.workspace.workspace_dir,
      domain: "outline",
      operation: "deck_refinement_planning",
      operation_id: input.aiLogger.createOperationId("outline", "deck_refinement_planning"),
      provider: "anna",
      runtime_mode: "anna",
    } : undefined;
    const { plan } = await input.aiClient.planDeckRefinement({
      instruction,
      outline: input.confirmedOutline,
      requirements: input.workspace.requirements,
      currentStyleGuide: styleGuide.content,
      locale: input.locale,
      logContext,
    });

    if (plan.route === "no_op") {
      const rendered = readRenderedDeck(input.workspace);
      if (!rendered) throw new Error(input.locale === "zh" ? "整套优化无需改动，但现有渲染产物不可用。" : "No changes are needed, but existing rendered artifacts are unavailable.");
      progress = await input.backend.recordPageProgress({
        workspace_dir: input.workspace.workspace_dir,
        patch: {
          deck_status: "completed",
          recovery: {
            status: "completed",
            run_kind: "deck-refinement",
            step: "complete",
            target_page_ids: [],
            refinement_request: null,
            page_refinement_reasons: {},
            error: null,
          },
        },
      });
      return {
        status: "completed",
        result: {
          outline: input.confirmedOutline,
          authoringDeck: authoringDeckFromConfirmedOutline(input.confirmedOutline),
          progress,
          rendered,
        },
      };
    }

    let styleGuideUpload;
    if (plan.style_guide_change.action === "regenerate") {
      emit(input, progress, "deck-refinement-style-guide", input.locale === "zh" ? "正在重新生成艺术指导" : "Regenerating Workspace Style Guide");
      if (!input.hostUploadClient) throw new Error("Host Upload is required to persist the Workspace Style Guide");
      const markdown = await input.aiClient.generateWorkspaceStyleGuide({
        brief: input.workspace.requirements.source?.brief ?? "",
        requirements: input.workspace.requirements,
        outline: provisionalOutline(input.confirmedOutline, plan),
        currentStyleGuide: styleGuide.content,
        refinementRequest: instruction,
        refinementReason: plan.style_guide_change.reason,
        logContext: input.aiLogger ? {
          logger: input.aiLogger,
          workspace_dir: input.workspace.workspace_dir,
          domain: "style_guide",
          operation: "regenerate_style_guide_for_deck_refinement",
          operation_id: input.aiLogger.createOperationId("style_guide", "regenerate_style_guide_for_deck_refinement"),
          provider: "anna",
          runtime_mode: "anna",
        } : undefined,
      });
      if (!markdown.trim()) throw new Error("Workspace Style Guide generation returned empty Markdown");
      const file = new File([markdown], "style-guide.md", { type: "text/markdown" });
      const hostUpload = await input.hostUploadClient.uploadFile(file, {
        purpose: "user_artifact",
        filename: "style-guide.md",
        mimeType: "text/markdown",
        metadata: { workspace_dir: input.workspace.workspace_dir, artifact: "workspace-style-guide-refinement" },
      });
      styleGuideUpload = { size_bytes: hostUpload.size_bytes, host_upload: hostUpload };
    }

    emit(input, progress, "deck-refinement-commit", input.locale === "zh" ? "正在提交整套优化方案" : "Committing deck refinement");
    const committed = await input.backend.commitDeckRefinement({
      workspace_dir: input.workspace.workspace_dir,
      refinement_request: instruction,
      title: plan.title,
      output_language_change: plan.output_language_change,
      style_guide_action: plan.style_guide_change.action,
      operations: plan.operations,
      style_guide_upload: styleGuideUpload,
    });
    progress = committed.progress;
    const workspace = await input.backend.openWorkspace({ workspace_dir: input.workspace.workspace_dir });
    const outline = committed.outline;
    const reasons = refinementReasons(plan, committed.target_page_ids, outline);
    return runDeckGeneration({
      ...input,
      workspace,
      confirmedOutline: outline,
      startMode: "resume",
      refinementRequest: instruction,
      pageRefinementReasons: reasons,
      pageRefinementVisualContexts: refinementVisualContexts(progress, committed.target_page_ids),
      refinementRunKind: "deck-refinement",
    });
  } catch (error) {
    return fail(input, progress, error);
  }
}
