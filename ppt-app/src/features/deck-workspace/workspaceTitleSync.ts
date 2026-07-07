import type { WorkspaceResult } from "../../api/types";

export const DEFAULT_WORKSPACE_TITLE_PATTERN =
  /^(?:新建工作区|新建任务|New Workspace|New Task)-\d{4}-\d{2}-\d{2}$/;

function readWorkspaceTaskTitle(workspace: WorkspaceResult) {
  return typeof workspace.task === "object" &&
    workspace.task !== null &&
    typeof (workspace.task as { title?: unknown }).title === "string"
    ? (workspace.task as { title: string }).title
    : workspace.task_id ?? workspace.workspace_id;
}

function readWorkspaceOutlineTitle(workspace: WorkspaceResult) {
  return typeof workspace.outline === "object" &&
    workspace.outline !== null &&
    !Array.isArray(workspace.outline) &&
    typeof (workspace.outline as { title?: unknown }).title === "string"
    ? (workspace.outline as { title: string }).title
    : "";
}

export function shouldAutoSyncWorkspaceTitleFromOutline(
  workspace: WorkspaceResult,
  nextTitle: string
) {
  const currentTitle = readWorkspaceTaskTitle(workspace).trim();
  const previousOutlineTitle = readWorkspaceOutlineTitle(workspace).trim();

  if (!currentTitle || currentTitle === nextTitle) return false;
  if (DEFAULT_WORKSPACE_TITLE_PATTERN.test(currentTitle)) return true;

  return Boolean(previousOutlineTitle && currentTitle === previousOutlineTitle);
}
