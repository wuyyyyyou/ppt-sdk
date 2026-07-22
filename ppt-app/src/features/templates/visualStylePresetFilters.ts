import type { VisualStylePreset } from "../../api/types";

export const VISUAL_STYLE_PRESET_FILTER_FIELDS = ["user", "use_case", "industry", "theme", "color"] as const;

export type VisualStylePresetFilterField = (typeof VISUAL_STYLE_PRESET_FILTER_FIELDS)[number];
export type VisualStylePresetFilters = Record<VisualStylePresetFilterField, string>;

export function matchesVisualStylePresetFilters(
  preset: VisualStylePreset,
  filters: VisualStylePresetFilters,
): boolean {
  return VISUAL_STYLE_PRESET_FILTER_FIELDS.every((field) => !filters[field] || preset[field] === filters[field]);
}
