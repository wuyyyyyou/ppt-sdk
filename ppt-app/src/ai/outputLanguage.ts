import type { WorkspaceOutline, WorkspaceSettings } from "../api/types";

export const AUTO_OUTPUT_LANGUAGE = "auto";
export const DEFAULT_OUTPUT_LANGUAGE_OPTIONS = ["auto", "中文", "English"] as const;

export function normalizeOutputLanguage(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : AUTO_OUTPUT_LANGUAGE;
}

export function readSettingOutputLanguage(setting?: WorkspaceSettings | Record<string, unknown>): string {
  return normalizeOutputLanguage(setting?.output_language);
}

export function readOutlineOutputLanguage(
  outline: Pick<WorkspaceOutline, "output_language" | "source">
): string {
  const outlineLanguage = normalizeOutputLanguage(outline.output_language);
  if (outlineLanguage !== AUTO_OUTPUT_LANGUAGE) {
    return outlineLanguage;
  }

  const settingLanguage = readSettingOutputLanguage(outline.source?.setting);
  if (settingLanguage !== AUTO_OUTPUT_LANGUAGE) {
    return settingLanguage;
  }

  return "中文";
}
