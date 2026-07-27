import type { VisualStylePreset } from "../../api/types";

export const VISUAL_STYLE_PRESET_FILTER_FIELDS = ["user", "use_case", "industry", "theme", "color"] as const;

export type VisualStylePresetFilterField = (typeof VISUAL_STYLE_PRESET_FILTER_FIELDS)[number];
export type VisualStylePresetFilters = Record<VisualStylePresetFilterField, string>;

export function sortVisualStylePresetsByScore(
  presets: readonly VisualStylePreset[],
): VisualStylePreset[] {
  return [...presets].sort((left, right) => {
    if (left.score === undefined) return right.score === undefined ? 0 : 1;
    if (right.score === undefined) return -1;
    return right.score - left.score;
  });
}

export function matchesVisualStylePresetFilters(
  preset: VisualStylePreset,
  filters: VisualStylePresetFilters,
): boolean {
  return VISUAL_STYLE_PRESET_FILTER_FIELDS.every((field) => {
    const selected = filters[field];
    if (!selected) return true;
    const value = preset[field];
    return Array.isArray(value) ? value.some((entry) => entry === selected) : value === selected;
  });
}

export function filterVisualStylePresets(
  presets: readonly VisualStylePreset[],
  filters: VisualStylePresetFilters,
): VisualStylePreset[] {
  return sortVisualStylePresetsByScore(
    presets.filter((preset) => matchesVisualStylePresetFilters(preset, filters)),
  );
}
