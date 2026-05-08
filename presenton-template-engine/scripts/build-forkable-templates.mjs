import { builtinModules, createRequire } from "node:module";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const requireFromProject = createRequire(path.join(projectDir, "package.json"));
const { getAllGroupsWithTemplates } = requireFromProject("./dist/index.cjs");
const appSourceRoot = path.join(projectDir, "src", "app");
const templateSourceRoot = path.join(appSourceRoot, "presentation-templates");
const registryManifestPath = path.join(
  templateSourceRoot,
  "generated-registry-manifest.json",
);
const outputRoot = path.join(projectDir, "dist", "forkable-templates");
const knownExtensions = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts", ".mjs", ".cjs"];
const packageNamePattern = /^(@[^/]+\/[^/]+|[^/]+)/;
const builtinPackageNames = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, "")]),
);

function createModuleSpecifierPattern() {
  return /(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?(["'])([^"'`]+)\1|import\(\s*(["'])([^"'`]+)\3\s*\)/g;
}

function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/");
}

function getPackageName(specifier) {
  const match = packageNamePattern.exec(specifier);
  return match ? match[1] : specifier;
}

function hasExplicitExtension(specifier) {
  return knownExtensions.includes(path.extname(specifier));
}

function stripKnownExtension(specifier) {
  const extension = path.extname(specifier);
  if (!knownExtensions.includes(extension)) {
    return specifier;
  }
  return specifier.slice(0, -extension.length);
}

async function pathExists(candidatePath) {
  try {
    await readFile(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(candidatePath) {
  try {
    return (await stat(candidatePath)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveModuleFile(fromDir, moduleSpecifier) {
  const exactPath = path.resolve(fromDir, moduleSpecifier);
  const exactExtension = path.extname(moduleSpecifier);
  const exactPathWithoutExtension = exactExtension
    ? exactPath.slice(0, -exactExtension.length)
    : exactPath;

  if (hasExplicitExtension(moduleSpecifier) && (await pathExists(exactPath))) {
    return exactPath;
  }

  for (const extension of knownExtensions) {
    const fileCandidate = hasExplicitExtension(moduleSpecifier)
      ? `${exactPathWithoutExtension}${extension}`
      : `${exactPath}${extension}`;
    if (await pathExists(fileCandidate)) {
      return fileCandidate;
    }
  }

  for (const extension of knownExtensions) {
    const indexCandidate = hasExplicitExtension(moduleSpecifier)
      ? path.join(exactPathWithoutExtension, `index${extension}`)
      : path.join(exactPath, `index${extension}`);
    if (await pathExists(indexCandidate)) {
      return indexCandidate;
    }
  }

  throw new Error(
    `Unable to resolve local module "${moduleSpecifier}" from ${fromDir}`,
  );
}

async function readTemplateEnginePackageJson() {
  return JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
}

async function readRegistryManifest() {
  return JSON.parse(await readFile(registryManifestPath, "utf8"));
}

function extractModuleSpecifiers(sourceText) {
  const specifiers = [];
  const pattern = createModuleSpecifierPattern();
  let match;

  while ((match = pattern.exec(sourceText)) !== null) {
    specifiers.push(match[2] ?? match[4]);
  }

  return specifiers;
}

async function collectDependencyGraph(entryFiles) {
  const visited = new Set();
  const externalPackages = new Set();
  const stack = [...entryFiles];

  while (stack.length > 0) {
    const currentFile = stack.pop();
    if (!currentFile || visited.has(currentFile)) {
      continue;
    }

    visited.add(currentFile);

    const sourceText = await readFile(currentFile, "utf8");
    const specifiers = extractModuleSpecifiers(sourceText);

    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        const resolved = await resolveModuleFile(path.dirname(currentFile), specifier);
        if (!resolved.startsWith(appSourceRoot)) {
          throw new Error(
            `Template dependency must stay within src/app: ${specifier} from ${currentFile}`,
          );
        }
        if (!visited.has(resolved)) {
          stack.push(resolved);
        }
        continue;
      }

      if (specifier.startsWith("/") || specifier.startsWith("node:")) {
        continue;
      }

      const packageName = getPackageName(specifier);
      if (!builtinPackageNames.has(packageName)) {
        externalPackages.add(packageName);
      }
    }
  }

  return {
    files: visited,
    externalPackages,
  };
}

function buildTargetRelativePath(groupRoot, sourceFile, entryFiles) {
  if (entryFiles.has(sourceFile)) {
    const groupRelativePath = path.relative(groupRoot, sourceFile);
    if (groupRelativePath === "" || groupRelativePath.startsWith(`..${path.sep}`)) {
      return path.join("slides", path.basename(sourceFile));
    }

    return groupRelativePath.startsWith(`slides${path.sep}`)
      ? groupRelativePath
      : path.join("slides", groupRelativePath);
  }

  if (sourceFile === groupRoot || sourceFile.startsWith(`${groupRoot}${path.sep}`)) {
    return path.relative(groupRoot, sourceFile);
  }

  return path.join("shared", path.relative(appSourceRoot, sourceFile));
}

function rewriteLocalSpecifiers(sourceText, sourceFile, targetFile, targetPathMap) {
  return sourceText.replace(createModuleSpecifierPattern(), (fullMatch, quote1, spec1, quote2, spec2) => {
    const originalSpecifier = spec1 ?? spec2;
    const quote = quote1 ?? quote2;

    if (!originalSpecifier.startsWith(".")) {
      return fullMatch;
    }

    const resolvedSource = path.resolve(path.dirname(sourceFile), originalSpecifier);

    let matchedSource = null;
    for (const candidate of targetPathMap.keys()) {
      if (
        candidate === resolvedSource ||
        candidate === `${resolvedSource}${path.extname(candidate)}` ||
        stripKnownExtension(candidate) === stripKnownExtension(resolvedSource)
      ) {
        matchedSource = candidate;
        break;
      }
    }

    if (!matchedSource) {
      return fullMatch;
    }

    const targetDependency = targetPathMap.get(matchedSource);
    if (!targetDependency) {
      return fullMatch;
    }

    let nextSpecifier = normalizeRelativePath(
      path.relative(path.dirname(targetFile), targetDependency),
    );

    if (!nextSpecifier.startsWith(".")) {
      nextSpecifier = `./${nextSpecifier}`;
    }

    if (!hasExplicitExtension(originalSpecifier)) {
      nextSpecifier = stripKnownExtension(nextSpecifier);
    }

    return fullMatch.replace(
      `${quote}${originalSpecifier}${quote}`,
      `${quote}${nextSpecifier}${quote}`,
    );
  });
}

function buildTemplateGroupMetadata(group, slideTargetPaths, dependencyVersions) {
  return {
    groupId: group.group_id,
    groupName: group.group_name,
    groupDescription: group.group_description,
    groupBrief: group.group_brief ?? null,
    styleTags: group.style_tags ?? null,
    industryTags: group.industry_tags ?? null,
    useCases: group.use_cases ?? null,
    audienceTags: group.audience_tags ?? null,
    toneTags: group.tone_tags ?? null,
    ordered: group.ordered,
    default: group.default,
    coverLayoutId: group.cover_layout_id ?? null,
    agendaLayoutId: group.agenda_layout_id ?? null,
    closingLayoutId: group.closing_layout_id ?? null,
    dependencies: dependencyVersions,
    packageJson: null,
    originalManifest: null,
    slides: group.layouts.map((layout, index) => ({
      slideId: layout.layout_id.replace(/[:/]/g, "-"),
      layoutId: layout.layout_id,
      layoutName: layout.layout_name,
      layoutDescription: layout.layout_description,
      sourcePath: normalizeRelativePath(slideTargetPaths[index]),
      sampleData: layout.sample_data ?? {},
      schemaJson: layout.json_schema ?? {},
    })),
  };
}

async function readGroupPackageJson(groupRoot) {
  const packageJsonPath = path.join(groupRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    throw new Error(`Template group package.json must be a JSON object: ${packageJsonPath}`);
  }

  return packageJson;
}

async function readGroupManifest(groupRoot) {
  const manifestPath = path.join(groupRoot, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    return null;
  }

  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function copyOptionalGroupAssets(groupRoot, groupOutputDir) {
  const catalogPath = path.join(groupRoot, "catalog.json");
  if (await pathExists(catalogPath)) {
    await cp(catalogPath, path.join(groupOutputDir, "catalog.json"));
  }

  const componentsReadmePath = path.join(groupRoot, "components", "README.md");
  if (await pathExists(componentsReadmePath)) {
    await cp(
      componentsReadmePath,
      path.join(groupOutputDir, "components", "README.md"),
    );
  }

  const dataDir = path.join(groupRoot, "data");
  if (await directoryExists(dataDir)) {
    await cp(dataDir, path.join(groupOutputDir, "data"), { recursive: true });
  }
}

async function main() {
  const templateGroups = getAllGroupsWithTemplates();
  const registryManifest = await readRegistryManifest();
  const packageJson = await readTemplateEnginePackageJson();
  const dependencyVersionMap = packageJson.dependencies ?? {};

  const manifestGroups = new Map(
    registryManifest.groups.map((group) => [group.groupId, group]),
  );

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const assetIndex = {
    version: 1,
    groups: {},
  };

  for (const group of templateGroups) {
    const manifestGroup = manifestGroups.get(group.group_id);
    if (!manifestGroup) {
      throw new Error(`Missing generated registry manifest entry for group "${group.group_id}"`);
    }

    if (manifestGroup.layouts.length !== group.layouts.length) {
      throw new Error(
        `Generated registry manifest layout count mismatch for group "${group.group_id}": expected ${group.layouts.length}, got ${manifestGroup.layouts.length}`,
      );
    }

    const entryFiles = manifestGroup.layouts.map((layout) =>
      path.join(templateSourceRoot, layout.sourcePath),
    );

    const groupRoot = path.join(templateSourceRoot, manifestGroup.groupDirName);
    const { files, externalPackages } = await collectDependencyGraph(entryFiles);
    const groupPackageJson = await readGroupPackageJson(groupRoot);
    const groupManifest = await readGroupManifest(groupRoot);
    const targetPathMap = new Map();
    const entryFileSet = new Set(entryFiles);

    for (const sourceFile of files) {
      targetPathMap.set(
        sourceFile,
        buildTargetRelativePath(groupRoot, sourceFile, entryFileSet),
      );
    }

    const groupOutputDir = path.join(outputRoot, "groups", group.group_id);
    for (const sourceFile of files) {
      const targetRelativePath = targetPathMap.get(sourceFile);
      const targetPath = path.join(groupOutputDir, targetRelativePath);

      await mkdir(path.dirname(targetPath), { recursive: true });

      const sourceText = await readFile(sourceFile, "utf8");
      const rewritten = rewriteLocalSpecifiers(
        sourceText,
        sourceFile,
        targetRelativePath,
        targetPathMap,
      );

      await writeFile(targetPath, rewritten, "utf8");
    }

    await copyOptionalGroupAssets(groupRoot, groupOutputDir);

    const dependencyVersions = groupPackageJson?.dependencies
      ? { ...groupPackageJson.dependencies }
      : Object.fromEntries(
          Array.from(externalPackages)
            .sort()
            .map((packageName) => {
              const version = dependencyVersionMap[packageName];
              if (!version) {
                throw new Error(
                  `Missing dependency version for "${packageName}" in template-engine package.json`,
                );
              }
              return [packageName, version];
            }),
        );

    const groupMetadata = buildTemplateGroupMetadata(
      group,
      entryFiles.map((filePath) => targetPathMap.get(filePath)),
      dependencyVersions,
    );
    groupMetadata.packageJson = groupPackageJson;
    groupMetadata.originalManifest = groupManifest;

    assetIndex.groups[group.group_id] = groupMetadata;
  }

  await writeFile(
    path.join(outputRoot, "index.json"),
    `${JSON.stringify(assetIndex, null, 2)}\n`,
    "utf8",
  );
}

await main();
