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
    requirements: {
      version: 1,
      status: "empty",
      source: null,
      candidates: {
        audience: [],
        purpose: [],
        desired_outcome: [],
        slide_count: [],
        output_language: [],
        visual_tone: [],
      },
      selections: {
        audience: null,
        purpose: null,
        desired_outcome: null,
        slide_count: null,
        output_language: null,
        visual_tone: null,
      },
      updated_at: null,
      confirmed_at: null,
    },
    outline: {
      version: 3,
      title: "",
      status: "empty",
      items: [],
      updated_at: null,
      confirmed_at: null,
    },
    page_progress: { version: 1, status: "idle", pages: [], updated_at: null },
  };
}
