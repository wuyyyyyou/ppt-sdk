import type {
  VisualStylePreset,
  VisualStylePresetColor,
  VisualStylePresetTheme,
} from "../../api/types";
import {
  sortVisualStylePresetsByScore,
  VISUAL_STYLE_PRESET_FILTER_FIELDS,
  type VisualStylePresetFilterField,
} from "./visualStylePresetFilters";
export { toVisualStylePresetSelection } from "./visualStylePresetSelection";

export const NO_VISUAL_STYLE_PRESET_ID = "none";

interface VisualStylePresetSource {
  id: string;
  version: number;
  ppt_number: number;
  score?: number;
  theme: VisualStylePresetTheme;
  color: VisualStylePresetColor[];
  name: string;
  description: string;
  user: string;
  use_case: string;
  industry: string;
  style_guide: string;
  preview_images: Array<{ path: string; alt: string }>;
}

const presetModules = import.meta.glob("./presets/*/preset.json", {
  eager: true,
  import: "default",
}) as Record<string, VisualStylePresetSource>;

const previewModules = import.meta.glob("./presets/*/images/*.{png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const VISUAL_STYLE_PRESET_THEMES = new Set<VisualStylePresetTheme>(["dark", "light"]);
const VISUAL_STYLE_PRESET_COLORS = new Set<VisualStylePresetColor>([
  "black",
  "white",
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "brown",
  "beige",
]);

function assertSource(value: VisualStylePresetSource, configPath: string): void {
  if (!value || typeof value !== "object") throw new Error(`Invalid visual style preset: ${configPath}`);
  if (typeof value.id !== "string" || !value.id || !Number.isInteger(value.version) || value.version < 1) {
    throw new Error(`Invalid visual style preset identity: ${configPath}`);
  }
  if (!Number.isInteger(value.ppt_number) || value.ppt_number < 1) {
    throw new Error(`Invalid visual style preset PPT number: ${configPath}`);
  }
  if (value.score !== undefined && !Number.isFinite(value.score)) {
    throw new Error(`Invalid visual style preset score: ${configPath}`);
  }
  if (!VISUAL_STYLE_PRESET_THEMES.has(value.theme)) {
    throw new Error(`Invalid visual style preset theme: ${configPath}`);
  }
  if (
    !Array.isArray(value.color) ||
    value.color.length === 0 ||
    value.color.some((color) => !VISUAL_STYLE_PRESET_COLORS.has(color)) ||
    new Set(value.color).size !== value.color.length
  ) {
    throw new Error(`Invalid visual style preset colors: ${configPath}`);
  }
  if (!value.name || !value.description || !value.style_guide || !Array.isArray(value.preview_images)) {
    throw new Error(`Incomplete visual style preset: ${configPath}`);
  }
  const taxonomy = [value.user, value.use_case, value.industry];
  if (taxonomy.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`Incomplete visual style preset taxonomy: ${configPath}`);
  }
}

function loadVisualStylePresets(): VisualStylePreset[] {
  const ids = new Set<string>();
  const pptNumbers = new Set<number>();

  return sortVisualStylePresetsByScore(
    Object.entries(presetModules)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([configPath, source]) => {
        assertSource(source, configPath);
        const match = /^\.\/presets\/([^/]+)\/preset\.json$/.exec(configPath);
        if (!match || match[1] !== source.id) {
          throw new Error(`Preset directory must match its id: ${configPath}`);
        }
        if (ids.has(source.id)) throw new Error(`Duplicate visual style preset id: ${source.id}`);
        ids.add(source.id);
        if (pptNumbers.has(source.ppt_number)) {
          throw new Error(`Duplicate visual style preset PPT number: ${source.ppt_number}`);
        }
        pptNumbers.add(source.ppt_number);

        const preview_images = source.preview_images.map(({ path, alt }) => {
          if (!/^images\/[^/]+\.(png|jpe?g|webp)$/i.test(path)) {
            throw new Error(`Invalid preview path for ${source.id}: ${path}`);
          }
          const imagePath = `./presets/${source.id}/${path}`;
          const url = previewModules[imagePath];
          if (!url) throw new Error(`Preview image not found for ${source.id}: ${path}`);
          return { url, alt: alt || source.name };
        });

        if (preview_images.length === 0) throw new Error(`Visual style preset has no previews: ${source.id}`);
        return { ...source, preview_images };
      }),
  );
}

export const VISUAL_STYLE_PRESETS = loadVisualStylePresets();

export const VISUAL_STYLE_PRESET_FILTER_OPTIONS = Object.fromEntries(
  VISUAL_STYLE_PRESET_FILTER_FIELDS.map((field) => [
    field,
    [
      ...new Set(
        VISUAL_STYLE_PRESETS.flatMap((preset) => {
          const value = preset[field];
          return Array.isArray(value) ? value : [value];
        }),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  ]),
) as Record<VisualStylePresetFilterField, string[]>;

export function findVisualStylePreset(id: string | null | undefined): VisualStylePreset | null {
  if (!id || id === NO_VISUAL_STYLE_PRESET_ID) return null;
  return VISUAL_STYLE_PRESETS.find((preset) => preset.id === id) ?? null;
}
