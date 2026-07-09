import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncPyprojectText, syncUvLockText } from "./sync-tool-manifests.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = "ppt-app/executas/ppt-gener/manifest.json";
const EXECUTA_PATH = "ppt-app/executas/ppt-gener/executa.json";
const PYPROJECT_PATH = "ppt-app/executas/ppt-gener/pyproject.toml";
const UV_LOCK_PATH = "ppt-app/executas/ppt-gener/uv.lock";
const PYTHON_SCRIPT_TARGET = "presenton_pptx_generator_plugin:main";
const PYTHON_PACKAGE_NAME = "presenton-pptx-generator-executa";

function resolveRepoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

async function readText(relativePath) {
  return readFile(resolveRepoPath(relativePath), "utf8");
}

async function writeText(relativePath, content) {
  await writeFile(resolveRepoPath(relativePath), content, "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateToolManifest(manifest) {
  assertNonEmptyString(manifest.version, `${MANIFEST_PATH}.version`);
  assertNonEmptyString(manifest.display_name, `${MANIFEST_PATH}.display_name`);
}

function validateLocalExecuta(executa) {
  assertNonEmptyString(executa.slug, `${EXECUTA_PATH}.slug`);
  assertNonEmptyString(executa.tool_id, `${EXECUTA_PATH}.tool_id`);
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  validateToolManifest(manifest);
  const executa = await readJson(EXECUTA_PATH);
  validateLocalExecuta(executa);
  executa.name = manifest.display_name;
  executa.version = manifest.version;
  if (typeof manifest.description === "string" && manifest.description.length > 0) {
    executa.description = manifest.description;
  }
  await writeJson(EXECUTA_PATH, executa);

  const tool = {
    manifest,
    localExecuta: executa,
    pyprojectPath: PYPROJECT_PATH,
    uvLockPath: UV_LOCK_PATH,
    pythonScriptTarget: PYTHON_SCRIPT_TARGET,
    pythonPackageName: PYTHON_PACKAGE_NAME,
  };

  await writeText(PYPROJECT_PATH, syncPyprojectText(await readText(PYPROJECT_PATH), tool));
  await writeText(UV_LOCK_PATH, syncUvLockText(await readText(UV_LOCK_PATH), tool));

  console.log(`Synced ppt-gener manifest: ${manifest.display_name}@${manifest.version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
