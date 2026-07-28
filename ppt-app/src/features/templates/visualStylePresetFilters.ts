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

export function createEmptyVisualStylePresetFilters(): VisualStylePresetFilters {
  return { user: "", use_case: "", industry: "", theme: "", color: "" };
}

export function buildVisualStylePresetFilterOptions(
  presets: readonly VisualStylePreset[],
): Record<VisualStylePresetFilterField, string[]> {
  return Object.fromEntries(
    VISUAL_STYLE_PRESET_FILTER_FIELDS.map((field) => [
      field,
      [...new Set(presets.map((preset) => preset[field]).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    ]),
  ) as Record<VisualStylePresetFilterField, string[]>;
}
