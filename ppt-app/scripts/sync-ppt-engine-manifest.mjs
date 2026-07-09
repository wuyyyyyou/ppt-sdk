import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = "ppt-app/executas/ppt-engine/manifest.json";
const EXECUTA_PATH = "ppt-app/executas/ppt-engine/executa.json";
const PACKAGE_PATH = "ppt-app/executas/ppt-engine/package.json";
const PACKAGE_LOCK_PATH = "ppt-app/executas/ppt-engine/package-lock.json";
const PACKAGE_BIN_TARGET = "./example_plugin.js";
const PACKAGE_LOCK_BIN_TARGET = "example_plugin.js";

function resolveRepoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolveRepoPath(relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  await writeFile(resolveRepoPath(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function syncLocalExecuta(executa, manifest) {
  executa.name = manifest.display_name;
  executa.version = manifest.version;
  if (typeof manifest.description === "string" && manifest.description.length > 0) {
    executa.description = manifest.description;
  }
}

function syncNodePackageBin(pkg, manifest, executa, binTarget) {
  pkg.version = manifest.version;
  pkg.bin ??= {};
  const toolId = executa.tool_id;
  for (const key of Object.keys(pkg.bin)) {
    if (key.startsWith("tool-") && pkg.bin[key] === binTarget && key !== toolId) {
      delete pkg.bin[key];
    }
  }
  pkg.bin[toolId] = binTarget;
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  validateToolManifest(manifest);
  const executa = await readJson(EXECUTA_PATH);
  validateLocalExecuta(executa);
  syncLocalExecuta(executa, manifest);
  await writeJson(EXECUTA_PATH, executa);

  const pkg = await readJson(PACKAGE_PATH);
  syncNodePackageBin(pkg, manifest, executa, PACKAGE_BIN_TARGET);
  await writeJson(PACKAGE_PATH, pkg);

  const lock = await readJson(PACKAGE_LOCK_PATH);
  lock.version = manifest.version;
  lock.packages ??= {};
  lock.packages[""] ??= {};
  syncNodePackageBin(lock.packages[""], manifest, executa, PACKAGE_LOCK_BIN_TARGET);
  await writeJson(PACKAGE_LOCK_PATH, lock);

  console.log(`Synced ppt-engine manifest: ${manifest.display_name}@${manifest.version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
