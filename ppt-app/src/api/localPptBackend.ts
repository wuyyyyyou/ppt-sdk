import type { PptBackend } from "./pptBackend";
import type {
  GeneratePptxInput,
  GeneratePptxResult,
  PrepareExportModelResult,
  ProjectResult,
  RenderDeckHtmlResult
} from "./types";

const LOCAL_PPT_ENGINE_TOOL_ID = "tool-local-ppt-engine";
const LOCAL_PPT_GENER_TOOL_ID = "tool-local-ppt-gener";

interface LocalBackendOptions {
  baseUrl: string;
}

interface LocalToolResponse<T> {
  ok: boolean;
  result?: T;
  error?: {
    code?: number;
    message: string;
  };
}

export function createLocalPptBackend(options: LocalBackendOptions): PptBackend {
  async function invoke<T>(
    toolId: string,
    method: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${options.baseUrl}/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool_id: toolId, method, args })
    });

    if (!response.ok) {
      throw new Error(`Local tool invoke failed: ${response.status}`);
    }

    const payload = (await response.json()) as LocalToolResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "Local tool invoke failed.");
    }

    return payload.result as T;
  }

  return {
    createProject: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_create_project",
        input
      ),
    getProject: (input) =>
      invoke<ProjectResult>(LOCAL_PPT_ENGINE_TOOL_ID, "app_get_project", input),
    recordRequirements: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_record_requirements",
        input
      ),
    listTemplates: (input) =>
      invoke(LOCAL_PPT_ENGINE_TOOL_ID, "app_list_templates", input),
    selectTemplate: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_select_template",
        input
      ),
    recordOutline: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_record_outline",
        input
      ),
    renderDeckHtml: (input) =>
      invoke<RenderDeckHtmlResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_render_deck_html",
        input
      ),
    recordDeckReview: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_record_deck_review",
        input
      ),
    prepareExportModel: (input) =>
      invoke<PrepareExportModelResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_prepare_export_model",
        input
      ),
    generatePptx: (input: GeneratePptxInput) =>
      invoke<GeneratePptxResult>(
        LOCAL_PPT_GENER_TOOL_ID,
        "generatePptx",
        input
      ),
    recordPptxExport: (input) =>
      invoke<ProjectResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_record_pptx_export",
        input
      )
  };
}
