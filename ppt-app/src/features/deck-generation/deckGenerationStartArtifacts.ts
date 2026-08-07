import type { AgentStreamEvent } from "../../agent/agentClient";
import type { PageProgress, WorkspaceOutline } from "../../api/types";
import { outlineDetailToText } from "../../data/mockDeck";
import { generationText } from "./messages";
import { emit } from "./progressProjection";
import type { AuthoringDeck, DeckGenerationStream, RunDeckGenerationInput } from "./types";
import { getAttemptLimits } from "./settings";
import { appendTextToLines, pushBounded, recordDeckRecovery, throwIfCancelled } from "./runtimeSupport";
import { beginPerformanceSpan } from "../../performance/performanceRecorder";

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
  step: "authoring-kit" | "style-guide" | "persistent-elements" | "page-sources" | "prepare",
  message: string,
  stream?: DeckGenerationStream | null,
) {
  emit(input, {
    step,
    message,
    currentPageIndex: null,
    totalPages: input.confirmedOutline.items.length,
  }, null, stream, undefined, getAttemptLimits(input));
}

function createPersistentElementsStreamTracker(input: RunDeckGenerationInput, operationId: string) {
  const text = generationText(input.locale);
  const now = new Date().toISOString();
  const stream: DeckGenerationStream = {
    run_id: operationId,
    kind: "persistent-elements",
    page_id: "persistent-elements",
    page_index: -1,
    status: text.persistentElements,
    lines: [],
    activities: [],
    started_at: now,
    updated_at: now,
  };
  const emitStream = () => {
    stream.updated_at = new Date().toISOString();
    emitPreparationStep(input, "persistent-elements", text.persistentElements, stream);
  };
  emitStream();
  return {
    stream,
    onStreamEvent(event: AgentStreamEvent) {
      if (event.type === "content") appendTextToLines(stream.lines, event.text, 30);
      if (event.type === "activity") pushBounded(stream.activities, event.message, 12);
      if (event.type === "error") pushBounded(stream.activities, event.message, 12);
      if (event.type === "complete") pushBounded(stream.activities, text.agentSessionCompleted, 12);
      emitStream();
    },
    finish(status: "completed" | "error", detail?: string) {
      if (detail) pushBounded(stream.activities, detail, 12);
      stream.status = status;
      emitStream();
    },
  };
}

function persistentElementsPrompt(input: RunDeckGenerationInput, targetPath: string, previousError = "") {
  return [
    "你是 Persistent Elements Reference（跨页固定元素参考）Agent。",
    "开始前必须完整读取 requirements.json、outline.json、style-guide.md、authoring-kit/README.md，以及当前 persistent-elements.tsx；不要读取研究资料、页面源码、截图或 Manifest。",
    `工作区目录：${input.workspace.workspace_dir}`,
    `目标文件：${targetPath}`,
    "将目标文件改写为完整、可编译、可独立渲染的 1280×720 TSX 参考页。它规定页眉、页脚、页码、持续装饰、适用的页面标题/副标题处理参考和内容安全区域，但不规定正文布局。",
    "艺术指导负责整套视觉意图；本文件负责跨页固定元素以及标题处理示例的具体 JSX 结构、位置、字体、字号、字重、是否斜体、颜色和间距。",
    "标题/副标题只提供视觉处理参考，不提供页面正文、事实或必须复制的示例文案；使用中性占位文字，并明确告诉页面 Agent 必须替换为当前页内容。不要为了填满参考页而虚构 Deck 内容。",
    "普通页面优先提供一个主标题处理示例；只有在封面、章节页、结尾页等确有不同视觉角色时，才提供少量命名变体。变体是可选择的，不是每页都必须使用。",
    "如果本 Deck 不需要任何跨页固定元素或标题处理参考，也必须改写成明确的空参考（JSX 注释说明 No persistent elements or title treatments），不能原样保留 Bootstrap。",
    "页码如需要，直接使用 data-presenton-page-number=\"current\" 或 \"total\"，可选 data-presenton-page-number-pad=\"2\"；数字只是示意，渲染器会替换真实页码。",
    "不要 import 页面源码，也不要把本文件设计成供页面 import 的运行时共享组件。",
    previousError ? `上一次门禁错误，请直接修复：${previousError}` : "",
    "完成后只返回 JSON：{\"summary\":\"...\",\"files_read\":[\"...\"],\"changed_files\":[\"...\"],\"needs_render\":false}",
  ].join("\n");
}

export async function ensurePersistentElementsReference(input: RunDeckGenerationInput, force = false) {
  const text = generationText(input.locale);
  const bootstrap = await input.backend.ensureWorkspacePersistentElementsReference({ workspace_dir: input.workspace.workspace_dir });
  const status = await input.backend.getWorkspacePersistentElementsReferenceStatus({ workspace_dir: input.workspace.workspace_dir });
  if (!force && !bootstrap.created && status.non_empty && status.sha256 !== bootstrap.sha256) return status;
  let previousSha = bootstrap.sha256;
  let previousSummary = "";
  let previousError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const operationId = input.aiLogger
      ? input.aiLogger.createOperationId("persistent_elements", "generate_persistent_elements_reference")
      : `persistent-elements-${Date.now().toString(36)}-${attempt}`;
    const tracker = createPersistentElementsStreamTracker(input, operationId);
    let result;
    try {
      result = await input.agentClient.runAuthoringPrompt(persistentElementsPrompt(input, bootstrap.persistent_elements_path, previousError), {
        signal: input.cancelSignal,
        isCancelled: input.isCancelled,
        onStreamEvent: tracker.onStreamEvent,
        logContext: input.aiLogger ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "persistent_elements",
        operation: "generate_persistent_elements_reference",
        operation_id: operationId,
        provider: "anna",
        runtime_mode: "anna",
        } : undefined,
      });
    } catch (error) {
      tracker.finish("error", error instanceof Error ? error.message : String(error));
      throw error;
    }
    const next = await input.backend.getWorkspacePersistentElementsReferenceStatus({ workspace_dir: input.workspace.workspace_dir });
    if (!next.non_empty) {
      const message = `${text.persistentElements}: Agent 没有产出文件`;
      tracker.finish("error", message);
      throw new Error(message);
    }
    if (next.sha256 !== previousSha) {
      try {
        await input.backend.typecheckWorkspacePersistentElements({ workspace_dir: input.workspace.workspace_dir });
        tracker.finish("completed");
        return next;
      } catch (error) {
        previousError = error instanceof Error ? error.message : String(error);
        tracker.finish("error", previousError);
        if (attempt === 3) throw error;
        previousSha = next.sha256;
        continue;
      }
    }
    previousSummary = result.summary || "Agent completed without changing the reference.";
    const noChangeMessage = `${text.persistentElements}: Agent 未修改 persistent-elements.tsx。${previousSummary}`;
    tracker.finish("error", noChangeMessage);
    if (attempt === 3) throw new Error(noChangeMessage);
    previousSha = next.sha256;
  }
  throw new Error(text.persistentElements);
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
  const performanceSpan = beginPerformanceSpan({
    operationName: "style_guide.create",
    workspaceId: input.workspace.workspace_id,
    attributes: { layer: "workflow" },
  });
  try {
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
    performanceSpan?.finish("ok");
  } catch (error) {
    performanceSpan?.finish("error");
    throw error;
  }
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
    if (!styleGuide.non_empty) {
      emitPreparationStep(input, "style-guide", generationText(input.locale).styleGuide);
      await ensureWorkspaceStyleGuide(input);
    }
    emitPreparationStep(input, "persistent-elements", generationText(input.locale).persistentElements);
    await ensurePersistentElementsReference(input);
    emitPreparationStep(input, "page-sources", generationText(input.locale).pageSources);
    await input.backend.prepareWorkspacePageSources({ workspace_dir: input.workspace.workspace_dir });
    progress = await input.backend.initializePageProgress({ workspace_dir: input.workspace.workspace_dir });
    return { authoringDeck, progress };
  }
  if (!styleGuide.non_empty || !progressMatchesAuthoringDeck(authoringDeck, progress)) return null;

  const persistentStatus = await input.backend.getWorkspacePersistentElementsReferenceStatus({ workspace_dir: input.workspace.workspace_dir });
  if (!persistentStatus.non_empty && input.refinementRunKind !== "page-refinement") {
    emitPreparationStep(input, "persistent-elements", generationText(input.locale).persistentElements);
    await ensurePersistentElementsReference(input);
  }

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

  emitPreparationStep(input, "persistent-elements", text.persistentElements);
  await ensurePersistentElementsReference(input);
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
