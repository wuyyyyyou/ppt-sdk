import type { WorkspaceResult } from "../../api/types";

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

export function createWorkspaceReviewRenderKey(workspace: WorkspaceResult) {
  const outlineRecord = readRecord(workspace.outline);
  const pageProgressRecord = readRecord(workspace.page_progress);
  const manifestPath = workspace.files?.manifest ?? "manifest.json";
  const updatedParts = [
    readString(outlineRecord, "updated_at"),
    readString(pageProgressRecord, "updated_at"),
  ];
  return `${workspace.task_dir ?? workspace.workspace_dir}:${manifestPath}:${updatedParts.join(":")}`;
}
