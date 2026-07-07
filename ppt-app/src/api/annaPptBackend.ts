import type { AnnaRuntime } from "../runtime/annaRuntime";
import type { PptBackend } from "./pptBackend";
import type {
  AppendWorkspaceLogResult,
  ExportPdfInput,
  ExportArtifactDownloadUrlResult,
  ExportPdfResult,
  GeneratePptxInput,
  GeneratePptxResult,
  GetWorkspacePageFileFingerprintsResult,
  ImageFetchResult,
  ImageSearchResult,
  PagePlan,
  PageProgress,
  TemplateSummary,
  WorkspaceOutline,
  ListWorkspacesResult,
  PreparePageFilesResult,
  PrepareExportModelResult,
  ProjectResult,
  PptxExportJob,
  ResearchCurationDraftFingerprint,
  ResearchEvidenceIndex,
  ResearchPlan,
  ResearchStatus,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewResult,
  RecordPdfExportInput,
  SelectTemplateResult,
  TemplatePlanningContext,
  WorkspaceThemeContext,
  WorkspaceThemeValidationResult,
  RecordWorkspaceThemeTokenResult,
  WorkspaceDefaultsResult,
  WorkspaceResult,
  BeginUploadedSourceUploadResult,
  CommitUploadedSourceUploadResult,
  UploadUploadedSourceResult,
  ListUploadedSourcesResult,
  RemoveUploadedSourceResult,
  PrepareUploadedSourceAnalysisWorkspaceResult,
  UploadedSourceAnalysisDraftFingerprint,
} from "./types";
import { createSearchAdapter } from "./searchAdapter";
import { resolvePptBundledToolIds } from "./bundledToolIds";

const PPTX_EXPORT_TIMEOUT_MS = 600_000;

interface HttpJsonReference {
  workspace_url?: string;
  result_url?: string;
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

function readHttpJsonReferenceUrl(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const workspaceUrl = value.workspace_url;
  if (typeof workspaceUrl === "string" && workspaceUrl.length > 0) {
    return workspaceUrl;
  }

  const resultUrl = value.result_url;
  return typeof resultUrl === "string" && resultUrl.length > 0 ? resultUrl : "";
}

async function resolveHttpJsonReference<T>(value: T | HttpJsonReference): Promise<T> {
  const url = readHttpJsonReferenceUrl(value);
  if (!url) {
    return value as T;
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch tool JSON reference: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
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

function normalizePrepareExportModelResult(
  value: unknown
): PrepareExportModelResult {
  const record = isRecord(value) ? value : {};

  return {
    modelPath: readString(record, "modelPath", "model_path"),
    htmlPath: readString(record, "htmlPath", "html_path"),
    outputDir: readString(record, "outputDir", "output_dir"),
  };
}

function normalizeGeneratePptxResult(
  value: unknown,
  fallbackOutputPath: string
): GeneratePptxResult {
  const record = isRecord(value) ? value : {};

  return {
    ...(record as object),
    pptxPath:
      readString(record, "pptxPath", "pptx_path", "path") || fallbackOutputPath,
    summary: record.summary ?? value,
  };
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
  async function invoke<T>(
    toolId: string,
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    const input =
      options?.timeoutMs === undefined
        ? { tool_id: toolId, method, args }
        : { tool_id: toolId, method, args, timeoutMs: options.timeoutMs };

    return unwrapToolResult<T>(
      await runtime.tools.invoke(input, options)
    );
  }
  async function invokeHttpJson<T>(
    toolId: string,
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    return resolveHttpJsonReference<T>(
      await invoke<T | HttpJsonReference>(toolId, method, args, options)
    );
  }
  const invokeWorkspaceResult = (
    method: string,
    args: object,
    options?: { timeoutMs?: number }
  ) => invokeHttpJson<WorkspaceResult>(toolIds.pptEngine, method, args, options);
  const searchAdapter = createSearchAdapter({
    runtime,
    toolId: toolIds.annaSearch,
  });

  return {
    listWorkspaces: () =>
      invoke<ListWorkspacesResult>(toolIds.pptEngine, "app_list_workspaces", {}),
    getWorkspaceDefaults: () =>
      invoke<WorkspaceDefaultsResult>(toolIds.pptEngine, "app_get_workspace_defaults", {}),
    createWorkspace: (input) =>
      invokeWorkspaceResult("app_create_workspace", input),
    openWorkspace: (input) =>
      invokeWorkspaceResult("app_open_workspace", input),
    beginUploadedSourceUpload: (input) =>
      invoke<BeginUploadedSourceUploadResult>(
        toolIds.pptEngine,
        "app_begin_uploaded_source_upload",
        input
      ),
    commitUploadedSourceUpload: (input) =>
      invoke<CommitUploadedSourceUploadResult>(
        toolIds.pptEngine,
        "app_commit_uploaded_source_upload",
        input
      ),
    uploadUploadedSource: (input) =>
      invoke<UploadUploadedSourceResult>(
        toolIds.pptEngine,
        "app_upload_uploaded_source",
        {
          workspace_dir: input.workspace_dir,
          filename: input.filename,
          mime_type: input.mime_type,
          content_base64: input.content_base64,
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
    appendWorkspaceLog: (input) =>
      invoke<AppendWorkspaceLogResult>(
        toolIds.pptEngine,
        "app_append_workspace_log",
        input
      ),
    getWorkspaceOutline: (input) =>
      invoke<WorkspaceOutline>(
        toolIds.pptEngine,
        "app_get_workspace_outline",
        input
      ),
    updateWorkspaceOutline: (input) =>
      invokeWorkspaceResult("app_update_workspace_outline", input),
    updateWorkspaceSettings: (input) =>
      invokeWorkspaceResult("app_update_workspace_settings", input),
    updateWorkspacePages: (input) =>
      invokeWorkspaceResult("app_update_workspace_pages", input),
    duplicateWorkspacePage: (input) =>
      invokeWorkspaceResult("app_duplicate_workspace_page", input),
    updateWorkspaceTitle: (input) =>
      invokeWorkspaceResult("app_update_workspace_title", input),
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
      invokeHttpJson<SelectTemplateResult>(
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
      invokeHttpJson<RecordWorkspaceThemeTokenResult>(
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
    prepareResearchWorkspace: (input) =>
      invoke(toolIds.pptEngine, "app_prepare_research_workspace", input),
    recordResearchPlan: (input) =>
      invoke<ResearchPlan>(toolIds.pptEngine, "app_record_research_plan", input),
    getResearchPlan: (input) =>
      invoke<ResearchPlan>(toolIds.pptEngine, "app_get_research_plan", input),
    recordResearchEvidence: (input) =>
      invoke<ResearchEvidenceIndex>(
        toolIds.pptEngine,
        "app_record_research_evidence",
        input
      ),
    recordResearchEvidencePage: (input) =>
      invoke<ResearchEvidenceIndex>(
        toolIds.pptEngine,
        "app_record_research_evidence_page",
        input
      ),
    getResearchEvidence: (input) =>
      invoke<ResearchEvidenceIndex>(
        toolIds.pptEngine,
        "app_get_research_evidence",
        input
      ),
    finalizeResearchVisualAssets: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_finalize_research_visual_assets",
        input
      ),
    recordResearchCurationDraft: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_record_research_curation_draft",
        input
      ),
    getResearchCurationDraft: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_get_research_curation_draft",
        input
      ),
    getResearchCurationDraftFingerprint: (input) =>
      invoke<ResearchCurationDraftFingerprint>(
        toolIds.pptEngine,
        "app_get_research_curation_draft_fingerprint",
        input
      ),
    recordResearchEvidencePageMarkdown: (input) =>
      invoke(
        toolIds.pptEngine,
        "app_record_research_evidence_page_markdown",
        input
      ),
    recordResearchStatus: (input) =>
      invoke<ResearchStatus>(toolIds.pptEngine, "app_record_research_status", input),
    recordResearchStatusPage: (input) =>
      invoke<ResearchStatus>(toolIds.pptEngine, "app_record_research_status_page", input),
    getResearchStatus: (input) =>
      invoke<ResearchStatus>(toolIds.pptEngine, "app_get_research_status", input),
    webSearch: searchAdapter.webSearch,
    webFetch: searchAdapter.webFetch,
    imageSearch: searchAdapter.imageSearch,
    imageFetch: searchAdapter.imageFetch,
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
        input
      ),
    getRenderedDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        toolIds.pptEngine,
        "app_get_rendered_deck_html",
        input
      ),
    recordOutline: (input) =>
      invoke<ProjectResult>(toolIds.pptEngine, "app_record_outline", input),
    renderDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        toolIds.pptEngine,
        "app_render_deck_html",
        input
      ),
    recordDeckReview: (input) =>
      invoke<ProjectResult>(
        toolIds.pptEngine,
        "app_record_deck_review",
        input
      ),
    prepareExportModel: (input) =>
      invoke<PrepareExportModelResult>(
        toolIds.pptEngine,
        "app_prepare_export_model",
        input,
        { timeoutMs: PPTX_EXPORT_TIMEOUT_MS }
      ).then(normalizePrepareExportModelResult),
    startPptxExportModel: (input) =>
      invoke<PptxExportJob>(
        toolIds.pptEngine,
        "app_start_pptx_export_model",
        input
      ),
    getPptxExportStatus: (input) =>
      invoke<PptxExportJob>(
        toolIds.pptEngine,
        "app_get_pptx_export_status",
        input
      ),
    generatePptx: (input: GeneratePptxInput) =>
      invoke<GeneratePptxResult>(toolIds.pptGener, "generatePptx", {
        model_path: input.modelPath,
        output_path: input.outputPath,
      }, { timeoutMs: PPTX_EXPORT_TIMEOUT_MS }).then((result) =>
        normalizeGeneratePptxResult(result, input.outputPath)
      ),
    startGeneratePptx: (input) =>
      invoke<PptxExportJob>(toolIds.pptGener, "startGeneratePptx", {
        workspace_dir: input.workspace_dir,
        model_path: input.modelPath,
        output_path: input.outputPath,
        job_id: input.job_id,
      }),
    exportPdf: (input: ExportPdfInput) =>
      invoke<ExportPdfResult>(toolIds.pptEngine, "app_export_pdf", input).then(
        normalizeExportPdfResult
      ),
    recordPptxExport: (input) =>
      invokeWorkspaceResult("app_record_pptx_export", {
        workspace_dir: input.workspace_dir,
        pptx_path: input.pptxPath,
        generator_result: input.generatorResult,
      }),
    recordPdfExport: (input: RecordPdfExportInput) =>
      invokeWorkspaceResult("app_record_pdf_export", {
        workspace_dir: input.workspace_dir,
        pdf_path: input.pdfPath,
      }),
    getExportArtifactDownloadUrl: (input) =>
      invoke<ExportArtifactDownloadUrlResult>(
        toolIds.pptEngine,
        "app_get_export_artifact_download_url",
        {
          workspace_dir: input.workspace_dir,
          artifact_type: input.artifact_type,
        }
      )
  };
}
