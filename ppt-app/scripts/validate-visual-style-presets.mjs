import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRESETS_ROOT = resolve(SCRIPT_DIR, "../src/features/templates/presets");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const THEMES = new Set(["light", "dark"]);
const COLORS = new Set([
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
const REQUIRED_FIELD_TYPES = {
  id: "string",
  version: "number",
  ppt_number: "number",
  theme: "string",
  color: "array",
  name: "string",
  description: "string",
  user: "string",
  use_case: "string",
  industry: "string",
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

  if (!preset.id.trim()) throw new Error(`${configPath}: field "id" must not be blank`);
  if (!Number.isInteger(preset.version) || preset.version < 1) {
    throw new Error(`${configPath}: field "version" must be a positive integer`);
  }
  if (!Number.isInteger(preset.ppt_number) || preset.ppt_number < 1) {
    throw new Error(`${configPath}: field "ppt_number" must be a positive integer`);
  }
  if (Object.hasOwn(preset, "score") && (typeof preset.score !== "number" || !Number.isFinite(preset.score))) {
    throw new Error(`${configPath}: field "score" must be a finite number`);
  }
  if (!THEMES.has(preset.theme)) {
    throw new Error(`${configPath}: field "theme" must be "light" or "dark"`);
  }
  if (
    preset.color.length === 0 ||
    new Set(preset.color).size !== preset.color.length ||
    preset.color.some((color) => typeof color !== "string" || !COLORS.has(color))
  ) {
    throw new Error(`${configPath}: field "color" must be a non-empty array of unique supported colors`);
  }
  for (const field of ["name", "description", "user", "use_case", "industry", "style_guide"]) {
    if (!preset[field].trim()) throw new Error(`${configPath}: field "${field}" must not be blank`);
  }
  if (preset.preview_images.length === 0) {
    throw new Error(`${configPath}: field "preview_images" must not be empty`);
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
    if (!preview.alt.trim()) throw new Error(`${label}.alt must not be blank`);

    if (isAbsolute(preview.path)) throw new Error(`${label}.path must be relative to its preset directory`);
    if (!/^images\/[^/]+\.(png|jpe?g|webp)$/i.test(preview.path)) {
      throw new Error(`${label}.path must use images/<filename> with a supported image extension`);
    }
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

  const imageEntries = await readdir(resolve(presetDir, "images"), { withFileTypes: true });
  const identifierSidecars = imageEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().includes("identifier"))
    .map((entry) => entry.name);
  if (identifierSidecars.length > 0) {
    throw new Error(`${configPath}: images directory contains identifier sidecars: ${identifierSidecars.join(", ")}`);
  }
}

export async function validateVisualStylePresets(presetsRoot = DEFAULT_PRESETS_ROOT) {
  const resolvedPresetsRoot = resolve(presetsRoot);
  const entries = await readdir(resolvedPresetsRoot, { withFileTypes: true });
  const presetDirectories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));
  const ids = new Set();
  const pptNumbers = new Set();
  let presetCount = 0;

  for (const entry of presetDirectories) {
    const presetDir = resolve(presetsRoot, entry.name);
    const configPath = resolve(presetDir, "preset.json");
    let source;
    try {
      source = await readFile(configPath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${configPath}: unable to read valid JSON (${message})`);
    }

    let preset;
    try {
      preset = JSON.parse(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${configPath}: unable to read valid JSON (${message})`);
    }

    assertFieldTypes(preset, configPath);
    if (preset.id !== entry.name) {
      throw new Error(`${configPath}: field "id" must match directory name "${entry.name}"`);
    }
    if (ids.has(preset.id)) throw new Error(`${configPath}: duplicate preset id "${preset.id}"`);
    if (pptNumbers.has(preset.ppt_number)) {
      throw new Error(`${configPath}: duplicate ppt_number ${preset.ppt_number}`);
    }
    ids.add(preset.id);
    pptNumbers.add(preset.ppt_number);
    await assertPreviewImages(preset, presetDir, configPath);
    presetCount += 1;
  }

  return { presetCount };
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
