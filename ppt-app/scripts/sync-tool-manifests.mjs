import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PPT_APP_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(PPT_APP_DIR, "..");

const TOOLS = [
  {
    key: "pptEngine",
    bundledHandle: "ppt-engine",
    manifestPath: "ppt-app/executas/ppt-engine/manifest.json",
    packagePath: "ppt-app/executas/ppt-engine/package.json",
    packageLockPath: "ppt-app/executas/ppt-engine/package-lock.json",
    localExecutaPath: "ppt-app/executas/ppt-engine/executa.json",
    bundledExecutaDir: "ppt-app/executas/ppt-engine",
    generatedConstName: "PPT_ENGINE_TOOL",
    packageBinTarget: "./example_plugin.js",
    packageLockBinTarget: "example_plugin.js",
  },
  {
    key: "pptGener",
    bundledHandle: "ppt-gener",
    manifestPath: "ppt-app/executas/ppt-gener/manifest.json",
    pyprojectPath: "ppt-app/executas/ppt-gener/pyproject.toml",
    uvLockPath: "ppt-app/executas/ppt-gener/uv.lock",
    localExecutaPath: "ppt-app/executas/ppt-gener/executa.json",
    bundledExecutaDir: "ppt-app/executas/ppt-gener",
    generatedConstName: "PPT_GENER_TOOL",
    pythonScriptTarget: "presenton_pptx_generator_plugin:main",
    pythonPackageName: "presenton-pptx-generator-executa",
  },
  {
    key: "annaSearch",
    bundledHandle: "anna-search",
    manifestPath: "ppt-app/executas/anna-search/manifest.json",
    pyprojectPath: "ppt-app/executas/anna-search/pyproject.toml",
    uvLockPath: "ppt-app/executas/anna-search/uv.lock",
    localExecutaPath: "ppt-app/executas/anna-search/executa.json",
    bundledExecutaDir: "ppt-app/executas/anna-search",
    generatedConstName: "ANNA_SEARCH_TOOL",
    pythonScriptTarget: "anna_search_executa.plugin:main",
    pythonPackageName: "anna-search-executa",
  },
];

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

async function writeJson(relativePath, value) {
  await writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toPosixPath(relativePath) {
  return relativePath.replaceAll(path.sep, "/").replaceAll("\\", "/");
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateToolManifest(manifest, relativePath) {
  assertNonEmptyString(manifest.version, `${relativePath}.version`);
  assertNonEmptyString(manifest.display_name, `${relativePath}.display_name`);
  if (!Array.isArray(manifest.tools)) {
    throw new Error(`${relativePath}.tools must be an array`);
  }

  const seen = new Set();
  for (const tool of manifest.tools) {
    const name = tool?.name;
    assertNonEmptyString(name, `${relativePath}.tools[].name`);
    if (seen.has(name)) {
      throw new Error(`${relativePath} has duplicate tool name: ${name}`);
    }
    seen.add(name);
  }
}

function validateLocalExecuta(executa, relativePath) {
  assertNonEmptyString(executa.slug, `${relativePath}.slug`);
  assertNonEmptyString(executa.tool_id, `${relativePath}.tool_id`);
}

async function loadToolManifests() {
  const loaded = [];
  for (const tool of TOOLS) {
    const manifest = await readJson(tool.manifestPath);
    validateToolManifest(manifest, tool.manifestPath);
    const localExecuta = tool.localExecutaPath ? await readJson(tool.localExecutaPath) : null;
    if (localExecuta) {
      validateLocalExecuta(localExecuta, tool.localExecutaPath);
    }
    loaded.push({ ...tool, manifest, localExecuta });
  }
  return loaded;
}

async function syncPptAppManifest(tools) {
  const appManifest = await readJson("ppt-app/manifest.json");
  applyPptAppManifestSync(appManifest, tools);
  await writeJson("ppt-app/manifest.json", appManifest);
}

export function applyPptAppManifestSync(appManifest, tools) {
  appManifest.required_executas = tools.map((tool, index) => ({
    ...(appManifest.required_executas?.[index] ?? {}),
    tool_id: `bundled:${tool.bundledHandle}`,
    min_version: tool.manifest.version,
    version: appManifest.required_executas?.[index]?.version ?? "latest",
  }));
  appManifest.ui ??= {};
  appManifest.ui.host_api ??= {};
  appManifest.ui.host_api.tools = tools.map((tool) => `required:bundled:${tool.bundledHandle}`);
  return appManifest;
}

async function syncPptAppListing(tools) {
  const appListing = await readJson("ppt-app/app.json");
  applyPptAppListingSync(appListing, tools);
  await writeJson("ppt-app/app.json", appListing);
}

export function applyPptAppListingSync(appListing, tools, relativePath = path.relative) {
  appListing.bundled_executas = Object.fromEntries(
    tools.map((tool) => [
      tool.bundledHandle,
      { path: toPosixPath(relativePath("ppt-app", tool.bundledExecutaDir)) },
    ]),
  );
  return appListing;
}

async function syncLocalExecutas(tools) {
  for (const tool of tools) {
    if (!tool.localExecutaPath) continue;
    applyLocalExecutaSync(tool.localExecuta, tool);
    await writeJson(tool.localExecutaPath, tool.localExecuta);
  }
}

export function applyLocalExecutaSync(executa, tool) {
  executa.name = tool.manifest.display_name;
  executa.version = tool.manifest.version;
  if (typeof tool.manifest.description === "string" && tool.manifest.description.length > 0) {
    executa.description = tool.manifest.description;
  }
  return executa;
}

async function syncGeneratedFrontendConstants(tools) {
  await writeText("ppt-app/src/api/toolManifests.generated.ts", buildGeneratedFrontendConstants(tools));
}

export function buildGeneratedFrontendConstants(tools) {
  const lines = [
    "// This file is generated by ppt-app/scripts/sync-tool-manifests.mjs.",
    "// Do not edit it by hand.",
    "",
  ];

  for (const tool of tools) {
    lines.push(`export const ${tool.generatedConstName} = {`);
    lines.push(`  handle: ${JSON.stringify(tool.bundledHandle)},`);
    lines.push(`  version: ${JSON.stringify(tool.manifest.version)},`);
    lines.push(`  displayName: ${JSON.stringify(tool.manifest.display_name)},`);
    lines.push("} as const;");
    lines.push("");
  }

  return `${lines.join("\n")}`;
}

function syncNodePackageBin(pkg, tool, binTarget = tool.packageBinTarget) {
  pkg.version = tool.manifest.version;
  pkg.bin ??= {};
  const toolId = tool.localExecuta.tool_id;
  for (const key of Object.keys(pkg.bin)) {
    if (key.startsWith("tool-") && pkg.bin[key] === binTarget && key !== toolId) {
      delete pkg.bin[key];
    }
  }
  pkg.bin[toolId] = binTarget;
}

async function syncNodePackage(tool) {
  const pkg = await readJson(tool.packagePath);
  syncNodePackageBin(pkg, tool);
  await writeJson(tool.packagePath, pkg);
}

async function syncNodePackageLock(tool) {
  const lock = await readJson(tool.packageLockPath);
  lock.version = tool.manifest.version;
  lock.packages ??= {};
  lock.packages[""] ??= {};
  syncNodePackageBin(lock.packages[""], tool, tool.packageLockBinTarget ?? tool.packageBinTarget);
  await writeJson(tool.packageLockPath, lock);
}

export function syncPyprojectText(content, tool) {
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
  let next = content.replace(
    /(^\[project\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
    `$1${tool.manifest.version}$2`,
  );
  const lines = next.split("\n").map((line) => line.replace(/\r$/, ""));
  const headingIndex = lines.findIndex((line) => line.trim() === "[project.scripts]");
  if (headingIndex === -1) {
    throw new Error("Unable to find [project.scripts] in pyproject.toml");
  }

  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && line.startsWith("[") && line.endsWith("]"),
  );
  const endIndex = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
  const bodyLines = lines
    .slice(headingIndex + 1, endIndex)
    .filter((line) => !line.trimStart().startsWith("tool-"))
    .filter((line) => line.length > 0);

  bodyLines.push(`${tool.localExecuta.tool_id} = ${JSON.stringify(tool.pythonScriptTarget)}`);
  const replacement = [
    lines[headingIndex],
    ...bodyLines,
    "",
  ];
  lines.splice(headingIndex, endIndex - headingIndex, ...replacement);
  return lines.join(lineEnding);
}

async function syncPyproject(tool) {
  await writeText(tool.pyprojectPath, syncPyprojectText(await readText(tool.pyprojectPath), tool));
}

export function syncUvLockText(content, tool) {
  const escapedName = tool.pythonPackageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(\\[\\[package\\]\\]\\r?\\nname = "${escapedName}"\\r?\\nversion = ")[^"]+(")`,
    "m",
  );
  if (!pattern.test(content)) {
    throw new Error(`Unable to find ${tool.pythonPackageName} package entry in ${tool.uvLockPath}`);
  }
  return content.replace(pattern, `$1${tool.manifest.version}$2`);
}

async function syncUvLock(tool) {
  await writeText(tool.uvLockPath, syncUvLockText(await readText(tool.uvLockPath), tool));
}

async function main() {
  const tools = await loadToolManifests();
  await syncPptAppManifest(tools);
  await syncPptAppListing(tools);
  await syncLocalExecutas(tools);
  await syncGeneratedFrontendConstants(tools);

  const engine = tools.find((tool) => tool.key === "pptEngine");
  await syncNodePackage(engine);
  await syncNodePackageLock(engine);

  for (const tool of tools.filter((candidate) => candidate.pyprojectPath)) {
    await syncPyproject(tool);
    await syncUvLock(tool);
  }

  console.log(
    `Synced tool manifests: ${tools.map((tool) => `${tool.manifest.display_name}@${tool.manifest.version}`).join(", ")}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
