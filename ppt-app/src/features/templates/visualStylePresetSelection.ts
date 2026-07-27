import type { VisualStylePreset, VisualStylePresetSelection } from "../../api/types";

export function toVisualStylePresetSelection(
  preset: VisualStylePreset | null,
): VisualStylePresetSelection | null {
  if (!preset) return null;
  return {
    id: preset.id,
    version: preset.version,
    name: preset.name,
    description: preset.description,
  };
}
