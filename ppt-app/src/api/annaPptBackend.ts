import type { AnnaRuntime } from "../runtime/annaRuntime";
import type { PptBackend } from "./pptBackend";
import type {
  AppendWorkspaceLogResult,
  GeneratePptxInput,
  GeneratePptxResult,
  TemplateSummary,
  WorkspaceOutline,
  ListWorkspacesResult,
  PrepareExportModelResult,
  ProjectResult,
  RenderDeckHtmlResult,
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
      ),
    generatePptx: (input: GeneratePptxInput) =>
      invoke<GeneratePptxResult>(PPT_GENER_TOOL_ID, "generatePptx", input),
    recordPptxExport: (input) =>
      invoke<ProjectResult>(
        PPT_ENGINE_TOOL_ID,
        "app_record_pptx_export",
        input
      )
  };
}
