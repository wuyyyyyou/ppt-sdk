import type { AnnaRuntime } from "../runtime/annaRuntime";
import type { PptBackend } from "./pptBackend";
import type {
  AppendWorkspaceLogResult,
  ExportPdfInput,
  ExportPdfResult,
  GeneratePptxInput,
  GeneratePptxResult,
  PagePlan,
  PageProgress,
  TemplateSummary,
  WorkspaceOutline,
  ListWorkspacesResult,
  PreparePageFilesResult,
  PrepareExportModelResult,
  ProjectResult,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewResult,
  RecordPdfExportInput,
  TemplatePlanningContext,
  WorkspaceResult
} from "./types";

const PPT_ENGINE_TOOL_ID =
  import.meta.env.VITE_PPT_ENGINE_TOOL_ID ??
  "tool-lightvoss_5433-ppt-engine-6443rj2a";
const PPT_GENER_TOOL_ID =
  import.meta.env.VITE_PPT_GENER_TOOL_ID ??
  "tool-lightvoss_5433-ppt-gener-dc7ftcep";

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
    args: object
  ): Promise<T> {
    return unwrapToolResult<T>(
      await runtime.tools.invoke({ tool_id: toolId, method, args })
    );
  }

  return {
    listWorkspaces: () =>
      invoke<ListWorkspacesResult>(PPT_ENGINE_TOOL_ID, "app_list_workspaces", {}),
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
        input
      ).then(normalizePrepareExportModelResult),
    generatePptx: (input: GeneratePptxInput) =>
      invoke<GeneratePptxResult>(PPT_GENER_TOOL_ID, "generatePptx", {
        model_path: input.modelPath,
        output_path: input.outputPath,
      }).then((result) => normalizeGeneratePptxResult(result, input.outputPath)),
    exportPdf: (input: ExportPdfInput) =>
      invoke<ExportPdfResult>(PPT_ENGINE_TOOL_ID, "app_export_pdf", input).then(
        normalizeExportPdfResult
      ),
    recordPptxExport: (input) =>
      invoke<ProjectResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_pptx_export",
        {
          workspace_dir: input.workspace_dir,
          pptx_path: input.pptxPath,
          generator_result: input.generatorResult,
        }
      ),
    recordPdfExport: (input: RecordPdfExportInput) =>
      invoke<ProjectResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_pdf_export",
        {
          workspace_dir: input.workspace_dir,
          pdf_path: input.pdfPath,
        }
      )
  };
}
