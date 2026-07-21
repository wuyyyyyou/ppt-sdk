import type { VisualStylePreset, VisualStylePresetSelection } from "../../api/types";

export const NO_VISUAL_STYLE_PRESET_ID = "none";

interface VisualStylePresetSource {
  id: string;
  version: number;
  name: string;
  description: string;
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

function assertSource(value: VisualStylePresetSource, configPath: string): void {
  if (!value || typeof value !== "object") throw new Error(`Invalid visual style preset: ${configPath}`);
  if (!value.id || !Number.isInteger(value.version) || value.version < 1) {
    throw new Error(`Invalid visual style preset identity: ${configPath}`);
  }
  if (!value.name || !value.description || !value.style_guide || !Array.isArray(value.preview_images)) {
    throw new Error(`Incomplete visual style preset: ${configPath}`);
  }
}

function loadVisualStylePresets(): VisualStylePreset[] {
  const ids = new Set<string>();

  return Object.entries(presetModules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([configPath, source]) => {
      assertSource(source, configPath);
      const match = /^\.\/presets\/([^/]+)\/preset\.json$/.exec(configPath);
      if (!match || match[1] !== source.id) {
        throw new Error(`Preset directory must match its id: ${configPath}`);
      }
      if (ids.has(source.id)) throw new Error(`Duplicate visual style preset id: ${source.id}`);
      ids.add(source.id);

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
    });
}

export const VISUAL_STYLE_PRESETS = loadVisualStylePresets();

export function findVisualStylePreset(id: string | null | undefined): VisualStylePreset | null {
  if (!id || id === NO_VISUAL_STYLE_PRESET_ID) return null;
  return VISUAL_STYLE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function toVisualStylePresetSelection(preset: VisualStylePreset | null): VisualStylePresetSelection | null {
  if (!preset) return null;
  return { id: preset.id, version: preset.version, name: preset.name, description: preset.description };
}
