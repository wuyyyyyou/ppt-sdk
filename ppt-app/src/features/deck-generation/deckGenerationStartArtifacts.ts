import type { PageProgress, WorkspaceOutline } from "../../api/types";
import { outlineDetailToText } from "../../data/mockDeck";
import { generationText } from "./messages";
import { emit } from "./progressProjection";
import type { AuthoringDeck, RunDeckGenerationInput } from "./types";
import { getAttemptLimits } from "./settings";
import { recordDeckRecovery, throwIfCancelled } from "./runtimeSupport";

export function authoringDeckFromConfirmedOutline(outline: WorkspaceOutline): AuthoringDeck {
  if (outline.status !== "confirmed" || outline.items.some((item) => !item.page_id)) {
    throw new Error("Confirmed Outline entries must all own page_id before Deck Generation");
  }
  return {
    title: outline.title,
    pages: outline.items.map((item, index) => ({
      page_id: item.page_id as string,
      index,
      title: item.title,
      outline: outlineDetailToText(item),
      slide_path: `./slides/${item.page_id}.tsx`,
    })),
  };
}

export function progressMatchesAuthoringDeck(authoringDeck: AuthoringDeck, progress: PageProgress) {
  const progressIds = progress.pages.map((page) => page.page_id);
  return progressIds.length === authoringDeck.pages.length &&
    authoringDeck.pages.every((page) => progressIds.includes(page.page_id));
}

function emitPreparationStep(
  input: RunDeckGenerationInput,
  step: "authoring-kit" | "style-guide" | "page-sources" | "prepare",
  message: string,
) {
  emit(input, {
    step,
    message,
    currentPageIndex: null,
    totalPages: input.confirmedOutline.items.length,
  }, null, undefined, undefined, getAttemptLimits(input));
}

async function ensureWorkspaceStyleGuide(input: RunDeckGenerationInput) {
  const status = await input.backend.getWorkspaceStyleGuideStatus({
    workspace_dir: input.workspace.workspace_dir,
  });
  if (status.non_empty) return;
  if (input.workspace.requirements.selections.visual_style_preset) {
    throw new Error("Selected Visual Style Preset Style Guide is missing. Return to Presentation Requirements and confirm the template again.");
  }
  if (!input.hostUploadClient) {
    throw new Error("Host Upload is required to persist the Workspace Style Guide");
  }
  const requirements = input.workspace.requirements;
  const markdown = await input.aiClient.generateWorkspaceStyleGuide({
    brief: requirements.source?.brief ?? "",
    requirements,
    outline: input.confirmedOutline,
    logContext: input.aiLogger ? {
      logger: input.aiLogger,
      workspace_dir: input.workspace.workspace_dir,
      domain: "style_guide",
      operation: "generate_style_guide",
      operation_id: input.aiLogger.createOperationId("style_guide", "generate_style_guide"),
      provider: "anna",
      runtime_mode: "anna",
    } : undefined,
  });
  const file = new File([markdown], "style-guide.md", { type: "text/markdown" });
  const hostUpload = await input.hostUploadClient.uploadFile(file, {
    purpose: "user_artifact",
    filename: "style-guide.md",
    mimeType: "text/markdown",
    metadata: { workspace_dir: input.workspace.workspace_dir, artifact: "workspace-style-guide" },
  });
  await input.backend.commitWorkspaceStyleGuideHostUpload({
    workspace_dir: input.workspace.workspace_dir,
    size_bytes: hostUpload.size_bytes,
    host_upload: hostUpload,
  });
}

export async function loadResumeArtifacts(input: RunDeckGenerationInput) {
  const authoringDeck = authoringDeckFromConfirmedOutline(input.confirmedOutline);
  let progress = await input.backend.getPageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  const styleGuide = await input.backend.getWorkspaceStyleGuideStatus({
    workspace_dir: input.workspace.workspace_dir,
  });
  if (progress.pages.length === 0) {
    emitPreparationStep(input, "authoring-kit", generationText(input.locale).authoringKit);
    await input.backend.installWorkspaceAuthoringKit({ workspace_dir: input.workspace.workspace_dir });
    if (!styleGuide.non_empty && !input.workspace.requirements.selections.visual_style_preset) {
      emitPreparationStep(input, "style-guide", generationText(input.locale).styleGuide);
      await ensureWorkspaceStyleGuide(input);
    }
    emitPreparationStep(input, "page-sources", generationText(input.locale).pageSources);
    await input.backend.prepareWorkspacePageSources({ workspace_dir: input.workspace.workspace_dir });
    progress = await input.backend.initializePageProgress({ workspace_dir: input.workspace.workspace_dir });
    return { authoringDeck, progress };
  }
  if (!styleGuide.non_empty || !progressMatchesAuthoringDeck(authoringDeck, progress)) return null;

  const pageAuthoringHasStarted = progress.pages.some((page) => page.status !== "pending");
  if (!pageAuthoringHasStarted) {
    emitPreparationStep(input, "authoring-kit", generationText(input.locale).authoringKit);
    await input.backend.installWorkspaceAuthoringKit({ workspace_dir: input.workspace.workspace_dir });
  }
  await input.backend.reconcileWorkspacePageSources({ workspace_dir: input.workspace.workspace_dir });
  return { authoringDeck, progress };
}

export async function createInitialArtifacts(input: RunDeckGenerationInput) {
  const text = generationText(input.locale);
  const authoringDeck = authoringDeckFromConfirmedOutline(input.confirmedOutline);
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "authoring-kit",
    target_page_ids: authoringDeck.pages.map((page) => page.page_id),
    refinement_request: null,
    page_refinement_reasons: {},
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

  emitPreparationStep(input, "authoring-kit", text.authoringKit);
  await input.backend.installWorkspaceAuthoringKit({ workspace_dir: input.workspace.workspace_dir });
  throwIfCancelled(input);

  if (!input.workspace.requirements.selections.visual_style_preset) {
    emitPreparationStep(input, "style-guide", text.styleGuide);
  }
  await ensureWorkspaceStyleGuide(input);
  throwIfCancelled(input);

  emitPreparationStep(input, "page-sources", text.pageSources);
  await input.backend.prepareWorkspacePageSources({
    workspace_dir: input.workspace.workspace_dir,
    reset_existing: true,
  });
  throwIfCancelled(input);

  emitPreparationStep(input, "prepare", text.prepare);
  const progress = await input.backend.initializePageProgress({
    workspace_dir: input.workspace.workspace_dir,
  });
  return { authoringDeck, progress };
}
