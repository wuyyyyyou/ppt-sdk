import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LocalTemplateGroupMetadata } from "../discovery/index.js";
import type { DeckManifestInput } from "../render/types.js";

type ForkableGroupSlideAsset = {
  slideId: string;
  layoutId: string;
  layoutName: string;
  layoutDescription: string;
  sourcePath: string;
  sampleData: Record<string, unknown>;
  schemaJson: Record<string, unknown>;
};

type ForkableGroupAsset = {
  groupId: string;
  groupName: string;
  groupDescription: string;
  groupBrief?: string | null;
  styleTags?: string[] | null;
  industryTags?: string[] | null;
  useCases?: string[] | null;
  audienceTags?: string[] | null;
  toneTags?: string[] | null;
  ordered: boolean;
  default: boolean;
  coverLayoutId?: string | null;
  agendaLayoutId?: string | null;
  closingLayoutId?: string | null;
  dependencies: Record<string, string>;
  packageJson?: Record<string, unknown> | null;
  slides: ForkableGroupSlideAsset[];
};

type ForkableTemplatesAssetIndex = {
  version: number;
  groups: Record<string, ForkableGroupAsset>;
};

type DependencyInstallResult = {
  packageLockPath: string | null;
  nodeModulesPath: string;
  installCommand: "npm install";
};

export interface ForkTemplateGroupInput {
  templateGroup: string;
  outDir: string;
  manifestTitle?: string | null;
  overwrite?: boolean;
  installDependencies?: boolean;
}

export interface ForkTemplateGroupResult {
  outDir: string;
  groupJsonPath: string;
  manifestPath: string;
  packageJsonPath: string;
  tsconfigPath: string;
  packageLockPath: string | null;
  nodeModulesPath: string | null;
  dependenciesInstalled: boolean;
  installCommand: string | null;
  manifest: DeckManifestInput;
}

const FORKABLE_TEMPLATES_DIR = path.join(getCurrentModuleDir(), "forkable-templates");
const FORKABLE_INDEX_PATH = path.join(FORKABLE_TEMPLATES_DIR, "index.json");
const FALLBACK_PACKAGE_NAME_PREFIX = "presenton-forked";

let assetIndexPromise: Promise<ForkableTemplatesAssetIndex> | null = null;

function getCurrentModuleDir(): string {
  if (typeof __dirname === "string") {
    return __dirname;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function loadAssetIndex(): Promise<ForkableTemplatesAssetIndex> {
  if (!assetIndexPromise) {
    assetIndexPromise = (async () => {
      if (!(await pathExists(FORKABLE_INDEX_PATH))) {
        throw new Error(
          `Forkable template assets not found at ${FORKABLE_INDEX_PATH}. Rebuild or reinstall @presenton-sdk/template-engine.`,
        );
      }

      return JSON.parse(
        await readFile(FORKABLE_INDEX_PATH, "utf8"),
      ) as ForkableTemplatesAssetIndex;
    })();
  }

  return assetIndexPromise;
}

async function ensureOutputDirectory(outDir: string, overwrite: boolean): Promise<void> {
  if (!(await pathExists(outDir))) {
    await mkdir(outDir, { recursive: true });
    return;
  }

  const currentStat = await stat(outDir);
  if (!currentStat.isDirectory()) {
    throw new Error(`Fork output path must be a directory: ${outDir}`);
  }

  const entries = await readdir(outDir);
  if (entries.length === 0) {
    return;
  }

  if (!overwrite) {
    throw new Error(
      `Fork output directory is not empty: ${outDir}. Pass overwrite: true to replace it.`,
    );
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

function normalizePackageName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 214);
}

function buildManifest(group: ForkableGroupAsset, manifestTitle: string): DeckManifestInput {
  return {
    title: manifestTitle,
    slides: group.slides.map((slide) => ({
      id: slide.slideId,
      title: slide.layoutName,
      speaker_note: slide.layoutName,
      source: {
        type: "local",
        path: `./${slide.sourcePath.replace(/\\/g, "/")}`,
      },
      data: slide.sampleData ?? {},
    })),
  };
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferForkedGroupId(group: ForkableGroupAsset, outDir: string): string {
  const basenameId = normalizePackageName(path.basename(path.resolve(outDir)));
  if (basenameId.length > 0 && basenameId !== group.groupId) {
    return basenameId;
  }

  return normalizePackageName(`${group.groupId}-fork`) || `${group.groupId}-fork`;
}

function buildForkedGroupMetadata(
  group: ForkableGroupAsset,
  outDir: string,
): LocalTemplateGroupMetadata {
  const forkedGroupId = inferForkedGroupId(group, outDir);
  const forkedGroupName =
    forkedGroupId === group.groupId
      ? `${group.groupName} Fork`
      : toTitleCaseFromSlug(forkedGroupId) || `${group.groupName} Fork`;

  return {
    group_id: forkedGroupId,
    group_name: forkedGroupName,
    group_description: group.groupDescription,
    ordered: group.ordered,
    default: group.default,
    layouts: group.slides.map((slide) => slide.sourcePath.replace(/\\/g, "/")),
    group_brief: group.groupBrief ?? undefined,
    style_tags: group.styleTags ?? undefined,
    industry_tags: group.industryTags ?? undefined,
    use_cases: group.useCases ?? undefined,
    audience_tags: group.audienceTags ?? undefined,
    tone_tags: group.toneTags ?? undefined,
    cover_layout_id: group.coverLayoutId ?? undefined,
    agenda_layout_id: group.agendaLayoutId ?? undefined,
    closing_layout_id: group.closingLayoutId ?? undefined,
  };
}

function buildDeckPackageJson(group: ForkableGroupAsset, forkedGroupId: string) {
  const packageJsonTemplate =
    group.packageJson && typeof group.packageJson === "object" && !Array.isArray(group.packageJson)
      ? group.packageJson
      : {};

  return {
    ...packageJsonTemplate,
    name:
      normalizePackageName(`${FALLBACK_PACKAGE_NAME_PREFIX}-${forkedGroupId}`) ||
      FALLBACK_PACKAGE_NAME_PREFIX,
    private:
      typeof packageJsonTemplate.private === "boolean" ? packageJsonTemplate.private : true,
    type: typeof packageJsonTemplate.type === "string" ? packageJsonTemplate.type : "module",
    dependencies: group.dependencies,
  };
}

function buildDeckTsconfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      jsx: "react-jsx",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  };
}

async function runNpmInstall(outDir: string): Promise<DependencyInstallResult> {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, ["install"], {
      cwd: outDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      reject(
        new Error(
          `Unable to install dependencies for forked template at ${outDir}: npm was not found or could not be started. Ensure npm is installed and available in PATH. ${message}`,
        ),
      );
    });

    child.once("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
      reject(
        new Error(
          `Unable to install dependencies for forked template at ${outDir}: npm install failed with exit code ${exitCode ?? "unknown"}${details ? `:\n${details}` : ""}`,
        ),
      );
    });
  });

  const packageLockPath = path.join(outDir, "package-lock.json");
  const nodeModulesPath = path.join(outDir, "node_modules");
  await mkdir(nodeModulesPath, { recursive: true });

  return {
    packageLockPath: (await pathExists(packageLockPath)) ? packageLockPath : null,
    nodeModulesPath,
    installCommand: "npm install",
  };
}

export async function forkTemplateGroup(
  input: ForkTemplateGroupInput,
): Promise<ForkTemplateGroupResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Fork template group input must be an object");
  }

  if (!input.templateGroup || typeof input.templateGroup !== "string") {
    throw new Error('Field "templateGroup" is required');
  }

  if (!input.outDir || typeof input.outDir !== "string") {
    throw new Error('Field "outDir" is required');
  }

  const assetIndex = await loadAssetIndex();
  const group = assetIndex.groups[input.templateGroup];
  if (!group) {
    throw new Error(`Forkable template group not found: ${input.templateGroup}`);
  }

  const outDir = path.resolve(input.outDir);
  await ensureOutputDirectory(outDir, input.overwrite === true);

  const sourceGroupDir = path.join(FORKABLE_TEMPLATES_DIR, "groups", group.groupId);
  await copyDirectoryContents(sourceGroupDir, outDir);

  const manifestTitle =
    input.manifestTitle && input.manifestTitle.trim().length > 0
      ? input.manifestTitle.trim()
      : `${group.groupName} Fork Deck`;

  const manifest = buildManifest(group, manifestTitle);
  const forkedGroupMetadata = buildForkedGroupMetadata(group, outDir);
  const groupJsonPath = path.join(outDir, "group.json");
  const manifestPath = path.join(outDir, "manifest.json");
  const packageJsonPath = path.join(outDir, "package.json");
  const tsconfigPath = path.join(outDir, "tsconfig.json");

  await writeFile(
    `${groupJsonPath}`,
    `${JSON.stringify(forkedGroupMetadata, null, 2)}\n`,
    "utf8",
  );
  await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    `${packageJsonPath}`,
    `${JSON.stringify(buildDeckPackageJson(group, forkedGroupMetadata.group_id), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    `${tsconfigPath}`,
    `${JSON.stringify(buildDeckTsconfig(), null, 2)}\n`,
    "utf8",
  );

  const installResult =
    input.installDependencies === true ? await runNpmInstall(outDir) : null;

  return {
    outDir,
    groupJsonPath,
    manifestPath,
    packageJsonPath,
    tsconfigPath,
    packageLockPath: installResult?.packageLockPath ?? null,
    nodeModulesPath: installResult?.nodeModulesPath ?? null,
    dependenciesInstalled: installResult !== null,
    installCommand: installResult?.installCommand ?? null,
    manifest,
  };
}
