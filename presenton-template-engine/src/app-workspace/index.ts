import os from "node:os";
import path from "node:path";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import type {
  AppWorkspaceResult,
  AppWorkspaceSummary,
  CreateAppWorkspaceInput,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
} from "./types.js";

const WORKSPACE_ROOT = path.join(os.homedir(), "anna-workspace", "ppt", "tasks");
const WORKSPACE_DIR_PATTERN = /^ppt-\d{8}-\d{6}$/;
const WORKSPACE_FILE_NAMES = [
  "task.json",
  "setting.json",
  "outline.json",
  "pages.json",
] as const;

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
    pages: path.join(workspaceDir, "pages.json"),
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
  return {
    version: 1,
    title: "",
    items: [],
    updated_at: null,
  };
}

function createDefaultPagesJson() {
  return {
    version: 1,
    pages: [],
    updated_at: null,
  };
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
    pages: createDefaultPagesJson(),
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
    outline: await readJsonFileIfExists(files.outline),
    pages: await readJsonFileIfExists(files.pages),
  };
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

export type {
  AppWorkspaceFiles,
  AppWorkspaceResult,
  AppWorkspaceSummary,
  CreateAppWorkspaceInput,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
} from "./types.js";
