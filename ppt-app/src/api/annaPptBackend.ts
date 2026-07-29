import type { AnnaRuntime } from "../runtime/annaRuntime";
import { createAppHostUploadClient } from "../runtime/appHostUploadClient";
import type { PptBackend } from "./pptBackend";
import type {
  AppendWorkspaceLogResult,
  ExportPdfInput,
  ExportArtifactDownloadUrlResult,
  PublishExportArtifactResult,
  ExportPdfResult,
  GetWorkspacePageFileFingerprintsResult,
  GetPageEditContextResult,
  GetWorkspaceCoverResult,
  SaveManualPageRevisionResult,
  RestorePageSourceVersionResult,
  PagePlan,
  PageProgress,
  TemplateSummary,
  WorkspaceOutline,
  ListWorkspacesResult,
  PreparePageFilesResult,
  ProjectResult,
  PptxExportJob,
  PptEngineRuntimeInfo,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewResult,
  RecordPdfExportInput,
  SelectTemplateResult,
  TemplatePlanningContext,
  WorkspaceThemeContext,
  WorkspaceThemeValidationResult,
  RecordWorkspaceThemeTokenResult,
  WorkspaceDefaultsResult,
  PatchWorkspaceDefaultsInput,
  DeleteWorkspaceResult,
  DuplicateWorkspaceResult,
  WorkspaceResult,
  ClearWorkspaceStyleProfileResult,
  CommitUploadedSourceHostUploadResult,
  CreateWorkspaceResult,
  CommitStyleProfileReferenceHostUploadResult,
  GetStyleProfileCreationContextResult,
  GetStyleProfileDraftResult,
  GetStyleProfilePreviewResult,
  GetStyleProfileResult,
  GetWorkspaceStyleProfileResult,
  ListStyleProfilesResult,
  PrepareStyleProfileCreationResult,
  HostUploadRef,
  ListUploadedSourcesResult,
  PublishStyleProfileResult,
  SelectWorkspaceStyleProfileResult,
  StyleProfileDraftFingerprint,
  RemoveUploadedSourceResult,
  PrepareUploadedSourceAnalysisWorkspaceResult,
  PresentationRequirements,
  UploadedSourceAnalysisDraftFingerprint,
  UpdateWorkspaceSettingsResult,
  WorkspaceAuthoringKitResult,
  PrepareWorkspacePageSourcesResult,
  PrepareWorkspaceDiagnosticBundleResult,
  WorkspacePageSourceFingerprint,
  CommitWorkspaceStyleGuideResult,
  ConfirmWorkspaceRequirementsResult,
  WorkspaceStyleGuideStatus,
  WorkspaceStyleGuide,
  PreparePageRefinementResult,
  CommitDeckRefinementResult,
  GenerationRunTransaction,
  PrepareGenerationRunResult,
  CommitGenerationRunResult,
  SharedResearchContextResult,
  PatchSharedResearchProgressResult,
  PublishSharedResearchBatchResult,
  ImportSharedResearchImageResult,
  FinalizePerformanceRunResult,
  ListPerformanceRunsResult,
  PerformanceRunSummary,
  PreparePerformanceReportResult,
} from "./types";
import { resolvePptBundledToolIds } from "./bundledToolIds";
import {
  beginPerformanceSpan,
  configurePerformanceEventSink,
  flushPerformanceEvents,
  getActivePerformanceRunId,
  setActivePerformanceRun,
} from "../performance/performanceRecorder";

const LONG_RUNNING_TOOL_TIMEOUT_MS = 600_000;
const WORKSPACE_LOG_INLINE_INVOKE_MAX_BYTES = 48 * 1024;

interface HostUploadJsonReference {
  workspace_upload?: HostUploadRef;
  result_upload?: HostUploadRef;
}

function unwrapToolResult<T>(result: unknown): T {
  if (
    typeof result === "object" &&
    result !== null &&
    !Array.isArray(result) &&
    (result as { success?: unknown }).success === true &&
    "data" in result
  ) {
    return (result as { data: T }).data;
  }

  return result as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readHostUploadJsonReference(value: unknown): HostUploadRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const upload = isRecord(value.workspace_upload)
    ? value.workspace_upload
    : isRecord(value.result_upload)
      ? value.result_upload
      : null;
  if (!upload) {
    return null;
  }
  if (upload.transport !== "host_upload") {
    throw new Error("Tool JSON reference upload transport must be host_upload.");
  }
  if (upload.mime_type !== "application/json") {
    throw new Error("Tool JSON reference upload MIME type must be application/json.");
  }
  if (typeof upload.r2_key !== "string" || upload.r2_key.length === 0) {
    throw new Error("Tool JSON reference upload r2_key must be non-empty.");
  }
  if (typeof upload.url !== "string" || upload.url.length === 0) {
    throw new Error("Tool JSON reference upload URL must be non-empty.");
  }
  if (typeof upload.size_bytes !== "number" || upload.size_bytes <= 0) {
    throw new Error("Tool JSON reference upload size_bytes must be positive.");
  }

  return upload as unknown as HostUploadRef;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveHostUploadJsonReference<T>(
  value: T | HostUploadJsonReference,
  resolveOnServer: (upload: HostUploadRef) => Promise<T>,
): Promise<T> {
  const upload = readHostUploadJsonReference(value);
  if (!upload) {
    return value as T;
  }

  try {
    const response = await fetch(upload.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (browserError) {
    try {
      return await resolveOnServer(upload);
    } catch (serverError) {
      throw new Error(
        "Failed to resolve tool JSON Host Upload reference. " +
        `Browser download failed: ${errorMessage(browserError)}. ` +
        `ppt-engine fallback failed: ${errorMessage(serverError)}.`,
      );
    }
  }
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "";
}

function normalizeExportPdfResult(value: unknown): ExportPdfResult {
  const record = isRecord(value) ? value : {};

  return {
    pdfPath: readString(record, "pdfPath", "pdf_path"),
    htmlPath: readString(record, "htmlPath", "html_path"),
    outputDir: readString(record, "outputDir", "output_dir"),
  };
}

export function createAnnaPptBackend(runtime: AnnaRuntime): PptBackend {
  const toolIds = resolvePptBundledToolIds();
  const hostUploadClient = createAppHostUploadClient(runtime);
  const performanceControlMethods = new Set([
    "app_list_performance_runs",
    "app_start_performance_run",
    "app_append_performance_events",
    "app_finalize_performance_run",
    "app_regenerate_performance_report",
    "app_abandon_performance_run",
    "app_delete_performance_run",
    "app_prepare_performance_report",
  ]);
  const performanceOperationNames: Record<string, string> = {
    app_get_runtime_info: "app.initialize",
    app_list_workspaces: "workspace.list",
    app_create_workspace: "workspace.create",
    app_open_workspace: "workspace.open",
    app_duplicate_workspace: "workspace.duplicate",
    app_delete_workspace: "workspace.delete",
    app_patch_workspace_settings: "workspace.settings.save",
    app_commit_uploaded_source_host_upload: "uploaded_source.upload",
    app_prepare_uploaded_source_analysis_workspace: "uploaded_source.analysis",
    app_update_workspace_requirements: "requirements.save",
    app_confirm_workspace_requirements: "requirements.confirm",
    app_save_workspace_outline_draft: "outline.save",
    app_confirm_workspace_outline: "outline.confirm",
    app_install_workspace_authoring_kit: "authoring_kit.install",
    app_prepare_workspace_page_sources: "page_sources.prepare",
    app_render_workspace_page_preview: "page.render",
    app_render_deck_html: "final_deck_render",
    app_prepare_page_refinement: "page_refinement.run",
    app_commit_deck_refinement: "deck_refinement.commit",
    app_get_page_edit_context: "manual_page.load",
    app_save_manual_page_revision: "manual_page.save",
    app_restore_page_source_version: "manual_page.restore",
    app_start_pptx_export: "pptx_export.run",
    app_get_pptx_export_status: "pptx_export.status",
    app_export_pdf: "pdf_export.run",
    app_publish_export_artifact: "export_download.prepare",
    app_get_export_artifact_download_url: "export_download.prepare",
  };
  async function invokeRaw<T>(toolId: string, method: string, args: object, options?: { timeoutMs?: number }) {
    const input = options?.timeoutMs === undefined
      ? { tool_id: toolId, method, args }
      : { tool_id: toolId, method, args, timeoutMs: options.timeoutMs };
    return unwrapToolResult<T>(await runtime.tools.invoke(input, options));
  }
  configurePerformanceEventSink((runId, events) => invokeRaw(
    toolIds.pptEngine,
    "app_append_performance_events",
    { run_id: runId, events },
  ).then(() => undefined));
  async function invoke<T>(
    toolId: string,
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    if (performanceControlMethods.has(method) || !getActivePerformanceRunId()) {
      return invokeRaw<T>(toolId, method, args, options);
    }
    const operationName = performanceOperationNames[method] ?? `tool.${method.replace(/^app_/, "")}`;
    const workspaceId = isRecord(args) && typeof args.workspace_dir === "string"
      ? args.workspace_dir.split(/[\\/]/).filter(Boolean).at(-1)
      : undefined;
    const span = beginPerformanceSpan({
      operationName: `${operationName}.roundtrip`,
      workspaceId,
      attributes: { layer: "ppt-backend", tool: method },
    });
    const performanceContext = span?.childContext(`${operationName}.backend`);
    try {
      const result = await invokeRaw<T>(toolId, method, performanceContext ? { ...args, performance_context: performanceContext } : args, options);
      span?.finish("ok");
      return result;
    } catch (error) {
      span?.finish("error");
      throw error;
    }
  }
  async function invokeHostUploadJson<T>(
    toolId: string,
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    return resolveHostUploadJsonReference<T>(
      await invoke<T | HostUploadJsonReference>(toolId, method, args, options),
      (hostUpload) => invoke<T>(
        toolId,
        "app_resolve_host_upload_json_reference",
        { host_upload: hostUpload },
        options,
      ),
    );
  }
  const invokeWorkspaceResult = (
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ) => invokeHostUploadJson<WorkspaceResult>(toolIds.pptEngine, method, args, options);
  return {
    getRuntimeInfo: () =>
      invoke<PptEngineRuntimeInfo>(toolIds.pptEngine, "app_get_runtime_info", {}),
    listPerformanceRuns: async () => {
      const result = await invoke<ListPerformanceRunsResult>(toolIds.pptEngine, "app_list_performance_runs", {});
      setActivePerformanceRun(result.active_run?.run_id ?? null);
      return result;
    },
    startPerformanceRun: async (input) => {
      const result = await invoke<PerformanceRunSummary>(toolIds.pptEngine, "app_start_performance_run", input);
      setActivePerformanceRun(result.run_id);
      return result;
    },
    appendPerformanceEvents: (input) =>
      invoke(toolIds.pptEngine, "app_append_performance_events", input),
    finalizePerformanceRun: async (input) => {
      await flushPerformanceEvents({ throwOnError: true });
      const result = await invoke<FinalizePerformanceRunResult>(toolIds.pptEngine, "app_finalize_performance_run", input);
      if (result.run.status === "completed") setActivePerformanceRun(null);
      return result;
    },
    regeneratePerformanceReport: (input) =>
      invoke<PerformanceRunSummary>(toolIds.pptEngine, "app_regenerate_performance_report", input),
    abandonPerformanceRun: async (input) => {
      await flushPerformanceEvents({ throwOnError: true });
      const result = await invoke<PerformanceRunSummary>(toolIds.pptEngine, "app_abandon_performance_run", input);
      setActivePerformanceRun(null);
      return result;
    },
    deletePerformanceRun: (input) =>
      invoke(toolIds.pptEngine, "app_delete_performance_run", input),
    preparePerformanceReport: (input) =>
      invoke<PreparePerformanceReportResult>(toolIds.pptEngine, "app_prepare_performance_report", input),
    beginGenerationRun: (input) =>
      invoke<GenerationRunTransaction>(toolIds.pptEngine, "app_begin_generation_run", input),
    prepareGenerationRun: (input) =>
      invoke<PrepareGenerationRunResult>(toolIds.pptEngine, "app_prepare_generation_run", input, { timeoutMs: LONG_RUNNING_TOOL_TIMEOUT_MS }),
    abandonGenerationRun: (input) =>
      invoke<GenerationRunTransaction>(toolIds.pptEngine, "app_abandon_generation_run", input),
    commitGenerationRun: (input) =>
      invoke<CommitGenerationRunResult>(toolIds.pptEngine, "app_commit_generation_run", input, { timeoutMs: LONG_RUNNING_TOOL_TIMEOUT_MS }),
    cleanupGenerationRun: (input) =>
      invoke<{ cleaned: true }>(toolIds.pptEngine, "app_cleanup_generation_run", input),
    getWorkspaceGenerationRun: (input) =>
      invoke<GenerationRunTransaction | null>(toolIds.pptEngine, "app_get_workspace_generation_run", input),
    listWorkspaces: () =>
      invoke<ListWorkspacesResult>(toolIds.pptEngine, "app_list_workspaces", {}),
    getWorkspaceDefaults: () =>
      invoke<WorkspaceDefaultsResult>(toolIds.pptEngine, "app_get_workspace_defaults", {}),
    patchWorkspaceDefaults: (input: PatchWorkspaceDefaultsInput) =>
      invoke<WorkspaceDefaultsResult>(toolIds.pptEngine, "app_patch_workspace_defaults", input),
    createWorkspace: (input) =>
      invoke<CreateWorkspaceResult>(toolIds.pptEngine, "app_create_workspace", input),
    openWorkspace: (input) =>
      invokeWorkspaceResult("app_open_workspace", input),
    installWorkspaceAuthoringKit: (input) =>
      invoke<WorkspaceAuthoringKitResult>(
        toolIds.pptEngine,
        "app_install_workspace_authoring_kit",
        input,
      ),
    prepareWorkspacePageSources: (input) =>
      invoke<PrepareWorkspacePageSourcesResult>(
        toolIds.pptEngine,
        "app_prepare_workspace_page_sources",
        input,
      ),
    reconcileWorkspacePageSources: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_reconcile_workspace_page_sources",
        input,
      ),
    getWorkspacePageSourceFingerprint: (input) =>
      invoke<WorkspacePageSourceFingerprint>(
        toolIds.pptEngine,
        "app_get_workspace_page_source_fingerprint",
        input,
      ),
    commitWorkspaceStyleGuideHostUpload: (input) =>
      invoke<CommitWorkspaceStyleGuideResult>(
        toolIds.pptEngine,
        "app_commit_workspace_style_guide_host_upload",
        input,
      ),
    confirmWorkspaceRequirements: (input) =>
      invokeHostUploadJson<ConfirmWorkspaceRequirementsResult>(
        toolIds.pptEngine,
        "app_confirm_workspace_requirements",
        input,
      ),
    getWorkspaceStyleGuideStatus: (input) =>
      invoke<WorkspaceStyleGuideStatus>(
        toolIds.pptEngine,
        "app_get_workspace_style_guide_status",
        input,
      ),
    getWorkspaceStyleGuide: (input) =>
      invoke<WorkspaceStyleGuide>(toolIds.pptEngine, "app_get_workspace_style_guide", input),
    initializePageProgress: (input) =>
      invoke<PageProgress>(toolIds.pptEngine, "app_initialize_page_progress", input),
    preparePageRefinement: (input) =>
      invoke<PreparePageRefinementResult>(toolIds.pptEngine, "app_prepare_page_refinement", input),
    commitDeckRefinement: (input) =>
      invoke<CommitDeckRefinementResult>(toolIds.pptEngine, "app_commit_deck_refinement", input),
    listStyleProfiles: () =>
      invoke<ListStyleProfilesResult>(
        toolIds.pptEngine,
        "app_list_style_profiles",
        {}
      ),
    getStyleProfilePreview: (input) =>
      invoke<GetStyleProfilePreviewResult>(
        toolIds.pptEngine,
        "app_get_style_profile_preview",
        input
      ),
    getStyleProfile: (input) =>
      invoke<GetStyleProfileResult>(
        toolIds.pptEngine,
        "app_get_style_profile",
        input
      ),
    prepareStyleProfileCreation: (input = {}) =>
      invoke<PrepareStyleProfileCreationResult>(
        toolIds.pptEngine,
        "app_prepare_style_profile_creation",
        input
      ),
    commitStyleProfileReferenceHostUpload: (input) =>
      invoke<CommitStyleProfileReferenceHostUploadResult>(
        toolIds.pptEngine,
        "app_commit_style_profile_reference_host_upload",
        {
          creation_id: input.creation_id,
          filename: input.filename,
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          host_upload: input.host_upload,
        }
      ),
    getStyleProfileCreationContext: (input) =>
      invoke<GetStyleProfileCreationContextResult>(
        toolIds.pptEngine,
        "app_get_style_profile_creation_context",
        input
      ),
    getStyleProfileDraftFingerprint: (input) =>
      invoke<StyleProfileDraftFingerprint>(
        toolIds.pptEngine,
        "app_get_style_profile_draft_fingerprint",
        input
      ),
    getStyleProfileDraft: (input) =>
      invoke<GetStyleProfileDraftResult>(
        toolIds.pptEngine,
        "app_get_style_profile_draft",
        input
      ),
    publishStyleProfile: (input) =>
      invoke<PublishStyleProfileResult>(
        toolIds.pptEngine,
        "app_publish_style_profile",
        input
      ),
    selectWorkspaceStyleProfile: (input) =>
      invokeHostUploadJson<SelectWorkspaceStyleProfileResult>(
        toolIds.pptEngine,
        "app_select_workspace_style_profile",
        input
      ),
    getWorkspaceStyleProfile: (input) =>
      invoke<GetWorkspaceStyleProfileResult>(
        toolIds.pptEngine,
        "app_get_workspace_style_profile",
        input
      ),
    clearWorkspaceStyleProfile: (input) =>
      invokeHostUploadJson<ClearWorkspaceStyleProfileResult>(
        toolIds.pptEngine,
        "app_clear_workspace_style_profile",
        input
      ),
    commitUploadedSourceHostUpload: (input) =>
      invoke<CommitUploadedSourceHostUploadResult>(
        toolIds.pptEngine,
        "app_commit_uploaded_source_host_upload",
        {
          workspace_dir: input.workspace_dir,
          filename: input.filename,
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          host_upload: input.host_upload,
        }
      ),
    listUploadedSources: (input) =>
      invoke<ListUploadedSourcesResult>(
        toolIds.pptEngine,
        "app_list_uploaded_sources",
        input
      ),
    removeUploadedSource: (input) =>
      invoke<RemoveUploadedSourceResult>(
        toolIds.pptEngine,
        "app_remove_uploaded_source",
        input
      ),
    prepareUploadedSourceAnalysisWorkspace: (input) =>
      invoke<PrepareUploadedSourceAnalysisWorkspaceResult>(
        toolIds.pptEngine,
        "app_prepare_uploaded_source_analysis_workspace",
        input
      ),
    recordUploadedSourceAnalysisDraft: (input) =>
      invoke<Record<string, unknown>>(
        toolIds.pptEngine,
        "app_record_uploaded_source_analysis_draft",
        input
      ),
    getUploadedSourceAnalysisDraft: (input) =>
      invoke<Record<string, unknown>>(
        toolIds.pptEngine,
        "app_get_uploaded_source_analysis_draft",
        input
      ),
    getUploadedSourceAnalysisDraftFingerprint: (input) =>
      invoke<UploadedSourceAnalysisDraftFingerprint>(
        toolIds.pptEngine,
        "app_get_uploaded_source_analysis_draft_fingerprint",
        input
      ),
    recordUploadedSourceAnalysis: (input) =>
      invoke<Record<string, unknown>>(
        toolIds.pptEngine,
        "app_record_uploaded_source_analysis",
        input
      ),
    getUploadedSourceAnalysis: (input) =>
      invoke<Record<string, unknown>>(
        toolIds.pptEngine,
        "app_get_uploaded_source_analysis",
        input
      ),
    appendWorkspaceLog: async (input) => {
      const inlineSizeBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
      if (inlineSizeBytes <= WORKSPACE_LOG_INLINE_INVOKE_MAX_BYTES) {
        return invoke<AppendWorkspaceLogResult>(
          toolIds.pptEngine,
          "app_append_workspace_log",
          input,
        );
      }

      const entryJson = JSON.stringify(input.entry);
      const entryUpload = await hostUploadClient.uploadFile(
        new File([entryJson], "workspace-log-entry.json", { type: "application/json" }),
        {
          purpose: "user_artifact",
          metadata: {
            workspace_dir: input.workspace_dir,
            source: "ppt-app.workspace-log-entry",
          },
        },
      );
      return invoke<AppendWorkspaceLogResult>(
        toolIds.pptEngine,
        "app_append_workspace_log",
        {
          workspace_dir: input.workspace_dir,
          channel: input.channel,
          entry_upload: entryUpload,
          ...(input.payload_keys ? { payload_keys: input.payload_keys } : {}),
          ...(input.inline_payload_max_bytes === undefined
            ? {}
            : { inline_payload_max_bytes: input.inline_payload_max_bytes }),
        },
      );
    },
    getWorkspaceRequirements: (input) =>
      invoke<PresentationRequirements>(
        toolIds.pptEngine,
        "app_get_workspace_requirements",
        input
      ),
    updateWorkspaceRequirements: (input) =>
      invokeWorkspaceResult("app_update_workspace_requirements", input),
    getWorkspaceOutline: (input) =>
      invoke<WorkspaceOutline>(
        toolIds.pptEngine,
        "app_get_workspace_outline",
        input
      ),
    resetWorkspaceOutline: (input) =>
      invokeWorkspaceResult("app_reset_workspace_outline", input),
    saveWorkspaceOutlineDraft: (input) =>
      invokeWorkspaceResult("app_save_workspace_outline_draft", input),
    confirmWorkspaceOutline: (input) =>
      invokeWorkspaceResult("app_confirm_workspace_outline", input),
    updateWorkspaceSettings: (input) =>
      invoke<UpdateWorkspaceSettingsResult>(
        toolIds.pptEngine,
        "app_patch_workspace_settings",
        input
      ),
    updateWorkspacePages: (input) =>
      invokeWorkspaceResult("app_update_workspace_pages", input),
    duplicateWorkspacePage: (input) =>
      invokeWorkspaceResult("app_duplicate_workspace_page", input),
    updateWorkspaceTitle: (input) =>
      invokeWorkspaceResult("app_update_workspace_title", input),
    deleteWorkspace: (input) =>
      invoke<DeleteWorkspaceResult>(toolIds.pptEngine, "app_delete_workspace", input),
    duplicateWorkspace: (input) =>
      invoke<DuplicateWorkspaceResult>(toolIds.pptEngine, "app_duplicate_workspace", input),
    createProject: (input) =>
      invoke<ProjectResult>(toolIds.pptEngine, "app_create_project", input),
    getProject: (input) =>
      invoke<ProjectResult>(toolIds.pptEngine, "app_get_project", input),
    recordRequirements: (input) =>
      invoke<ProjectResult>(
        toolIds.pptEngine,
        "app_record_requirements",
        input
      ),
    listTemplates: () =>
      invoke<{ groups?: TemplateSummary[]; count?: number }>(
        toolIds.pptEngine,
        "app_list_template_groups",
        {}
      ).then((result) => ({
        templates: result.groups ?? [],
        count: result.count ?? result.groups?.length ?? 0,
      })),
    selectTemplate: (input) =>
      invokeHostUploadJson<SelectTemplateResult>(
        toolIds.pptEngine,
        "app_select_workspace_template",
        input
      ),
    getTemplatePlanningContext: (input) =>
      invoke<TemplatePlanningContext>(
        toolIds.pptEngine,
        "app_get_template_planning_context",
        input
      ),
    getWorkspaceThemeContext: (input) =>
      invoke<WorkspaceThemeContext>(
        toolIds.pptEngine,
        "app_get_workspace_theme_context",
        input
      ),
    validateWorkspaceThemeToken: (input) =>
      invoke<WorkspaceThemeValidationResult>(
        toolIds.pptEngine,
        "app_validate_workspace_theme_token",
        input
      ),
    recordWorkspaceThemeToken: (input) =>
      invokeHostUploadJson<RecordWorkspaceThemeTokenResult>(
        toolIds.pptEngine,
        "app_record_workspace_theme_token",
        input
      ),
    recordPagePlan: (input) =>
      invoke<PagePlan>(toolIds.pptEngine, "app_record_page_plan", input),
    getPagePlan: (input) =>
      invoke<PagePlan>(toolIds.pptEngine, "app_get_page_plan", input),
    preparePageFiles: (input) =>
      invoke<PreparePageFilesResult>(
        toolIds.pptEngine,
        "app_prepare_page_files",
        input
      ),
    prepareDeckRefinementPageFiles: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_prepare_deck_refinement_page_files",
        input
      ),
    getWorkspacePageFileFingerprints: (input) =>
      invoke<GetWorkspacePageFileFingerprintsResult>(
        toolIds.pptEngine,
        "app_get_workspace_page_file_fingerprints",
        input,
      ),
    prepareSharedResearchWorkspace: (input) =>
      invokeHostUploadJson<SharedResearchContextResult>(toolIds.pptEngine, "app_prepare_shared_research_workspace", input),
    getSharedResearchContext: (input) =>
      invokeHostUploadJson<SharedResearchContextResult>(toolIds.pptEngine, "app_get_shared_research_context", input),
    patchSharedResearchProgress: (input) =>
      invoke<PatchSharedResearchProgressResult>(toolIds.pptEngine, "app_patch_shared_research_progress", input),
    publishPreparedWebResearchBatch: (input) =>
      invoke<PublishSharedResearchBatchResult>(toolIds.pptEngine, "app_publish_prepared_web_research_batch", input),
    publishPreparedImageResearchBatch: (input) =>
      invoke<PublishSharedResearchBatchResult>(toolIds.pptEngine, "app_publish_prepared_image_research_batch", input),
    importSharedResearchImageHostUpload: (input) =>
      invoke<ImportSharedResearchImageResult>(toolIds.pptEngine, "app_import_shared_research_image_host_upload", input),
    getPageProgress: (input) =>
      invoke<PageProgress>(toolIds.pptEngine, "app_get_page_progress", input),
    recordPageProgress: (input) =>
      invoke<PageProgress>(
        toolIds.pptEngine,
        "app_record_page_progress",
        input
      ),
    renderWorkspacePagePreview: (input) =>
      invoke<RenderWorkspacePagePreviewResult>(
        toolIds.pptEngine,
        "app_render_workspace_page_preview",
        input,
        { timeoutMs: LONG_RUNNING_TOOL_TIMEOUT_MS },
      ),
    uploadCurrentPageScreenshot: (input) =>
      invoke<HostUploadRef>(
        toolIds.pptEngine,
        "app_upload_current_page_screenshot",
        input,
      ),
    getPageEditContext: (input) =>
      invoke<GetPageEditContextResult>(toolIds.pptEngine, "app_get_page_edit_context", input),
    saveManualPageRevision: (input) =>
      invoke<SaveManualPageRevisionResult>(toolIds.pptEngine, "app_save_manual_page_revision", input),
    restorePageSourceVersion: (input) =>
      invoke<RestorePageSourceVersionResult>(toolIds.pptEngine, "app_restore_page_source_version", input),
    getRenderedDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        toolIds.pptEngine,
        "app_get_rendered_deck_html",
        input
      ),
    getWorkspaceCover: (input) =>
      invoke<GetWorkspaceCoverResult>(
        toolIds.pptEngine,
        "app_get_workspace_cover",
        input
      ),
    recordOutline: (input) =>
      invoke<ProjectResult>(toolIds.pptEngine, "app_record_outline", input),
    renderDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        toolIds.pptEngine,
        "app_render_deck_html",
        input,
        { timeoutMs: LONG_RUNNING_TOOL_TIMEOUT_MS },
      ),
    recordDeckReview: (input) =>
      invoke<ProjectResult>(
        toolIds.pptEngine,
        "app_record_deck_review",
        input
      ),
    startPptxExport: (input) =>
      invoke<PptxExportJob>(
        toolIds.pptEngine,
        "app_start_pptx_export",
        input
      ),
    getPptxExportStatus: (input) =>
      invoke<PptxExportJob>(
        toolIds.pptEngine,
        "app_get_pptx_export_status",
        input
      ),
    exportPdf: (input: ExportPdfInput) =>
      invoke<ExportPdfResult>(toolIds.pptEngine, "app_export_pdf", input).then(
        normalizeExportPdfResult
      ),
    recordPdfExport: (input: RecordPdfExportInput) =>
      invokeWorkspaceResult("app_record_pdf_export", {
        workspace_dir: input.workspace_dir,
        pdf_path: input.pdfPath,
      }),
    publishExportArtifact: (input) =>
      invoke<PublishExportArtifactResult>(
        toolIds.pptEngine,
        "app_publish_export_artifact",
        {
          workspace_dir: input.workspace_dir,
          artifact_type: input.artifact_type,
        }
      ),
    getExportArtifactDownloadUrl: (input) =>
      invoke<ExportArtifactDownloadUrlResult>(
        toolIds.pptEngine,
        "app_get_export_artifact_download_url",
        {
          workspace_dir: input.workspace_dir,
          artifact_type: input.artifact_type,
        }
      ),
    prepareWorkspaceDiagnosticBundle: (input) =>
      invoke<PrepareWorkspaceDiagnosticBundleResult>(
        toolIds.pptEngine,
        "app_prepare_workspace_diagnostic_bundle",
        { workspace_dir: input.workspace_dir },
        { timeoutMs: LONG_RUNNING_TOOL_TIMEOUT_MS }
      )
  };
}
