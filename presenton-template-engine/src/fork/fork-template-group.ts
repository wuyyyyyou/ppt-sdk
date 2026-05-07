import { access, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LocalTemplateGroupMetadata } from "../discovery/index.js";
import type { DeckManifestInput, DeckManifestSlideInput } from "../render/types.js";

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
  originalManifest?: DeckManifestInput | null;
  slides: ForkableGroupSlideAsset[];
};

type ForkableTemplatesAssetIndex = {
  version: number;
  groups: Record<string, ForkableGroupAsset>;
};

export interface ForkTemplateGroupInput {
  templateGroup: string;
  outDir: string;
  manifestTitle?: string | null;
  overwrite?: boolean;
}

export interface ForkTemplateGroupResult {
  outDir: string;
  groupJsonPath: string;
  manifestPath: string;
  catalogJsonPath?: string;
  dataDirPath?: string;
  manifest: DeckManifestInput;
}

const FORKABLE_TEMPLATES_DIR = path.join(getCurrentModuleDir(), "forkable-templates");
const FORKABLE_INDEX_PATH = path.join(FORKABLE_TEMPLATES_DIR, "index.json");

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

function assertAbsolutePath(value: string, fieldName: string): void {
  if (!path.isAbsolute(value)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
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
        path: toManifestSourcePath(slide.sourcePath),
      },
      data: slide.sampleData ?? {},
    })),
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRelativeFilePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function toManifestSourcePath(sourcePath: string): string {
  return `./${normalizeRelativeFilePath(sourcePath)}`;
}

function addSlidePathMapping(
  slideBySourcePath: Map<string, ForkableGroupSlideAsset>,
  sourcePath: string,
  slide: ForkableGroupSlideAsset,
): void {
  const normalizedSourcePath = normalizeRelativeFilePath(sourcePath);
  if (!slideBySourcePath.has(normalizedSourcePath)) {
    slideBySourcePath.set(normalizedSourcePath, slide);
  }

  if (normalizedSourcePath.startsWith("slides/")) {
    const withoutSlidesPrefix = normalizedSourcePath.slice("slides/".length);
    if (!slideBySourcePath.has(withoutSlidesPrefix)) {
      slideBySourcePath.set(withoutSlidesPrefix, slide);
    }
    return;
  }

  const withSlidesPrefix = `slides/${normalizedSourcePath}`;
  if (!slideBySourcePath.has(withSlidesPrefix)) {
    slideBySourcePath.set(withSlidesPrefix, slide);
  }
}

function buildManifestFromOriginal(
  group: ForkableGroupAsset,
  manifestTitle: string,
): DeckManifestInput | null {
  const originalManifest = group.originalManifest;
  if (!isPlainRecord(originalManifest) || !Array.isArray(originalManifest.slides)) {
    return null;
  }

  const slideBySourcePath = new Map<string, ForkableGroupSlideAsset>();
  group.slides.forEach((slide) => {
    addSlidePathMapping(slideBySourcePath, slide.sourcePath, slide);
  });
  const slideById = new Map(group.slides.map((slide) => [slide.slideId, slide]));

  const slides = originalManifest.slides.map((originalSlide, index) => {
    if (!isPlainRecord(originalSlide)) {
      throw new Error(
        `Invalid original manifest for template group "${group.groupId}": slide at index ${index} must be an object`,
      );
    }

    const originalSource = originalSlide.source;
    if (
      !isPlainRecord(originalSource) ||
      originalSource.type !== "local" ||
      typeof originalSource.path !== "string"
    ) {
      throw new Error(
        `Invalid original manifest for template group "${group.groupId}": slide at index ${index} must use a local source.path`,
      );
    }

    const sourceKey = normalizeRelativeFilePath(originalSource.path);
    const matchingSlide =
      slideBySourcePath.get(sourceKey) ??
      (typeof originalSlide.id === "string" ? slideById.get(originalSlide.id) : undefined);

    if (!matchingSlide) {
      throw new Error(
        `Invalid original manifest for template group "${group.groupId}": cannot map slide source "${originalSource.path}" to a forked slide file`,
      );
    }

    const nextSlide: DeckManifestSlideInput = {
      ...originalSlide,
      id:
        typeof originalSlide.id === "string" && originalSlide.id.length > 0
          ? originalSlide.id
          : matchingSlide.slideId,
      source: {
        type: "local",
        path: toManifestSourcePath(matchingSlide.sourcePath),
      },
      data: isPlainRecord(originalSlide.data) ? originalSlide.data : {},
    };

    if (
      nextSlide.title === undefined &&
      typeof originalSlide.title !== "string" &&
      matchingSlide.layoutName
    ) {
      nextSlide.title = matchingSlide.layoutName;
    }

    if (
      nextSlide.speaker_note === undefined &&
      typeof originalSlide.speaker_note !== "string" &&
      matchingSlide.layoutName
    ) {
      nextSlide.speaker_note = matchingSlide.layoutName;
    }

    return nextSlide;
  });

  return {
    ...originalManifest,
    title: manifestTitle,
    slides,
  };
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rewriteLayoutIdGroup(layoutId: string | undefined, nextGroupId: string): string | undefined {
  if (!layoutId) {
    return undefined;
  }

  const [, localLayoutId] = layoutId.includes(":")
    ? layoutId.split(":", 2)
    : ["", layoutId];
  return localLayoutId ? `${nextGroupId}:${localLayoutId}` : undefined;
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
    cover_layout_id: rewriteLayoutIdGroup(group.coverLayoutId ?? undefined, forkedGroupId),
    agenda_layout_id: rewriteLayoutIdGroup(group.agendaLayoutId ?? undefined, forkedGroupId),
    closing_layout_id: rewriteLayoutIdGroup(group.closingLayoutId ?? undefined, forkedGroupId),
  };
}

async function rewriteForkedCatalogGroupId(catalogJsonPath: string, forkedGroupId: string): Promise<void> {
  if (!(await pathExists(catalogJsonPath))) {
    return;
  }

  const catalog = JSON.parse(await readFile(catalogJsonPath, "utf8")) as unknown;
  if (!isPlainRecord(catalog)) {
    return;
  }

  catalog.group_id = forkedGroupId;
  await writeFile(catalogJsonPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
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

  assertAbsolutePath(input.outDir, "outDir");
  const outDir = path.normalize(input.outDir);
  const assetIndex = await loadAssetIndex();
  const group = assetIndex.groups[input.templateGroup];
  if (!group) {
    throw new Error(`Forkable template group not found: ${input.templateGroup}`);
  }

  await ensureOutputDirectory(outDir, input.overwrite === true);

  const sourceGroupDir = path.join(FORKABLE_TEMPLATES_DIR, "groups", group.groupId);
  await copyDirectoryContents(sourceGroupDir, outDir);

  const manifestTitle =
    input.manifestTitle && input.manifestTitle.trim().length > 0
      ? input.manifestTitle.trim()
      : `${group.groupName} Fork Deck`;

  const manifest =
    buildManifestFromOriginal(group, manifestTitle) ?? buildManifest(group, manifestTitle);
  const forkedGroupMetadata = buildForkedGroupMetadata(group, outDir);
  const groupJsonPath = path.join(outDir, "group.json");
  const manifestPath = path.join(outDir, "manifest.json");
  const catalogJsonPath = path.join(outDir, "catalog.json");
  const dataDirPath = path.join(outDir, "data");

  await writeFile(
    `${groupJsonPath}`,
    `${JSON.stringify(forkedGroupMetadata, null, 2)}\n`,
    "utf8",
  );
  await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rewriteForkedCatalogGroupId(catalogJsonPath, forkedGroupMetadata.group_id);

  return {
    outDir,
    groupJsonPath,
    manifestPath,
    catalogJsonPath: (await pathExists(catalogJsonPath)) ? catalogJsonPath : undefined,
    dataDirPath: (await pathExists(dataDirPath)) ? dataDirPath : undefined,
    manifest,
  };
}
