import type { VisualStylePreset, VisualStylePresetColor } from "../../api/types";

export function sampleVisualStylePresetsByColor(
  presets: readonly VisualStylePreset[],
  color: VisualStylePresetColor,
  limit = 10,
  random = Math.random,
): VisualStylePreset[] {
  const matching = presets.filter((preset) => preset.color.includes(color));
  if (matching.length <= limit) return [...matching];

  const shuffled = [...matching];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}
