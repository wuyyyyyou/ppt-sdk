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
  TemplatePlanningContext,
  WorkspaceDefaultsResult,
  WorkspaceResult,
} from "./types";
import { ANNA_SEARCH_TOOL, PPT_ENGINE_TOOL, PPT_GENER_TOOL } from "./toolManifests.generated";
import { createSearchAdapter } from "./searchAdapter";

const PPT_ENGINE_TOOL_ID =
  import.meta.env.VITE_PPT_ENGINE_TOOL_ID ??
  PPT_ENGINE_TOOL.id;
const PPT_GENER_TOOL_ID =
  import.meta.env.VITE_PPT_GENER_TOOL_ID ??
  PPT_GENER_TOOL.id;
const ANNA_SEARCH_TOOL_ID =
  import.meta.env.VITE_ANNA_SEARCH_TOOL_ID ??
  ANNA_SEARCH_TOOL.id;
const PPTX_EXPORT_TIMEOUT_MS = 600_000;

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
  const searchAdapter = createSearchAdapter({
    runtime,
    toolId: ANNA_SEARCH_TOOL_ID,
  });

  return {
    listWorkspaces: () =>
      invoke<ListWorkspacesResult>(PPT_ENGINE_TOOL_ID, "app_list_workspaces", {}),
    getWorkspaceDefaults: () =>
      invoke<WorkspaceDefaultsResult>(PPT_ENGINE_TOOL_ID, "app_get_workspace_defaults", {}),
    createWorkspace: (input) =>
      invoke<WorkspaceResult>(PPT_ENGINE_TOOL_ID, "app_create_workspace", input),
    openWorkspace: (input) =>
      invoke<WorkspaceResult>(PPT_ENGINE_TOOL_ID, "app_open_workspace", input),
    appendWorkspaceLog: (input) =>
      invoke<AppendWorkspaceLogResult>(
        PPT_ENGINE_TOOL_ID,
        "app_append_workspace_log",
        input
      ),
    getWorkspaceOutline: (input) =>
      invoke<WorkspaceOutline>(
        PPT_ENGINE_TOOL_ID,
        "app_get_workspace_outline",
        input
      ),
    updateWorkspaceOutline: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_update_workspace_outline",
        input
      ),
    updateWorkspaceSettings: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_update_workspace_settings",
        input
      ),
    updateWorkspacePages: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_update_workspace_pages",
        input
      ),
    duplicateWorkspacePage: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_duplicate_workspace_page",
        input
      ),
    updateWorkspaceTitle: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_update_workspace_title",
        input
      ),
    createProject: (input) =>
      invoke<ProjectResult>(PPT_ENGINE_TOOL_ID, "app_create_project", input),
    getProject: (input) =>
      invoke<ProjectResult>(PPT_ENGINE_TOOL_ID, "app_get_project", input),
    recordRequirements: (input) =>
      invoke<ProjectResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_requirements",
        input
      ),
    listTemplates: () =>
      invoke<{ groups?: TemplateSummary[]; count?: number }>(
        PPT_ENGINE_TOOL_ID,
        "app_list_template_groups",
        {}
      ).then((result) => ({
        templates: result.groups ?? [],
        count: result.count ?? result.groups?.length ?? 0,
      })),
    selectTemplate: (input) =>
      invoke(PPT_ENGINE_TOOL_ID, "app_select_workspace_template", input),
    getTemplatePlanningContext: (input) =>
      invoke<TemplatePlanningContext>(
        PPT_ENGINE_TOOL_ID,
        "app_get_template_planning_context",
        input
      ),
    recordPagePlan: (input) =>
      invoke<PagePlan>(PPT_ENGINE_TOOL_ID, "app_record_page_plan", input),
    getPagePlan: (input) =>
      invoke<PagePlan>(PPT_ENGINE_TOOL_ID, "app_get_page_plan", input),
    preparePageFiles: (input) =>
      invoke<PreparePageFilesResult>(
        PPT_ENGINE_TOOL_ID,
        "app_prepare_page_files",
        input
      ),
    prepareDeckRefinementPageFiles: (input) =>
      invoke(
        PPT_ENGINE_TOOL_ID,
        "app_prepare_deck_refinement_page_files",
        input
      ),
    getWorkspacePageFileFingerprints: (input) =>
      invoke<GetWorkspacePageFileFingerprintsResult>(
        PPT_ENGINE_TOOL_ID,
        "app_get_workspace_page_file_fingerprints",
        input,
      ),
    prepareResearchWorkspace: (input) =>
      invoke(PPT_ENGINE_TOOL_ID, "app_prepare_research_workspace", input),
    recordResearchPlan: (input) =>
      invoke<ResearchPlan>(PPT_ENGINE_TOOL_ID, "app_record_research_plan", input),
    getResearchPlan: (input) =>
      invoke<ResearchPlan>(PPT_ENGINE_TOOL_ID, "app_get_research_plan", input),
    recordResearchEvidence: (input) =>
      invoke<ResearchEvidenceIndex>(
        PPT_ENGINE_TOOL_ID,
        "app_record_research_evidence",
        input
      ),
    recordResearchEvidencePage: (input) =>
      invoke<ResearchEvidenceIndex>(
        PPT_ENGINE_TOOL_ID,
        "app_record_research_evidence_page",
        input
      ),
    getResearchEvidence: (input) =>
      invoke<ResearchEvidenceIndex>(
        PPT_ENGINE_TOOL_ID,
        "app_get_research_evidence",
        input
      ),
    recordResearchCurationDraft: (input) =>
      invoke(
        PPT_ENGINE_TOOL_ID,
        "app_record_research_curation_draft",
        input
      ),
    getResearchCurationDraft: (input) =>
      invoke(
        PPT_ENGINE_TOOL_ID,
        "app_get_research_curation_draft",
        input
      ),
    getResearchCurationDraftFingerprint: (input) =>
      invoke<ResearchCurationDraftFingerprint>(
        PPT_ENGINE_TOOL_ID,
        "app_get_research_curation_draft_fingerprint",
        input
      ),
    recordResearchEvidencePageMarkdown: (input) =>
      invoke(
        PPT_ENGINE_TOOL_ID,
        "app_record_research_evidence_page_markdown",
        input
      ),
    recordResearchStatus: (input) =>
      invoke<ResearchStatus>(PPT_ENGINE_TOOL_ID, "app_record_research_status", input),
    recordResearchStatusPage: (input) =>
      invoke<ResearchStatus>(PPT_ENGINE_TOOL_ID, "app_record_research_status_page", input),
    getResearchStatus: (input) =>
      invoke<ResearchStatus>(PPT_ENGINE_TOOL_ID, "app_get_research_status", input),
    webSearch: searchAdapter.webSearch,
    webFetch: searchAdapter.webFetch,
    imageSearch: searchAdapter.imageSearch,
    imageFetch: searchAdapter.imageFetch,
    getPageProgress: (input) =>
      invoke<PageProgress>(PPT_ENGINE_TOOL_ID, "app_get_page_progress", input),
    recordPageProgress: (input) =>
      invoke<PageProgress>(
        PPT_ENGINE_TOOL_ID,
        "app_record_page_progress",
        input
      ),
    renderWorkspacePagePreview: (input) =>
      invoke<RenderWorkspacePagePreviewResult>(
        PPT_ENGINE_TOOL_ID,
        "app_render_workspace_page_preview",
        input
      ),
    recordOutline: (input) =>
      invoke<ProjectResult>(PPT_ENGINE_TOOL_ID, "app_record_outline", input),
    renderDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        PPT_ENGINE_TOOL_ID,
        "app_render_deck_html",
        input
      ),
    recordDeckReview: (input) =>
      invoke<ProjectResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_deck_review",
        input
      ),
    prepareExportModel: (input) =>
      invoke<PrepareExportModelResult>(
        PPT_ENGINE_TOOL_ID,
        "app_prepare_export_model",
        input,
        { timeoutMs: PPTX_EXPORT_TIMEOUT_MS }
      ).then(normalizePrepareExportModelResult),
    startPptxExportModel: (input) =>
      invoke<PptxExportJob>(
        PPT_ENGINE_TOOL_ID,
        "app_start_pptx_export_model",
        input
      ),
    getPptxExportStatus: (input) =>
      invoke<PptxExportJob>(
        PPT_ENGINE_TOOL_ID,
        "app_get_pptx_export_status",
        input
      ),
    generatePptx: (input: GeneratePptxInput) =>
      invoke<GeneratePptxResult>(PPT_GENER_TOOL_ID, "generatePptx", {
        model_path: input.modelPath,
        output_path: input.outputPath,
      }, { timeoutMs: PPTX_EXPORT_TIMEOUT_MS }).then((result) =>
        normalizeGeneratePptxResult(result, input.outputPath)
      ),
    startGeneratePptx: (input) =>
      invoke<PptxExportJob>(PPT_GENER_TOOL_ID, "startGeneratePptx", {
        workspace_dir: input.workspace_dir,
        model_path: input.modelPath,
        output_path: input.outputPath,
        job_id: input.job_id,
      }),
    exportPdf: (input: ExportPdfInput) =>
      invoke<ExportPdfResult>(PPT_ENGINE_TOOL_ID, "app_export_pdf", input).then(
        normalizeExportPdfResult
      ),
    recordPptxExport: (input) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_pptx_export",
        {
          workspace_dir: input.workspace_dir,
          pptx_path: input.pptxPath,
          generator_result: input.generatorResult,
        }
      ),
    recordPdfExport: (input: RecordPdfExportInput) =>
      invoke<WorkspaceResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_pdf_export",
        {
          workspace_dir: input.workspace_dir,
          pdf_path: input.pdfPath,
        }
      ),
    getExportArtifactDownloadUrl: (input) =>
      invoke<ExportArtifactDownloadUrlResult>(
        PPT_ENGINE_TOOL_ID,
        "app_get_export_artifact_download_url",
        {
          workspace_dir: input.workspace_dir,
          artifact_type: input.artifact_type,
        }
      )
  };
}
