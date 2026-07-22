import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRESETS_ROOT = resolve(SCRIPT_DIR, "../src/features/templates/presets");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const REQUIRED_FIELD_TYPES = {
  id: "string",
  version: "number",
  name: "string",
  description: "string",
  user: "string",
  use_case: "string",
  industry: "string",
  theme: "string",
  color: "string",
  style_guide: "string",
  preview_images: "array",
};

function valueType(value) {
  return Array.isArray(value) ? "array" : typeof value;
}

function assertFieldTypes(preset, configPath) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    throw new Error(`${configPath}: preset.json must contain a JSON object`);
  }

  for (const [field, expectedType] of Object.entries(REQUIRED_FIELD_TYPES)) {
    if (!Object.hasOwn(preset, field)) {
      throw new Error(`${configPath}: missing required field "${field}"`);
    }
    const actualType = valueType(preset[field]);
    if (actualType !== expectedType) {
      throw new Error(`${configPath}: field "${field}" must be ${expectedType}, received ${actualType}`);
    }
  }
}

async function assertPreviewImages(preset, presetDir, configPath) {
  for (const [index, preview] of preset.preview_images.entries()) {
    const label = `${configPath}: preview_images[${index}]`;
    if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
      throw new Error(`${label} must be an object`);
    }
    for (const field of ["path", "alt"]) {
      if (!Object.hasOwn(preview, field)) throw new Error(`${label} is missing required field "${field}"`);
      if (typeof preview[field] !== "string") throw new Error(`${label}.${field} must be string`);
    }

    if (isAbsolute(preview.path)) throw new Error(`${label}.path must be relative to its preset directory`);
    const imagePath = resolve(presetDir, preview.path);
    const relativePath = relative(presetDir, imagePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`${label}.path must stay inside its preset directory`);
    }
    if (!IMAGE_EXTENSIONS.has(extname(imagePath).toLowerCase())) {
      throw new Error(`${label}.path must reference a PNG, JPG, JPEG, or WebP image`);
    }

    let imageStat;
    try {
      imageStat = await stat(imagePath);
    } catch {
      throw new Error(`${label}.path does not exist: ${preview.path}`);
    }
    if (!imageStat.isFile()) throw new Error(`${label}.path is not a file: ${preview.path}`);
  }
}

export async function validateVisualStylePresets(presetsRoot = DEFAULT_PRESETS_ROOT) {
  const entries = await readdir(presetsRoot, { withFileTypes: true });
  const presetDirectories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of presetDirectories) {
    const presetDir = resolve(presetsRoot, entry.name);
    const configPath = resolve(presetDir, "preset.json");
    let preset;
    try {
      preset = JSON.parse(await readFile(configPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${configPath}: unable to read valid JSON (${message})`);
    }
    assertFieldTypes(preset, configPath);
    await assertPreviewImages(preset, presetDir, configPath);
  }

  return { presetCount: presetDirectories.length };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  validateVisualStylePresets()
    .then(({ presetCount }) => console.log(`Validated ${presetCount} visual style presets.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
