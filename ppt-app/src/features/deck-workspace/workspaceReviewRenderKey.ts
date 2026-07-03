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
  const templateRecord = readRecord(workspace.template);
  const settingRecord = readRecord(workspace.setting);
  const outlineRecord = readRecord(workspace.outline);
  const pagePlanRecord = readRecord(workspace.page_plan);
  const pageProgressRecord = readRecord(workspace.page_progress);
  const pagesRecord = readRecord(workspace.pages);
  const manifestPath = readString(templateRecord, "manifest_path");
  const selectedAt = readString(templateRecord, "selected_at");
  const themeId = readString(settingRecord, "theme_id");
  const updatedParts = [
    themeId,
    readString(outlineRecord, "updated_at"),
    readString(pagePlanRecord, "updated_at"),
    readString(pageProgressRecord, "updated_at"),
    readString(pagesRecord, "updated_at"),
    selectedAt,
  ];
  return `${workspace.task_dir ?? workspace.workspace_dir}:${manifestPath}:${updatedParts.join(":")}`;
}
