import type { CreateWorkspaceResult, WorkspaceResult } from "../../api/types";

export function createInitialWorkspaceSnapshot(
  result: CreateWorkspaceResult,
): WorkspaceResult {
  return {
    workspace_root: result.workspace_root,
    workspace_id: result.workspace_id,
    workspace_dir: result.workspace_dir,
    task: {
      id: result.workspace_id,
      title: result.title,
      status: "initialized",
    },
    setting: result.setting,
    outline: {
      version: 2,
      title: "",
      output_language: result.setting.output_language,
      status: "draft",
      items: [],
      source: {
        prompt: "",
        context: [],
        setting: result.setting,
      },
      updated_at: null,
    },
    pages: {
      version: 1,
      pages: [],
      updated_at: null,
    },
    template: {
      version: 1,
      selected_template_group: "",
      selected_template_group_name: "",
      template_dir: "",
      manifest_path: "",
      catalog_json_path: "",
      data_dir_path: "",
      selected_at: null,
    },
  };
}
