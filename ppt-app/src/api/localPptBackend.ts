import type { PptBackend } from "./pptBackend";
import type {
  GeneratePptxInput,
  GeneratePptxResult,
  ListWorkspacesResult,
  PrepareExportModelResult,
  ProjectResult,
  RenderDeckHtmlResult,
  WorkspaceResult
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

export function createLocalPptBackend(options: LocalBackendOptions): PptBackend {
  async function invoke<T>(
    toolId: string,
    method: string,
    args: object
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

    return unwrapToolResult<T>(payload.result);
  }

  return {
    listWorkspaces: () =>
      invoke<ListWorkspacesResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_list_workspaces",
        {}
      ),
    createWorkspace: (input) =>
      invoke<WorkspaceResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_create_workspace",
        input
      ),
    openWorkspace: (input) =>
      invoke<WorkspaceResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_open_workspace",
        input
      ),
    updateWorkspaceSettings: (input) =>
      invoke<WorkspaceResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_update_workspace_settings",
        input
      ),
    updateWorkspaceTitle: (input) =>
      invoke<WorkspaceResult>(
        LOCAL_PPT_ENGINE_TOOL_ID,
        "app_update_workspace_title",
        input
      ),
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
