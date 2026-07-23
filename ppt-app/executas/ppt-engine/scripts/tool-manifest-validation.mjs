import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PARAMETER_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    fail(path, "must be a non-empty string");
  }
}

function validateParameter(parameter, path) {
  if (!parameter || typeof parameter !== "object" || Array.isArray(parameter)) {
    fail(path, "must be an object");
  }

  assertNonEmptyString(parameter.name, `${path}.name`);
  if (!PARAMETER_TYPES.has(parameter.type)) {
    fail(`${path}.type`, `must be one of ${Array.from(PARAMETER_TYPES).join(", ")}`);
  }
  assertNonEmptyString(parameter.description, `${path}.description`);
  if (parameter.required !== undefined && typeof parameter.required !== "boolean") {
    fail(`${path}.required`, "must be a boolean when provided");
  }

  if (parameter.type !== "array") return;

  const itemsType = parameter.items_type ?? parameter.items?.type;
  if (!PARAMETER_TYPES.has(itemsType)) {
    fail(`${path}.items`, "array parameters must declare a supported items.type or items_type");
  }
}

function validateTool(tool, path) {
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
    fail(path, "must be an object");
  }

  assertNonEmptyString(tool.name, `${path}.name`);
  assertNonEmptyString(tool.description, `${path}.description`);
  if (tool.parameters !== undefined && !Array.isArray(tool.parameters)) {
    fail(`${path}.parameters`, "must be an array when provided");
  }
  for (const [index, parameter] of (tool.parameters ?? []).entries()) {
    validateParameter(parameter, `${path}.parameters[${index}]`);
  }
}

export function validateToolManifest(manifest, label = "tool manifest") {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail(label, "must be a JSON object");
  }
  assertNonEmptyString(manifest.display_name, `${label}.display_name`);
  assertNonEmptyString(manifest.version, `${label}.version`);
  if (!Array.isArray(manifest.tools)) {
    fail(`${label}.tools`, "must be an array");
  }
  for (const [index, tool] of (manifest.tools ?? []).entries()) {
    validateTool(tool, `${label}.tools[${index}]`);
  }
  return manifest;
}

export async function readAndValidateToolManifest(filePath) {
  const manifest = JSON.parse(await readFile(filePath, "utf8"));
  return validateToolManifest(manifest, filePath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/tool-manifest-validation.mjs <manifest.json>");
    process.exit(1);
  }
  readAndValidateToolManifest(filePath)
    .then(() => console.log(`Tool manifest validation passed: ${filePath}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exit(1);
    });
}
