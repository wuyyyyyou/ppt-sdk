import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DeckManifestInput } from "../render/types.js";
import { validateDeckManifest } from "../render/manifest-render-plan.js";

const CURRENT_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE_ID_PATTERN = /^page-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface WorkspaceAuthoringPaths {
  workspace_dir: string;
  authoring_kit_dir: string;
  manifest_path: string;
  slides_dir: string;
}

export interface WorkspaceAuthoringKitResult extends WorkspaceAuthoringPaths {
  installed: boolean;
}

export interface WorkspaceOutlinePage {
  page_id: string;
  title: string;
  outline: string;
}

export interface ConfirmedWorkspaceOutline {
  title: string;
  status: "confirmed";
  items: WorkspaceOutlinePage[];
  [key: string]: unknown;
}

type AssetSource = {
  kitDir: string;
  pageSourceStarterPath: string;
};

function assertAbsolutePath(value: string, fieldName: string) {
  if (!path.isAbsolute(value)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getWorkspaceAuthoringPaths(workspaceDir: string): WorkspaceAuthoringPaths {
  assertAbsolutePath(workspaceDir, "workspace_dir");
  const normalized = path.normalize(workspaceDir);
  return {
    workspace_dir: normalized,
    authoring_kit_dir: path.join(normalized, "authoring-kit"),
    manifest_path: path.join(normalized, "manifest.json"),
    slides_dir: path.join(normalized, "slides"),
  };
}

function getSourceAsset(): AssetSource {
  const rootDir = path.join(CURRENT_MODULE_DIR, "..", "app", "authoring-kit");
  return {
    kitDir: rootDir,
    pageSourceStarterPath: path.join(
      rootDir,
      "page-source-starters",
      "BlankSlide.tsx.example",
    ),
  };
}

async function loadAssetSource(): Promise<AssetSource> {
  const candidates = [
    path.join(CURRENT_MODULE_DIR, "authoring-kit"),
    path.join(CURRENT_MODULE_DIR, "..", "..", "dist", "authoring-kit"),
  ];
  for (const rootDir of candidates) {
    const kitDir = path.join(rootDir, "kit");
    const pageSourceStarterPath = path.join(
      rootDir,
      "page-source-starters",
      "BlankSlide.tsx.example",
    );
    if (await pathExists(path.join(kitDir, "README.md")) && await pathExists(pageSourceStarterPath)) {
      return { kitDir, pageSourceStarterPath };
    }
  }
  return getSourceAsset();
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".preview.tsx")) continue;
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

export async function installWorkspaceAuthoringKit(input: {
  workspace_dir: string;
}): Promise<WorkspaceAuthoringKitResult> {
  const paths = getWorkspaceAuthoringPaths(input.workspace_dir);
  await mkdir(paths.workspace_dir, { recursive: true });
  if (await pathExists(paths.authoring_kit_dir)) {
    await mkdir(paths.slides_dir, { recursive: true });
    return { ...paths, installed: false };
  }

  const source = await loadAssetSource();
  await mkdir(paths.authoring_kit_dir, { recursive: true });
  await copyFile(
    path.join(source.kitDir, "README.md"),
    path.join(paths.authoring_kit_dir, "README.md"),
  );
  for (const directoryName of ["foundations", "references"]) {
    await copyDirectory(
      path.join(source.kitDir, directoryName),
      path.join(paths.authoring_kit_dir, directoryName),
    );
  }
  await mkdir(paths.slides_dir, { recursive: true });
  return { ...paths, installed: true };
}

function normalizeConfirmedOutline(value: unknown): ConfirmedWorkspaceOutline {
  if (!isPlainRecord(value) || value.status !== "confirmed" || !Array.isArray(value.items)) {
    throw new Error("Workspace outline must be confirmed before preparing Page Sources");
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    throw new Error("Confirmed Outline title must be a non-empty string");
  }
  const seenIds = new Set<string>();
  const items = value.items.map((itemValue, index) => {
    if (!isPlainRecord(itemValue)) {
      throw new Error(`Confirmed Outline item at index ${index} must be an object`);
    }
    const existingId = typeof itemValue.page_id === "string" ? itemValue.page_id : "";
    const pageId = existingId || `page-${randomUUID()}`;
    if (!PAGE_ID_PATTERN.test(pageId)) {
      throw new Error(`Confirmed Outline item at index ${index} has invalid page_id`);
    }
    if (seenIds.has(pageId)) {
      throw new Error(`Duplicate Confirmed Outline page_id "${pageId}"`);
    }
    seenIds.add(pageId);
    return {
      ...itemValue,
      page_id: pageId,
      title: typeof itemValue.title === "string" ? itemValue.title : "",
      outline: typeof itemValue.outline === "string" ? itemValue.outline : "",
    };
  });
  return { ...value, title: value.title, status: "confirmed", items } as ConfirmedWorkspaceOutline;
}

export async function ensureConfirmedOutlinePageIds(input: {
  workspace_dir: string;
}): Promise<ConfirmedWorkspaceOutline> {
  const paths = getWorkspaceAuthoringPaths(input.workspace_dir);
  const outlinePath = path.join(paths.workspace_dir, "outline.json");
  const outline = normalizeConfirmedOutline(JSON.parse(await readFile(outlinePath, "utf8")));
  await writeFile(outlinePath, `${JSON.stringify(outline, null, 2)}\n`, "utf8");
  return outline;
}

export async function rebuildWorkspaceDeckManifest(input: {
  workspace_dir: string;
  outline?: ConfirmedWorkspaceOutline;
}): Promise<DeckManifestInput> {
  const paths = getWorkspaceAuthoringPaths(input.workspace_dir);
  const outline = input.outline ?? await ensureConfirmedOutlinePageIds(input);
  const manifest: DeckManifestInput = {
    title: outline.title,
    slides: outline.items.map((item) => ({
      id: item.page_id,
      source: `./slides/${item.page_id}.tsx`,
    })),
  };
  validateDeckManifest(manifest);
  for (const slide of manifest.slides) {
    await access(path.join(paths.workspace_dir, slide.source));
  }
  await writeFile(paths.manifest_path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function prepareWorkspacePageSources(input: {
  workspace_dir: string;
}): Promise<{
  paths: WorkspaceAuthoringPaths;
  outline: ConfirmedWorkspaceOutline;
  manifest: DeckManifestInput;
  created_page_ids: string[];
}> {
  const installation = await installWorkspaceAuthoringKit(input);
  const outline = await ensureConfirmedOutlinePageIds(input);
  const { pageSourceStarterPath } = await loadAssetSource();
  const createdPageIds: string[] = [];
  for (const item of outline.items) {
    const targetPath = path.join(installation.slides_dir, `${item.page_id}.tsx`);
    if (await pathExists(targetPath)) continue;
    await copyFile(pageSourceStarterPath, targetPath);
    createdPageIds.push(item.page_id);
  }
  const manifest = await rebuildWorkspaceDeckManifest({
    workspace_dir: input.workspace_dir,
    outline,
  });
  return {
    paths: getWorkspaceAuthoringPaths(input.workspace_dir),
    outline,
    manifest,
    created_page_ids: createdPageIds,
  };
}

export async function fingerprintWorkspacePageSource(input: {
  workspace_dir: string;
  page_id: string;
}): Promise<{ path: string; sha256: string; size_bytes: number }> {
  const paths = getWorkspaceAuthoringPaths(input.workspace_dir);
  if (!PAGE_ID_PATTERN.test(input.page_id)) {
    throw new Error('Field "page_id" must be an opaque page UUID');
  }
  const sourcePath = path.join(paths.slides_dir, `${input.page_id}.tsx`);
  const bytes = await readFile(sourcePath);
  const fileStat = await stat(sourcePath);
  return {
    path: sourcePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size_bytes: fileStat.size,
  };
}
