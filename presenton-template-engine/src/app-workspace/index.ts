import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appendFile, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import {
  getDiscoveredTemplateGroup,
  listDiscoveredTemplateGroupSummaries,
  type DiscoveredTemplateGroupSummaryInfo,
} from "../discovery/index.js";
import { forkTemplateGroup } from "../fork/fork-template-group.js";
import {
  getTemplatePreviewGroup,
  readTemplatePreviewDataUrl,
  type TemplatePreviewImage,
} from "../template-previews/index.js";
import {
  buildDeckHtmlFromManifest,
  buildDeckHtmlPagesFromManifest,
  buildDeckPageScreenshotFromManifest,
} from "../render/build-deck-from-manifest.js";
import { convertDeckHtmlToPptxModel } from "../html-to-pptx-model/index.js";
import type {
  AppendAppWorkspaceLogInput,
  AppendAppWorkspaceLogResult,
  AppTemplateGroupSummary,
  AppTemplatePreviewRef,
  AppTemplatePreviewResult,
  AppWorkspaceResult,
  AppWorkspaceSummary,
  AppWorkspaceOutline,
  AppWorkspaceOutlineItem,
  AppPagePlan,
  AppPagePlanItem,
  AppPageProgress,
  AppPageProgressItem,
  ExportAppPdfInput,
  ExportAppPdfResult,
  AppWorkspacePages,
  AppWorkspaceTemplateSelection,
  AppTemplatePlanningBlueprint,
  AppTemplatePlanningContext,
  CreateAppWorkspaceInput,
  DuplicateAppWorkspacePageInput,
  GetAppPagePlanInput,
  GetAppPageProgressInput,
  GetAppTemplateGroupInput,
  GetAppTemplatePlanningContextInput,
  GetAppTemplatePreviewInput,
  GetAppWorkspaceOutlineInput,
  ListAppTemplateGroupsResult,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  PrepareAppPageFilesInput,
  PrepareAppPageFilesResult,
  PrepareAppExportModelInput,
  PrepareAppExportModelResult,
  RecordAppPagePlanInput,
  RecordAppPageProgressInput,
  RecordAppPdfExportInput,
  RecordAppPptxExportInput,
  RenderAppWorkspacePagePreviewInput,
  RenderAppWorkspacePagePreviewResult,
  RenderAppWorkspaceDeckHtmlInput,
  RenderAppWorkspaceDeckHtmlResult,
  SelectAppWorkspaceTemplateInput,
  SelectAppWorkspaceTemplateResult,
  UpdateAppWorkspacePagesInput,
  UpdateAppWorkspaceOutlineInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
} from "./types.js";

const WORKSPACE_ROOT = path.join(os.homedir(), "anna-workspace", "ppt", "tasks");
const WORKSPACE_DIR_PATTERN = /^ppt-\d{8}-\d{6}$/;
const WORKSPACE_FILE_NAMES = [
  "task.json",
  "setting.json",
  "outline.json",
  "page-plan.json",
  "page-progress.json",
  "pages.json",
  "template.json",
] as const;
const WORKSPACE_LOG_FILE_NAMES = {
  "ai-outline": "ai-outline.jsonl",
  "ai-page-plan": "ai-page-plan.jsonl",
  "ai-page-agent": "ai-page-agent.jsonl",
  "ai-page-agent-stream": "ai-page-agent-stream.jsonl",
} as const;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatWorkspaceId(date = new Date()): string {
  return [
    "ppt",
    `${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}${padDatePart(date.getMinutes())}${padDatePart(date.getSeconds())}`,
  ].join("-");
}

function formatDefaultWorkspaceTitle(date = new Date()): string {
  return [
    "新建工作区",
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
  ].join("-");
}

function isWorkspaceDirName(name: string): boolean {
  return WORKSPACE_DIR_PATTERN.test(name);
}

function assertAbsolutePath(value: string, parameterName: string): void {
  if (!path.isAbsolute(value)) {
    throw new Error(`"${parameterName}" must be an absolute path`);
  }
}

function assertWorkspaceUnderRoot(workspaceDir: string): void {
  const relativePath = path.relative(WORKSPACE_ROOT, workspaceDir);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('"workspace_dir" must be under the default PPT workspace root');
  }
}

function buildWorkspaceFilePaths(workspaceDir: string) {
  return {
    task: path.join(workspaceDir, "task.json"),
    setting: path.join(workspaceDir, "setting.json"),
    outline: path.join(workspaceDir, "outline.json"),
    page_plan: path.join(workspaceDir, "page-plan.json"),
    page_progress: path.join(workspaceDir, "page-progress.json"),
    pages: path.join(workspaceDir, "pages.json"),
    template: path.join(workspaceDir, "template.json"),
  };
}

async function readJsonFileIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function createDefaultTaskJson(workspaceDir: string, title?: string) {
  const workspaceId = path.basename(workspaceDir);
  const now = new Date().toISOString();
  return {
    id: workspaceId,
    title: title || workspaceId,
    status: "initialized",
    workspace_dir: workspaceDir,
    created_at: now,
    updated_at: now,
    artifacts: {
      task: "task.json",
      setting: "setting.json",
      outline: "outline.json",
      page_plan: "page-plan.json",
      page_progress: "page-progress.json",
      pages: "pages.json",
    },
  };
}

function createDefaultSettingJson() {
  return {
    audience: "",
    goal: "",
    style_notes: "",
    language: "zh",
    output_language: "中文",
    aspect_ratio: "16:9",
    slide_count: "auto",
    text_density: "balanced",
    visual_tone: "",
    typography: "",
  };
}

function normalizeSettingJson(setting: unknown): Record<string, unknown> {
  const existing =
    setting && typeof setting === "object" && !Array.isArray(setting)
      ? (setting as Record<string, unknown>)
      : {};
  const nextSetting = { ...existing };

  delete nextSetting.content_source;

  if (
    nextSetting.visual_tone === "极简 SaaS · 清爽版式 · 柔和中性色" ||
    nextSetting.visual_tone === "professional"
  ) {
    nextSetting.visual_tone = "";
  }

  if (nextSetting.typography === "Clean Sans") {
    nextSetting.typography = "";
  }

  return nextSetting;
}

function createDefaultOutlineJson() {
  return normalizeOutlineJson(null);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeOutlineItem(value: unknown): AppWorkspaceOutlineItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    title: normalizeString(record.title),
    outline: normalizeString(record.outline),
  };
}

function normalizeOutlineJson(outline: unknown): AppWorkspaceOutline {
  const existing =
    outline && typeof outline === "object" && !Array.isArray(outline)
      ? (outline as Record<string, unknown>)
      : {};
  const source =
    existing.source && typeof existing.source === "object" && !Array.isArray(existing.source)
      ? (existing.source as Record<string, unknown>)
      : {};
  const items = Array.isArray(existing.items)
    ? existing.items
        .map(normalizeOutlineItem)
        .filter((item): item is AppWorkspaceOutlineItem => item !== null)
    : [];

  return {
    version: 2,
    title: normalizeString(existing.title),
    status: existing.status === "confirmed" ? "confirmed" : "draft",
    items,
    source: {
      prompt: normalizeString(source.prompt),
      context: Array.isArray(source.context) ? source.context : [],
      setting:
        source.setting && typeof source.setting === "object" && !Array.isArray(source.setting)
          ? (source.setting as Record<string, unknown>)
          : {},
      kind: normalizeString(source.kind) || undefined,
    },
    updated_at: typeof existing.updated_at === "string" ? existing.updated_at : null,
  };
}

function getPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeRelativeManifestPath(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`"${fieldName}" must be a non-empty relative path`);
  }

  const normalized = value.trim().replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.includes("..")) {
    throw new Error(`"${fieldName}" must stay inside the template directory`);
  }

  return normalized.startsWith("./") ? normalized : `./${normalized}`;
}

function normalizePagePlanItem(value: unknown, index: number): AppPagePlanItem {
  const record = getPlainRecord(value);
  const pageId = normalizeString(record.page_id) || `page-${String(index + 1).padStart(2, "0")}`;
  const manifestSlideId = normalizeString(record.manifest_slide_id) || pageId;
  const slidePath = normalizeRelativeManifestPath(
    record.slide_path || `./slides/${pageId}.tsx`,
    `pages[${index}].slide_path`,
  );
  const dataPath = normalizeRelativeManifestPath(
    record.data_path || `./data/${pageId}.json`,
    `pages[${index}].data_path`,
  );
  const blueprintSource = normalizeRelativeManifestPath(
    record.blueprint_source,
    `pages[${index}].blueprint_source`,
  );

  if (!slidePath.startsWith("./slides/") || !slidePath.endsWith(".tsx")) {
    throw new Error(`pages[${index}].slide_path must point to ./slides/*.tsx`);
  }

  if (!dataPath.startsWith("./data/") || !dataPath.endsWith(".json")) {
    throw new Error(`pages[${index}].data_path must point to ./data/*.json`);
  }

  if (!blueprintSource.startsWith("./blueprints/") || !blueprintSource.endsWith(".tsx")) {
    throw new Error(`pages[${index}].blueprint_source must point to ./blueprints/*.tsx`);
  }

  return {
    page_id: pageId,
    index,
    title: normalizeString(record.title) || pageId,
    outline: normalizeString(record.outline),
    blueprint_id: normalizeString(record.blueprint_id),
    blueprint_source: blueprintSource,
    slide_path: slidePath,
    data_path: dataPath,
    manifest_slide_id: manifestSlideId,
    reason: normalizeString(record.reason),
  };
}

function normalizePagePlanJson(value: unknown): AppPagePlan {
  const record = getPlainRecord(value);
  const source = getPlainRecord(record.source);
  const pages = Array.isArray(record.pages)
    ? record.pages.map(normalizePagePlanItem)
    : [];
  const seenIds = new Set<string>();

  pages.forEach((page) => {
    if (seenIds.has(page.manifest_slide_id)) {
      throw new Error(`Duplicate manifest_slide_id "${page.manifest_slide_id}"`);
    }
    seenIds.add(page.manifest_slide_id);
  });

  return {
    version: 1,
    status:
      record.status === "prepared" || record.status === "stale"
        ? record.status
        : "planned",
    title: normalizeString(record.title),
    source: {
      outline_updated_at:
        typeof source.outline_updated_at === "string" ? source.outline_updated_at : null,
      template_group: normalizeString(source.template_group),
      template_manifest_path: normalizeString(source.template_manifest_path),
      generated_by: normalizeString(source.generated_by),
    },
    pages,
    updated_at:
      typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

function normalizePageProgressItem(value: unknown): AppPageProgressItem | null {
  const record = getPlainRecord(value);
  const pageId = normalizeString(record.page_id);
  if (!pageId) return null;

  return {
    page_id: pageId,
    index: typeof record.index === "number" ? record.index : 0,
    title: normalizeString(record.title) || pageId,
    status: normalizeString(record.status) || "pending",
    render_attempts: typeof record.render_attempts === "number" ? record.render_attempts : 0,
    self_review_attempts:
      typeof record.self_review_attempts === "number" ? record.self_review_attempts : 0,
    agent_failures: typeof record.agent_failures === "number" ? record.agent_failures : 0,
    agent_infrastructure_failures:
      typeof record.agent_infrastructure_failures === "number"
        ? record.agent_infrastructure_failures
        : 0,
    slide_path: normalizeString(record.slide_path),
    data_path: normalizeString(record.data_path),
    last_html_path: normalizeString(record.last_html_path),
    last_screenshot_path: normalizeString(record.last_screenshot_path),
    last_error: normalizeString(record.last_error),
    review: record.review ?? null,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

function normalizePageProgressJson(value: unknown): AppPageProgress {
  const record = getPlainRecord(value);
  const pages = Array.isArray(record.pages)
    ? record.pages
        .map(normalizePageProgressItem)
        .filter((item): item is AppPageProgressItem => item !== null)
        .sort((left, right) => left.index - right.index)
    : [];

  return {
    version: 1,
    status: normalizeString(record.status) || "idle",
    pages,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

function createDefaultPagesJson() {
  return {
    version: 1,
    pages: [],
    updated_at: null,
  };
}

function createDefaultPagePlanJson(): AppPagePlan {
  return {
    version: 1,
    status: "planned",
    title: "",
    source: {
      outline_updated_at: null,
      template_group: "",
      template_manifest_path: "",
      generated_by: "",
    },
    pages: [],
    updated_at: new Date(0).toISOString(),
  };
}

function createDefaultPageProgressJson(): AppPageProgress {
  return {
    version: 1,
    status: "idle",
    pages: [],
    updated_at: null,
  };
}

function createDefaultTemplateJson() {
  return {
    version: 1,
    selected_template_group: "",
    selected_template_group_name: "",
    template_dir: "",
    manifest_path: "",
    catalog_json_path: "",
    data_dir_path: "",
    selected_at: null,
  };
}

function readSelectedTemplateManifestPath(workspace: AppWorkspaceResult): string {
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const manifestPath = typeof template.manifest_path === "string" ? template.manifest_path.trim() : "";

  if (!manifestPath) {
    throw new Error(
      "No workspace template is selected. Select a template before rendering deck HTML.",
    );
  }

  assertAbsolutePath(manifestPath, "template.manifest_path");
  const normalizedManifestPath = path.normalize(manifestPath);
  const relativePath = path.relative(workspace.workspace_dir, normalizedManifestPath);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('"template.manifest_path" must be inside the workspace directory');
  }

  return normalizedManifestPath;
}

function readSelectedTemplateDir(workspace: AppWorkspaceResult): string {
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const templateDir = typeof template.template_dir === "string" ? template.template_dir.trim() : "";

  if (!templateDir) {
    throw new Error(
      "No workspace template is selected. Select a template before using template planning.",
    );
  }

  assertAbsolutePath(templateDir, "template.template_dir");
  const normalizedTemplateDir = path.normalize(templateDir);
  const relativePath = path.relative(workspace.workspace_dir, normalizedTemplateDir);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('"template.template_dir" must be inside the workspace directory');
  }

  return normalizedTemplateDir;
}

function readSelectedTemplateCatalogPath(workspace: AppWorkspaceResult): string {
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const catalogPath = typeof template.catalog_json_path === "string" ? template.catalog_json_path.trim() : "";

  if (catalogPath) {
    assertAbsolutePath(catalogPath, "template.catalog_json_path");
    return path.normalize(catalogPath);
  }

  return path.join(readSelectedTemplateDir(workspace), "catalog.json");
}

async function ensureWorkspaceFiles(
  workspaceDir: string,
  options: CreateAppWorkspaceInput = {},
): Promise<AppWorkspaceResult> {
  assertAbsolutePath(workspaceDir, "workspace_dir");

  const normalizedWorkspaceDir = path.normalize(workspaceDir);
  assertWorkspaceUnderRoot(normalizedWorkspaceDir);
  const workspaceName = path.basename(normalizedWorkspaceDir);
  if (!isWorkspaceDirName(workspaceName)) {
    throw new Error('"workspace_dir" must point to a ppt-YYYYMMDD-HHmmss directory');
  }

  await mkdir(normalizedWorkspaceDir, { recursive: true });
  const files = buildWorkspaceFilePaths(normalizedWorkspaceDir);
  const createdFiles: string[] = [];

  const defaults = {
    task: createDefaultTaskJson(normalizedWorkspaceDir, options.title),
    setting: createDefaultSettingJson(),
    outline: createDefaultOutlineJson(),
    page_plan: createDefaultPagePlanJson(),
    page_progress: createDefaultPageProgressJson(),
    pages: createDefaultPagesJson(),
    template: createDefaultTemplateJson(),
  };

  for (const [key, filePath] of Object.entries(files)) {
    if (!(await fileExists(filePath))) {
      await writeJsonFile(filePath, defaults[key as keyof typeof defaults]);
      createdFiles.push(path.basename(filePath));
    }
  }

  const currentSetting = await readJsonFileIfExists(files.setting);
  const normalizedSetting = normalizeSettingJson(currentSetting);
  if (JSON.stringify(currentSetting) !== JSON.stringify(normalizedSetting)) {
    await writeJsonFile(files.setting, normalizedSetting);
  }

  const currentOutline = await readJsonFileIfExists(files.outline);
  const normalizedOutline = normalizeOutlineJson(currentOutline);
  if (JSON.stringify(currentOutline) !== JSON.stringify(normalizedOutline)) {
    await writeJsonFile(files.outline, normalizedOutline);
  }

  const missingFiles: string[] = [];
  for (const fileName of WORKSPACE_FILE_NAMES) {
    const filePath = path.join(normalizedWorkspaceDir, fileName);
    if (!(await fileExists(filePath))) {
      missingFiles.push(fileName);
    }
  }

  return {
    workspace_root: WORKSPACE_ROOT,
    workspace_dir: normalizedWorkspaceDir,
    workspace_id: workspaceName,
    initialized: missingFiles.length === 0,
    created_files: createdFiles,
    missing_files: missingFiles,
    files,
    task: await readJsonFileIfExists(files.task),
    setting: normalizedSetting,
    outline: normalizedOutline,
    page_plan: await readJsonFileIfExists(files.page_plan),
    page_progress: await readJsonFileIfExists(files.page_progress),
    pages: await readJsonFileIfExists(files.pages),
    template: await readJsonFileIfExists(files.template),
  };
}

async function touchWorkspaceTask(workspace: AppWorkspaceResult, updatedAt: string): Promise<void> {
  const existing =
    workspace.task && typeof workspace.task === "object" && !Array.isArray(workspace.task)
      ? (workspace.task as Record<string, unknown>)
      : {};

  await writeJsonFile(workspace.files.task, {
    ...existing,
    updated_at: updatedAt,
  });
}

async function getWorkspaceSummary(workspaceDir: string): Promise<AppWorkspaceSummary> {
  const workspaceName = path.basename(workspaceDir);
  const task = await readJsonFileIfExists(path.join(workspaceDir, "task.json"));
  const info = await stat(workspaceDir);
  const taskRecord =
    task && typeof task === "object" && !Array.isArray(task)
      ? (task as Record<string, unknown>)
      : {};

  return {
    workspace_id: workspaceName,
    workspace_dir: workspaceDir,
    title:
      typeof taskRecord.title === "string" && taskRecord.title.length > 0
        ? taskRecord.title
        : workspaceName,
    status:
      typeof taskRecord.status === "string" && taskRecord.status.length > 0
        ? taskRecord.status
        : "unknown",
    updated_at:
      typeof taskRecord.updated_at === "string"
        ? taskRecord.updated_at
        : info.mtime.toISOString(),
    created_at:
      typeof taskRecord.created_at === "string"
        ? taskRecord.created_at
        : info.birthtime.toISOString(),
  };
}

export function getDefaultAppWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}

export async function listAppWorkspaces(): Promise<ListAppWorkspacesResult> {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  const entries = await readdir(WORKSPACE_ROOT, { withFileTypes: true });
  const workspaceDirs = entries
    .filter((entry) => entry.isDirectory() && isWorkspaceDirName(entry.name))
    .map((entry) => path.join(WORKSPACE_ROOT, entry.name));

  const workspaces = await Promise.all(workspaceDirs.map(getWorkspaceSummary));
  workspaces.sort((left, right) => right.workspace_id.localeCompare(left.workspace_id));

  return {
    workspace_root: WORKSPACE_ROOT,
    has_workspaces: workspaces.length > 0,
    latest_workspace: workspaces[0] ?? null,
    workspaces,
  };
}

export async function createAppWorkspace(
  input: CreateAppWorkspaceInput = {},
): Promise<AppWorkspaceResult> {
  const createdAt = new Date();
  let workspaceId = formatWorkspaceId(createdAt);
  let workspaceDir = path.join(WORKSPACE_ROOT, workspaceId);
  let attempt = 0;
  while (await fileExists(workspaceDir)) {
    attempt += 1;
    workspaceId = formatWorkspaceId(new Date(Date.now() + attempt * 1000));
    workspaceDir = path.join(WORKSPACE_ROOT, workspaceId);
  }

  const title =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title.trim()
      : formatDefaultWorkspaceTitle(createdAt);

  return ensureWorkspaceFiles(workspaceDir, { title });
}

export async function openAppWorkspace(
  input: OpenAppWorkspaceInput,
): Promise<AppWorkspaceResult> {
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function updateAppWorkspaceSettings(
  input: UpdateAppWorkspaceSettingsInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const existing =
    workspace.setting &&
    typeof workspace.setting === "object" &&
    !Array.isArray(workspace.setting)
      ? (workspace.setting as Record<string, unknown>)
      : {};
  const nextSetting = {
    ...existing,
    ...input.setting,
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(workspace.files.setting, nextSetting);
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function updateAppWorkspaceTitle(
  input: UpdateAppWorkspaceTitleInput,
): Promise<AppWorkspaceResult> {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error('"title" must be a non-empty string');
  }

  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const existing =
    workspace.task &&
    typeof workspace.task === "object" &&
    !Array.isArray(workspace.task)
      ? (workspace.task as Record<string, unknown>)
      : {};
  const nextTask = {
    ...existing,
    title,
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(workspace.files.task, nextTask);
  return ensureWorkspaceFiles(input.workspace_dir);
}

function readPageIdFromManifestSlide(value: unknown): string {
  return normalizeString(getPlainRecord(value).id);
}

function writeIndexToRecord(record: Record<string, unknown>, index: number): Record<string, unknown> {
  return {
    ...record,
    index,
  };
}

function clonePlainRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function normalizeIdSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createUniqueId(baseId: string, existingIds: Set<string>): string {
  const normalizedBase = normalizeIdSegment(baseId) || "page";
  const copyBase = `${normalizedBase}-copy`;
  if (!existingIds.has(copyBase)) return copyBase;

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${copyBase}-${index}`;
    if (!existingIds.has(candidate)) return candidate;
  }

  throw new Error(`Could not create a unique copy id for "${baseId}"`);
}

export async function updateAppWorkspacePages(
  input: UpdateAppWorkspacePagesInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  if (!Array.isArray(input.pages) || input.pages.length === 0) {
    throw new Error('"pages" must be a non-empty array');
  }

  const requestedPages = input.pages.map((page) => ({
    page_id: normalizeString(page.page_id),
    title: normalizeString(page.title),
  }));
  if (requestedPages.some((page) => !page.page_id)) {
    throw new Error('Every page entry must include "page_id"');
  }

  const seenPageIds = new Set<string>();
  for (const page of requestedPages) {
    if (seenPageIds.has(page.page_id)) {
      throw new Error(`Duplicate page_id "${page.page_id}"`);
    }
    seenPageIds.add(page.page_id);
  }

  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const manifestRecord = getPlainRecord(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const manifestSlides = Array.isArray(manifestRecord.slides) ? manifestRecord.slides : [];
  const manifestSlidesById = new Map(
    manifestSlides.map((slide) => [readPageIdFromManifestSlide(slide), getPlainRecord(slide)]),
  );
  const missingPageId = requestedPages.find((page) => !manifestSlidesById.has(page.page_id))?.page_id;
  if (missingPageId) {
    throw new Error(`Page not found in manifest: ${missingPageId}`);
  }

  const nextManifestSlides = requestedPages.map((page) => {
    const slide = manifestSlidesById.get(page.page_id) ?? {};
    return page.title ? { ...slide, title: page.title } : slide;
  });

  const updatedAt = new Date().toISOString();
  await writeJsonFile(manifestPath, {
    ...manifestRecord,
    slides: nextManifestSlides,
  });

  const pagesRecord = getPlainRecord(await readJsonFileIfExists(workspace.files.pages));
  const renderedPages = Array.isArray(pagesRecord.pages) ? pagesRecord.pages : [];
  const renderedPagesById = new Map(
    renderedPages.map((page) => [normalizeString(getPlainRecord(page).page_id), getPlainRecord(page)]),
  );
  const nextRenderedPages = requestedPages
    .map((page, index) => {
      const existing = renderedPagesById.get(page.page_id);
      if (!existing) return null;
      return writeIndexToRecord(
        {
          ...existing,
          title: page.title || normalizeString(existing.title),
        },
        index,
      );
    })
    .filter((page): page is Record<string, unknown> => page !== null);

  await writeJsonFile(workspace.files.pages, {
    ...pagesRecord,
    pages: nextRenderedPages,
    updated_at: updatedAt,
  });

  const outlineRecord = normalizeOutlineJson(await readJsonFileIfExists(workspace.files.outline));
  await writeJsonFile(workspace.files.outline, {
    ...outlineRecord,
    items: nextManifestSlides.map((slide) => ({
      title: normalizeString(slide.title),
      outline: normalizeString(slide.speaker_note) || normalizeString(slide.id),
    })),
    updated_at: updatedAt,
  });

  const pagePlanRecord = normalizePagePlanJson(await readJsonFileIfExists(workspace.files.page_plan));
  const pagePlanByManifestId = new Map(
    pagePlanRecord.pages.map((page) => [page.manifest_slide_id, page]),
  );
  const nextPagePlanPages = requestedPages
    .map((page, index) => {
      const existing = pagePlanByManifestId.get(page.page_id);
      return existing
        ? {
            ...existing,
            index,
            title: page.title || existing.title,
          }
        : null;
    })
    .filter((page): page is AppPagePlan["pages"][number] => page !== null);
  if (nextPagePlanPages.length > 0) {
    await writeJsonFile(workspace.files.page_plan, {
      ...pagePlanRecord,
      source: {
        ...pagePlanRecord.source,
        outline_updated_at: updatedAt,
      },
      pages: nextPagePlanPages,
      updated_at: updatedAt,
    });
  }

  const pageProgressRecord = normalizePageProgressJson(await readJsonFileIfExists(workspace.files.page_progress));
  const progressByPageId = new Map(
    pageProgressRecord.pages.map((page) => [page.page_id, page]),
  );
  const nextProgressPages = nextPagePlanPages
    .map((planPage): AppPageProgressItem | null => {
      const existing = progressByPageId.get(planPage.page_id);
      return existing
        ? {
            ...existing,
            index: planPage.index,
            title: planPage.title,
            updated_at: updatedAt,
          }
        : null;
    })
    .filter((page): page is AppPageProgressItem => page !== null);
  if (nextProgressPages.length > 0) {
    await writeJsonFile(workspace.files.page_progress, {
      ...pageProgressRecord,
      pages: nextProgressPages,
      updated_at: updatedAt,
    });
  }

  await touchWorkspaceTask(workspace, updatedAt);
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function duplicateAppWorkspacePage(
  input: DuplicateAppWorkspacePageInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const sourcePageId = normalizeString(input.page_id);
  if (!sourcePageId) {
    throw new Error('"page_id" must be a non-empty string');
  }

  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const manifestRecord = getPlainRecord(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const manifestSlides = Array.isArray(manifestRecord.slides)
    ? manifestRecord.slides.map((slide) => getPlainRecord(slide))
    : [];
  const sourceIndex = manifestSlides.findIndex(
    (slide) => readPageIdFromManifestSlide(slide) === sourcePageId,
  );
  if (sourceIndex < 0) {
    throw new Error(`Page not found in manifest: ${sourcePageId}`);
  }

  const sourceSlide = manifestSlides[sourceIndex] ?? {};
  const existingManifestIds = new Set(manifestSlides.map(readPageIdFromManifestSlide));
  const copySlideId = createUniqueId(sourcePageId, existingManifestIds);
  const copyTitle = normalizeString(input.title) || normalizeString(sourceSlide.title) || copySlideId;
  const copySlide: Record<string, unknown> = {
    ...clonePlainRecord(sourceSlide),
    id: copySlideId,
    title: copyTitle,
  };
  const nextManifestSlides: Record<string, unknown>[] = [
    ...manifestSlides.slice(0, sourceIndex + 1),
    copySlide,
    ...manifestSlides.slice(sourceIndex + 1),
  ];

  const updatedAt = new Date().toISOString();
  await writeJsonFile(manifestPath, {
    ...manifestRecord,
    slides: nextManifestSlides,
  });

  const pagesRecord = getPlainRecord(await readJsonFileIfExists(workspace.files.pages));
  const renderedPages = Array.isArray(pagesRecord.pages)
    ? pagesRecord.pages.map((page) => getPlainRecord(page))
    : [];
  const renderedSourceIndex = renderedPages.findIndex(
    (page) => normalizeString(page.page_id) === sourcePageId,
  );
  if (renderedSourceIndex >= 0) {
    const sourceRenderedPage = renderedPages[renderedSourceIndex] ?? {};
    const copyRenderedPage = {
      ...clonePlainRecord(sourceRenderedPage),
      page_id: copySlideId,
      title: copyTitle,
    };
    const nextRenderedPages = [
      ...renderedPages.slice(0, renderedSourceIndex + 1),
      copyRenderedPage,
      ...renderedPages.slice(renderedSourceIndex + 1),
    ].map(writeIndexToRecord);

    await writeJsonFile(workspace.files.pages, {
      ...pagesRecord,
      pages: nextRenderedPages,
      updated_at: updatedAt,
    });
  }

  const outlineRecord = normalizeOutlineJson(await readJsonFileIfExists(workspace.files.outline));
  await writeJsonFile(workspace.files.outline, {
    ...outlineRecord,
    items: nextManifestSlides.map((slide) => ({
      title: normalizeString(slide.title),
      outline: normalizeString(slide.speaker_note) || normalizeString(slide.id),
    })),
    updated_at: updatedAt,
  });

  const pagePlanRecord = normalizePagePlanJson(await readJsonFileIfExists(workspace.files.page_plan));
  const pagePlanByManifestId = new Map(
    pagePlanRecord.pages.map((page) => [page.manifest_slide_id, page]),
  );
  const sourcePagePlan = pagePlanByManifestId.get(sourcePageId);
  let copyPagePlanId = "";
  if (sourcePagePlan) {
    const existingPagePlanIds = new Set(pagePlanRecord.pages.map((page) => page.page_id));
    copyPagePlanId = createUniqueId(sourcePagePlan.page_id, existingPagePlanIds);
    const nextPagePlanPages = nextManifestSlides
      .map((slide, index) => {
        const slideId = readPageIdFromManifestSlide(slide);
        if (slideId === copySlideId) {
          return {
            ...sourcePagePlan,
            page_id: copyPagePlanId,
            index,
            title: copyTitle,
            manifest_slide_id: copySlideId,
          };
        }
        const existing = pagePlanByManifestId.get(slideId);
        return existing
          ? {
              ...existing,
              index,
            }
          : null;
      })
      .filter((page): page is AppPagePlanItem => page !== null);

    await writeJsonFile(workspace.files.page_plan, {
      ...pagePlanRecord,
      source: {
        ...pagePlanRecord.source,
        outline_updated_at: updatedAt,
      },
      pages: nextPagePlanPages,
      updated_at: updatedAt,
    });

    const pageProgressRecord = normalizePageProgressJson(await readJsonFileIfExists(workspace.files.page_progress));
    const progressByPageId = new Map(
      pageProgressRecord.pages.map((page) => [page.page_id, page]),
    );
    const sourceProgress = progressByPageId.get(sourcePagePlan.page_id);
    const nextProgressPages = nextPagePlanPages
      .map((planPage): AppPageProgressItem | null => {
        if (planPage.page_id === copyPagePlanId) {
          return sourceProgress
            ? {
                ...sourceProgress,
                page_id: copyPagePlanId,
                index: planPage.index,
                title: copyTitle,
                updated_at: updatedAt,
              }
            : null;
        }
        const existing = progressByPageId.get(planPage.page_id);
        return existing
          ? {
              ...existing,
              index: planPage.index,
              title: planPage.title,
            }
          : null;
      })
      .filter((page): page is AppPageProgressItem => page !== null);

    if (nextProgressPages.length > 0) {
      await writeJsonFile(workspace.files.page_progress, {
        ...pageProgressRecord,
        pages: nextProgressPages,
        updated_at: updatedAt,
      });
    }
  }

  await touchWorkspaceTask(workspace, updatedAt);
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function getAppWorkspaceOutline(
  input: GetAppWorkspaceOutlineInput,
): Promise<AppWorkspaceOutline> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return normalizeOutlineJson(workspace.outline);
}

export async function appendAppWorkspaceLog(
  input: AppendAppWorkspaceLogInput,
): Promise<AppendAppWorkspaceLogResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const logFileName = WORKSPACE_LOG_FILE_NAMES[input.channel];
  if (!logFileName) {
    throw new Error('"channel" must be a supported workspace log channel');
  }

  const logDir = path.join(workspace.workspace_dir, ".log");
  const logFile = path.join(logDir, logFileName);
  const entry = {
    timestamp: new Date().toISOString(),
    ...input.entry,
  };

  await mkdir(logDir, { recursive: true });
  await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf8");

  return {
    workspace_dir: workspace.workspace_dir,
    log_file: logFile,
    appended: true,
  };
}

export async function updateAppWorkspaceOutline(
  input: UpdateAppWorkspaceOutlineInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const updatedAt = new Date().toISOString();
  const nextOutline = normalizeOutlineJson({
    ...normalizeOutlineJson(workspace.outline),
    ...input.outline,
    updated_at: updatedAt,
  });

  await writeJsonFile(workspace.files.outline, nextOutline);
  await touchWorkspaceTask(workspace, updatedAt);
  return ensureWorkspaceFiles(input.workspace_dir);
}

function buildTemplatePreviewUrl(image: TemplatePreviewImage): string {
  return `template-previews/${image.group_id}/${image.file_name}`;
}

function mapPreviewRef(image: TemplatePreviewImage | null): AppTemplatePreviewRef | null {
  return image
    ? {
        group_id: image.group_id,
        layout_id: image.layout_id,
        layout_name: image.layout_name,
        file_name: image.file_name,
        mime_type: image.mime_type,
        width: image.width,
        height: image.height,
        primary: image.primary,
        url: buildTemplatePreviewUrl(image),
      }
    : null;
}

function normalizePlanningBlueprint(value: unknown): AppTemplatePlanningBlueprint | null {
  const record = getPlainRecord(value);
  const id = normalizeString(record.id);
  const blueprintSource = normalizeString(record.blueprint_source);
  if (!id || !blueprintSource) return null;

  return {
    id,
    name: normalizeString(record.name) || id,
    blueprint_source: blueprintSource,
    example_slide: normalizeString(record.example_slide) || undefined,
    layout_family: normalizeString(record.layout_family) || undefined,
    content_intents: normalizeStringArray(record.content_intents),
    suitable_for: normalizeStringArray(record.suitable_for),
    avoid_for: normalizeStringArray(record.avoid_for),
  };
}

async function mapTemplateGroupSummary(
  group: DiscoveredTemplateGroupSummaryInfo,
): Promise<AppTemplateGroupSummary> {
  const previewGroup = await getTemplatePreviewGroup(group.group_id).catch(() => null);
  const images = previewGroup?.images ?? [];
  const cover = group.cover_layout_id
    ? images.find((image) => image.layout_id === group.cover_layout_id) ?? null
    : null;
  const primary = images.find((image) => image.primary) ?? null;
  const preview = cover ?? primary ?? images[0] ?? null;
  const previews = images
    .map(mapPreviewRef)
    .filter((ref): ref is AppTemplatePreviewRef => ref !== null);

  return {
    group_id: group.group_id,
    group_name: group.group_name,
    group_description: group.group_description,
    ordered: group.ordered,
    default: group.default,
    group_brief: group.group_brief,
    style_tags: group.style_tags,
    industry_tags: group.industry_tags,
    use_cases: group.use_cases,
    audience_tags: group.audience_tags,
    tone_tags: group.tone_tags,
    cover_layout_id: group.cover_layout_id,
    agenda_layout_id: group.agenda_layout_id,
    closing_layout_id: group.closing_layout_id,
    layout_roles_summary: group.layout_roles_summary,
    content_elements_summary: group.content_elements_summary,
    layout_count: group.layout_count,
    preview: mapPreviewRef(preview),
    previews,
  };
}

export async function listAppTemplateGroups(): Promise<ListAppTemplateGroupsResult> {
  const groups = await listDiscoveredTemplateGroupSummaries({ include_builtin: true });
  const mapped = await Promise.all(groups.map(mapTemplateGroupSummary));
  return {
    groups: mapped,
    count: mapped.length,
  };
}

export async function getAppTemplateGroup(input: GetAppTemplateGroupInput) {
  const group = await getDiscoveredTemplateGroup({
    group_id: input.group_id,
    include_builtin: true,
  });

  if (!group) {
    throw new Error(`Template group not found: ${input.group_id}`);
  }

  return group;
}

export async function getAppTemplatePreview(
  input: GetAppTemplatePreviewInput,
): Promise<AppTemplatePreviewResult> {
  return readTemplatePreviewDataUrl(input.group_id, input.layout_id);
}

export async function getAppTemplatePlanningContext(
  input: GetAppTemplatePlanningContextInput,
): Promise<AppTemplatePlanningContext> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const templateDir = readSelectedTemplateDir(workspace);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const catalogPath = readSelectedTemplateCatalogPath(workspace);
  const catalog = getPlainRecord(JSON.parse(await readFile(catalogPath, "utf8")) as unknown);
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const blueprints = Array.isArray(catalog.blueprints)
    ? catalog.blueprints
        .map(normalizePlanningBlueprint)
        .filter((item): item is AppTemplatePlanningBlueprint => item !== null)
    : [];

  return {
    template_group: normalizeString(catalog.group_id) || normalizeString(template.selected_template_group),
    template_group_name:
      normalizeString(template.selected_template_group_name) || normalizeString(catalog.group_id),
    template_dir: templateDir,
    manifest_path: manifestPath,
    catalog_path: catalogPath,
    blueprints,
    rules: [
      "Choose blueprint_id only from this context.",
      "manifest.json must reference ./slides/*.tsx entries.",
      "blueprints/ and reference-slides/ are read-only.",
      "data/*.json stores content; slides/*.tsx owns layout and component composition.",
    ],
  };
}

export async function selectAppWorkspaceTemplate(
  input: SelectAppWorkspaceTemplateInput,
): Promise<SelectAppWorkspaceTemplateResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const templateGroup = input.template_group.trim();
  if (templateGroup.length === 0) {
    throw new Error('"template_group" must be a non-empty string');
  }

  const availableGroups = await listDiscoveredTemplateGroupSummaries({ include_builtin: true });
  const selectedGroup = availableGroups.find((group) => group.group_id === templateGroup);
  if (!selectedGroup) {
    throw new Error(`Template group not found: ${templateGroup}`);
  }

  const title =
    workspace.task &&
    typeof workspace.task === "object" &&
    !Array.isArray(workspace.task) &&
    typeof (workspace.task as { title?: unknown }).title === "string"
      ? (workspace.task as { title: string }).title
      : selectedGroup.group_name;
  const templateDir = path.join(workspace.workspace_dir, "template");
  const forkResult = await forkTemplateGroup({
    templateGroup: selectedGroup.group_id,
    outDir: templateDir,
    manifestTitle: title,
    overwrite: true,
  });
  const selectedAt = new Date().toISOString();
  const selection: AppWorkspaceTemplateSelection = {
    version: 1,
    selected_template_group: selectedGroup.group_id,
    selected_template_group_name: selectedGroup.group_name,
    template_dir: templateDir,
    manifest_path: forkResult.manifestPath,
    catalog_json_path: forkResult.catalogJsonPath,
    data_dir_path: forkResult.dataDirPath,
    selected_at: selectedAt,
  };

  await writeJsonFile(workspace.files.template, selection);
  await touchWorkspaceTask(workspace, selectedAt);

  return {
    workspace: await ensureWorkspaceFiles(input.workspace_dir),
    selection,
  };
}

export async function renderAppWorkspaceDeckHtml(
  input: RenderAppWorkspaceDeckHtmlInput,
): Promise<RenderAppWorkspaceDeckHtmlResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const renderedAt = new Date().toISOString();
  const outputDir = path.join(workspace.workspace_dir, "output", "app-render");
  const result = await buildDeckHtmlPagesFromManifest({
    manifestPath,
    outputDir,
    name: `${workspace.workspace_id}-review`,
  });
  const slides = result.slides.map((slide) => ({
    slide_id: slide.slideId,
    layout_id: slide.layoutId,
    title: slide.title,
    html_path: slide.outputPath,
    speaker_note: slide.speakerNote,
  }));
  const outline: AppWorkspaceOutline = {
    version: 2,
    title: result.title,
    status: "confirmed",
    items: slides.map((slide) => ({
      title: slide.title,
      outline: slide.speaker_note || slide.layout_id,
    })),
    source: {
      prompt: "",
      context: [],
      setting: normalizeSettingJson(workspace.setting),
      kind: "template-manifest",
    },
    updated_at: renderedAt,
  };
  const pages: AppWorkspacePages = {
    version: 1,
    status: "rendered",
    title: result.title,
    manifest_path: result.manifestPath,
    output_dir: result.outputDir,
    rendered_at: renderedAt,
    pages: slides.map((slide, index) => ({
      page_id: slide.slide_id,
      index,
      title: slide.title,
      layout_id: slide.layout_id,
      html_path: slide.html_path,
      speaker_note: slide.speaker_note,
    })),
    source: {
      kind: "template-manifest",
    },
    updated_at: renderedAt,
  };

  await writeJsonFile(workspace.files.outline, outline);
  await writeJsonFile(workspace.files.pages, pages);
  await touchWorkspaceTask(workspace, renderedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: result.manifestPath,
    output_dir: result.outputDir,
    slides,
    slide_count: result.slideCount,
    title: result.title,
    rendered_at: renderedAt,
  };
}

async function launchPdfBrowser(): Promise<any> {
  const puppeteerModule = await import("puppeteer");
  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

function buildPdfHtmlFromDataUrls(imageDataUrls: string[]): string {
  const slides = imageDataUrls.map((dataUrl, index) => [
    `<section class="page" data-page="${index + 1}">`,
    `<img alt="Slide ${index + 1}" src="${dataUrl}" />`,
    "</section>",
  ].join("\n")).join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    "  <style>",
    "    @page {",
    "      size: 13.333in 7.5in;",
    "      margin: 0;",
    "    }",
    "    html, body {",
    "      margin: 0;",
    "      padding: 0;",
    "      width: 100%;",
    "      background: #ffffff;",
    "    }",
    "    body {",
    "      -webkit-print-color-adjust: exact;",
    "      print-color-adjust: exact;",
    "    }",
    "    .page {",
    "      width: 1280px;",
    "      height: 720px;",
    "      overflow: hidden;",
    "      page-break-after: always;",
    "    }",
    "    .page:last-child {",
    "      page-break-after: auto;",
    "    }",
    "    img {",
    "      display: block;",
    "      width: 1280px;",
    "      height: 720px;",
    "      object-fit: cover;",
    "    }",
    "  </style>",
    "</head>",
    "<body>",
    slides,
    "</body>",
    "</html>",
  ].join("\n");
}

async function createPdfFromSlideHtmlPaths(
  slideHtmlPaths: string[],
  pdfPath: string,
): Promise<void> {
  const browser = await launchPdfBrowser();

  try {
    const slideDataUrls: string[] = [];

    for (const slideHtmlPath of slideHtmlPaths) {
      const slideBrowserPage = await browser.newPage();
      try {
        await slideBrowserPage.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
        await slideBrowserPage.goto(pathToFileURL(slideHtmlPath).href, {
          waitUntil: "networkidle0",
        });
        await slideBrowserPage.waitForSelector("#presentation-slides-wrapper[data-presenton-render-status='ready']", {
          timeout: 120_000,
        });
        const screenshot = await slideBrowserPage.screenshot({
          type: "png",
          fullPage: false,
        });
        slideDataUrls.push(`data:image/png;base64,${Buffer.from(screenshot).toString("base64")}`);
      } finally {
        await slideBrowserPage.close().catch(() => undefined);
      }
    }

    const pdfPage = await browser.newPage();
    try {
      await pdfPage.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await pdfPage.setContent(buildPdfHtmlFromDataUrls(slideDataUrls), {
        waitUntil: "load",
      });
      await pdfPage.pdf({
        path: pdfPath,
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await pdfPage.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function recordWorkspaceExport(
  workspace: AppWorkspaceResult,
  artifactType: "pptx" | "pdf",
  artifactPath: string,
  extra?: Record<string, unknown>,
): Promise<AppWorkspaceResult> {
  const updatedAt = new Date().toISOString();
  const existing =
    workspace.task && typeof workspace.task === "object" && !Array.isArray(workspace.task)
      ? (workspace.task as Record<string, unknown>)
      : {};
  const existingArtifacts =
    existing.artifacts && typeof existing.artifacts === "object" && !Array.isArray(existing.artifacts)
      ? (existing.artifacts as Record<string, unknown>)
      : {};

  await writeJsonFile(workspace.files.task, {
    ...existing,
    updated_at: updatedAt,
    artifacts: {
      ...existingArtifacts,
      [artifactType]: {
        path: artifactPath,
        updated_at: updatedAt,
        ...extra,
      },
    },
  });

  return ensureWorkspaceFiles(workspace.workspace_dir);
}

export async function prepareAppExportModel(
  input: PrepareAppExportModelInput,
): Promise<PrepareAppExportModelResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const outputDir = path.join(workspace.workspace_dir, "output");
  const preparedAt = new Date().toISOString();
  const result = await buildDeckHtmlFromManifest({
    manifestPath,
    outputDir,
    name: `${workspace.workspace_id}-export`,
  });
  const model = await convertDeckHtmlToPptxModel({
    html: result.deckHtml,
    name: result.title,
  });
  const modelPath = path.join(outputDir, "ppt-model.json");

  await mkdir(outputDir, { recursive: true });
  await writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  await touchWorkspaceTask(workspace, preparedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: manifestPath,
    html_path: result.deckOutputPath,
    model_path: modelPath,
    output_dir: outputDir,
    prepared_at: preparedAt,
  };
}

export async function exportAppPdf(
  input: ExportAppPdfInput,
): Promise<ExportAppPdfResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const outputDir = path.join(workspace.workspace_dir, "output");
  const pdfPath = path.join(outputDir, "deck.pdf");
  const exportedAt = new Date().toISOString();
  const pagesRecord =
    workspace.pages && typeof workspace.pages === "object" && !Array.isArray(workspace.pages)
      ? (workspace.pages as Record<string, unknown>)
      : null;
  const existingHtmlPaths = Array.isArray(pagesRecord?.pages)
    ? pagesRecord.pages
        .map((page) =>
          page && typeof page === "object" && !Array.isArray(page) && typeof (page as { html_path?: unknown }).html_path === "string"
            ? (page as { html_path: string }).html_path
            : "",
        )
        .filter((htmlPath): htmlPath is string => htmlPath.length > 0)
    : [];
  const rendered = existingHtmlPaths.length > 0
    ? null
    : await renderAppWorkspaceDeckHtml({
      workspace_dir: workspace.workspace_dir,
    });
  const htmlPaths =
    existingHtmlPaths.length > 0
      ? existingHtmlPaths
      : rendered?.slides.map((slide) => slide.html_path) ?? [];

  await mkdir(outputDir, { recursive: true });
  await createPdfFromSlideHtmlPaths(htmlPaths, pdfPath);
  await touchWorkspaceTask(workspace, exportedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: rendered?.manifest_path ?? readSelectedTemplateManifestPath(workspace),
    html_path: htmlPaths[0] ?? "",
    pdf_path: pdfPath,
    output_dir: outputDir,
    exported_at: exportedAt,
  };
}

export async function recordAppPptxExport(
  input: RecordAppPptxExportInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return recordWorkspaceExport(workspace, "pptx", input.pptx_path, {
    generator_result: input.generator_result ?? null,
  });
}

export async function recordAppPdfExport(
  input: RecordAppPdfExportInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return recordWorkspaceExport(workspace, "pdf", input.pdf_path);
}

function buildBlueprintLookup(context: AppTemplatePlanningContext): Map<string, AppTemplatePlanningBlueprint> {
  return new Map(context.blueprints.map((blueprint) => [blueprint.id, blueprint]));
}

function resolveTemplateRelativePath(templateDir: string, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  const absolutePath = path.normalize(path.join(templateDir, cleanPath));
  const relativeToTemplate = path.relative(templateDir, absolutePath);
  if (
    relativeToTemplate.length === 0 ||
    relativeToTemplate.startsWith("..") ||
    path.isAbsolute(relativeToTemplate)
  ) {
    throw new Error(`Template-relative path escapes template directory: ${relativePath}`);
  }
  return absolutePath;
}

async function validatePagePlanAgainstTemplate(
  workspace: AppWorkspaceResult,
  pagePlan: AppPagePlan,
): Promise<AppTemplatePlanningContext> {
  const context = await getAppTemplatePlanningContext({ workspace_dir: workspace.workspace_dir });
  const blueprintById = buildBlueprintLookup(context);
  const outline = normalizeOutlineJson(workspace.outline);

  if (outline.items.length > 0 && pagePlan.pages.length !== outline.items.length) {
    throw new Error(
      `page_plan.pages length (${pagePlan.pages.length}) must equal outline.items length (${outline.items.length})`,
    );
  }

  pagePlan.pages.forEach((page, index) => {
    if (page.index !== index) {
      throw new Error(`page_plan.pages[${index}].index must equal ${index}`);
    }

    const blueprint = blueprintById.get(page.blueprint_id);
    if (!blueprint) {
      throw new Error(`Unknown blueprint_id "${page.blueprint_id}"`);
    }

    if (page.blueprint_source !== blueprint.blueprint_source) {
      throw new Error(
        `page_plan.pages[${index}].blueprint_source must match catalog source "${blueprint.blueprint_source}"`,
      );
    }
  });

  return context;
}

export async function recordAppPagePlan(input: RecordAppPagePlanInput): Promise<AppPagePlan> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const pagePlan = normalizePagePlanJson(input.page_plan);
  const context = await validatePagePlanAgainstTemplate(workspace, pagePlan);
  const updatedAt = new Date().toISOString();
  const normalizedPlan: AppPagePlan = {
    ...pagePlan,
    status: "planned",
    source: {
      ...pagePlan.source,
      template_group: pagePlan.source.template_group || context.template_group,
      template_manifest_path: pagePlan.source.template_manifest_path || context.manifest_path,
    },
    updated_at: updatedAt,
  };

  await writeJsonFile(workspace.files.page_plan, normalizedPlan);
  await touchWorkspaceTask(workspace, updatedAt);
  return normalizedPlan;
}

export async function getAppPagePlan(input: GetAppPagePlanInput): Promise<AppPagePlan> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return normalizePagePlanJson(workspace.page_plan);
}

function buildInitialPageData(page: AppPagePlanItem) {
  return {
    pageId: page.page_id,
    title: page.title,
    outline: page.outline,
    speakerNote: page.outline,
    _plan: {
      blueprint_id: page.blueprint_id,
      reason: page.reason,
      status: "agent_pending",
    },
  };
}

function buildInitialPageProgress(pagePlan: AppPagePlan): AppPageProgress {
  const now = new Date().toISOString();
  return {
    version: 1,
    status: "prepared",
    pages: pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      status: "pending",
      render_attempts: 0,
      self_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      slide_path: page.slide_path,
      data_path: page.data_path,
      last_html_path: "",
      last_screenshot_path: "",
      last_error: "",
      review: null,
      updated_at: now,
    })),
    updated_at: now,
  };
}

export async function prepareAppPageFiles(
  input: PrepareAppPageFilesInput,
): Promise<PrepareAppPageFilesResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const pagePlan = normalizePagePlanJson(workspace.page_plan);
  const context = await validatePagePlanAgainstTemplate(workspace, pagePlan);
  const templateDir = context.template_dir;
  const preparedAt = new Date().toISOString();

  if (pagePlan.pages.length === 0) {
    throw new Error("page-plan.json has no pages to prepare");
  }

  for (const page of pagePlan.pages) {
    const sourcePath = resolveTemplateRelativePath(templateDir, page.blueprint_source);
    const slidePath = resolveTemplateRelativePath(templateDir, page.slide_path);
    const dataPath = resolveTemplateRelativePath(templateDir, page.data_path);

    await mkdir(path.dirname(slidePath), { recursive: true });
    await mkdir(path.dirname(dataPath), { recursive: true });
    await copyFile(sourcePath, slidePath);
    await writeJsonFile(dataPath, buildInitialPageData(page));
  }

  const currentManifest = getPlainRecord(JSON.parse(await readFile(context.manifest_path, "utf8")) as unknown);
  const nextManifest = {
    ...currentManifest,
    title: pagePlan.title || normalizeString(currentManifest.title) || "Generated Deck",
    slides: pagePlan.pages.map((page) => ({
      id: page.manifest_slide_id,
      title: page.title,
      speaker_note: page.outline,
      source: {
        type: "local",
        path: page.slide_path,
      },
      data_path: page.data_path,
    })),
  };
  const preparedPlan: AppPagePlan = {
    ...pagePlan,
    status: "prepared",
    updated_at: preparedAt,
  };

  await writeJsonFile(context.manifest_path, nextManifest);
  await writeJsonFile(workspace.files.page_plan, preparedPlan);
  await writeJsonFile(workspace.files.page_progress, buildInitialPageProgress(preparedPlan));
  await touchWorkspaceTask(workspace, preparedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: context.manifest_path,
    page_plan_path: workspace.files.page_plan,
    prepared_at: preparedAt,
    pages: preparedPlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      slide_path: page.slide_path,
      data_path: page.data_path,
      blueprint_id: page.blueprint_id,
      manifest_slide_id: page.manifest_slide_id,
    })),
  };
}

export async function getAppPageProgress(
  input: GetAppPageProgressInput,
): Promise<AppPageProgress> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return normalizePageProgressJson(workspace.page_progress);
}

export async function recordAppPageProgress(
  input: RecordAppPageProgressInput,
): Promise<AppPageProgress> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const current = normalizePageProgressJson(workspace.page_progress);
  const updatedAt = new Date().toISOString();
  let found = false;
  const nextPages = current.pages.map((page) => {
    if (page.page_id !== input.page_id) return page;
    found = true;
    return normalizePageProgressItem({
      ...page,
      ...input.patch,
      page_id: page.page_id,
      index: page.index,
      updated_at: updatedAt,
    }) as AppPageProgressItem;
  });

  if (!found) {
    throw new Error(`Unknown page_id "${input.page_id}" in page-progress.json`);
  }

  const nextProgress: AppPageProgress = {
    version: 1,
    status: normalizeString(input.patch.deck_status) || current.status || "running",
    pages: nextPages,
    updated_at: updatedAt,
  };

  await writeJsonFile(workspace.files.page_progress, nextProgress);
  await touchWorkspaceTask(workspace, updatedAt);
  return nextProgress;
}

export async function renderAppWorkspacePagePreview(
  input: RenderAppWorkspacePagePreviewInput,
): Promise<RenderAppWorkspacePagePreviewResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  if (!Number.isInteger(input.page_index) || input.page_index < 0) {
    throw new Error('"page_index" must be a non-negative integer');
  }

  const pageNumber = input.page_index + 1;
  const renderedAt = new Date().toISOString();
  const htmlOutputDir = path.join(workspace.workspace_dir, "output", "page-preview-html");
  const screenshotOutputDir = path.join(workspace.workspace_dir, "output", "screenshots");
  const result = await buildDeckPageScreenshotFromManifest({
    manifestPath,
    outputDir: screenshotOutputDir,
    htmlOutputDir,
    name: `${workspace.workspace_id}-page-preview`,
    page: pageNumber,
  });

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: result.manifestPath,
    html_path: result.htmlPath,
    screenshot_path: result.screenshotPath,
    page_index: input.page_index,
    page_number: pageNumber,
    slide_id: result.slideId,
    layout_id: result.layoutId,
    title: result.title,
    rendered_at: renderedAt,
  };
}

export type {
  AppendAppWorkspaceLogInput,
  AppendAppWorkspaceLogResult,
  AppPagePlan,
  AppPagePlanItem,
  AppPageProgress,
  AppPageProgressItem,
  ExportAppPdfInput,
  ExportAppPdfResult,
  AppTemplatePlanningBlueprint,
  AppTemplatePlanningContext,
  AppTemplateGroupSummary,
  AppTemplatePreviewRef,
  AppTemplatePreviewResult,
  AppWorkspaceFiles,
  AppWorkspaceOutline,
  AppWorkspaceOutlineItem,
  AppWorkspaceResult,
  AppWorkspaceSummary,
  AppWorkspaceTemplateSelection,
  CreateAppWorkspaceInput,
  DuplicateAppWorkspacePageInput,
  GetAppPagePlanInput,
  GetAppPageProgressInput,
  GetAppTemplateGroupInput,
  GetAppTemplatePlanningContextInput,
  GetAppTemplatePreviewInput,
  GetAppWorkspaceOutlineInput,
  ListAppTemplateGroupsResult,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  PrepareAppPageFilesInput,
  PrepareAppPageFilesResult,
  PrepareAppExportModelInput,
  PrepareAppExportModelResult,
  RecordAppPagePlanInput,
  RecordAppPageProgressInput,
  RecordAppPdfExportInput,
  RecordAppPptxExportInput,
  RenderAppWorkspaceDeckHtmlInput,
  RenderAppWorkspaceDeckHtmlResult,
  RenderAppWorkspacePagePreviewInput,
  RenderAppWorkspacePagePreviewResult,
  SelectAppWorkspaceTemplateInput,
  SelectAppWorkspaceTemplateResult,
  UpdateAppWorkspaceOutlineInput,
  UpdateAppWorkspacePagesInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
} from "./types.js";
