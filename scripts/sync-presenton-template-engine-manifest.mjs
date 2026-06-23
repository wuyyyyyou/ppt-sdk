import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "presenton-template-engine/manifest.json";
const PACKAGE_PATH = "presenton-template-engine/package.json";
const PACKAGE_LOCK_PATH = "presenton-template-engine/package-lock.json";
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
  assertNonEmptyString(manifest.name, `${MANIFEST_PATH}.name`);
  assertNonEmptyString(manifest.version, `${MANIFEST_PATH}.version`);
  assertNonEmptyString(manifest.display_name, `${MANIFEST_PATH}.display_name`);
}

function syncNodePackageBin(pkg, manifest, binTarget) {
  pkg.version = manifest.version;
  pkg.bin ??= {};
  for (const key of Object.keys(pkg.bin)) {
    if (key.startsWith("tool-") && pkg.bin[key] === binTarget && key !== manifest.name) {
      delete pkg.bin[key];
    }
  }
  pkg.bin[manifest.name] = binTarget;
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  validateToolManifest(manifest);

  const pkg = await readJson(PACKAGE_PATH);
  syncNodePackageBin(pkg, manifest, PACKAGE_BIN_TARGET);
  await writeJson(PACKAGE_PATH, pkg);

  const lock = await readJson(PACKAGE_LOCK_PATH);
  lock.version = manifest.version;
  lock.packages ??= {};
  lock.packages[""] ??= {};
  syncNodePackageBin(lock.packages[""], manifest, PACKAGE_LOCK_BIN_TARGET);
  await writeJson(PACKAGE_LOCK_PATH, lock);

  console.log(`Synced presenton-template-engine manifest: ${manifest.display_name}@${manifest.version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
