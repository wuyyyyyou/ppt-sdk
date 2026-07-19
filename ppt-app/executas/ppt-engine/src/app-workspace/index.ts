import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createReadStream } from "node:fs";
import { appendFile, copyFile, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
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
  buildDeckHtmlPagesAndScreenshotsFromManifest,
  buildDeckPageScreenshotFromManifest,
} from "../render/build-deck-from-manifest.js";
import type {
  LegacyDeckManifestInput,
  LegacyDeckManifestSlideInput,
} from "../render/types.js";
import { validateThemeTokenRecord } from "../render/theme-tokens.js";
import { resolveLocalModulePath } from "../local-template/loader.js";
import { assertLocalTemplateTypecheck } from "../local-template/typecheck.js";
import { launchManagedBrowser } from "../runtime/browser-runtime.js";
import { convertDeckHtmlToPptxModel } from "../html-to-pptx-model/index.js";
import { rasterizePptxToImages } from "../pptx-rasterization/index.js";
import type {
  AppendAppWorkspaceLogInput,
  AppendAppWorkspaceLogResult,
  AppUploadedSourceIndex,
  AppUploadedSourceMaterial,
  AppUploadedSourceAnalysisDraftFingerprint,
  AppUploadedSourceAnalysisPaths,
  AppReferenceSlideImage,
  AppStyleProfileCreationManifest,
  AppStyleProfileCreationPaths,
  AppStyleProfileDraftFingerprint,
  AppStyleProfileIndex,
  AppStyleProfileIndexEntry,
  AppStyleProfileReferenceMaterial,
  AppTemplateGroupSummary,
  AppTemplatePreviewRef,
  AppTemplatePreviewResult,
  AppCreateWorkspaceSetting,
  AppPresentationRequirementCandidate,
  AppPresentationRequirements,
  AppPresentationRequirementsCandidates,
  AppPresentationRequirementsSelections,
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
  AppExportArtifactMirror,
  AppExportArtifactMirrorStatus,
  AppExportArtifactInfo,
  AppExportArtifactSnapshot,
  AppWorkspacePages,
  AppWorkspaceTemplateSelection,
  AppTemplatePlanningBlueprint,
  AppTemplatePlanningContext,
  CreateAppWorkspaceInput,
  CreateAppWorkspaceResult,
  DuplicateAppWorkspacePageInput,
  ListAppUploadedSourcesInput,
  ListAppUploadedSourcesResult,
  ListAppStyleProfilesResult,
  AppStyleProfileReferenceImagePreview,
  GetAppStyleProfileInput,
  GetAppStyleProfilePreviewInput,
  GetAppStyleProfilePreviewResult,
  GetAppStyleProfileResult,
  GetAppStyleProfileCreationContextInput,
  GetAppStyleProfileCreationContextResult,
  GetAppStyleProfileDraftFingerprintInput,
  GetAppStyleProfileDraftInput,
  GetAppStyleProfileDraftResult,
  GetAppWorkspaceStyleProfileInput,
  GetAppWorkspaceStyleProfileResult,
  GetAppUploadedSourceAnalysisDraftFingerprintInput,
  GetAppUploadedSourceAnalysisDraftInput,
  GetAppUploadedSourceAnalysisInput,
  GetAppPagePlanInput,
  GetAppPageProgressInput,
  GetAppExportArtifactInput,
  CommitAppExportArtifactMirrorInput,
  GetAppWorkspaceDefaultsResult,
  GetAppTemplateGroupInput,
  GetAppTemplatePlanningContextInput,
  GetAppTemplatePreviewInput,
  GetAppWorkspaceThemeContextInput,
  GetAppWorkspaceOutlineInput,
  GetAppWorkspaceRequirementsInput,
  GetAppWorkspacePageFileFingerprintsInput,
  GetAppWorkspacePageFileFingerprintsResult,
  ListAppTemplateGroupsResult,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  RemoveAppUploadedSourceInput,
  RemoveAppUploadedSourceResult,
  ClearAppWorkspaceStyleProfileInput,
  ClearAppWorkspaceStyleProfileResult,
  CommitAppUploadedSourceUploadResult,
  CommitAppStyleProfileReferenceUploadInput,
  CommitAppStyleProfileReferenceUploadResult,
  RecordAppUploadedSourceAnalysisDraftInput,
  RecordAppUploadedSourceAnalysisInput,
  PrepareAppDeckRefinementPageFilesInput,
  PrepareAppDeckRefinementPageFilesResult,
  PrepareAppPageFilesInput,
  PrepareAppPageFilesResult,
  PrepareAppExportModelInput,
  PrepareAppExportModelResult,
  AppPptxExportJob,
  AppResearchPaths,
  RecordAppPagePlanInput,
  RecordAppPageProgressInput,
  RecordAppWorkspaceStyleGuideInput,
  RecordAppWorkspaceStyleGuideResult,
  GetAppWorkspaceStyleGuideStatusInput,
  GetAppWorkspaceStyleGuideStatusResult,
  InitializeAppPageProgressInput,
  RecordAppWorkspaceThemeTokenInput,
  RecordAppWorkspaceThemeTokenResult,
  RecordAppPdfExportInput,
  RecordAppPptxExportInput,
  GetAppResearchEvidenceInput,
  GetAppResearchPlanInput,
  GetAppResearchStatusInput,
  FinalizeAppResearchVisualAssetsInput,
  FinalizeAppResearchVisualAssetsResult,
  PrepareAppResearchWorkspaceInput,
  PrepareAppResearchWorkspaceResult,
  PrepareAppUploadedSourceAnalysisWorkspaceInput,
  PrepareAppUploadedSourceAnalysisWorkspaceResult,
  PrepareAppStyleProfileCreationInput,
  PrepareAppStyleProfileCreationResult,
  PatchAppWorkspaceSettingsResult,
  GetAppResearchCurationDraftInput,
  GetAppResearchCurationDraftFingerprintInput,
  RecordAppResearchEvidenceInput,
  RecordAppResearchEvidenceResult,
  RecordAppResearchEvidencePageInput,
  RecordAppResearchEvidencePageResult,
  RecordAppResearchCurationDraftInput,
  RecordAppResearchEvidencePageMarkdownInput,
  RecordAppResearchEvidencePageMarkdownResult,
  RecordAppResearchPlanInput,
  RecordAppResearchStatusInput,
  RecordAppResearchStatusPageInput,
  RenderAppWorkspacePagePreviewInput,
  RenderAppWorkspacePagePreviewResult,
  RenderAppWorkspaceDeckHtmlInput,
  RenderAppWorkspaceDeckHtmlResult,
  SelectAppWorkspaceTemplateInput,
  SelectAppWorkspaceTemplateResult,
  SelectAppWorkspaceStyleProfileInput,
  SelectAppWorkspaceStyleProfileResult,
  StartAppPptxExportModelInput,
  UpdateAppWorkspacePagesInput,
  ConfirmAppWorkspaceOutlineInput,
  ResetAppWorkspaceOutlineInput,
  SaveAppWorkspaceOutlineDraftInput,
  UpdateAppWorkspaceRequirementsInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
  UploadAppUploadedSourceInput,
  UploadAppUploadedSourceResult,
  ValidateAppWorkspaceThemeTokenInput,
  AppWorkspaceThemeContext,
  AppWorkspaceThemeValidationResult,
  PublishAppStyleProfileInput,
  PublishAppStyleProfileResult,
} from "./types.js";

const WORKSPACE_ROOT = path.join(os.homedir(), "anna-workspace", "ppt");
const WORKSPACE_FORMAT = "authoring-kit-v1";
const LEGACY_TASK_ROOT = path.join(WORKSPACE_ROOT, "tasks");
const WORKSPACE_SETTING_PATH = path.join(WORKSPACE_ROOT, "setting.json");
const WORKSPACE_DIR_PATTERN = /^ppt-\d{8}-\d{6}$/;
const PAGE_ID_PATTERN = /^page-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WORKSPACE_FILE_NAMES = [
  "task.json",
  "setting.json",
  "requirements.json",
  "outline.json",
  "page-progress.json",
] as const;
const WORKSPACE_LOG_FILE_NAMES = {
  "ai-requirements": "ai-requirements.jsonl",
  "ai-requirements-interactions": "ai-requirements-interactions.jsonl",
  "ai-outline": "ai-outline.jsonl",
  "ai-outline-interactions": "ai-outline-interactions.jsonl",
  "ai-style-guide": "ai-style-guide.jsonl",
  "ai-style-guide-interactions": "ai-style-guide-interactions.jsonl",
  "ai-page-plan": "ai-page-plan.jsonl",
  "ai-page-plan-interactions": "ai-page-plan-interactions.jsonl",
  "ai-page-agent": "ai-page-agent.jsonl",
  "ai-page-agent-interactions": "ai-page-agent-interactions.jsonl",
  "ai-page-agent-stream": "ai-page-agent-stream.jsonl",
  "ai-research": "ai-research.jsonl",
  "ai-research-interactions": "ai-research-interactions.jsonl",
  "ai-theme": "ai-theme.jsonl",
  "ai-theme-interactions": "ai-theme-interactions.jsonl",
} as const;
const WORKSPACE_LOG_INLINE_PAYLOAD_MAX_BYTES = 64 * 1024;
const PPTX_EXPORT_STATUS_FILE_NAME = "generate_ppt.json";
const PPTX_EXPORT_STATUSES: AppPptxExportJob["status"][] = [
  "idle",
  "preparing_model",
  "model_ready",
  "generating_pptx",
  "completed",
  "failed",
];
const UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES = 25 * 1024 * 1024;
const UPLOADED_SOURCE_ACTIVE_TOTAL_MAX_BYTES = 100 * 1024 * 1024;
const UPLOADED_SOURCE_ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".txt",
  ".md",
  ".html",
  ".htm",
]);
const UPLOADED_SOURCE_REJECTED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".dmg",
  ".pkg",
  ".app",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".rar",
  ".7z",
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".pdf",
]);
const STYLE_PROFILE_LIBRARY_DIR = path.join(WORKSPACE_ROOT, "style-profiles");
const STYLE_PROFILE_CREATING_DIR = path.join(STYLE_PROFILE_LIBRARY_DIR, "creating");
const STYLE_PROFILE_PROFILES_DIR = path.join(STYLE_PROFILE_LIBRARY_DIR, "profiles");
const STYLE_PROFILE_INDEX_PATH = path.join(STYLE_PROFILE_LIBRARY_DIR, "index.json");
const STYLE_PROFILE_ALLOWED_EXTENSIONS = new Set([".pptx", ".png", ".jpg", ".jpeg", ".webp"]);
const STYLE_PROFILE_SINGLE_FILE_MAX_BYTES = 100 * 1024 * 1024;
const STYLE_PROFILE_DRAFT_MIN_BYTES = 200;
const STYLE_PROFILE_DRAFT_MAX_BYTES = 8 * 1024;
const STYLE_PROFILE_REFERENCE_ANALYSIS_LIMIT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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
    "新建任务",
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
  ].join("-");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256BufferHex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeFileNamePart(value: string, fallback: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizePayloadKey(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "payload";
}

function readInlinePayloadMaxBytes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return WORKSPACE_LOG_INLINE_PAYLOAD_MAX_BYTES;
  }

  return Math.max(1024, Math.floor(value));
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
    throw new Error('"task_dir" must be under the default PPT workspace root');
  }
}

function normalizeWorkspaceDir(workspaceDir: string): string {
  assertAbsolutePath(workspaceDir, "workspace_dir");
  const normalizedWorkspaceDir = path.normalize(workspaceDir);
  assertWorkspaceUnderRoot(normalizedWorkspaceDir);
  const workspaceName = path.basename(normalizedWorkspaceDir);
  if (!isWorkspaceDirName(workspaceName)) {
    throw new Error('"workspace_dir" must point to a ppt-YYYYMMDD-HHmmss directory');
  }
  return normalizedWorkspaceDir;
}

function buildWorkspaceFilePaths(workspaceDir: string) {
  return {
    task: path.join(workspaceDir, "task.json"),
    setting: path.join(workspaceDir, "setting.json"),
    requirements: path.join(workspaceDir, "requirements.json"),
    outline: path.join(workspaceDir, "outline.json"),
    manifest: path.join(workspaceDir, "manifest.json"),
    style_guide: path.join(workspaceDir, "style-guide.md"),
    authoring_kit: path.join(workspaceDir, "authoring-kit"),
    page_plan: path.join(workspaceDir, "page-plan.json"),
    page_progress: path.join(workspaceDir, "page-progress.json"),
    pages: path.join(workspaceDir, "pages.json"),
    template: path.join(workspaceDir, "template.json"),
    research_plan: path.join(workspaceDir, "research", "research-plan.json"),
    research_evidence: path.join(workspaceDir, "research", "evidence-index.json"),
    research_status: path.join(workspaceDir, "research", "research-status.json"),
  };
}

function buildUploadedSourcePaths(workspaceDir: string) {
  const rootDir = path.join(workspaceDir, "uploaded-sources");
  return {
    root_dir: rootDir,
    files_dir: path.join(rootDir, "files"),
    index_path: path.join(rootDir, "index.json"),
  };
}

function buildUploadedSourceAnalysisPaths(workspaceDir: string): AppUploadedSourceAnalysisPaths {
  const rootDir = path.join(workspaceDir, "uploaded-sources", "analysis");
  const draftsDir = path.join(rootDir, "drafts");
  return {
    root_dir: rootDir,
    drafts_dir: draftsDir,
    factual_draft_path: path.join(draftsDir, "uploaded-source-factual.json"),
    visual_draft_path: path.join(draftsDir, "uploaded-source-visual.json"),
    analysis_path: path.join(rootDir, "uploaded-source-analysis.json"),
  };
}

function createDefaultUploadedSourceIndex(workspaceDir: string): AppUploadedSourceIndex {
  return {
    version: 1,
    workspace_dir: workspaceDir,
    active_total_size_bytes: 0,
    materials: [],
    updated_at: new Date().toISOString(),
  };
}

function normalizeUploadedSourceStatus(value: unknown): AppUploadedSourceMaterial["status"] {
  return value === "removed" ? "removed" : "active";
}

function normalizeUploadedSourceMaterial(value: unknown): AppUploadedSourceMaterial | null {
  const record = getPlainRecord(value);
  const uploadedSourceId = normalizeString(record.uploaded_source_id);
  const filePath = normalizeString(record.file_path);
  if (!uploadedSourceId || !filePath) return null;
  return {
    uploaded_source_id: uploadedSourceId,
    status: normalizeUploadedSourceStatus(record.status),
    original_filename: normalizeString(record.original_filename),
    display_name: normalizeString(record.display_name) || normalizeString(record.original_filename) || uploadedSourceId,
    mime_type: normalizeString(record.mime_type),
    extension: normalizeString(record.extension),
    size_bytes: typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes)
      ? Math.max(0, Math.floor(record.size_bytes))
      : 0,
    sha256: normalizeString(record.sha256),
    file_path: filePath,
    duplicate_of: normalizeStringArray(record.duplicate_of),
    created_at: normalizeString(record.created_at) || new Date().toISOString(),
    updated_at: normalizeString(record.updated_at) || new Date().toISOString(),
    removed_at: typeof record.removed_at === "string" ? record.removed_at : null,
  };
}

function normalizeUploadedSourceIndex(value: unknown, workspaceDir: string): AppUploadedSourceIndex {
  const record = getPlainRecord(value);
  const materials = Array.isArray(record.materials)
    ? record.materials
        .map(normalizeUploadedSourceMaterial)
        .filter((item): item is AppUploadedSourceMaterial => item !== null)
    : [];
  const activeTotalSize = materials
    .filter((item) => item.status === "active")
    .reduce((sum, item) => sum + item.size_bytes, 0);
  return {
    version: 1,
    workspace_dir: workspaceDir,
    active_total_size_bytes: activeTotalSize,
    materials,
    updated_at: normalizeString(record.updated_at) || new Date().toISOString(),
  };
}

async function readUploadedSourceIndex(workspaceDir: string): Promise<AppUploadedSourceIndex> {
  const paths = buildUploadedSourcePaths(workspaceDir);
  const existing = await readJsonFileIfExists(paths.index_path);
  return normalizeUploadedSourceIndex(existing, workspaceDir);
}

async function writeUploadedSourceIndex(workspaceDir: string, index: AppUploadedSourceIndex): Promise<AppUploadedSourceIndex> {
  const normalized = normalizeUploadedSourceIndex(index, workspaceDir);
  await writeJsonFile(buildUploadedSourcePaths(workspaceDir).index_path, normalized);
  return normalized;
}

function sanitizeUploadedSourceDisplayName(value: string): string {
  return sanitizeFileNameBase(value || "uploaded-source");
}

function readUploadedSourceExtension(filename: string): string {
  return path.extname(filename).trim().toLowerCase();
}

function assertAllowedUploadedSourceFile(filename: string, sizeBytes: number): string {
  const extension = readUploadedSourceExtension(filename);
  if (!extension) {
    throw new Error("Uploaded source file must have an allowed extension.");
  }
  if (UPLOADED_SOURCE_REJECTED_EXTENSIONS.has(extension) || !UPLOADED_SOURCE_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported uploaded source file type: ${extension}`);
  }
  if (sizeBytes <= 0) {
    throw new Error("Uploaded source file must not be empty.");
  }
  if (sizeBytes > UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES) {
    throw new Error(`Uploaded source file exceeds the single-file limit of ${UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES} bytes.`);
  }
  return extension;
}

function createUploadedSourceId(now: Date, sha256: string, existingIds: Set<string>): string {
  const datePart = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join("");
  const base = `uploaded-source-${datePart}-${sha256.slice(0, 8)}`;
  if (!existingIds.has(base)) return base;
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  throw new Error("Could not create a unique uploaded-source id.");
}

function decodeUploadedSourceBase64(value: string): Buffer {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('"content_base64" must be a non-empty base64 string');
  }
  const base64 = trimmed.includes(",") ? trimmed.slice(trimmed.indexOf(",") + 1) : trimmed;
  return Buffer.from(base64, "base64");
}

function buildResearchPaths(workspaceDir: string): AppResearchPaths {
  const rootDir = path.join(workspaceDir, "research");
  const rawDir = path.join(rootDir, "raw");
  const evidenceDir = path.join(rootDir, "evidence");
  return {
    root_dir: rootDir,
    raw_dir: rawDir,
    raw_web_dir: path.join(rawDir, "web"),
    raw_images_dir: path.join(rawDir, "images"),
    evidence_dir: evidenceDir,
    evidence_pages_dir: path.join(evidenceDir, "pages"),
    evidence_images_dir: path.join(evidenceDir, "images"),
    evidence_drafts_dir: path.join(evidenceDir, "drafts"),
    research_plan_path: path.join(rootDir, "research-plan.json"),
    evidence_index_path: path.join(rootDir, "evidence-index.json"),
    status_path: path.join(rootDir, "research-status.json"),
  };
}

function assertPathUnderWorkspace(workspaceDir: string, targetPath: string, parameterName: string): void {
  const relativePath = path.relative(workspaceDir, targetPath);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`"${parameterName}" must stay inside the workspace directory`);
  }
}

function assertResearchPathUnderWorkspace(workspaceDir: string, targetPath: string, parameterName: string): void {
  const researchRoot = buildResearchPaths(workspaceDir).root_dir;
  const normalizedTarget = path.normalize(targetPath);
  assertPathUnderWorkspace(researchRoot, normalizedTarget, parameterName);
}

function isPathInsideDir(parentDir: string, targetPath: string): boolean {
  const relativePath = path.relative(parentDir, targetPath);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function fileUrlToPathOrNull(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "file:" ? fileURLToPath(url) : null;
  } catch {
    return null;
  }
}

function normalizeVisualAssetSourcePath(workspaceDir: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  const trimmed = value.trim();
  const fileUrlPath = trimmed.startsWith("file://") ? fileUrlToPathOrNull(trimmed) : null;
  if (fileUrlPath) {
    return path.normalize(fileUrlPath);
  }
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  const agentFileToolRoot = path.dirname(path.dirname(workspaceDir));
  const agentFileToolPath = path.normalize(path.join(agentFileToolRoot, trimmed));
  if (isPathInsideDir(workspaceDir, agentFileToolPath)) {
    return agentFileToolPath;
  }

  return path.normalize(path.join(workspaceDir, trimmed));
}

interface RawImageMetadataEntry {
  file_path: string;
  metadata: Record<string, unknown>;
}

function readOptionalVisualAssetString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function buildRawImageMetadataByPath(
  workspaceDir: string,
  rawImageIndexPaths: string[] | undefined,
): Promise<Map<string, Record<string, unknown>>> {
  const metadata = new Map<string, Record<string, unknown>>();
  for (const indexPathValue of rawImageIndexPaths ?? []) {
    const indexPath = normalizeVisualAssetSourcePath(workspaceDir, indexPathValue);
    if (!indexPath || !isPathInsideDir(workspaceDir, indexPath)) continue;
    let index: unknown;
    try {
      index = await readJsonFileIfExists(indexPath);
    } catch {
      continue;
    }
    const record = getPlainRecord(index);
    const results = Array.isArray(record.results) ? record.results.map(getPlainRecord) : [];
    for (const item of results) {
      const candidatePaths = getRawImageMetadataCandidatePaths(workspaceDir, item);
      for (const candidatePath of candidatePaths) {
        metadata.set(candidatePath, item);
      }
    }
  }
  return metadata;
}

async function buildRawImageMetadataEntries(
  workspaceDir: string,
  rawImageIndexPaths: string[] | undefined,
): Promise<RawImageMetadataEntry[]> {
  const entries: RawImageMetadataEntry[] = [];
  const seen = new Set<string>();
  for (const indexPathValue of rawImageIndexPaths ?? []) {
    const indexPath = normalizeVisualAssetSourcePath(workspaceDir, indexPathValue);
    if (!indexPath || !isPathInsideDir(workspaceDir, indexPath)) continue;
    let index: unknown;
    try {
      index = await readJsonFileIfExists(indexPath);
    } catch {
      continue;
    }
    const record = getPlainRecord(index);
    const results = Array.isArray(record.results) ? record.results.map(getPlainRecord) : [];
    for (const item of results) {
      const filePath = normalizeVisualAssetSourcePath(workspaceDir, item.file_path);
      if (!filePath || seen.has(filePath)) continue;
      seen.add(filePath);
      entries.push({ file_path: filePath, metadata: item });
    }
  }
  return entries;
}

function getRawImageMetadataCandidatePaths(
  workspaceDir: string,
  item: Record<string, unknown>,
): string[] {
  return [
    item.file_path,
    item.path,
    item.local_path,
    item.output_path,
  ].map((value) => normalizeVisualAssetSourcePath(workspaceDir, value)).filter(Boolean);
}

function normalizePathForSuffixMatch(value: string): string {
  return path.normalize(value.trim().replace(/\\/g, "/")).replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function findUniqueRawImageMetadataEntryBySuffix(
  entries: RawImageMetadataEntry[],
  rawPath: string,
): RawImageMetadataEntry | "ambiguous" | null {
  const normalizedRawPath = normalizePathForSuffixMatch(rawPath);
  if (!normalizedRawPath) return null;
  const matches = entries.filter((entry) => {
    const normalizedFilePath = normalizePathForSuffixMatch(entry.file_path);
    return normalizedFilePath === normalizedRawPath ||
      normalizedFilePath.endsWith(`/${normalizedRawPath}`) ||
      normalizedRawPath.endsWith(`/${normalizedFilePath}`);
  });
  if (matches.length === 1) return matches[0] ?? null;
  return matches.length > 1 ? "ambiguous" : null;
}

function findRawImageMetadataEntryForAsset(input: {
  entries: RawImageMetadataEntry[];
  asset: Record<string, unknown>;
  draftPaths: string[];
}): RawImageMetadataEntry | "ambiguous" | null {
  const draftSha256 = normalizeString(input.asset.sha256).trim().toLowerCase();
  if (draftSha256) {
    const matches = input.entries.filter((entry) =>
      normalizeString(entry.metadata.sha256).trim().toLowerCase() === draftSha256
    );
    if (matches.length === 1) return matches[0] ?? null;
    if (matches.length > 1) return "ambiguous";
  }

  const imageUrl = readOptionalVisualAssetString(input.asset, "image_url");
  if (imageUrl) {
    const matches = input.entries.filter((entry) =>
      readOptionalVisualAssetString(entry.metadata, "image_url") === imageUrl ||
      readOptionalVisualAssetString(entry.metadata, "url") === imageUrl
    );
    if (matches.length === 1) return matches[0] ?? null;
    if (matches.length > 1) return "ambiguous";
  }

  for (const draftPath of input.draftPaths) {
    const match = findUniqueRawImageMetadataEntryBySuffix(input.entries, draftPath);
    if (match) return match;
  }

  return null;
}

function buildPptxExportPaths(workspaceDir: string) {
  const outputDir = path.join(workspaceDir, "output");
  return {
    outputDir,
    statusPath: path.join(outputDir, PPTX_EXPORT_STATUS_FILE_NAME),
    modelPath: path.join(outputDir, "ppt-model.json"),
    pptxPath: path.join(outputDir, "deck.pptx"),
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

const pageProgressWriteQueues = new Map<string, Promise<unknown>>();
const uploadedSourceWriteQueues = new Map<string, Promise<unknown>>();
const styleProfileWriteQueues = new Map<string, Promise<unknown>>();
const themeTokenWriteQueues = new Map<string, Promise<unknown>>();
const exportArtifactWriteQueues = new Map<string, Promise<unknown>>();

async function withExportArtifactWriteQueue<T>(
  workspaceDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.normalize(workspaceDir);
  const previous = exportArtifactWriteQueues.get(queueKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  exportArtifactWriteQueues.set(queueKey, current);
  try {
    return await current;
  } finally {
    if (exportArtifactWriteQueues.get(queueKey) === current) {
      exportArtifactWriteQueues.delete(queueKey);
    }
  }
}

async function withPageProgressWriteQueue<T>(
  workspaceDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.normalize(workspaceDir);
  const previous = pageProgressWriteQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.catch(() => undefined);
  pageProgressWriteQueues.set(queueKey, tail);

  try {
    return await run;
  } finally {
    if (pageProgressWriteQueues.get(queueKey) === tail) {
      pageProgressWriteQueues.delete(queueKey);
    }
  }
}

async function withUploadedSourceWriteQueue<T>(
  workspaceDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.normalize(workspaceDir);
  const previous = uploadedSourceWriteQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.catch(() => undefined);
  uploadedSourceWriteQueues.set(queueKey, tail);

  try {
    return await run;
  } finally {
    if (uploadedSourceWriteQueues.get(queueKey) === tail) {
      uploadedSourceWriteQueues.delete(queueKey);
    }
  }
}

async function withStyleProfileWriteQueue<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.normalize(key);
  const previous = styleProfileWriteQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.catch(() => undefined);
  styleProfileWriteQueues.set(queueKey, tail);

  try {
    return await run;
  } finally {
    if (styleProfileWriteQueues.get(queueKey) === tail) {
      styleProfileWriteQueues.delete(queueKey);
    }
  }
}

function createPptxExportJob(
  workspaceDir: string,
  patch: Partial<AppPptxExportJob> = {},
): AppPptxExportJob {
  const paths = buildPptxExportPaths(workspaceDir);
  const now = new Date().toISOString();

  return {
    version: 1,
    job_id: `${path.basename(workspaceDir)}-${Date.now()}`,
    status: "preparing_model",
    message: "Preparing PPTX export model.",
    percent: 5,
    workspace_dir: workspaceDir,
    status_path: paths.statusPath,
    output_dir: paths.outputDir,
    html_path: "",
    model_path: paths.modelPath,
    pptx_path: paths.pptxPath,
    started_at: now,
    updated_at: now,
    completed_at: null,
    error: null,
    ...patch,
  };
}

function normalizePptxExportJob(
  value: unknown,
  workspaceDir: string,
): AppPptxExportJob {
  const existing =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<AppPptxExportJob>)
      : {};
  const paths = buildPptxExportPaths(workspaceDir);
  const status = PPTX_EXPORT_STATUSES.includes(existing.status as AppPptxExportJob["status"])
    ? existing.status as AppPptxExportJob["status"]
    : "idle";

  return createPptxExportJob(workspaceDir, {
    ...existing,
    version: 1,
    job_id: typeof existing.job_id === "string" && existing.job_id.length > 0
      ? existing.job_id
      : `${path.basename(workspaceDir)}-${Date.now()}`,
    status,
    message: typeof existing.message === "string" ? existing.message : "",
    percent: typeof existing.percent === "number" ? existing.percent : 0,
    workspace_dir: workspaceDir,
    status_path: paths.statusPath,
    output_dir: paths.outputDir,
    html_path: typeof existing.html_path === "string" ? existing.html_path : "",
    model_path: typeof existing.model_path === "string" ? existing.model_path : paths.modelPath,
    pptx_path: typeof existing.pptx_path === "string" ? existing.pptx_path : paths.pptxPath,
    started_at: typeof existing.started_at === "string" ? existing.started_at : null,
    updated_at: typeof existing.updated_at === "string" ? existing.updated_at : null,
    completed_at: typeof existing.completed_at === "string" ? existing.completed_at : null,
    error:
      existing.error && typeof existing.error === "object" && !Array.isArray(existing.error)
        ? existing.error as AppPptxExportJob["error"]
        : null,
    generator_result: existing.generator_result,
  });
}

async function writePptxExportJob(job: AppPptxExportJob): Promise<AppPptxExportJob> {
  await writeJsonFile(job.status_path, {
    ...job,
    updated_at: new Date().toISOString(),
  });
  return getAppPptxExportStatus({ workspace_dir: job.workspace_dir });
}

function createDefaultTaskJson(workspaceDir: string, title?: string) {
  const workspaceId = path.basename(workspaceDir);
  const now = new Date().toISOString();
  return {
    id: workspaceId,
    task_id: workspaceId,
    title: title || workspaceId,
    status: "initialized",
    task_dir: workspaceDir,
    workspace_dir: workspaceDir,
    workspace_format: WORKSPACE_FORMAT,
    created_at: now,
    updated_at: now,
    artifacts: {
      task: "task.json",
      setting: "setting.json",
      requirements: "requirements.json",
      outline: "outline.json",
      page_progress: "page-progress.json",
      manifest: "manifest.json",
      style_guide: "style-guide.md",
      authoring_kit: "authoring-kit/",
    },
  };
}

function createDefaultSettingJson() {
  return {
    page_generation_concurrency: 5,
    visual_review_enabled: false,
    visual_review_failure_limit: 2,
    disable_web_research: false,
    disable_image_research: false,
  };
}

function normalizeReviewFailureLimit(value: unknown, fallback = 5): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(1, Math.min(5, Math.floor(numericValue)));
}

function normalizePageGenerationConcurrency(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return 5;
  }

  return Math.max(1, Math.min(10, Math.floor(numericValue)));
}

function normalizeSettingJson(setting: unknown): Record<string, unknown> {
  const existing =
    setting && typeof setting === "object" && !Array.isArray(setting)
      ? (setting as Record<string, unknown>)
      : {};
  return {
    page_generation_concurrency: normalizePageGenerationConcurrency(
      existing.page_generation_concurrency,
    ),
    visual_review_enabled: existing.visual_review_enabled === true,
    visual_review_failure_limit: normalizeReviewFailureLimit(
      existing.visual_review_failure_limit,
      2,
    ),
    disable_web_research: existing.disable_web_research === true,
    disable_image_research: existing.disable_image_research === true,
    ...(typeof existing.updated_at === "string" ? { updated_at: existing.updated_at } : {}),
  };
}

async function ensureWorkspaceSetting(): Promise<Record<string, unknown>> {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  const currentSetting = await readJsonFileIfExists(WORKSPACE_SETTING_PATH);
  const currentRecord =
    currentSetting && typeof currentSetting === "object" && !Array.isArray(currentSetting)
      ? (currentSetting as Record<string, unknown>)
      : {};
  const normalizedSetting = normalizeSettingJson({
    ...createDefaultSettingJson(),
    ...currentRecord,
  });
  if (JSON.stringify(currentSetting) !== JSON.stringify(normalizedSetting)) {
    await writeJsonFile(WORKSPACE_SETTING_PATH, normalizedSetting);
  }

  return normalizedSetting;
}

async function readGlobalWorkspaceDefaults(): Promise<Record<string, unknown>> {
  return ensureWorkspaceSetting();
}

export async function getAppWorkspaceDefaults(): Promise<GetAppWorkspaceDefaultsResult> {
  return {
    workspace_root: WORKSPACE_ROOT,
    setting: await readGlobalWorkspaceDefaults(),
  };
}

async function updateGlobalWorkspaceDefaults(
  setting: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existing = await ensureWorkspaceSetting();
  const nextSetting = {
    ...normalizeSettingJson({
      ...existing,
      ...setting,
    }),
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(WORKSPACE_SETTING_PATH, nextSetting);
  return nextSetting;
}

function createDefaultOutlineJson() {
  return normalizeOutlineJson(null);
}

const PRESENTATION_REQUIREMENTS_FIELDS = [
  "audience",
  "purpose",
  "desired_outcome",
  "slide_count",
  "output_language",
  "visual_tone",
] as const;

function createDefaultPresentationRequirements(): AppPresentationRequirements {
  return {
    version: 1,
    status: "empty",
    source: null,
    candidates: {
      audience: [],
      purpose: [],
      desired_outcome: [],
      slide_count: [],
      output_language: [],
      visual_tone: [],
    },
    selections: {
      audience: null,
      purpose: null,
      desired_outcome: null,
      slide_count: null,
      output_language: null,
      visual_tone: null,
    },
    updated_at: null,
    confirmed_at: null,
  };
}

function assertExactKeys(record: Record<string, unknown>, expected: readonly string[], label: string) {
  const keys = Object.keys(record).sort();
  const expectedKeys = [...expected].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(", ")}`);
  }
}

function parseRequirementCandidate(value: unknown, label: string): AppPresentationRequirementCandidate {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertExactKeys(value, ["label", "description"], label);
  const candidateLabel = normalizeString(value.label).trim();
  const description = normalizeString(value.description).trim();
  if (!candidateLabel || !description) {
    throw new Error(`${label} must include non-empty label and description`);
  }
  return { label: candidateLabel, description };
}

function assertUniqueValues(values: unknown[], label: string) {
  const serialized = values.map((value) => JSON.stringify(value));
  if (new Set(serialized).size !== serialized.length) {
    throw new Error(`${label} candidates must be unique`);
  }
}

function parseSemanticCandidateArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 4) {
    throw new Error(`${label} must be an array with at most 4 candidates`);
  }
  const candidates = value.map((candidate, index) =>
    parseRequirementCandidate(candidate, `${label}[${index}]`)
  );
  assertUniqueValues(candidates, label);
  return candidates;
}

function parseRequirementsCandidates(value: unknown): AppPresentationRequirementsCandidates {
  if (!isRecord(value)) throw new Error("requirements.candidates must be an object");
  assertExactKeys(value, PRESENTATION_REQUIREMENTS_FIELDS, "requirements.candidates");
  if (!Array.isArray(value.slide_count) || value.slide_count.length > 4) {
    throw new Error("requirements.candidates.slide_count must be an array with at most 4 values");
  }
  const slideCount = value.slide_count.map((candidate, index) => {
    if (!Number.isInteger(candidate) || Number(candidate) <= 0) {
      throw new Error(`requirements.candidates.slide_count[${index}] must be a positive integer`);
    }
    return Number(candidate);
  });
  assertUniqueValues(slideCount, "requirements.candidates.slide_count");
  if (!Array.isArray(value.output_language) || value.output_language.length > 4) {
    throw new Error("requirements.candidates.output_language must be an array with at most 4 values");
  }
  const outputLanguage = value.output_language.map((candidate, index) => {
    const language = normalizeString(candidate).trim();
    if (!language || language.toLowerCase() === "auto") {
      throw new Error(`requirements.candidates.output_language[${index}] must be a concrete language`);
    }
    return language;
  });
  assertUniqueValues(outputLanguage, "requirements.candidates.output_language");
  return {
    audience: parseSemanticCandidateArray(value.audience, "requirements.candidates.audience"),
    purpose: parseSemanticCandidateArray(value.purpose, "requirements.candidates.purpose"),
    desired_outcome: parseSemanticCandidateArray(value.desired_outcome, "requirements.candidates.desired_outcome"),
    slide_count: slideCount,
    output_language: outputLanguage,
    visual_tone: parseSemanticCandidateArray(value.visual_tone, "requirements.candidates.visual_tone"),
  };
}

function parseNullableRequirementCandidate(value: unknown, label: string) {
  return value === null ? null : parseRequirementCandidate(value, label);
}

function parseRequirementsSelections(value: unknown): AppPresentationRequirementsSelections {
  if (!isRecord(value)) throw new Error("requirements.selections must be an object");
  assertExactKeys(value, PRESENTATION_REQUIREMENTS_FIELDS, "requirements.selections");
  const slideCount = value.slide_count;
  if (slideCount !== null && (!Number.isInteger(slideCount) || Number(slideCount) <= 0)) {
    throw new Error("requirements.selections.slide_count must be null or a positive integer");
  }
  const outputLanguage = value.output_language;
  if (outputLanguage !== null && (
    typeof outputLanguage !== "string" ||
    !outputLanguage.trim() ||
    outputLanguage.trim().toLowerCase() === "auto"
  )) {
    throw new Error("requirements.selections.output_language must be null or a concrete language");
  }
  return {
    audience: parseNullableRequirementCandidate(value.audience, "requirements.selections.audience"),
    purpose: parseNullableRequirementCandidate(value.purpose, "requirements.selections.purpose"),
    desired_outcome: parseNullableRequirementCandidate(value.desired_outcome, "requirements.selections.desired_outcome"),
    slide_count: slideCount === null ? null : Number(slideCount),
    output_language: outputLanguage === null ? null : outputLanguage.trim(),
    visual_tone: parseNullableRequirementCandidate(value.visual_tone, "requirements.selections.visual_tone"),
  };
}

function normalizePresentationRequirements(value: unknown): AppPresentationRequirements {
  if (!isRecord(value)) throw new Error("requirements.json must contain an object");
  assertExactKeys(
    value,
    ["version", "status", "source", "candidates", "selections", "updated_at", "confirmed_at"],
    "requirements.json",
  );
  if (value.version !== 1) throw new Error("requirements.version must be 1");
  if (value.status !== "empty" && value.status !== "draft" && value.status !== "confirmed") {
    throw new Error('requirements.status must be "empty", "draft", or "confirmed"');
  }
  const source = value.source === null
    ? null
    : (() => {
        if (!isRecord(value.source)) throw new Error("requirements.source must be null or an object");
        assertExactKeys(value.source, ["brief"], "requirements.source");
        const brief = normalizeString(value.source.brief).trim();
        if (!brief) throw new Error("requirements.source.brief must be a non-empty string");
        return { brief };
      })();
  const candidates = parseRequirementsCandidates(value.candidates);
  const selections = parseRequirementsSelections(value.selections);
  const updatedAt = value.updated_at === null ? null : normalizeString(value.updated_at);
  const confirmedAt = value.confirmed_at === null ? null : normalizeString(value.confirmed_at);

  if (value.status === "empty") {
    if (source !== null || PRESENTATION_REQUIREMENTS_FIELDS.some((field) => candidates[field].length > 0) ||
      PRESENTATION_REQUIREMENTS_FIELDS.some((field) => selections[field] !== null)) {
      throw new Error("empty requirements cannot include a source, candidates, or selections");
    }
  } else if (!source) {
    throw new Error(`${value.status} requirements must include source.brief`);
  }

  if (value.status === "confirmed") {
    const missing = PRESENTATION_REQUIREMENTS_FIELDS.filter((field) => selections[field] === null);
    if (missing.length > 0) {
      throw new Error(`confirmed requirements are missing selections: ${missing.join(", ")}`);
    }
  }

  return {
    version: 1,
    status: value.status,
    source,
    candidates,
    selections,
    updated_at: updatedAt || null,
    confirmed_at: confirmedAt || null,
  };
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeFileNameBase(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return normalized || "deck";
}

const OUTLINE_BULLET_PATTERN = /^(\s*)(?:[-*+•]|\d+[.)])\s+(.+)$/;
const OUTLINE_EMPTY_BULLET_PATTERN = /^(\s*)(?:[-*+•]|\d+[.)])\s*$/;

function normalizeRequiredContentMarkdown(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a Markdown string`);
  }
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ""))
    .filter((line) => line.trim().length > 0);
  const normalized = lines.map((line, index) => {
    const match = OUTLINE_BULLET_PATTERN.exec(line);
    if (OUTLINE_EMPTY_BULLET_PATTERN.test(line)) {
      throw new Error(`${fieldName} line ${index + 1} must not be empty`);
    }
    const indentation = match?.[1] ?? line.match(/^(\s*)/)?.[1] ?? "";
    const content = (match?.[2] ?? line).trim();
    if (!content) {
      throw new Error(`${fieldName} line ${index + 1} must not be empty`);
    }
    return `${indentation}- ${content}`;
  });
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must contain at least one Markdown list item`);
  }
  return normalized.join("\n");
}

function normalizeOutlineLine(value: unknown, fieldName: string): string {
  const normalized = normalizeString(value).trim();
  if (!normalized) throw new Error(`${fieldName} must be a non-empty string`);
  if (/\r|\n/u.test(normalized)) throw new Error(`${fieldName} must be a single line`);
  return normalized;
}

function normalizeValidOutlineItem(
  value: unknown,
  index: number,
  options: { require_page_id?: boolean } = {},
): AppWorkspaceOutlineItem {
  if (!isRecord(value)) throw new Error(`outline.items[${index}] must be an object`);
  assertExactKeys(
    value,
    options.require_page_id
      ? ["page_id", "title", "core_message", "required_content"]
      : ["title", "core_message", "required_content"],
    `outline.items[${index}]`,
  );
  const pageId = options.require_page_id ? normalizeString(value.page_id) : "";
  if (options.require_page_id && !PAGE_ID_PATTERN.test(pageId)) {
    throw new Error(`outline.items[${index}].page_id must be an opaque page UUID`);
  }
  return {
    ...(pageId ? { page_id: pageId } : {}),
    title: normalizeOutlineLine(value.title, `outline.items[${index}].title`),
    core_message: normalizeOutlineLine(value.core_message, `outline.items[${index}].core_message`),
    required_content: normalizeRequiredContentMarkdown(
      value.required_content,
      `outline.items[${index}].required_content`,
    ),
  };
}

function outlineItemFromLegacyText(titleValue: unknown, textValue: unknown): AppWorkspaceOutlineItem {
  const title = normalizeString(titleValue).trim() || "Untitled Page";
  const lines = normalizeString(textValue).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const coreMessage = lines[0] ?? title;
  const requiredLines = lines.length > 1 ? lines.slice(1) : [coreMessage];
  return {
    title: title.replace(/\r|\n/gu, " "),
    core_message: coreMessage.replace(/\r|\n/gu, " "),
    required_content: requiredLines
      .map((line) => `- ${line.replace(/^(?:[-*+•]|\d+[.)])\s+/u, "")}`)
      .join("\n"),
  };
}

function createEmptyOutlineJson(): AppWorkspaceOutline {
  return {
    version: 3,
    status: "empty",
    title: "",
    items: [],
    updated_at: null,
    confirmed_at: null,
  };
}

function normalizeOutlineJson(outline: unknown): AppWorkspaceOutline {
  if (!isRecord(outline) || outline.version !== 3) return createEmptyOutlineJson();
  assertExactKeys(
    outline,
    ["version", "status", "title", "items", "updated_at", "confirmed_at"],
    "outline.json",
  );
  if (outline.status !== "empty" && outline.status !== "draft" && outline.status !== "confirmed") {
    throw new Error('outline.status must be "empty", "draft", or "confirmed"');
  }
  if (outline.status === "empty") {
    if (outline.title !== "" || !Array.isArray(outline.items) || outline.items.length !== 0 ||
      outline.updated_at !== null || outline.confirmed_at !== null) {
      throw new Error("empty outline cannot include content or timestamps");
    }
    return createEmptyOutlineJson();
  }
  const title = normalizeOutlineLine(outline.title, "outline.title");
  if (!Array.isArray(outline.items) || outline.items.length === 0) {
    throw new Error("outline.items must contain at least one page");
  }
  const confirmedItemsHavePageIds = outline.status === "confirmed" && outline.items.every(
    (item) => isRecord(item) && typeof item.page_id === "string" && item.page_id.length > 0,
  );
  const items = outline.items.map((item, index) => normalizeValidOutlineItem(
    item,
    index,
    { require_page_id: confirmedItemsHavePageIds },
  ));
  if (confirmedItemsHavePageIds && new Set(items.map((item) => item.page_id)).size !== items.length) {
    throw new Error("confirmed outline page_id values must be unique");
  }
  const updatedAt = normalizeString(outline.updated_at).trim();
  if (!updatedAt) throw new Error("persisted outline.updated_at must be a non-empty string");
  const confirmedAt = outline.confirmed_at === null ? null : normalizeString(outline.confirmed_at).trim();
  if (outline.status === "confirmed" && !confirmedAt) {
    throw new Error("confirmed outline.confirmed_at must be a non-empty string");
  }
  if (outline.status === "draft" && confirmedAt !== null) {
    throw new Error("draft outline.confirmed_at must be null");
  }
  return {
    version: 3,
    status: outline.status,
    title,
    items,
    updated_at: updatedAt,
    confirmed_at: confirmedAt,
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

function normalizePageContentPlan(value: unknown) {
  const record = getPlainRecord(value);
  if (Object.keys(record).length === 0) return undefined;
  return {
    main_message: normalizeString(record.main_message),
    content_points: normalizeStringArray(record.content_points),
    evidence_fact_ids: normalizeStringArray(record.evidence_fact_ids),
    derived_insight_ids: normalizeStringArray(record.derived_insight_ids),
    visual_asset_ids: normalizeStringArray(record.visual_asset_ids),
    uploaded_source_fact_ids: normalizeStringArray(record.uploaded_source_fact_ids),
    uploaded_source_visual_asset_ids: normalizeStringArray(record.uploaded_source_visual_asset_ids),
    gaps: normalizeStringArray(record.gaps),
    authoring_notes: normalizeStringArray(record.authoring_notes),
  };
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
    ...(normalizePageContentPlan(record.content_plan)
      ? { content_plan: normalizePageContentPlan(record.content_plan) }
      : {}),
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
    status: PAGE_PROGRESS_PAGE_STATUSES.has(normalizeString(record.status))
      ? normalizeString(record.status)
      : "pending",
    render_attempts: typeof record.render_attempts === "number" ? record.render_attempts : 0,
    visual_review_attempts:
      typeof record.visual_review_attempts === "number" ? record.visual_review_attempts : 0,
    agent_failures: typeof record.agent_failures === "number" ? record.agent_failures : 0,
    agent_infrastructure_failures:
      typeof record.agent_infrastructure_failures === "number"
        ? record.agent_infrastructure_failures
        : 0,
    last_html_path: normalizeString(record.last_html_path),
    last_screenshot_path: normalizeString(record.last_screenshot_path),
    last_error: normalizeString(record.last_error),
    visual_review: record.visual_review ?? null,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

const PAGE_PROGRESS_PAGE_STATUSES = new Set([
  "pending",
  "authoring",
  "rendering",
  "render_fixing",
  "visual_review",
  "visual_review_fixing",
  "accepted",
  "interrupted",
  "agent_failed",
  "agent_infrastructure_failed",
  "render_failed",
]);

const PAGE_PROGRESS_RECOVERY_RUN_KINDS = new Set([
  "deck-generation",
  "page-generation-retry",
  "page-refinement",
  "deck-refinement",
  "final-deck-render",
]);

const PAGE_PROGRESS_RECOVERY_STATUSES = new Set([
  "idle",
  "running",
  "interrupted",
  "failed",
  "completed",
]);

const FINAL_DECK_RENDER_STATUSES = new Set([
  "idle",
  "running",
  "completed",
  "failed",
  "interrupted",
]);

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0);
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  const record = getPlainRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, rawValue]) => [key, normalizeString(rawValue)] as const)
      .filter(([, rawValue]) => rawValue.length > 0),
  );
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizePageProgressRecoveryState(value: unknown): AppPageProgress["recovery"] {
  const record = getPlainRecord(value);
  const runKind = normalizeString(record.run_kind);
  const status = normalizeString(record.status);
  return {
    status: PAGE_PROGRESS_RECOVERY_STATUSES.has(status)
      ? status as AppPageProgress["recovery"]["status"]
      : "idle",
    run_kind: PAGE_PROGRESS_RECOVERY_RUN_KINDS.has(runKind)
      ? runKind as AppPageProgress["recovery"]["run_kind"]
      : null,
    step: normalizeNullableString(record.step),
    target_page_ids: normalizeStringList(record.target_page_ids),
    page_refinement_request: normalizeNullableString(record.page_refinement_request),
    page_refinement_requests: normalizeStringRecord(record.page_refinement_requests),
    deck_refinement_review: record.deck_refinement_review ?? null,
    error: normalizeNullableString(record.error),
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

function normalizeFinalDeckRenderState(value: unknown): AppPageProgress["final_deck_render"] {
  const record = getPlainRecord(value);
  const status = normalizeString(record.status);
  return {
    status: FINAL_DECK_RENDER_STATUSES.has(status)
      ? status as AppPageProgress["final_deck_render"]["status"]
      : "idle",
    message: normalizeNullableString(record.message),
    error: normalizeNullableString(record.error),
    output_dir: normalizeNullableString(record.output_dir),
    deck_html_path: normalizeNullableString(record.deck_html_path),
    rendered_at: typeof record.rendered_at === "string" ? record.rendered_at : null,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

const RESEARCH_DISCOVERY_PHASES = new Set([
  "web-decision",
  "web-collection",
  "web-curation",
  "visual-decision",
  "visual-collection",
  "visual-curation",
  "evidence-page-planning",
]);

const RESEARCH_DISCOVERY_STATES = new Set([
  "pending",
  "active",
  "completed",
  "warning",
  "failed",
]);

function normalizeResearchDiscoveryProgress(value: unknown): AppPageProgress["research_discovery"] {
  const record = getPlainRecord(value);
  const status = normalizeString(record.status);
  if (!RESEARCH_DISCOVERY_STATES.has(status) || !Array.isArray(record.records)) {
    return undefined;
  }
  return {
    ...record,
    status,
    summary: getPlainRecord(record.summary),
    records: record.records
      .map((item) => getPlainRecord(item))
      .filter((item) =>
        RESEARCH_DISCOVERY_PHASES.has(normalizeString(item.phase)) &&
        RESEARCH_DISCOVERY_STATES.has(normalizeString(item.state))
      ),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function normalizePageProgressJson(value: unknown): AppPageProgress {
  const record = getPlainRecord(value);
  const pages = Array.isArray(record.pages)
    ? record.pages
        .map(normalizePageProgressItem)
        .filter((item): item is AppPageProgressItem => item !== null)
    : [];

  return {
    version: 1,
    status: normalizeString(record.status) || "idle",
    recovery: normalizePageProgressRecoveryState(record.recovery),
    final_deck_render: normalizeFinalDeckRenderState(record.final_deck_render),
    research_discovery: normalizeResearchDiscoveryProgress(record.research_discovery),
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
    recovery: {
      status: "idle",
      run_kind: null,
      step: null,
      target_page_ids: [],
      page_refinement_request: null,
      page_refinement_requests: {},
      deck_refinement_review: null,
      error: null,
      updated_at: null,
    },
    final_deck_render: {
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      rendered_at: null,
      updated_at: null,
    },
    research_discovery: undefined,
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
  if (getPlainRecord(workspace.task).workspace_format === WORKSPACE_FORMAT) {
    return workspace.files.manifest;
  }
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const manifestPath = typeof template.manifest_path === "string" ? template.manifest_path.trim() : "";

  if (!manifestPath) {
    throw new Error(
      "No task template is selected. Select a template before rendering deck HTML.",
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
    throw new Error('"template.manifest_path" must be inside the task directory');
  }

  return normalizedManifestPath;
}

async function readManifestLocalSlideSourcePath(input: {
  manifestPath: string;
  pageIndex: number;
}): Promise<{ absolutePath: string; slideId: string } | null> {
  const manifestDir = path.dirname(input.manifestPath);
  const rawValue = JSON.parse(await readFile(input.manifestPath, "utf8")) as unknown;
  if (!isRecord(rawValue)) {
    throw new Error("Selected template manifest root must be a JSON object");
  }

  const manifest = rawValue as unknown as LegacyDeckManifestInput;
  const slide = manifest.slides?.[input.pageIndex] as LegacyDeckManifestSlideInput | undefined;
  if (!slide) {
    throw new Error(`Manifest does not contain page index ${input.pageIndex}`);
  }

  if (slide.source?.type !== "local") {
    return null;
  }

  const absolutePath = await resolveLocalModulePath(
    slide.source.path,
    manifestDir,
    `Slide "${slide.id}"`,
  );
  return {
    absolutePath,
    slideId: slide.id,
  };
}

function readSelectedTemplateDir(workspace: AppWorkspaceResult): string {
  const template =
    workspace.template && typeof workspace.template === "object" && !Array.isArray(workspace.template)
      ? (workspace.template as Record<string, unknown>)
      : {};
  const templateDir = typeof template.template_dir === "string" ? template.template_dir.trim() : "";

  if (!templateDir) {
    throw new Error(
      "No task template is selected. Select a template before using template planning.",
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
    throw new Error('"template.template_dir" must be inside the task directory');
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
  options: CreateAppWorkspaceInput & { require_format?: boolean } = {},
): Promise<AppWorkspaceResult> {
  const normalizedWorkspaceDir = normalizeWorkspaceDir(workspaceDir);
  const workspaceName = path.basename(normalizedWorkspaceDir);

  await mkdir(normalizedWorkspaceDir, { recursive: true });
  const workspaceSettingDefaults = await readGlobalWorkspaceDefaults();
  const files = buildWorkspaceFilePaths(normalizedWorkspaceDir);
  const createdFiles: string[] = [];

  const existingTask = await readJsonFileIfExists(files.task);
  if (existingTask !== null && options.require_format === true) {
    const existingTaskRecord = getPlainRecord(existingTask);
    if (existingTaskRecord.workspace_format !== WORKSPACE_FORMAT) {
      throw new Error(
        `Unsupported Workspace format. Expected "${WORKSPACE_FORMAT}"; legacy Workspace migration is not available.`,
      );
    }
  }

  const defaults = {
    task: createDefaultTaskJson(normalizedWorkspaceDir, options.title),
    setting: normalizeSettingJson({
      ...createDefaultSettingJson(),
      ...workspaceSettingDefaults,
    }),
    requirements: createDefaultPresentationRequirements(),
    outline: createDefaultOutlineJson(),
    page_progress: createDefaultPageProgressJson(),
  };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const filePath = files[key as keyof typeof defaults];
    if (!(await fileExists(filePath))) {
      await writeJsonFile(filePath, defaultValue);
      createdFiles.push(path.basename(filePath));
    }
  }

  const currentTaskSetting = await readJsonFileIfExists(files.setting);
  const currentTaskSettingRecord =
    currentTaskSetting && typeof currentTaskSetting === "object" && !Array.isArray(currentTaskSetting)
      ? (currentTaskSetting as Record<string, unknown>)
      : {};
  const normalizedTaskSetting = normalizeSettingJson(currentTaskSettingRecord);
  if (JSON.stringify(currentTaskSetting) !== JSON.stringify(normalizedTaskSetting)) {
    await writeJsonFile(files.setting, normalizedTaskSetting);
  }

  const normalizedRequirements = normalizePresentationRequirements(
    await readJsonFileIfExists(files.requirements),
  );

  const currentOutline = await readJsonFileIfExists(files.outline);
  const normalizedOutline = normalizeOutlineJson(currentOutline);
  if (
    getPlainRecord(existingTask).workspace_format === WORKSPACE_FORMAT &&
    normalizedOutline.status === "confirmed" &&
    normalizedOutline.items.some((item) => !item.page_id)
  ) {
    throw new Error("authoring-kit-v1 Confirmed Outline entries must all own page_id");
  }
  if (JSON.stringify(currentOutline) !== JSON.stringify(normalizedOutline)) {
    await writeJsonFile(files.outline, normalizedOutline);
  }

  const currentPageProgress = await readJsonFileIfExists(files.page_progress);
  const normalizedPageProgress = normalizePageProgressJson(currentPageProgress);
  if (JSON.stringify(currentPageProgress) !== JSON.stringify(normalizedPageProgress)) {
    await writeJsonFile(files.page_progress, normalizedPageProgress);
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
    task_root: WORKSPACE_ROOT,
    workspace_dir: normalizedWorkspaceDir,
    task_dir: normalizedWorkspaceDir,
    workspace_id: workspaceName,
    task_id: workspaceName,
    initialized: missingFiles.length === 0,
    created_files: createdFiles,
    missing_files: missingFiles,
    files,
    task: await readJsonFileIfExists(files.task),
    setting: normalizedTaskSetting,
    requirements: normalizedRequirements,
    outline: normalizedOutline,
    page_plan: await readJsonFileIfExists(files.page_plan),
    page_progress: normalizedPageProgress,
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
    task_id: workspaceName,
    workspace_dir: workspaceDir,
    task_dir: workspaceDir,
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
  const roots = [WORKSPACE_ROOT, LEGACY_TASK_ROOT];
  const workspaceDirs = new Set<string>();
  for (const root of roots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      entries
        .filter((entry) => entry.isDirectory() && isWorkspaceDirName(entry.name))
        .forEach((entry) => workspaceDirs.add(path.join(root, entry.name)));
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const workspaces = await Promise.all([...workspaceDirs].map(getWorkspaceSummary));
  workspaces.sort((left, right) => right.workspace_id.localeCompare(left.workspace_id));

  return {
    workspace_root: WORKSPACE_ROOT,
    task_root: WORKSPACE_ROOT,
    has_workspaces: workspaces.length > 0,
    has_tasks: workspaces.length > 0,
    latest_workspace: workspaces[0] ?? null,
    latest_task: workspaces[0] ?? null,
    workspaces,
    tasks: workspaces,
  };
}

export async function createAppWorkspace(
  input: CreateAppWorkspaceInput = {},
): Promise<CreateAppWorkspaceResult> {
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

  const workspace = await ensureWorkspaceFiles(workspaceDir, { title });
  const setting = normalizeSettingJson(workspace.setting);
  const defaults = createDefaultSettingJson();
  const createSetting: AppCreateWorkspaceSetting = {
    page_generation_concurrency: normalizePageGenerationConcurrency(
      setting.page_generation_concurrency,
    ),
    visual_review_enabled: setting.visual_review_enabled === true,
    visual_review_failure_limit: normalizeReviewFailureLimit(
      setting.visual_review_failure_limit,
      2,
    ),
    disable_web_research: setting.disable_web_research === true,
    disable_image_research: setting.disable_image_research === true,
  };

  return {
    version: 1,
    workspace_root: workspace.workspace_root,
    workspace_id: workspace.workspace_id,
    workspace_dir: workspace.workspace_dir,
    title,
    setting: createSetting,
  };
}

export async function openAppWorkspace(
  input: OpenAppWorkspaceInput,
): Promise<AppWorkspaceResult> {
  return ensureWorkspaceFiles(input.workspace_dir, { require_format: true });
}

export async function updateAppWorkspaceSettings(
  input: UpdateAppWorkspaceSettingsInput,
): Promise<AppWorkspaceResult> {
  await patchAppWorkspaceSettings(input);
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function patchAppWorkspaceSettings(
  input: UpdateAppWorkspaceSettingsInput,
): Promise<PatchAppWorkspaceSettingsResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const existing = normalizeSettingJson(await readJsonFileIfExists(workspace.files.setting));
  const nextSetting = {
    ...normalizeSettingJson({
      ...existing,
      ...input.setting,
    }),
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(workspace.files.setting, nextSetting);
  if (input.persist_as_default === true) {
    await updateGlobalWorkspaceDefaults(input.setting);
  }
  return {
    workspace_dir: workspace.workspace_dir,
    setting: nextSetting,
    persisted_as_default: input.persist_as_default === true,
  };
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

export async function uploadAppUploadedSource(
  input: UploadAppUploadedSourceInput,
): Promise<UploadAppUploadedSourceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const bytes = decodeUploadedSourceBase64(input.content_base64);
  return withUploadedSourceWriteQueue(workspace.workspace_dir, () => persistUploadedSourceBytes({
    workspace,
    filename: input.filename,
    mime_type: input.mime_type,
    bytes,
  }));
}

async function persistUploadedSourceBytes(input: {
  workspace: AppWorkspaceResult;
  filename: string;
  mime_type?: string;
  bytes: Buffer;
}): Promise<UploadAppUploadedSourceResult> {
  const originalFilename = sanitizeUploadedSourceDisplayName(input.filename);
  const bytes = input.bytes;
  const sizeBytes = bytes.byteLength;
  const extension = assertAllowedUploadedSourceFile(originalFilename, sizeBytes);
  const sha256 = sha256BufferHex(bytes);
  const now = new Date();
  const updatedAt = now.toISOString();
  const index = await readUploadedSourceIndex(input.workspace.workspace_dir);
  const activeMaterials = index.materials.filter((item) => item.status === "active");
  const activeTotalWithNew = activeMaterials.reduce((sum, item) => sum + item.size_bytes, 0) + sizeBytes;
  if (activeTotalWithNew > UPLOADED_SOURCE_ACTIVE_TOTAL_MAX_BYTES) {
    throw new Error(`Active uploaded source files exceed the total limit of ${UPLOADED_SOURCE_ACTIVE_TOTAL_MAX_BYTES} bytes.`);
  }

  const existingIds = new Set(index.materials.map((item) => item.uploaded_source_id));
  const uploadedSourceId = createUploadedSourceId(now, sha256, existingIds);
  const storageDir = path.join(buildUploadedSourcePaths(input.workspace.workspace_dir).files_dir, uploadedSourceId);
  const storedFileName = `${sanitizeFileNamePart(path.basename(originalFilename, extension), "source")}${extension}`;
  const filePath = path.join(storageDir, storedFileName);
  assertPathUnderWorkspace(input.workspace.workspace_dir, filePath, "uploaded_source.file_path");
  await mkdir(storageDir, { recursive: true });
  await writeFile(filePath, bytes);

  const duplicateOf = activeMaterials
    .filter((item) => item.sha256 === sha256)
    .map((item) => item.uploaded_source_id);
  const material: AppUploadedSourceMaterial = {
    uploaded_source_id: uploadedSourceId,
    status: "active",
    original_filename: originalFilename,
    display_name: originalFilename,
    mime_type: normalizeString(input.mime_type),
    extension,
    size_bytes: sizeBytes,
    sha256,
    file_path: filePath,
    duplicate_of: duplicateOf,
    created_at: updatedAt,
    updated_at: updatedAt,
    removed_at: null,
  };
  const nextIndex = await writeUploadedSourceIndex(input.workspace.workspace_dir, {
    version: 1,
    workspace_dir: input.workspace.workspace_dir,
    active_total_size_bytes: activeTotalWithNew,
    materials: [...index.materials, material],
    updated_at: updatedAt,
  });
  await touchWorkspaceTask(input.workspace, updatedAt);
  return {
    workspace_dir: input.workspace.workspace_dir,
    material,
    index: nextIndex,
    warnings: duplicateOf.length > 0
      ? [`Duplicate uploaded source content matches: ${duplicateOf.join(", ")}`]
      : [],
  };
}

export async function commitAppUploadedSourceUpload(input: {
  workspace_dir: string;
  upload_id: string;
  filename: string;
  mime_type?: string;
  staging_file_path: string;
  expected_size_bytes: number;
}): Promise<CommitAppUploadedSourceUploadResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const stagingPath = path.normalize(input.staging_file_path);
  const stagingStat = await stat(stagingPath);
  if (!stagingStat.isFile()) {
    throw new Error(`Uploaded source staging path is not a file: ${stagingPath}`);
  }
  if (stagingStat.size !== input.expected_size_bytes) {
    throw new Error(`Uploaded source staging size mismatch: expected ${input.expected_size_bytes} bytes, got ${stagingStat.size} bytes.`);
  }
  const bytes = await readFile(stagingPath);
  const result = await withUploadedSourceWriteQueue(workspace.workspace_dir, () => persistUploadedSourceBytes({
    workspace,
    filename: input.filename,
    mime_type: input.mime_type,
    bytes,
  }));
  return {
    ...result,
    upload_id: input.upload_id,
  };
}

function buildStyleProfileCreationPaths(creationId: string): AppStyleProfileCreationPaths {
  const creationDir = path.join(STYLE_PROFILE_CREATING_DIR, creationId);
  return {
    library_dir: STYLE_PROFILE_LIBRARY_DIR,
    creation_dir: creationDir,
    uploads_dir: path.join(creationDir, "uploads"),
    references_dir: path.join(creationDir, "references"),
    rasterized_dir: path.join(creationDir, "rasterized"),
    draft_dir: path.join(creationDir, "draft"),
    draft_profile_path: path.join(creationDir, "draft", "profile.md"),
    manifest_path: path.join(creationDir, "manifest.json"),
  };
}

function buildStyleProfileStoragePaths(styleProfileId: string) {
  const profileDir = path.join(STYLE_PROFILE_PROFILES_DIR, styleProfileId);
  return {
    profile_dir: profileDir,
    profile_path: path.join(profileDir, "profile.md"),
    metadata_path: path.join(profileDir, "metadata.json"),
    references_dir: path.join(profileDir, "references"),
  };
}

function buildWorkspaceStyleProfilePaths(workspaceDir: string) {
  const profileDir = path.join(workspaceDir, "profile");
  return {
    profile_dir: profileDir,
    profile_path: path.join(profileDir, "style-profile.md"),
    selection_path: path.join(profileDir, "selection.json"),
  };
}

function getImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).trim().toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

async function markWorkspaceRenderedPagesStaleIfPresent(
  workspace: AppWorkspaceResult,
  updatedAt: string,
): Promise<void> {
  const pagesRecord = getPlainRecord(await readJsonFileIfExists(workspace.files.pages));
  const pages = Array.isArray(pagesRecord.pages) ? pagesRecord.pages : [];
  if (pages.length === 0) return;
  await writeJsonFile(workspace.files.pages, {
    ...pagesRecord,
    status: "stale",
    updated_at: updatedAt,
  });
}

function assertStyleProfileCreationId(value: string): string {
  const creationId = sanitizeFileNamePart(value, "");
  if (!creationId || creationId !== value || !creationId.startsWith("style-profile-creation-")) {
    throw new Error('"creation_id" must be a valid Style Profile Creation Workspace id.');
  }
  const paths = buildStyleProfileCreationPaths(creationId);
  if (!isPathInsideDir(STYLE_PROFILE_CREATING_DIR, paths.creation_dir)) {
    throw new Error('"creation_id" resolves outside the Style Profile Creation directory.');
  }
  return creationId;
}

function assertStyleProfileId(value: string): string {
  const styleProfileId = sanitizeFileNamePart(value, "");
  if (!styleProfileId || styleProfileId !== value || !styleProfileId.startsWith("style-profile-")) {
    throw new Error('"style_profile_id" must be a valid Style Profile id.');
  }
  const paths = buildStyleProfileStoragePaths(styleProfileId);
  if (!isPathInsideDir(STYLE_PROFILE_PROFILES_DIR, paths.profile_dir)) {
    throw new Error('"style_profile_id" resolves outside the Style Profile Library profiles directory.');
  }
  return styleProfileId;
}

function createStyleProfileCreationId(now: Date): string {
  const datePart = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join("");
  return `style-profile-creation-${datePart}-${randomUUID().slice(0, 8)}`;
}

function createStyleProfileId(now: Date, sha256: string, existingIds: Set<string>): string {
  const datePart = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join("");
  const base = `style-profile-${datePart}-${sha256.slice(0, 8)}`;
  if (!existingIds.has(base)) return base;
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  throw new Error("Could not create a unique Style Profile id.");
}

function createDefaultStyleProfileIndex(): AppStyleProfileIndex {
  return {
    version: 1,
    library_dir: STYLE_PROFILE_LIBRARY_DIR,
    profiles: [],
    updated_at: new Date().toISOString(),
  };
}

function normalizeStyleProfileIndexEntry(value: unknown): AppStyleProfileIndexEntry | null {
  const record = getPlainRecord(value);
  const styleProfileId = normalizeString(record.style_profile_id);
  const profilePath = normalizeString(record.profile_path);
  const profileDir = normalizeString(record.profile_dir);
  if (!styleProfileId || !profilePath || !profileDir) return null;
  return {
    version: 1,
    style_profile_id: styleProfileId,
    display_name: normalizeString(record.display_name) || styleProfileId,
    profile_dir: profileDir,
    profile_path: profilePath,
    metadata_path: normalizeString(record.metadata_path) || path.join(profileDir, "metadata.json"),
    profile_sha256: normalizeString(record.profile_sha256),
    size_bytes: typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes)
      ? Math.max(0, Math.floor(record.size_bytes))
      : 0,
    reference_count: typeof record.reference_count === "number" && Number.isFinite(record.reference_count)
      ? Math.max(0, Math.floor(record.reference_count))
      : 0,
    source_file_count: typeof record.source_file_count === "number" && Number.isFinite(record.source_file_count)
      ? Math.max(0, Math.floor(record.source_file_count))
      : 0,
    created_at: normalizeString(record.created_at) || new Date().toISOString(),
    updated_at: normalizeString(record.updated_at) || new Date().toISOString(),
  };
}

function normalizeStyleProfileIndex(value: unknown): AppStyleProfileIndex {
  const record = getPlainRecord(value);
  const profiles = Array.isArray(record.profiles)
    ? record.profiles
        .map(normalizeStyleProfileIndexEntry)
        .filter((item): item is AppStyleProfileIndexEntry => item !== null)
    : [];
  profiles.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  return {
    version: 1,
    library_dir: STYLE_PROFILE_LIBRARY_DIR,
    profiles,
    updated_at: normalizeString(record.updated_at) || new Date().toISOString(),
  };
}

async function readStyleProfileIndex(): Promise<AppStyleProfileIndex> {
  const existing = await readJsonFileIfExists(STYLE_PROFILE_INDEX_PATH);
  return normalizeStyleProfileIndex(existing ?? createDefaultStyleProfileIndex());
}

async function writeStyleProfileIndex(index: AppStyleProfileIndex): Promise<AppStyleProfileIndex> {
  const normalized = normalizeStyleProfileIndex(index);
  await writeJsonFile(STYLE_PROFILE_INDEX_PATH, normalized);
  return normalized;
}

function normalizeStyleProfileReferenceMaterial(value: unknown): AppStyleProfileReferenceMaterial | null {
  const record = getPlainRecord(value);
  const referenceId = normalizeString(record.reference_id);
  const filePath = normalizeString(record.file_path);
  if (!referenceId || !filePath) return null;
  return {
    reference_id: referenceId,
    original_filename: normalizeString(record.original_filename) || referenceId,
    display_name: normalizeString(record.display_name) || normalizeString(record.original_filename) || referenceId,
    mime_type: normalizeString(record.mime_type),
    extension: normalizeString(record.extension),
    size_bytes: typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes)
      ? Math.max(0, Math.floor(record.size_bytes))
      : 0,
    sha256: normalizeString(record.sha256),
    file_path: filePath,
    kind: record.kind === "pptx" ? "pptx" : "image",
    created_at: normalizeString(record.created_at) || new Date().toISOString(),
  };
}

function normalizeStyleProfileReferenceImage(value: unknown): AppReferenceSlideImage | null {
  const record = getPlainRecord(value);
  const referenceImageId = normalizeString(record.reference_image_id);
  const sourceReferenceId = normalizeString(record.source_reference_id);
  const filePath = normalizeString(record.file_path);
  if (!referenceImageId || !sourceReferenceId || !filePath) return null;
  return {
    reference_image_id: referenceImageId,
    source_reference_id: sourceReferenceId,
    source_file_path: normalizeString(record.source_file_path),
    page_number: typeof record.page_number === "number" && Number.isFinite(record.page_number)
      ? Math.max(1, Math.floor(record.page_number))
      : null,
    file_path: filePath,
    width: typeof record.width === "number" && Number.isFinite(record.width) ? Math.max(0, Math.floor(record.width)) : null,
    height: typeof record.height === "number" && Number.isFinite(record.height) ? Math.max(0, Math.floor(record.height)) : null,
    selected_for_analysis: record.selected_for_analysis === true,
    order: typeof record.order === "number" && Number.isFinite(record.order) ? Math.max(1, Math.floor(record.order)) : 1,
  };
}

function normalizeStyleProfileCreationManifest(
  value: unknown,
  creationId: string,
  displayName: string,
): AppStyleProfileCreationManifest {
  const record = getPlainRecord(value);
  const referenceMaterials = Array.isArray(record.reference_materials)
    ? record.reference_materials
        .map(normalizeStyleProfileReferenceMaterial)
        .filter((item): item is AppStyleProfileReferenceMaterial => item !== null)
    : [];
  const referenceImages = Array.isArray(record.reference_images)
    ? record.reference_images
        .map(normalizeStyleProfileReferenceImage)
        .filter((item): item is AppReferenceSlideImage => item !== null)
    : [];
  const selectedIds = new Set(normalizeStringArray(record.selected_reference_image_ids));
  return {
    version: 1,
    creation_id: creationId,
    display_name: normalizeString(record.display_name) || displayName,
    status: record.status === "published" ? "published" : referenceMaterials.length > 0 ? "uploaded" : "prepared",
    reference_materials: referenceMaterials,
    reference_images: referenceImages
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        ...item,
        selected_for_analysis: selectedIds.size > 0
          ? selectedIds.has(item.reference_image_id)
          : item.selected_for_analysis,
      })),
    selected_reference_image_ids: selectedIds.size > 0
      ? Array.from(selectedIds)
      : referenceImages.filter((item) => item.selected_for_analysis).map((item) => item.reference_image_id),
    created_at: normalizeString(record.created_at) || new Date().toISOString(),
    updated_at: normalizeString(record.updated_at) || new Date().toISOString(),
    published_style_profile_id: normalizeString(record.published_style_profile_id) || undefined,
  };
}

async function readStyleProfileCreationManifest(
  creationId: string,
): Promise<AppStyleProfileCreationManifest> {
  const paths = buildStyleProfileCreationPaths(creationId);
  const existing = await readJsonFileIfExists(paths.manifest_path);
  if (!existing) {
    throw new Error(`Style Profile Creation Workspace not found: ${creationId}`);
  }
  return normalizeStyleProfileCreationManifest(existing, creationId, creationId);
}

async function writeStyleProfileCreationManifest(
  manifest: AppStyleProfileCreationManifest,
): Promise<AppStyleProfileCreationManifest> {
  const normalized = normalizeStyleProfileCreationManifest(
    manifest,
    manifest.creation_id,
    manifest.display_name,
  );
  await writeJsonFile(buildStyleProfileCreationPaths(normalized.creation_id).manifest_path, normalized);
  return normalized;
}

export function selectEvenlySpacedReferenceImages<T>(items: T[], limit = STYLE_PROFILE_REFERENCE_ANALYSIS_LIMIT): T[] {
  if (items.length <= limit) return items.slice();
  if (limit <= 1) return [items[0]];
  const selectedIndexes = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    selectedIndexes.add(Math.round(index * (items.length - 1) / (limit - 1)));
  }
  return Array.from(selectedIndexes)
    .sort((left, right) => left - right)
    .map((index) => items[index]);
}

function applyStyleProfileReferenceSelection(
  manifest: AppStyleProfileCreationManifest,
): AppStyleProfileCreationManifest {
  const orderedImages = manifest.reference_images
    .slice()
    .sort((left, right) => left.order - right.order);
  const selectedIds = new Set(
    selectEvenlySpacedReferenceImages(orderedImages, STYLE_PROFILE_REFERENCE_ANALYSIS_LIMIT)
      .map((item) => item.reference_image_id),
  );
  return {
    ...manifest,
    reference_images: orderedImages.map((item) => ({
      ...item,
      selected_for_analysis: selectedIds.has(item.reference_image_id),
    })),
    selected_reference_image_ids: Array.from(selectedIds),
  };
}

function assertAllowedStyleProfileReferenceFile(filename: string, sizeBytes: number): string {
  const extension = path.extname(filename).trim().toLowerCase();
  if (!extension || !STYLE_PROFILE_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported Style Profile reference file type: ${extension || "(none)"}`);
  }
  if (sizeBytes <= 0) {
    throw new Error("Style Profile reference file must not be empty.");
  }
  if (sizeBytes > STYLE_PROFILE_SINGLE_FILE_MAX_BYTES) {
    throw new Error(`Style Profile reference file exceeds the single-file limit of ${STYLE_PROFILE_SINGLE_FILE_MAX_BYTES} bytes.`);
  }
  return extension;
}

async function readImageDimensions(filePath: string): Promise<{ width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

function buildReferenceImageId(materialId: string, pageNumber: number | null): string {
  return pageNumber === null
    ? `${materialId}-image`
    : `${materialId}-page-${String(pageNumber).padStart(3, "0")}`;
}

async function materialToReferenceImages(input: {
  paths: AppStyleProfileCreationPaths;
  material: AppStyleProfileReferenceMaterial;
  extension: string;
  nextOrder: number;
}): Promise<AppReferenceSlideImage[]> {
  if (input.extension === ".pptx") {
    const outputDir = path.join(input.paths.rasterized_dir, input.material.reference_id);
    const rasterized = await rasterizePptxToImages({
      pptx_path: input.material.file_path,
      output_dir: outputDir,
      target_height: 720,
      overwrite: false,
    });
    return rasterized.slides.map((slide, index) => ({
      reference_image_id: buildReferenceImageId(input.material.reference_id, slide.page_number),
      source_reference_id: input.material.reference_id,
      source_file_path: input.material.file_path,
      page_number: slide.page_number,
      file_path: slide.image_path,
      width: slide.width,
      height: slide.height,
      selected_for_analysis: false,
      order: input.nextOrder + index,
    }));
  }

  const storedFileName = `${input.material.reference_id}${input.extension}`;
  const referenceImagePath = path.join(input.paths.references_dir, storedFileName);
  await mkdir(input.paths.references_dir, { recursive: true });
  await copyFile(input.material.file_path, referenceImagePath);
  const dimensions = await readImageDimensions(referenceImagePath);
  return [{
    reference_image_id: buildReferenceImageId(input.material.reference_id, null),
    source_reference_id: input.material.reference_id,
    source_file_path: input.material.file_path,
    page_number: null,
    file_path: referenceImagePath,
    width: dimensions.width,
    height: dimensions.height,
    selected_for_analysis: false,
    order: input.nextOrder,
  }];
}

export async function listAppStyleProfiles(): Promise<ListAppStyleProfilesResult> {
  const index = await readStyleProfileIndex();
  return {
    library_dir: STYLE_PROFILE_LIBRARY_DIR,
    index,
    profiles: index.profiles,
  };
}

async function readPublishedStyleProfileEntry(styleProfileId: string): Promise<AppStyleProfileIndexEntry> {
  const normalizedId = assertStyleProfileId(styleProfileId);
  const index = await readStyleProfileIndex();
  const profile = index.profiles.find((item) => item.style_profile_id === normalizedId);
  if (!profile) {
    throw new Error(`Style Profile not found: ${normalizedId}`);
  }
  return profile;
}

async function listStyleProfileReferenceImagePreviews(
  styleProfileId: string,
): Promise<AppStyleProfileReferenceImagePreview[]> {
  const storage = buildStyleProfileStoragePaths(styleProfileId);
  let filenames: string[];
  try {
    filenames = await readdir(storage.references_dir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const previews = await Promise.all(
    filenames
      .filter((filename) => /\.(?:png|jpe?g|webp|gif)$/i.test(filename))
      .sort((left, right) => left.localeCompare(right))
      .map(async (filename, index): Promise<AppStyleProfileReferenceImagePreview | null> => {
        const filePath = path.join(storage.references_dir, filename);
        if (!isPathInsideDir(storage.references_dir, filePath)) return null;
        const imageStat = await stat(filePath).catch(() => null);
        if (!imageStat?.isFile()) return null;
        return {
          reference_image_id: `${styleProfileId}-reference-${String(index + 1).padStart(3, "0")}`,
          file_path: filePath,
          filename,
          mime_type: getImageMimeType(filePath),
          size_bytes: imageStat.size,
          order: index + 1,
        };
      }),
  );
  return previews.filter((item): item is AppStyleProfileReferenceImagePreview => item !== null);
}

export async function getAppStyleProfilePreview(
  input: GetAppStyleProfilePreviewInput,
): Promise<GetAppStyleProfilePreviewResult> {
  const styleProfile = await readPublishedStyleProfileEntry(input.style_profile_id);
  const referenceImages = await listStyleProfileReferenceImagePreviews(styleProfile.style_profile_id);
  return {
    style_profile: styleProfile,
    cover_image: referenceImages[0] ?? null,
  };
}

export async function getAppStyleProfile(
  input: GetAppStyleProfileInput,
): Promise<GetAppStyleProfileResult> {
  const styleProfile = await readPublishedStyleProfileEntry(input.style_profile_id);
  const content = await readFile(styleProfile.profile_path, "utf8");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const sha256 = sha256Hex(content);
  return {
    style_profile: styleProfile,
    content,
    size_bytes: sizeBytes,
    sha256,
    reference_images: await listStyleProfileReferenceImagePreviews(styleProfile.style_profile_id),
  };
}

export async function prepareAppStyleProfileCreation(
  input: PrepareAppStyleProfileCreationInput = {},
): Promise<PrepareAppStyleProfileCreationResult> {
  const now = new Date();
  const creationId = createStyleProfileCreationId(now);
  const displayName = normalizeString(input.display_name).trim() || `Style Profile ${now.toISOString().slice(0, 10)}`;
  const paths = buildStyleProfileCreationPaths(creationId);
  await Promise.all([
    mkdir(paths.uploads_dir, { recursive: true }),
    mkdir(paths.references_dir, { recursive: true }),
    mkdir(paths.rasterized_dir, { recursive: true }),
    mkdir(paths.draft_dir, { recursive: true }),
  ]);
  const manifest = normalizeStyleProfileCreationManifest(null, creationId, displayName);
  await writeStyleProfileCreationManifest(manifest);
  return {
    ...paths,
    creation_id: creationId,
    display_name: displayName,
    prepared_at: manifest.created_at,
  };
}

export async function commitAppStyleProfileReferenceUpload(
  input: CommitAppStyleProfileReferenceUploadInput,
): Promise<CommitAppStyleProfileReferenceUploadResult> {
  const creationId = assertStyleProfileCreationId(input.creation_id);
  const paths = buildStyleProfileCreationPaths(creationId);
  const originalFilename = sanitizeUploadedSourceDisplayName(input.filename);
  const stagingPath = path.normalize(input.staging_file_path);
  const stagingStat = await stat(stagingPath);
  if (!stagingStat.isFile()) {
    throw new Error(`Style Profile reference staging path is not a file: ${stagingPath}`);
  }
  if (stagingStat.size !== input.expected_size_bytes) {
    throw new Error(`Style Profile reference staging size mismatch: expected ${input.expected_size_bytes} bytes, got ${stagingStat.size} bytes.`);
  }
  const extension = assertAllowedStyleProfileReferenceFile(originalFilename, stagingStat.size);

  return withStyleProfileWriteQueue(creationId, async () => {
    const manifest = await readStyleProfileCreationManifest(creationId);
    const bytes = await readFile(stagingPath);
    const sha256 = sha256BufferHex(bytes);
    const referenceId = `reference-${String(manifest.reference_materials.length + 1).padStart(3, "0")}-${sha256.slice(0, 8)}`;
    const storageDir = path.join(paths.uploads_dir, referenceId);
    const storedFileName = `${sanitizeFileNamePart(path.basename(originalFilename, extension), "reference")}${extension}`;
    const storedPath = path.join(storageDir, storedFileName);
    if (!isPathInsideDir(paths.uploads_dir, storedPath)) {
      throw new Error("Style Profile reference file path escapes uploads directory.");
    }
    await mkdir(storageDir, { recursive: true });
    await copyFile(stagingPath, storedPath);
    const now = new Date().toISOString();
    const material: AppStyleProfileReferenceMaterial = {
      reference_id: referenceId,
      original_filename: originalFilename,
      display_name: originalFilename,
      mime_type: normalizeString(input.mime_type),
      extension,
      size_bytes: stagingStat.size,
      sha256,
      file_path: storedPath,
      kind: extension === ".pptx" ? "pptx" : "image",
      created_at: now,
    };
    const referenceImages = await materialToReferenceImages({
      paths,
      material,
      extension,
      nextOrder: manifest.reference_images.length + 1,
    });
    const nextManifest = await writeStyleProfileCreationManifest(
      applyStyleProfileReferenceSelection({
        ...manifest,
        status: "uploaded",
        reference_materials: [...manifest.reference_materials, material],
        reference_images: [...manifest.reference_images, ...referenceImages],
        updated_at: now,
      }),
    );
    return {
      creation_id: creationId,
      upload_id: input.upload_id,
      material,
      manifest: nextManifest,
      warnings: [],
    };
  });
}

export async function getAppStyleProfileCreationContext(
  input: GetAppStyleProfileCreationContextInput,
): Promise<GetAppStyleProfileCreationContextResult> {
  const creationId = assertStyleProfileCreationId(input.creation_id);
  const paths = buildStyleProfileCreationPaths(creationId);
  const manifest = await readStyleProfileCreationManifest(creationId);
  const selectedIds = new Set(manifest.selected_reference_image_ids);
  const selectedReferenceImages = manifest.reference_images
    .filter((item) => selectedIds.has(item.reference_image_id))
    .sort((left, right) => left.order - right.order);
  return {
    ...paths,
    creation_id: creationId,
    manifest,
    selected_reference_images: selectedReferenceImages,
  };
}

async function fingerprintStyleProfileDraft(creationId: string): Promise<AppStyleProfileDraftFingerprint> {
  const draftPath = buildStyleProfileCreationPaths(creationId).draft_profile_path;
  try {
    const fingerprint = await fingerprintFile(draftPath);
    return {
      creation_id: creationId,
      draft_path: draftPath,
      exists: true,
      sha256: fingerprint.sha256,
      size_bytes: fingerprint.size_bytes,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        creation_id: creationId,
        draft_path: draftPath,
        exists: false,
      };
    }
    throw error;
  }
}

function assertValidStyleProfileDraft(content: string, sizeBytes: number): void {
  if (sizeBytes < STYLE_PROFILE_DRAFT_MIN_BYTES) {
    throw new Error(`Style Profile draft is too short. Expected at least ${STYLE_PROFILE_DRAFT_MIN_BYTES} bytes.`);
  }
  if (sizeBytes > STYLE_PROFILE_DRAFT_MAX_BYTES) {
    throw new Error(`Style Profile draft exceeds the ${STYLE_PROFILE_DRAFT_MAX_BYTES} byte limit.`);
  }
  if (content.trim().length === 0) {
    throw new Error("Style Profile draft must not be empty.");
  }
}

export async function getAppStyleProfileDraftFingerprint(
  input: GetAppStyleProfileDraftFingerprintInput,
): Promise<AppStyleProfileDraftFingerprint> {
  const creationId = assertStyleProfileCreationId(input.creation_id);
  return fingerprintStyleProfileDraft(creationId);
}

export async function getAppStyleProfileDraft(
  input: GetAppStyleProfileDraftInput,
): Promise<GetAppStyleProfileDraftResult> {
  const creationId = assertStyleProfileCreationId(input.creation_id);
  const draftPath = buildStyleProfileCreationPaths(creationId).draft_profile_path;
  const content = await readFile(draftPath, "utf8");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const sha256 = sha256Hex(content);
  return {
    creation_id: creationId,
    draft_path: draftPath,
    exists: true,
    content,
    size_bytes: sizeBytes,
    sha256,
  };
}

export async function publishAppStyleProfile(
  input: PublishAppStyleProfileInput,
): Promise<PublishAppStyleProfileResult> {
  const creationId = assertStyleProfileCreationId(input.creation_id);
  return withStyleProfileWriteQueue(STYLE_PROFILE_INDEX_PATH, async () => {
    const manifest = await readStyleProfileCreationManifest(creationId);
    const draft = await getAppStyleProfileDraft({ creation_id: creationId });
    assertValidStyleProfileDraft(draft.content, draft.size_bytes);
    const index = await readStyleProfileIndex();
    const now = new Date();
    const updatedAt = now.toISOString();
    const styleProfileId = createStyleProfileId(
      now,
      draft.sha256,
      new Set(index.profiles.map((item) => item.style_profile_id)),
    );
    const storage = buildStyleProfileStoragePaths(styleProfileId);
    await Promise.all([
      mkdir(storage.profile_dir, { recursive: true }),
      mkdir(storage.references_dir, { recursive: true }),
    ]);
    await writeFile(storage.profile_path, draft.content, "utf8");

    const selectedIds = new Set(manifest.selected_reference_image_ids);
    const selectedImages = manifest.reference_images
      .filter((item) => selectedIds.has(item.reference_image_id))
      .sort((left, right) => left.order - right.order);
    for (const image of selectedImages) {
      const extension = path.extname(image.file_path).toLowerCase() || ".png";
      const targetPath = path.join(
        storage.references_dir,
        `reference-${String(image.order).padStart(3, "0")}${extension}`,
      );
      await copyFile(image.file_path, targetPath);
    }

    const displayName = normalizeString(input.display_name).trim() || manifest.display_name || styleProfileId;
    const entry: AppStyleProfileIndexEntry = {
      version: 1,
      style_profile_id: styleProfileId,
      display_name: displayName,
      profile_dir: storage.profile_dir,
      profile_path: storage.profile_path,
      metadata_path: storage.metadata_path,
      profile_sha256: draft.sha256,
      size_bytes: draft.size_bytes,
      reference_count: selectedImages.length,
      source_file_count: manifest.reference_materials.length,
      created_at: updatedAt,
      updated_at: updatedAt,
    };
    await writeJsonFile(storage.metadata_path, entry);
    const nextIndex = await writeStyleProfileIndex({
      version: 1,
      library_dir: STYLE_PROFILE_LIBRARY_DIR,
      profiles: [entry, ...index.profiles],
      updated_at: updatedAt,
    });
    await writeStyleProfileCreationManifest({
      ...manifest,
      status: "published",
      display_name: displayName,
      updated_at: updatedAt,
      published_style_profile_id: styleProfileId,
    });
    return {
      style_profile: entry,
      index: nextIndex,
      profile_path: storage.profile_path,
      reference_count: selectedImages.length,
    };
  });
}

export async function selectAppWorkspaceStyleProfile(
  input: SelectAppWorkspaceStyleProfileInput,
): Promise<SelectAppWorkspaceStyleProfileResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const styleProfileId = assertStyleProfileId(input.style_profile_id);
  const index = await readStyleProfileIndex();
  const profile = index.profiles.find((item) => item.style_profile_id === styleProfileId);
  if (!profile) {
    throw new Error(`Style Profile not found: ${styleProfileId}`);
  }
  const content = await readFile(profile.profile_path, "utf8");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (content.trim().length === 0) {
    throw new Error(`Style Profile is empty: ${styleProfileId}`);
  }
  const sha256 = sha256Hex(content);
  const paths = buildWorkspaceStyleProfilePaths(workspace.workspace_dir);
  await mkdir(paths.profile_dir, { recursive: true });
  await writeFile(paths.profile_path, content, "utf8");
  const selectedAt = new Date().toISOString();
  const selection = {
    version: 1 as const,
    style_profile_id: styleProfileId,
    display_name: profile.display_name,
    source_profile_path: profile.profile_path,
    workspace_profile_path: paths.profile_path,
    selection_path: paths.selection_path,
    profile_sha256: sha256,
    size_bytes: sizeBytes,
    selected_at: selectedAt,
  };
  await writeJsonFile(paths.selection_path, selection);
  await markWorkspaceRenderedPagesStaleIfPresent(workspace, selectedAt);
  await touchWorkspaceTask(workspace, selectedAt);
  return {
    workspace: await ensureWorkspaceFiles(workspace.workspace_dir),
    selection,
    content,
  };
}

export async function getAppWorkspaceStyleProfile(
  input: GetAppWorkspaceStyleProfileInput,
): Promise<GetAppWorkspaceStyleProfileResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = buildWorkspaceStyleProfilePaths(workspace.workspace_dir);
  const selectionRecord = await readJsonFileIfExists(paths.selection_path);
  const selection = getPlainRecord(selectionRecord);
  const hasSelection = Boolean(normalizeString(selection.style_profile_id));
  const content = await readFile(paths.profile_path, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (hasSelection) {
        throw new Error("Selected Style Profile file is missing. Select or clear the workspace Style Profile before generation.");
      }
      return "";
    }
    throw error;
  });
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (hasSelection && content.trim().length === 0) {
    throw new Error("Selected Style Profile file is empty. Select or clear the workspace Style Profile before generation.");
  }
  const sha256 = content ? sha256Hex(content) : "";
  return {
    workspace_dir: workspace.workspace_dir,
    selected: hasSelection,
    profile_path: paths.profile_path,
    selection_path: paths.selection_path,
    selection: hasSelection
      ? {
          version: 1,
          style_profile_id: normalizeString(selection.style_profile_id),
          display_name: normalizeString(selection.display_name),
          source_profile_path: normalizeString(selection.source_profile_path),
          workspace_profile_path: paths.profile_path,
          selection_path: paths.selection_path,
          profile_sha256: normalizeString(selection.profile_sha256),
          size_bytes: typeof selection.size_bytes === "number" && Number.isFinite(selection.size_bytes)
            ? Math.max(0, Math.floor(selection.size_bytes))
            : sizeBytes,
          selected_at: normalizeString(selection.selected_at),
        }
      : null,
    content,
    size_bytes: sizeBytes,
    sha256,
  };
}

export async function clearAppWorkspaceStyleProfile(
  input: ClearAppWorkspaceStyleProfileInput,
): Promise<ClearAppWorkspaceStyleProfileResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = buildWorkspaceStyleProfilePaths(workspace.workspace_dir);
  const existed = await fileExists(paths.profile_path).then(Boolean).catch(() => false);
  const selectionExisted = await fileExists(paths.selection_path).then(Boolean).catch(() => false);
  await Promise.all([
    rm(paths.profile_path, { force: true }),
    rm(paths.selection_path, { force: true }),
  ]);
  if (existed || selectionExisted) {
    const updatedAt = new Date().toISOString();
    await markWorkspaceRenderedPagesStaleIfPresent(workspace, updatedAt);
    await touchWorkspaceTask(workspace, updatedAt);
  }
  return {
    workspace: await ensureWorkspaceFiles(workspace.workspace_dir),
    cleared: existed || selectionExisted,
  };
}

export async function listAppUploadedSources(
  input: ListAppUploadedSourcesInput,
): Promise<ListAppUploadedSourcesResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const index = await readUploadedSourceIndex(workspace.workspace_dir);
  const active = index.materials.filter((item) => item.status === "active");
  const removed = index.materials.filter((item) => item.status === "removed");
  return {
    workspace_dir: workspace.workspace_dir,
    index: {
      ...index,
      materials: input.include_removed === true ? index.materials : active,
    },
    active,
    removed: input.include_removed === true ? removed : [],
    limits: {
      single_file_max_bytes: UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES,
      active_total_max_bytes: UPLOADED_SOURCE_ACTIVE_TOTAL_MAX_BYTES,
    },
  };
}

export async function removeAppUploadedSource(
  input: RemoveAppUploadedSourceInput,
): Promise<RemoveAppUploadedSourceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return withUploadedSourceWriteQueue(workspace.workspace_dir, async () => {
    const index = await readUploadedSourceIndex(workspace.workspace_dir);
    const updatedAt = new Date().toISOString();
    let removedMaterial: AppUploadedSourceMaterial | null = null;
    const materials = index.materials.map((item) => {
      if (item.uploaded_source_id !== input.uploaded_source_id) return item;
      removedMaterial = {
        ...item,
        status: "removed",
        updated_at: updatedAt,
        removed_at: updatedAt,
      };
      return removedMaterial;
    });
    if (!removedMaterial) {
      throw new Error(`Uploaded Source Material not found: ${input.uploaded_source_id}`);
    }
    const activeTotalSize = materials
      .filter((item) => item.status === "active")
      .reduce((sum, item) => sum + item.size_bytes, 0);
    const nextIndex = await writeUploadedSourceIndex(workspace.workspace_dir, {
      version: 1,
      workspace_dir: workspace.workspace_dir,
      active_total_size_bytes: activeTotalSize,
      materials,
      updated_at: updatedAt,
    });
    await touchWorkspaceTask(workspace, updatedAt);
    return {
      workspace_dir: workspace.workspace_dir,
      material: removedMaterial,
      index: nextIndex,
    };
  });
}

function normalizeUploadedSourceAnalysisDraftType(value: string): "factual" | "visual" {
  if (value === "factual" || value === "visual") return value;
  throw new Error('"draft_type" must be either "factual" or "visual"');
}

function normalizeUploadedSourceAnalysisDraftId(value: unknown): string | null {
  const draftId = normalizeString(value);
  if (!draftId) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(draftId)) {
    throw new Error('"draft_id" may only contain letters, numbers, underscores, and hyphens');
  }
  return draftId;
}

function buildUploadedSourceAnalysisDraftPath(
  paths: AppUploadedSourceAnalysisPaths,
  draftType: "factual" | "visual",
  draftId?: string | null,
): string {
  if (!draftId) {
    return draftType === "factual" ? paths.factual_draft_path : paths.visual_draft_path;
  }
  return path.join(paths.drafts_dir, `${draftId}-${draftType}.json`);
}

function normalizeUploadedSourceAnalysisArtifact(value: unknown, fallbackStatus: string): Record<string, unknown> {
  const record = getPlainRecord(value);
  return {
    version: typeof record.version === "number" ? record.version : 1,
    status: normalizeString(record.status) || fallbackStatus,
    ...record,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

async function ensureUploadedSourceAnalysisDirectories(workspaceDir: string): Promise<AppUploadedSourceAnalysisPaths> {
  const paths = buildUploadedSourceAnalysisPaths(workspaceDir);
  await mkdir(paths.drafts_dir, { recursive: true });
  return paths;
}

export async function prepareAppUploadedSourceAnalysisWorkspace(
  input: PrepareAppUploadedSourceAnalysisWorkspaceInput,
): Promise<PrepareAppUploadedSourceAnalysisWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const preparedAt = new Date().toISOString();
  await touchWorkspaceTask(workspace, preparedAt);
  return {
    workspace_dir: workspace.workspace_dir,
    uploaded_source_index: await readUploadedSourceIndex(workspace.workspace_dir),
    ...paths,
    prepared_at: preparedAt,
  };
}

export async function recordAppUploadedSourceAnalysisDraft(
  input: RecordAppUploadedSourceAnalysisDraftInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const draftType = normalizeUploadedSourceAnalysisDraftType(input.draft_type);
  const draftId = normalizeUploadedSourceAnalysisDraftId(input.draft_id);
  const draftPath = buildUploadedSourceAnalysisDraftPath(paths, draftType, draftId);
  assertPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");
  const updatedAt = new Date().toISOString();
  const next = {
    ...normalizeUploadedSourceAnalysisArtifact(input.draft, "draft"),
    draft_type: draftType,
    ...(draftId ? { draft_id: draftId } : {}),
    draft_path: draftPath,
    updated_at: updatedAt,
  };
  await writeJsonFile(draftPath, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function getAppUploadedSourceAnalysisDraft(
  input: GetAppUploadedSourceAnalysisDraftInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const draftType = normalizeUploadedSourceAnalysisDraftType(input.draft_type);
  const draftId = normalizeUploadedSourceAnalysisDraftId(input.draft_id);
  const draftPath = buildUploadedSourceAnalysisDraftPath(paths, draftType, draftId);
  assertPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");
  const existing = await readJsonFileIfExists(draftPath);
  if (existing === null) {
    return {
      version: 1,
      status: "empty",
      draft_type: draftType,
      ...(draftId ? { draft_id: draftId } : {}),
      draft_path: draftPath,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeUploadedSourceAnalysisArtifact(existing, "empty");
}

export async function getAppUploadedSourceAnalysisDraftFingerprint(
  input: GetAppUploadedSourceAnalysisDraftFingerprintInput,
): Promise<AppUploadedSourceAnalysisDraftFingerprint> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const draftType = normalizeUploadedSourceAnalysisDraftType(input.draft_type);
  const draftId = normalizeUploadedSourceAnalysisDraftId(input.draft_id);
  const draftPath = buildUploadedSourceAnalysisDraftPath(paths, draftType, draftId);
  assertPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");
  try {
    const fingerprint = await fingerprintFile(draftPath);
    return {
      workspace_dir: workspace.workspace_dir,
      draft_type: draftType,
      ...(draftId ? { draft_id: draftId } : {}),
      draft_path: draftPath,
      exists: true,
      sha256: fingerprint.sha256,
      size_bytes: fingerprint.size_bytes,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        workspace_dir: workspace.workspace_dir,
        draft_type: draftType,
        ...(draftId ? { draft_id: draftId } : {}),
        draft_path: draftPath,
        exists: false,
      };
    }
    throw error;
  }
}

export async function recordAppUploadedSourceAnalysis(
  input: RecordAppUploadedSourceAnalysisInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const next = {
    ...normalizeUploadedSourceAnalysisArtifact(input.analysis, "ready"),
    analysis_path: paths.analysis_path,
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.analysis_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function getAppUploadedSourceAnalysis(
  input: GetAppUploadedSourceAnalysisInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureUploadedSourceAnalysisDirectories(workspace.workspace_dir);
  const existing = await readJsonFileIfExists(paths.analysis_path);
  if (existing === null) {
    return {
      version: 1,
      status: "empty",
      analysis_path: paths.analysis_path,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeUploadedSourceAnalysisArtifact(existing, "empty");
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
    items: nextManifestSlides.map((slide) => outlineItemFromLegacyText(
      slide.title,
      normalizeString(slide.speaker_note) || normalizeString(slide.id),
    )),
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
    items: nextManifestSlides.map((slide) => outlineItemFromLegacyText(
      slide.title,
      normalizeString(slide.speaker_note) || normalizeString(slide.id),
    )),
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
                updated_at: updatedAt,
              }
            : null;
        }
        const existing = progressByPageId.get(planPage.page_id);
        return existing
          ? {
              ...existing,
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

export async function getAppWorkspaceRequirements(
  input: GetAppWorkspaceRequirementsInput,
): Promise<AppPresentationRequirements> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  return normalizePresentationRequirements(workspace.requirements);
}

export async function updateAppWorkspaceRequirements(
  input: UpdateAppWorkspaceRequirementsInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const currentRequirements = normalizePresentationRequirements(workspace.requirements);
  const requirements = normalizePresentationRequirements(input.requirements);
  const updatedAt = new Date().toISOString();
  const nextRequirements: AppPresentationRequirements = {
    ...requirements,
    updated_at: updatedAt,
    confirmed_at: requirements.status === "confirmed" ? updatedAt : null,
  };
  if (getSelectedVisualTone(currentRequirements) !== getSelectedVisualTone(nextRequirements)) {
    await invalidateWorkspaceStyleGuide(workspace);
  }
  await writeJsonFile(workspace.files.requirements, nextRequirements);
  await touchWorkspaceTask(workspace, updatedAt);
  return ensureWorkspaceFiles(input.workspace_dir);
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
  const payloadKeys = Array.isArray(input.payload_keys)
    ? input.payload_keys.filter((key): key is string => typeof key === "string" && key.length > 0)
    : [];
  const inlinePayloadMaxBytes = readInlinePayloadMaxBytes(input.inline_payload_max_bytes);

  await mkdir(logDir, { recursive: true });
  for (const key of payloadKeys) {
    if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
    const value = entry[key as keyof typeof entry];
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    const size = Buffer.byteLength(serialized, "utf8");
    if (size <= inlinePayloadMaxBytes) continue;

    const sha256 = sha256Hex(serialized);
    const payloadDir = path.join(logDir, "payloads", input.channel);
    const payloadFileName = [
      entry.timestamp.replace(/[:.]/g, "-"),
      sanitizePayloadKey(key),
      sha256.slice(0, 16),
    ].join("-");
    const payloadFile = path.join(payloadDir, `${payloadFileName}.json`);

    await mkdir(payloadDir, { recursive: true });
    await writeFile(payloadFile, serialized, "utf8");
    entry[key as keyof typeof entry] = {
      __workspace_log_payload: true,
      path: payloadFile,
      relative_path: path.relative(workspace.workspace_dir, payloadFile),
      size,
      sha256,
    } as never;
  }
  await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf8");

  return {
    workspace_dir: workspace.workspace_dir,
    log_file: logFile,
    appended: true,
  };
}

function createDefaultResearchPlanJson(workspace: AppWorkspaceResult) {
  const now = new Date().toISOString();
  return {
    version: 1,
    status: "empty",
    title: "",
    source: {
      outline_updated_at: normalizeString((normalizeOutlineJson(workspace.outline).updated_at)),
      page_plan_updated_at: normalizeString(getPlainRecord(workspace.page_plan).updated_at),
      template_group: normalizeString(getPlainRecord(workspace.template).selected_template_group),
      generated_by: "system",
    },
    pages: [],
    shared: {
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
    },
    updated_at: now,
  };
}

function createDefaultResearchEvidenceJson() {
  return {
    version: 1,
    status: "empty",
    pages: [],
    shared: {
      facts: [],
      visual_assets: [],
      gaps: [],
    },
    updated_at: new Date().toISOString(),
  };
}

function createDefaultResearchStatusJson() {
  return {
    version: 1,
    status: "idle",
    pages: [],
    updated_at: new Date().toISOString(),
  };
}

async function ensureResearchDirectories(workspaceDir: string): Promise<AppResearchPaths> {
  const paths = buildResearchPaths(workspaceDir);
  await Promise.all([
    mkdir(paths.raw_web_dir, { recursive: true }),
    mkdir(paths.raw_images_dir, { recursive: true }),
    mkdir(paths.evidence_pages_dir, { recursive: true }),
    mkdir(paths.evidence_images_dir, { recursive: true }),
    mkdir(paths.evidence_drafts_dir, { recursive: true }),
  ]);
  return paths;
}

export async function prepareAppResearchWorkspace(
  input: PrepareAppResearchWorkspaceInput,
): Promise<PrepareAppResearchWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const preparedAt = new Date().toISOString();

  if (!(await fileExists(paths.research_plan_path))) {
    await writeJsonFile(paths.research_plan_path, createDefaultResearchPlanJson(workspace));
  }
  if (!(await fileExists(paths.evidence_index_path))) {
    await writeJsonFile(paths.evidence_index_path, createDefaultResearchEvidenceJson());
  }
  if (!(await fileExists(paths.status_path))) {
    await writeJsonFile(paths.status_path, createDefaultResearchStatusJson());
  }

  await touchWorkspaceTask(workspace, preparedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    ...paths,
    prepared_at: preparedAt,
  };
}

function normalizeResearchArtifact(value: unknown, fallbackStatus: string): Record<string, unknown> {
  const record = getPlainRecord(value);
  return {
    version: typeof record.version === "number" ? record.version : 1,
    status: normalizeString(record.status) || fallbackStatus,
    ...record,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

function normalizeResearchPageRecord(value: unknown, label: string): Record<string, unknown> {
  const record = getPlainRecord(value);
  const pageId = normalizeString(record.page_id);
  if (pageId.length === 0) {
    throw new Error(`"${label}.page_id" must be a non-empty string`);
  }
  return {
    ...record,
    page_id: pageId,
    updated_at: new Date().toISOString(),
  };
}

function upsertResearchPage(
  pages: unknown,
  pageRecord: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const existingPages = Array.isArray(pages) ? pages.map(getPlainRecord) : [];
  const index = existingPages.findIndex((page) => normalizeString(page.page_id) === pageRecord.page_id);
  if (index < 0) {
    return [...existingPages, pageRecord];
  }
  return existingPages.map((page, pageIndex) => pageIndex === index ? pageRecord : page);
}

function computeResearchEvidenceStatus(pages: Array<Record<string, unknown>>): string {
  if (pages.length === 0) {
    return "empty";
  }
  if (pages.every((page) => normalizeString(page.status) === "curated" || normalizeString(page.status) === "skipped")) {
    return "curated";
  }
  return "partial";
}

function computeResearchAggregateStatus(pages: Array<Record<string, unknown>>): string {
  if (pages.some((page) => normalizeString(page.status) === "error")) {
    return "error";
  }
  if (pages.some((page) => normalizeString(page.status) === "gap")) {
    return "gap";
  }
  return "ready";
}

export async function recordAppResearchPlan(input: RecordAppResearchPlanInput): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const plan = normalizeResearchArtifact(input.research_plan, "planned");
  const next = {
    ...plan,
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.research_plan_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function getAppResearchPlan(input: GetAppResearchPlanInput): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const existing = await readJsonFileIfExists(paths.research_plan_path);
  if (existing === null) {
    const defaultPlan = createDefaultResearchPlanJson(workspace);
    await writeJsonFile(paths.research_plan_path, defaultPlan);
    return defaultPlan;
  }
  return normalizeResearchArtifact(existing, "empty");
}

export async function recordAppResearchEvidence(
  input: RecordAppResearchEvidenceInput,
): Promise<RecordAppResearchEvidenceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const evidence = normalizeResearchArtifact(input.evidence, "curated");
  const next = {
    ...evidence,
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.evidence_index_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return {
    workspace_dir: workspace.workspace_dir,
    status: normalizeString(evidence.status),
    evidence_index_path: paths.evidence_index_path,
    page_count: Array.isArray(evidence.pages) ? evidence.pages.length : 0,
    updated_at: updatedAt,
  };
}

export async function recordAppResearchEvidencePage(
  input: RecordAppResearchEvidencePageInput,
): Promise<RecordAppResearchEvidencePageResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const current = normalizeResearchArtifact(
    await readJsonFileIfExists(paths.evidence_index_path) ?? createDefaultResearchEvidenceJson(),
    "empty",
  );
  const pageEvidence = normalizeResearchPageRecord(input.page_evidence, "page_evidence");
  const pages = upsertResearchPage(current.pages, {
    ...pageEvidence,
    updated_at: updatedAt,
  });
  const shared = getPlainRecord(current.shared);
  const next = {
    ...current,
    version: 1,
    status: computeResearchEvidenceStatus(pages),
    pages,
    shared: {
      facts: Array.isArray(shared.facts) ? shared.facts : [],
      visual_assets: Array.isArray(shared.visual_assets) ? shared.visual_assets : [],
      gaps: Array.isArray(shared.gaps) ? shared.gaps : [],
    },
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.evidence_index_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return {
    workspace_dir: workspace.workspace_dir,
    page_id: normalizeString(pageEvidence.page_id),
    status: normalizeString(pageEvidence.status),
    evidence_index_path: paths.evidence_index_path,
    page_count: pages.length,
    updated_at: updatedAt,
  };
}

export async function getAppResearchEvidence(input: GetAppResearchEvidenceInput): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const existing = await readJsonFileIfExists(paths.evidence_index_path);
  if (existing === null) {
    const defaultEvidence = createDefaultResearchEvidenceJson();
    await writeJsonFile(paths.evidence_index_path, defaultEvidence);
    return defaultEvidence;
  }
  return normalizeResearchArtifact(existing, "empty");
}

export async function finalizeAppResearchVisualAssets(
  input: FinalizeAppResearchVisualAssetsInput,
): Promise<FinalizeAppResearchVisualAssetsResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const pageId = normalizeString(input.page_id);
  if (pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (!Array.isArray(input.visual_assets)) {
    throw new Error('"visual_assets" must be an array');
  }

  const visualAssets: FinalizeAppResearchVisualAssetsResult["visual_assets"] = [];
  const gaps: string[] = [];
  const rejectedMaterial: FinalizeAppResearchVisualAssetsResult["rejected_material"] = [];
  const uploadedSourcePaths = buildUploadedSourcePaths(workspace.workspace_dir);
  const rawMetadataByPath = await buildRawImageMetadataByPath(
    workspace.workspace_dir,
    input.raw_image_index_paths,
  );
  const rawMetadataEntries = await buildRawImageMetadataEntries(
    workspace.workspace_dir,
    input.raw_image_index_paths,
  );

  for (const rawAsset of input.visual_assets) {
    const asset = getPlainRecord(rawAsset);
    const assetId = normalizeString(asset.id);
    let originalRawPath = normalizeVisualAssetSourcePath(workspace.workspace_dir, asset.original_raw_path);
    let draftFilePath = normalizeVisualAssetSourcePath(workspace.workspace_dir, asset.file_path);
    let sourcePath = originalRawPath || draftFilePath;
    let rawMetadata = sourcePath ? rawMetadataByPath.get(sourcePath) : undefined;

    if (!assetId) {
      gaps.push("Visual asset was rejected because id is missing.");
      rejectedMaterial.push({ reason: "Visual asset was rejected because id is missing." });
      continue;
    }
    if (!sourcePath) {
      gaps.push(`Visual asset ${assetId} was rejected because no local source path was provided.`);
      rejectedMaterial.push({
        source: assetId,
        reason: "Visual asset was rejected because no local source path was provided.",
      });
      continue;
    }

    if (
      originalRawPath &&
      draftFilePath &&
      path.normalize(originalRawPath) !== path.normalize(draftFilePath)
    ) {
      rejectedMaterial.push({
        source: assetId,
        reason: "Visual asset file_path differed from original_raw_path; original_raw_path was used.",
      });
    }

    let isRawImage = isPathInsideDir(paths.raw_images_dir, sourcePath);
    let isEvidenceImage = isPathInsideDir(paths.evidence_images_dir, sourcePath);
    let isUploadedSourceImage = isPathInsideDir(uploadedSourcePaths.files_dir, sourcePath);
    if (!isRawImage && !isEvidenceImage && !isUploadedSourceImage) {
      const recoveredEntry = findRawImageMetadataEntryForAsset({
        entries: rawMetadataEntries,
        asset,
        draftPaths: [
          normalizeString(asset.original_raw_path),
          normalizeString(asset.file_path),
          sourcePath,
        ],
      });
      if (recoveredEntry === "ambiguous") {
        gaps.push(`Visual asset ${assetId} was rejected because its source path had an ambiguous raw image match.`);
        rejectedMaterial.push({
          source: assetId,
          reason: `Visual asset source path had an ambiguous raw image match: ${sourcePath}`,
        });
        continue;
      }
      if (recoveredEntry) {
        sourcePath = recoveredEntry.file_path;
        originalRawPath = recoveredEntry.file_path;
        draftFilePath = recoveredEntry.file_path;
        rawMetadata = recoveredEntry.metadata;
        rejectedMaterial.push({
          source: assetId,
          reason: "Visual asset source path was recovered from raw image index metadata because the draft path was not directly usable.",
        });
        isRawImage = isPathInsideDir(paths.raw_images_dir, sourcePath);
        isEvidenceImage = isPathInsideDir(paths.evidence_images_dir, sourcePath);
        isUploadedSourceImage = isPathInsideDir(uploadedSourcePaths.files_dir, sourcePath);
      }
    }
    if (!isRawImage && !isEvidenceImage && !isUploadedSourceImage) {
      gaps.push(`Visual asset ${assetId} was rejected because its source path is outside research image directories or uploaded-source directories.`);
      rejectedMaterial.push({
        source: assetId,
        reason: `Visual asset source path is outside research image directories or uploaded-source directories: ${sourcePath}`,
      });
      continue;
    }

    let sourceBytes: Buffer;
    try {
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) {
        gaps.push(`Visual asset ${assetId} was rejected because its source path is not a file.`);
        rejectedMaterial.push({
          source: assetId,
          reason: `Visual asset source path is not a file: ${sourcePath}`,
        });
        continue;
      }
      sourceBytes = await readFile(sourcePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      gaps.push(`Visual asset ${assetId} was rejected because its source file could not be read.`);
      rejectedMaterial.push({
        source: assetId,
        reason: `Visual asset source file could not be read: ${message}`,
      });
      continue;
    }

    const sha256 = sha256BufferHex(sourceBytes);
    const draftSha256 = normalizeString(asset.sha256);
    if (draftSha256 && draftSha256.toLowerCase() !== sha256) {
      rejectedMaterial.push({
        source: assetId,
        reason: `Visual asset draft sha256 did not match local file bytes; using computed sha256 ${sha256}.`,
      });
    }
    const metadataSha256 = rawMetadata ? normalizeString(rawMetadata.sha256) : "";
    if (metadataSha256 && metadataSha256.toLowerCase() !== sha256) {
      gaps.push(`Visual asset ${assetId} was rejected because raw image index sha256 did not match local file bytes.`);
      rejectedMaterial.push({
        source: assetId,
        reason: `Visual asset raw image index sha256 did not match local file bytes: expected ${metadataSha256}, computed ${sha256}.`,
      });
      continue;
    }
    const metadataImageUrl = rawMetadata ? readOptionalVisualAssetString(rawMetadata, "image_url") ?? readOptionalVisualAssetString(rawMetadata, "url") : undefined;
    const metadataPageUrl = rawMetadata ? readOptionalVisualAssetString(rawMetadata, "page_url") : undefined;
    const assetImageUrl = readOptionalVisualAssetString(asset, "image_url");
    const assetPageUrl = readOptionalVisualAssetString(asset, "page_url");
    if (assetImageUrl && metadataImageUrl && assetImageUrl !== metadataImageUrl) {
      rejectedMaterial.push({
        source: assetId,
        reason: "Visual asset image_url differed from raw image index metadata; draft image_url was preserved.",
      });
    }
    if (assetPageUrl && metadataPageUrl && assetPageUrl !== metadataPageUrl) {
      rejectedMaterial.push({
        source: assetId,
        reason: "Visual asset page_url differed from raw image index metadata; draft page_url was preserved.",
      });
    }

    const ext = path.extname(sourcePath) || ".bin";
    const outputFileName = [
      sanitizeFileNamePart(pageId, "page"),
      sanitizeFileNamePart(assetId, "asset"),
      sha256.slice(0, 16),
    ].join("-") + ext;
    const outputPath = path.join(paths.evidence_images_dir, outputFileName);

    if (!isEvidenceImage || sourcePath !== outputPath) {
      try {
        await mkdir(paths.evidence_images_dir, { recursive: true });
        await copyFile(sourcePath, outputPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        gaps.push(`Visual asset ${assetId} was rejected because it could not be copied into evidence images.`);
        rejectedMaterial.push({
          source: assetId,
          reason: `Visual asset could not be copied into evidence images: ${message}`,
        });
        continue;
      }
    }

    visualAssets.push({
      id: assetId,
      file_path: outputPath,
      original_raw_path: originalRawPath || (isRawImage || isUploadedSourceImage ? sourcePath : undefined),
      ...(assetImageUrl || metadataImageUrl ? { image_url: assetImageUrl ?? metadataImageUrl } : {}),
      ...(assetPageUrl || metadataPageUrl ? { page_url: assetPageUrl ?? metadataPageUrl } : {}),
      sha256,
      reason: normalizeString(asset.reason),
      visual_summary: normalizeString(asset.visual_summary),
    });
  }

  return {
    workspace_dir: workspace.workspace_dir,
    page_id: pageId,
    visual_assets: visualAssets,
    gaps,
    rejected_material: rejectedMaterial,
  };
}

function normalizeResearchDraftType(value: string): "web" | "visual" {
  if (value === "web" || value === "visual") {
    return value;
  }
  throw new Error('"draft_type" must be either "web" or "visual"');
}

function normalizeResearchDraftPageId(value: string): string {
  const pageId = normalizeString(value);
  if (!pageId) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(pageId)) {
    throw new Error('"page_id" may only contain letters, numbers, underscores, and hyphens');
  }
  return pageId;
}

function normalizeResearchDraftId(value: unknown): string | null {
  const draftId = normalizeString(value);
  if (!draftId) {
    return null;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(draftId)) {
    throw new Error('"draft_id" may only contain letters, numbers, underscores, and hyphens');
  }
  return draftId;
}

function buildResearchDraftPath(
  paths: AppResearchPaths,
  pageId: string,
  draftType: "web" | "visual",
  draftId?: string | null,
): string {
  const fileStem = draftId ?? pageId;
  return path.join(paths.evidence_drafts_dir, `${fileStem}-${draftType}.json`);
}

export async function recordAppResearchCurationDraft(
  input: RecordAppResearchCurationDraftInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const pageId = normalizeResearchDraftPageId(input.page_id);
  const draftType = normalizeResearchDraftType(input.draft_type);
  const draftId = normalizeResearchDraftId(input.draft_id);
  const draftPath = buildResearchDraftPath(paths, pageId, draftType, draftId);
  assertResearchPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");
  const updatedAt = new Date().toISOString();
  const draft = normalizeResearchArtifact(input.draft, "curated");
  const next = {
    ...draft,
    page_id: pageId,
    draft_type: draftType,
    draft_path: draftPath,
    updated_at: updatedAt,
  };
  await writeJsonFile(draftPath, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function getAppResearchCurationDraft(
  input: GetAppResearchCurationDraftInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const pageId = normalizeResearchDraftPageId(input.page_id);
  const draftType = normalizeResearchDraftType(input.draft_type);
  const draftId = normalizeResearchDraftId(input.draft_id);
  const draftPath = buildResearchDraftPath(paths, pageId, draftType, draftId);
  assertResearchPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");
  const existing = await readJsonFileIfExists(draftPath);
  if (existing === null) {
    return {
      version: 1,
      status: "empty",
      page_id: pageId,
      draft_type: draftType,
      draft_path: draftPath,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeResearchArtifact(existing, "empty");
}

export async function getAppResearchCurationDraftFingerprint(
  input: GetAppResearchCurationDraftFingerprintInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const pageId = normalizeResearchDraftPageId(input.page_id);
  const draftType = normalizeResearchDraftType(input.draft_type);
  const draftId = normalizeResearchDraftId(input.draft_id);
  const draftPath = buildResearchDraftPath(paths, pageId, draftType, draftId);
  assertResearchPathUnderWorkspace(workspace.workspace_dir, draftPath, "draft_path");

  try {
    const fingerprint = await fingerprintFile(draftPath);
    return {
      workspace_dir: workspace.workspace_dir,
      page_id: pageId,
      draft_type: draftType,
      ...(draftId ? { draft_id: draftId } : {}),
      draft_path: draftPath,
      exists: true,
      sha256: fingerprint.sha256,
      size_bytes: fingerprint.size_bytes,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        workspace_dir: workspace.workspace_dir,
        page_id: pageId,
        draft_type: draftType,
        ...(draftId ? { draft_id: draftId } : {}),
        draft_path: draftPath,
        exists: false,
      };
    }
    throw error;
  }
}

export async function recordAppResearchEvidencePageMarkdown(
  input: RecordAppResearchEvidencePageMarkdownInput,
): Promise<RecordAppResearchEvidencePageMarkdownResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const pageId = normalizeResearchDraftPageId(input.page_id);
  if (typeof input.markdown !== "string") {
    throw new Error('"markdown" must be a string');
  }
  const markdownPath = path.join(paths.evidence_pages_dir, `${pageId}.md`);
  assertResearchPathUnderWorkspace(workspace.workspace_dir, markdownPath, "markdown_path");
  const updatedAt = new Date().toISOString();
  await writeFile(markdownPath, input.markdown, "utf8");
  await touchWorkspaceTask(workspace, updatedAt);
  return {
    workspace_dir: workspace.workspace_dir,
    page_id: pageId,
    markdown_path: markdownPath,
    updated_at: updatedAt,
  };
}

export async function recordAppResearchStatus(input: RecordAppResearchStatusInput): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const status = normalizeResearchArtifact(input.status, "running");
  const next = {
    ...status,
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.status_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function recordAppResearchStatusPage(
  input: RecordAppResearchStatusPageInput,
): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const updatedAt = new Date().toISOString();
  const current = normalizeResearchArtifact(
    await readJsonFileIfExists(paths.status_path) ?? createDefaultResearchStatusJson(),
    "idle",
  );
  const pageStatus = normalizeResearchPageRecord(input.page_status, "page_status");
  const pages = upsertResearchPage(current.pages, {
    ...pageStatus,
    updated_at: updatedAt,
  });
  const next = {
    ...current,
    version: 1,
    status: computeResearchAggregateStatus(pages),
    pages,
    updated_at: updatedAt,
  };
  await writeJsonFile(paths.status_path, next);
  await touchWorkspaceTask(workspace, updatedAt);
  return next;
}

export async function getAppResearchStatus(input: GetAppResearchStatusInput): Promise<Record<string, unknown>> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const paths = await ensureResearchDirectories(workspace.workspace_dir);
  const existing = await readJsonFileIfExists(paths.status_path);
  if (existing === null) {
    const defaultStatus = createDefaultResearchStatusJson();
    await writeJsonFile(paths.status_path, defaultStatus);
    return defaultStatus;
  }
  return normalizeResearchArtifact(existing, "idle");
}

function buildPersistedOutline(
  outline: SaveAppWorkspaceOutlineDraftInput["outline"],
  status: "draft" | "confirmed",
  updatedAt: string,
): AppWorkspaceOutline {
  const title = normalizeOutlineLine(outline.title, "outline.title");
  if (!Array.isArray(outline.items) || outline.items.length === 0) {
    throw new Error("outline.items must contain at least one page");
  }
  return {
    version: 3,
    status,
    title,
    items: outline.items.map((item, index) => {
      const normalized = normalizeValidOutlineItem(item, index);
      return status === "confirmed"
        ? { ...normalized, page_id: `page-${randomUUID()}` }
        : normalized;
    }),
    updated_at: updatedAt,
    confirmed_at: status === "confirmed" ? updatedAt : null,
  };
}

function outlineContentSignature(outline: AppWorkspaceOutline): string {
  if (outline.status === "empty") return "";
  const items = outline.items
    .map((item) => JSON.stringify([
      item.title.trim(),
      item.core_message.trim(),
      item.required_content.trim(),
    ]))
    .sort();
  return JSON.stringify([outline.title.trim(), items]);
}

function getSelectedVisualTone(requirements: AppPresentationRequirements): string {
  const visualTone = requirements.selections.visual_tone;
  return visualTone ? JSON.stringify([visualTone.label.trim(), visualTone.description.trim()]) : "";
}

async function invalidateWorkspaceStyleGuide(workspace: AppWorkspaceResult): Promise<void> {
  await rm(workspace.files.style_guide, { force: true });
}

async function persistAppWorkspaceOutline(
  input: SaveAppWorkspaceOutlineDraftInput,
  status: "draft" | "confirmed",
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const requirements = normalizePresentationRequirements(workspace.requirements);
  if (requirements.status !== "confirmed") {
    throw new Error("Confirmed Presentation Requirements are required before saving an Outline.");
  }
  const updatedAt = new Date().toISOString();
  const nextOutline = buildPersistedOutline(input.outline, status, updatedAt);
  const nextRequirements: AppPresentationRequirements = {
    ...requirements,
    selections: {
      ...requirements.selections,
      slide_count: nextOutline.items.length,
    },
    updated_at: updatedAt,
    confirmed_at: updatedAt,
  };
  const currentTask = getPlainRecord(workspace.task);
  const currentOutline = normalizeOutlineJson(workspace.outline);
  if (outlineContentSignature(currentOutline) !== outlineContentSignature(nextOutline)) {
    await invalidateWorkspaceStyleGuide(workspace);
  }
  await writeJsonFile(workspace.files.outline, nextOutline);
  await writeJsonFile(workspace.files.requirements, nextRequirements);
  await writeJsonFile(workspace.files.task, {
    ...currentTask,
    title: nextOutline.title,
    updated_at: updatedAt,
  });
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function resetAppWorkspaceOutline(
  input: ResetAppWorkspaceOutlineInput,
): Promise<AppWorkspaceResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const requirements = normalizePresentationRequirements(workspace.requirements);
  if (requirements.status !== "confirmed") {
    throw new Error("Confirmed Presentation Requirements are required before resetting an Outline.");
  }
  const updatedAt = new Date().toISOString();
  await invalidateWorkspaceStyleGuide(workspace);
  await writeJsonFile(workspace.files.outline, createEmptyOutlineJson());
  await touchWorkspaceTask(workspace, updatedAt);
  return ensureWorkspaceFiles(input.workspace_dir);
}

export async function saveAppWorkspaceOutlineDraft(
  input: SaveAppWorkspaceOutlineDraftInput,
): Promise<AppWorkspaceResult> {
  return persistAppWorkspaceOutline(input, "draft");
}

export async function confirmAppWorkspaceOutline(
  input: ConfirmAppWorkspaceOutlineInput,
): Promise<AppWorkspaceResult> {
  return persistAppWorkspaceOutline(input, "confirmed");
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

function buildWorkspaceThemePaths(templateDir: string) {
  return {
    themeDir: path.join(templateDir, "theme"),
    tokenPath: path.join(templateDir, "theme", "token.json"),
    schemaPath: path.join(templateDir, "theme", "token.schema.json"),
    defaultTokenPath: path.join(templateDir, "theme", "token.default.json"),
    readmePath: path.join(templateDir, "theme", "README.md"),
  };
}

function assertTemplateContainedPath(templateDir: string, filePath: string, fieldName: string): void {
  const normalizedTemplateDir = path.normalize(templateDir);
  const normalizedFilePath = path.normalize(filePath);
  const relativePath = path.relative(normalizedTemplateDir, normalizedFilePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`"${fieldName}" must stay inside the selected template directory`);
  }
}

async function readRequiredThemeJsonFile(filePath: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Selected template is missing ${label}: ${filePath}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${label}: ${message}`);
  }
}

async function readRequiredThemeTextFile(filePath: string, label: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Selected template is missing ${label}: ${filePath}`);
    }
    throw error;
  }
}

function formatAjvError(error: ErrorObject): string {
  const pathText = error.instancePath || "/";
  const message = error.message ?? "is invalid";
  const params = Object.keys(error.params ?? {}).length > 0
    ? ` ${JSON.stringify(error.params)}`
    : "";
  return `${pathText} ${message}${params}`;
}

function validateThemeTokenAgainstSchema(
  token: unknown,
  schema: Record<string, unknown>,
  sourcePath: string,
): AppWorkspaceThemeValidationResult {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const schemaOk = validate(token);
  const errors = schemaOk
    ? []
    : (validate.errors ?? []).map(formatAjvError);

  if (schemaOk) {
    try {
      validateThemeTokenRecord(token, sourcePath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function readSelectedTemplateThemeContext(
  workspace: AppWorkspaceResult,
): Promise<Omit<AppWorkspaceThemeContext, "current_token" | "current_token_validation">> {
  const templateDir = readSelectedTemplateDir(workspace);
  const paths = buildWorkspaceThemePaths(templateDir);
  for (const [fieldName, filePath] of Object.entries(paths)) {
    if (fieldName === "themeDir") continue;
    assertTemplateContainedPath(templateDir, filePath, fieldName);
  }

  const schemaValue = await readRequiredThemeJsonFile(paths.schemaPath, "Template Theme Contract schema");
  const schema = getPlainRecord(schemaValue);
  if (Object.keys(schema).length === 0) {
    throw new Error(`Template Theme Contract schema must be a JSON object: ${paths.schemaPath}`);
  }

  const defaultToken = await readRequiredThemeJsonFile(paths.defaultTokenPath, "Template Theme Contract default token");
  const defaultValidation = validateThemeTokenAgainstSchema(defaultToken, schema, paths.defaultTokenPath);
  if (!defaultValidation.ok) {
    throw new Error(
      `Template default theme token does not satisfy its schema: ${defaultValidation.errors.join("; ")}`,
    );
  }

  const readme = await readRequiredThemeTextFile(paths.readmePath, "Template Theme Contract README");

  return {
    workspace_dir: workspace.workspace_dir,
    template_dir: templateDir,
    token_path: paths.tokenPath,
    schema_path: paths.schemaPath,
    default_token_path: paths.defaultTokenPath,
    readme_path: paths.readmePath,
    schema,
    default_token: defaultToken,
    readme,
  };
}

async function readCurrentWorkspaceThemeToken(
  tokenPath: string,
  schema: Record<string, unknown>,
): Promise<Pick<AppWorkspaceThemeContext, "current_token" | "current_token_validation">> {
  if (!(await fileExists(tokenPath))) {
    return {
      current_token: null,
      current_token_validation: null,
    };
  }

  try {
    const token = JSON.parse(await readFile(tokenPath, "utf8")) as unknown;
    return {
      current_token: token,
      current_token_validation: validateThemeTokenAgainstSchema(token, schema, tokenPath),
    };
  } catch (error) {
    return {
      current_token: null,
      current_token_validation: {
        ok: false,
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

async function withThemeTokenWriteQueue<T>(
  workspaceDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.normalize(workspaceDir);
  const previous = themeTokenWriteQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.catch(() => undefined);
  themeTokenWriteQueues.set(queueKey, tail);

  try {
    return await run;
  } finally {
    if (themeTokenWriteQueues.get(queueKey) === tail) {
      themeTokenWriteQueues.delete(queueKey);
    }
  }
}

export async function getAppWorkspaceThemeContext(
  input: GetAppWorkspaceThemeContextInput,
): Promise<AppWorkspaceThemeContext> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const context = await readSelectedTemplateThemeContext(workspace);
  const current = await readCurrentWorkspaceThemeToken(context.token_path, context.schema);
  return {
    ...context,
    ...current,
  };
}

export async function validateAppWorkspaceThemeToken(
  input: ValidateAppWorkspaceThemeTokenInput,
): Promise<AppWorkspaceThemeValidationResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const context = await readSelectedTemplateThemeContext(workspace);
  return validateThemeTokenAgainstSchema(input.token, context.schema, context.token_path);
}

export async function recordAppWorkspaceThemeToken(
  input: RecordAppWorkspaceThemeTokenInput,
): Promise<RecordAppWorkspaceThemeTokenResult> {
  return withThemeTokenWriteQueue(input.workspace_dir, async () => {
    const workspace = await ensureWorkspaceFiles(input.workspace_dir);
    const context = await readSelectedTemplateThemeContext(workspace);
    const fallbackUsed = input.use_default === true;
    const token = fallbackUsed ? context.default_token : input.token;
    if (token === undefined) {
      throw new Error('"token" is required unless "use_default" is true');
    }

    const validation = validateThemeTokenAgainstSchema(token, context.schema, context.token_path);
    if (validation.ok) {
      await writeJsonFile(context.token_path, token);
      await touchWorkspaceTask(workspace, new Date().toISOString());
    }

    return {
      workspace: await ensureWorkspaceFiles(input.workspace_dir),
      workspace_dir: workspace.workspace_dir,
      token_path: context.token_path,
      fallback_used: fallbackUsed,
      validation,
      token,
    };
  });
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
  const result = await buildDeckHtmlPagesAndScreenshotsFromManifest({
    manifestPath,
    outputDir,
    name: `${workspace.workspace_id}-review`,
  });
  const slides = result.slides.map((slide) => ({
    slide_id: slide.slideId,
    layout_id: slide.layoutId,
    title: slide.title,
    html_path: slide.htmlPath,
    screenshot_path: slide.screenshotPath,
    speaker_note: slide.speakerNote,
  }));
  const currentProgress = normalizePageProgressJson(workspace.page_progress);
  const renderedByPageId = new Map(slides.map((slide) => [slide.slide_id, slide]));
  const nextProgress: AppPageProgress = {
    ...currentProgress,
    final_deck_render: {
      status: "completed",
      message: null,
      error: null,
      output_dir: result.outputDir,
      deck_html_path: slides[0]?.html_path ?? null,
      rendered_at: renderedAt,
      updated_at: renderedAt,
    },
    pages: currentProgress.pages.map((page) => {
      const rendered = renderedByPageId.get(page.page_id);
      return rendered ? {
        ...page,
        last_html_path: rendered.html_path,
        last_screenshot_path: rendered.screenshot_path,
        updated_at: renderedAt,
      } : page;
    }),
    updated_at: renderedAt,
  };
  await writeJsonFile(workspace.files.page_progress, nextProgress);
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

async function assertExistingFile(filePath: string, label: string): Promise<string> {
  if (!filePath) {
    throw new Error(`${label} is missing`);
  }

  const normalizedPath = path.normalize(filePath);
  let fileStat;
  try {
    fileStat = await stat(normalizedPath);
  } catch {
    throw new Error(`${label} is unavailable: ${normalizedPath}`);
  }
  if (!fileStat.isFile()) {
    throw new Error(`${label} is not a file: ${normalizedPath}`);
  }

  return normalizedPath;
}

export async function getRenderedAppWorkspaceDeckHtml(
  input: RenderAppWorkspaceDeckHtmlInput,
): Promise<RenderAppWorkspaceDeckHtmlResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const manifestRecord = getPlainRecord(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const manifestSlides = Array.isArray(manifestRecord.slides)
    ? manifestRecord.slides.map((slide) => getPlainRecord(slide))
    : [];
  const progress = normalizePageProgressJson(workspace.page_progress);
  if (progress.final_deck_render.status !== "completed" || progress.pages.length === 0) {
    throw new Error("Rendered deck pages are unavailable");
  }
  if (manifestSlides.length !== progress.pages.length) {
    throw new Error("Rendered deck page count does not match the selected template manifest");
  }

  const slides = await Promise.all(
    progress.pages.map(async (page, index) => {
      const manifestSlide = manifestSlides[index] ?? {};
      const pageId = page.page_id;
      const manifestPageId = readPageIdFromManifestSlide(manifestSlide);
      if (!pageId || pageId !== manifestPageId) {
        throw new Error(`Rendered deck page ${index + 1} does not match the selected template manifest`);
      }

      const htmlPath = await assertExistingFile(page.last_html_path, `Rendered deck HTML for ${pageId}`);
      const screenshotPath = await assertExistingFile(
        page.last_screenshot_path,
        `Rendered deck screenshot for ${pageId}`,
      );

      return {
        slide_id: pageId,
        layout_id: normalizeString(manifestSlide.layout_id),
        title: normalizeString(manifestSlide.title) || pageId,
        html_path: htmlPath,
        screenshot_path: screenshotPath,
        speaker_note: normalizeString(manifestSlide.speaker_note),
      };
    }),
  );

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: manifestPath,
    output_dir: progress.final_deck_render.output_dir ?? "",
    slides,
    slide_count: slides.length,
    title: normalizeString(manifestRecord.title),
    rendered_at: progress.final_deck_render.rendered_at ?? progress.updated_at ?? "",
  };
}

async function launchPdfBrowser(): Promise<any> {
  const puppeteerModule = await import("puppeteer");
  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  return launchManagedBrowser(puppeteer, {
    purpose: "app PDF export",
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
  return withExportArtifactWriteQueue(workspace.workspace_dir, async () => {
    const current = await ensureWorkspaceFiles(workspace.workspace_dir);
    const updatedAt = new Date().toISOString();
    const existing =
      current.task && typeof current.task === "object" && !Array.isArray(current.task)
        ? (current.task as Record<string, unknown>)
        : {};
    const existingArtifacts =
      existing.artifacts && typeof existing.artifacts === "object" && !Array.isArray(existing.artifacts)
        ? (existing.artifacts as Record<string, unknown>)
        : {};

    await writeJsonFile(current.files.task, {
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

    return ensureWorkspaceFiles(current.workspace_dir);
  });
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
    htmlFilePath: result.deckOutputPath,
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

async function runPptxExportModelJob(job: AppPptxExportJob): Promise<void> {
  try {
    const prepared = await prepareAppExportModel({
      workspace_dir: job.workspace_dir,
    });
    await writePptxExportJob({
      ...job,
      status: "model_ready",
      message: "PPTX model is ready.",
      percent: 50,
      html_path: prepared.html_path,
      model_path: prepared.model_path,
      output_dir: prepared.output_dir,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : undefined;
    await writePptxExportJob({
      ...job,
      status: "failed",
      message,
      percent: 100,
      completed_at: new Date().toISOString(),
      error: {
        message,
        ...(stack ? { stack } : {}),
      },
    });
  }
}

export async function startAppPptxExportModel(
  input: StartAppPptxExportModelInput,
): Promise<AppPptxExportJob> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const current = await getAppPptxExportStatus({
    workspace_dir: workspace.workspace_dir,
  });

  if (current.status === "preparing_model" || current.status === "generating_pptx") {
    return current;
  }

  const job = createPptxExportJob(workspace.workspace_dir);
  const written = await writePptxExportJob(job);

  void runPptxExportModelJob(written);

  return written;
}

export async function getAppPptxExportStatus(input: {
  workspace_dir: string;
}): Promise<AppPptxExportJob> {
  const workspaceDir = normalizeWorkspaceDir(input.workspace_dir);
  const paths = buildPptxExportPaths(workspaceDir);
  const existing = await readJsonFileIfExists(paths.statusPath);

  if (existing === null) {
    return createPptxExportJob(workspaceDir, {
      job_id: "",
      status: "idle",
      message: "",
      percent: 0,
      started_at: null,
      updated_at: null,
      status_path: paths.statusPath,
      output_dir: paths.outputDir,
      model_path: paths.modelPath,
      pptx_path: paths.pptxPath,
    });
  }

  return normalizePptxExportJob(existing, workspaceDir);
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

export async function getAppExportArtifact(
  input: GetAppExportArtifactInput,
): Promise<AppExportArtifactInfo> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const artifactType = input.artifact_type;
  if (artifactType !== "pptx" && artifactType !== "pdf") {
    throw new Error('"artifact_type" must be "pptx" or "pdf"');
  }

  const task =
    workspace.task && typeof workspace.task === "object" && !Array.isArray(workspace.task)
      ? (workspace.task as Record<string, unknown>)
      : {};
  const artifacts =
    task.artifacts && typeof task.artifacts === "object" && !Array.isArray(task.artifacts)
      ? (task.artifacts as Record<string, unknown>)
      : {};
  const artifact =
    artifacts[artifactType] && typeof artifacts[artifactType] === "object" && !Array.isArray(artifacts[artifactType])
      ? (artifacts[artifactType] as Record<string, unknown>)
      : {};
  const artifactPath = typeof artifact.path === "string" ? path.normalize(artifact.path) : "";

  if (!artifactPath) {
    throw new Error(`No ${artifactType.toUpperCase()} export artifact is recorded for this workspace`);
  }
  assertAbsolutePath(artifactPath, `${artifactType}_path`);
  const artifactStat = await stat(artifactPath);
  if (!artifactStat.isFile()) {
    throw new Error(`${artifactType.toUpperCase()} export artifact is not a file: ${artifactPath}`);
  }

  const workspaceTitle = (await getWorkspaceSummary(workspace.workspace_dir)).title;
  const updatedAt = typeof artifact.updated_at === "string" && artifact.updated_at.length > 0
    ? artifact.updated_at
    : artifactStat.mtime.toISOString();

  return {
    workspace_dir: workspace.workspace_dir,
    workspace_id: workspace.workspace_id,
    title: workspaceTitle,
    artifact_type: artifactType,
    path: artifactPath,
    filename: `${sanitizeFileNameBase(workspaceTitle || workspace.workspace_id)}.${artifactType}`,
    updated_at: updatedAt,
    mirror: normalizeExportArtifactMirror(artifact.mirror),
  };
}

function normalizeExportArtifactMirror(value: unknown): AppExportArtifactMirror | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const sizeBytes = Number(record.size_bytes);
  if (
    record.provider !== "aps.files" ||
    record.scope !== "app" ||
    typeof record.path !== "string" ||
    record.path.length === 0 ||
    typeof record.etag !== "string" ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes < 0 ||
    typeof record.content_type !== "string" ||
    record.content_type.length === 0 ||
    typeof record.content_disposition !== "string" ||
    !/^attachment(?:;|$)/i.test(record.content_disposition) ||
    typeof record.source_updated_at !== "string" ||
    record.source_updated_at.length === 0 ||
    typeof record.source_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(record.source_sha256) ||
    typeof record.published_at !== "string" ||
    record.published_at.length === 0
  ) {
    return null;
  }
  return {
    provider: "aps.files",
    scope: "app",
    path: record.path,
    etag: record.etag,
    size_bytes: Math.floor(sizeBytes),
    content_type: record.content_type,
    content_disposition: record.content_disposition,
    source_updated_at: record.source_updated_at,
    source_sha256: record.source_sha256.toLowerCase(),
    published_at: record.published_at,
  };
}

function exportArtifactContentType(artifactType: "pptx" | "pdf"): string {
  return artifactType === "pptx"
    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    : "application/pdf";
}

async function sha256FileHex(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sourceFileChanged(
  before: { size: number; mtimeMs: number },
  after: { size: number; mtimeMs: number },
): boolean {
  return before.size !== after.size || before.mtimeMs !== after.mtimeMs;
}

export async function createAppExportArtifactSnapshot(
  input: GetAppExportArtifactInput,
): Promise<AppExportArtifactSnapshot> {
  const artifact = await getAppExportArtifact(input);
  const before = await stat(artifact.path);
  const snapshotDir = path.join(os.tmpdir(), "ppt-engine-export-snapshots");
  const snapshotPath = path.join(
    snapshotDir,
    `${artifact.workspace_id}-${artifact.artifact_type}-${randomUUID()}.${artifact.artifact_type}`,
  );
  await mkdir(snapshotDir, { recursive: true });
  try {
    await copyFile(artifact.path, snapshotPath);
    const after = await stat(artifact.path);
    if (sourceFileChanged(before, after)) {
      throw new Error("Export artifact changed while its upload snapshot was being created");
    }
    const [sourceSha256, snapshotStat] = await Promise.all([
      sha256FileHex(snapshotPath),
      stat(snapshotPath),
    ]);
    return {
      ...artifact,
      snapshot_path: snapshotPath,
      source_sha256: sourceSha256,
      size_bytes: snapshotStat.size,
      content_type: exportArtifactContentType(artifact.artifact_type),
      mirror_path: `workspaces/${artifact.workspace_id}/exports/current.${artifact.artifact_type}`,
    };
  } catch (error) {
    await unlink(snapshotPath).catch(() => undefined);
    throw error;
  }
}

export async function commitAppExportArtifactMirror(
  input: CommitAppExportArtifactMirrorInput,
): Promise<AppExportArtifactMirror> {
  return withExportArtifactWriteQueue(input.workspace_dir, async () => {
    const artifact = await getAppExportArtifact(input);
    if (artifact.updated_at !== input.expected_updated_at) {
      throw new Error("Export artifact changed while its APS mirror was being published");
    }
    const sourceSha256 = await sha256FileHex(artifact.path);
    if (sourceSha256 !== input.expected_sha256.toLowerCase()) {
      throw new Error("Export artifact content changed while its APS mirror was being published");
    }
    if (
      input.mirror.provider !== "aps.files" ||
      input.mirror.scope !== "app" ||
      input.mirror.source_updated_at !== input.expected_updated_at ||
      input.mirror.source_sha256.toLowerCase() !== input.expected_sha256.toLowerCase()
    ) {
      throw new Error("Export artifact mirror does not match the expected source version");
    }

    const workspace = await ensureWorkspaceFiles(input.workspace_dir);
    const task = workspace.task && typeof workspace.task === "object" && !Array.isArray(workspace.task)
      ? (workspace.task as Record<string, unknown>)
      : {};
    const artifacts = task.artifacts && typeof task.artifacts === "object" && !Array.isArray(task.artifacts)
      ? (task.artifacts as Record<string, unknown>)
      : {};
    const current = artifacts[input.artifact_type] && typeof artifacts[input.artifact_type] === "object" && !Array.isArray(artifacts[input.artifact_type])
      ? (artifacts[input.artifact_type] as Record<string, unknown>)
      : {};
    if (current.updated_at !== input.expected_updated_at) {
      throw new Error("Export artifact changed before its APS mirror could be recorded");
    }

    const mirror = normalizeExportArtifactMirror(input.mirror);
    if (!mirror) {
      throw new Error("Export artifact mirror is invalid");
    }
    await writeJsonFile(workspace.files.task, {
      ...task,
      artifacts: {
        ...artifacts,
        [input.artifact_type]: {
          ...current,
          mirror,
        },
      },
    });
    return mirror;
  });
}

export async function getAppExportArtifactMirrorStatus(
  input: GetAppExportArtifactInput,
): Promise<AppExportArtifactMirrorStatus> {
  const artifact = await getAppExportArtifact(input);
  if (!artifact.mirror) {
    return {
      status: "missing",
      reason: "mirror_missing",
      artifact,
      mirror: null,
    };
  }
  if (artifact.mirror.source_updated_at !== artifact.updated_at) {
    return {
      status: "stale",
      reason: "artifact_version_changed",
      artifact,
      mirror: artifact.mirror,
    };
  }
  const sourceSha256 = await sha256FileHex(artifact.path);
  if (sourceSha256 !== artifact.mirror.source_sha256) {
    return {
      status: "stale",
      reason: "source_hash_changed",
      artifact,
      mirror: artifact.mirror,
    };
  }
  return {
    status: "ready",
    reason: null,
    artifact,
    mirror: artifact.mirror,
  };
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

async function fingerprintFile(filePath: string) {
  const [bytes, fileStat] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ]);
  if (!fileStat.isFile()) {
    throw new Error(`Target page file is not a file: ${filePath}`);
  }
  return {
    path: filePath,
    sha256: sha256BufferHex(bytes),
    size_bytes: fileStat.size,
  };
}

export async function getAppWorkspacePageFileFingerprints(
  input: GetAppWorkspacePageFileFingerprintsInput,
): Promise<GetAppWorkspacePageFileFingerprintsResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const templateDir = path.dirname(manifestPath);
  const slidePath = resolveTemplateRelativePath(templateDir, normalizeString(input.slide_path));
  const dataPath = resolveTemplateRelativePath(templateDir, normalizeString(input.data_path));

  const [slide, data] = await Promise.all([
    fingerprintFile(slidePath),
    fingerprintFile(dataPath),
  ]);

  return {
    workspace_dir: workspace.workspace_dir,
    slide,
    data,
  };
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
    recovery: {
      status: "idle",
      run_kind: null,
      step: null,
      target_page_ids: [],
      page_refinement_request: null,
      page_refinement_requests: {},
      deck_refinement_review: null,
      error: null,
      updated_at: now,
    },
    final_deck_render: {
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      rendered_at: null,
      updated_at: now,
    },
    pages: pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      status: "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      slide_path: page.slide_path,
      data_path: page.data_path,
      last_html_path: "",
      last_screenshot_path: "",
      last_error: "",
      visual_review: null,
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

export async function prepareAppDeckRefinementPageFiles(
  input: PrepareAppDeckRefinementPageFilesInput,
): Promise<PrepareAppDeckRefinementPageFilesResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const pagePlan = normalizePagePlanJson(workspace.page_plan);
  const context = await validatePagePlanAgainstTemplate(workspace, pagePlan);
  const templateDir = context.template_dir;
  const preparedAt = new Date().toISOString();
  const newPageIds = new Set((input.new_page_ids ?? []).map(normalizeString).filter(Boolean));

  if (pagePlan.pages.length === 0) {
    throw new Error("page-plan.json has no pages to prepare");
  }

  for (const page of pagePlan.pages) {
    if (!newPageIds.has(page.page_id)) continue;
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

  const currentProgress = normalizePageProgressJson(workspace.page_progress);
  const currentProgressById = new Map(currentProgress.pages.map((page) => [page.page_id, page]));
  const nextProgress: AppPageProgress = {
    ...currentProgress,
    status: currentProgress.status === "idle" ? "prepared" : currentProgress.status,
    final_deck_render: {
      ...currentProgress.final_deck_render,
      status: "idle",
      message: null,
      error: null,
      output_dir: null,
      deck_html_path: null,
      rendered_at: null,
      updated_at: preparedAt,
    },
    pages: preparedPlan.pages.map((page) => {
      const existing = currentProgressById.get(page.page_id);
      if (existing && !newPageIds.has(page.page_id)) {
        return {
          ...existing,
          index: page.index,
          title: page.title,
          slide_path: page.slide_path,
          data_path: page.data_path,
          updated_at: preparedAt,
        };
      }
      return {
        page_id: page.page_id,
        index: page.index,
        title: page.title,
        status: "pending",
        render_attempts: 0,
        visual_review_attempts: 0,
        agent_failures: 0,
        agent_infrastructure_failures: 0,
        slide_path: page.slide_path,
        data_path: page.data_path,
        last_html_path: "",
        last_screenshot_path: "",
        last_error: "",
        visual_review: null,
        updated_at: preparedAt,
      };
    }),
    updated_at: preparedAt,
  };

  const activePageIds = new Set(preparedPlan.pages.map((page) => page.page_id));
  const existingPagesRecord = getPlainRecord(workspace.pages);
  const existingRenderedPages = Array.isArray(existingPagesRecord.pages)
    ? existingPagesRecord.pages
    : [];
  const nextRenderedPages = existingRenderedPages
    .filter((page) => activePageIds.has(normalizeString(getPlainRecord(page).page_id)))
    .map((page) => {
      const record = getPlainRecord(page);
      const planPage = preparedPlan.pages.find((item) => item.page_id === normalizeString(record.page_id));
      return {
        ...record,
        index: planPage?.index ?? record.index,
        title: planPage?.title ?? record.title,
      };
    });

  await writeJsonFile(context.manifest_path, nextManifest);
  await writeJsonFile(workspace.files.page_plan, preparedPlan);
  await writeJsonFile(workspace.files.page_progress, nextProgress);
  await writeJsonFile(workspace.files.pages, {
    ...existingPagesRecord,
    status: nextRenderedPages.length === preparedPlan.pages.length ? existingPagesRecord.status : "stale",
    title: preparedPlan.title,
    pages: nextRenderedPages,
    updated_at: preparedAt,
  });
  await touchWorkspaceTask(workspace, preparedAt);

  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: context.manifest_path,
    page_plan_path: workspace.files.page_plan,
    prepared_at: preparedAt,
    new_page_ids: Array.from(newPageIds),
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

export async function recordAppWorkspaceStyleGuide(
  input: RecordAppWorkspaceStyleGuideInput,
): Promise<RecordAppWorkspaceStyleGuideResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  assertAbsolutePath(input.staging_file_path, "staging_file_path");
  const expectedSizeBytes = Math.floor(input.expected_size_bytes);
  if (!Number.isFinite(expectedSizeBytes) || expectedSizeBytes <= 0) {
    throw new Error('"expected_size_bytes" must be a positive integer');
  }
  const bytes = await readFile(input.staging_file_path);
  if (bytes.length !== expectedSizeBytes) {
    throw new Error(
      `Style Guide size mismatch: expected ${expectedSizeBytes} bytes, got ${bytes.length} bytes`,
    );
  }
  if (bytes.toString("utf8").trim().length === 0) {
    throw new Error("Workspace Style Guide must not be empty");
  }
  await writeFile(workspace.files.style_guide, bytes);
  const updatedAt = new Date().toISOString();
  await touchWorkspaceTask(workspace, updatedAt);
  return {
    workspace_dir: workspace.workspace_dir,
    style_guide_path: workspace.files.style_guide,
    size_bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    updated_at: updatedAt,
  };
}

export async function getAppWorkspaceStyleGuideStatus(
  input: GetAppWorkspaceStyleGuideStatusInput,
): Promise<GetAppWorkspaceStyleGuideStatusResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  try {
    const bytes = await readFile(workspace.files.style_guide);
    return {
      workspace_dir: workspace.workspace_dir,
      style_guide_path: workspace.files.style_guide,
      exists: true,
      non_empty: bytes.toString("utf8").trim().length > 0,
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        workspace_dir: workspace.workspace_dir,
        style_guide_path: workspace.files.style_guide,
        exists: false,
        non_empty: false,
        size_bytes: 0,
      };
    }
    throw error;
  }
}

export async function initializeAppPageProgress(
  input: InitializeAppPageProgressInput,
): Promise<AppPageProgress> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const outline = normalizeOutlineJson(workspace.outline);
  if (outline.status !== "confirmed") {
    throw new Error("Confirmed Outline is required before initializing Page Progress");
  }
  const styleGuide = await readFile(workspace.files.style_guide, "utf8").catch(() => "");
  if (!styleGuide.trim()) {
    throw new Error("Workspace Style Guide is required before initializing Page Progress");
  }
  for (const item of outline.items) {
    if (!item.page_id) throw new Error("Confirmed Outline item is missing page_id");
    if (!(await fileExists(path.join(workspace.workspace_dir, "slides", `${item.page_id}.tsx`)))) {
      throw new Error(`Page Source is missing for page_id "${item.page_id}"`);
    }
  }
  const updatedAt = new Date().toISOString();
  const progress: AppPageProgress = {
    ...createDefaultPageProgressJson(),
    status: "running",
    pages: outline.items.map((item) => ({
      page_id: item.page_id as string,
      status: "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_html_path: "",
      last_screenshot_path: "",
      last_error: "",
      visual_review: null,
      updated_at: updatedAt,
    })),
    updated_at: updatedAt,
  };
  await writeJsonFile(workspace.files.page_progress, progress);
  await touchWorkspaceTask(workspace, updatedAt);
  return progress;
}

export async function recordAppPageProgress(
  input: RecordAppPageProgressInput,
): Promise<AppPageProgress> {
  return withPageProgressWriteQueue(input.workspace_dir, async () => {
    const workspace = await ensureWorkspaceFiles(input.workspace_dir);
    const current = normalizePageProgressJson(workspace.page_progress);
    const updatedAt = new Date().toISOString();
    const pageId = normalizeString(input.page_id);
    const nextPages = current.pages.map((page) => {
      if (!pageId || page.page_id !== pageId) return page;
      return normalizePageProgressItem({
        ...page,
        ...input.patch,
        page_id: page.page_id,
        updated_at: updatedAt,
      }) as AppPageProgressItem;
    });

    if (pageId && !current.pages.some((page) => page.page_id === pageId)) {
      throw new Error(`Unknown page_id "${pageId}" in page-progress.json`);
    }

    const patchRecord = getPlainRecord(input.patch);
    const recoveryPatch = isRecord(patchRecord.recovery) ? patchRecord.recovery : {};
    const finalDeckRenderPatch = isRecord(patchRecord.final_deck_render)
      ? patchRecord.final_deck_render
      : {};
    const researchDiscoveryPatch = isRecord(patchRecord.research_discovery)
      ? normalizeResearchDiscoveryProgress(patchRecord.research_discovery)
      : undefined;
    const recovery = normalizePageProgressRecoveryState({
      ...current.recovery,
      ...recoveryPatch,
      updated_at: Object.keys(recoveryPatch).length > 0 ? updatedAt : current.recovery.updated_at,
    });
    const finalDeckRender = normalizeFinalDeckRenderState({
      ...current.final_deck_render,
      ...finalDeckRenderPatch,
      updated_at: Object.keys(finalDeckRenderPatch).length > 0
        ? updatedAt
        : current.final_deck_render.updated_at,
    });
    const nextProgress: AppPageProgress = {
      version: 1,
      status: normalizeString(input.patch.deck_status) || current.status || "running",
      recovery,
      final_deck_render: finalDeckRender,
      research_discovery: researchDiscoveryPatch ?? current.research_discovery,
      pages: nextPages,
      updated_at: updatedAt,
    };

    await writeJsonFile(workspace.files.page_progress, nextProgress);
    await touchWorkspaceTask(workspace, updatedAt);
    return nextProgress;
  });
}

export async function renderAppWorkspacePagePreview(
  input: RenderAppWorkspacePagePreviewInput,
): Promise<RenderAppWorkspacePagePreviewResult> {
  const workspace = await ensureWorkspaceFiles(input.workspace_dir);
  const manifestPath = readSelectedTemplateManifestPath(workspace);
  const manifest = getPlainRecord(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const slides = Array.isArray(manifest.slides) ? manifest.slides.map(getPlainRecord) : [];
  const pageIndex = slides.findIndex((slide) => normalizeString(slide.id) === input.page_id);
  if (pageIndex < 0) throw new Error(`Unknown page_id "${input.page_id}" in manifest.json`);

  const pageNumber = pageIndex + 1;
  const renderedAt = new Date().toISOString();
  const htmlOutputDir = path.join(workspace.workspace_dir, "output", "page-preview-html");
  const screenshotOutputDir = path.join(workspace.workspace_dir, "output", "screenshots");
  const localSlide = await readManifestLocalSlideSourcePath({
    manifestPath,
    pageIndex,
  });
  if (localSlide) {
    await assertLocalTemplateTypecheck({
      entryPath: localSlide.absolutePath,
      cwd: path.dirname(manifestPath),
      label: `slide "${localSlide.slideId}"`,
    });
  }
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
    page_index: pageIndex,
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
  AppExportArtifactInfo,
  ExportAppPdfInput,
  ExportAppPdfResult,
  AppTemplatePlanningBlueprint,
  AppTemplatePlanningContext,
  AppTemplateGroupSummary,
  AppTemplatePreviewRef,
  AppTemplatePreviewResult,
  AppCreateWorkspaceSetting,
  AppPresentationRequirementCandidate,
  AppPresentationRequirements,
  AppPresentationRequirementsCandidates,
  AppPresentationRequirementsSelections,
  AppWorkspaceFiles,
  AppWorkspaceOutline,
  AppWorkspaceOutlineItem,
  AppWorkspaceResult,
  AppWorkspaceSummary,
  AppWorkspaceTemplateSelection,
  CreateAppWorkspaceInput,
  CreateAppWorkspaceResult,
  DuplicateAppWorkspacePageInput,
  GetAppPagePlanInput,
  GetAppPageProgressInput,
  GetAppTemplateGroupInput,
  GetAppTemplatePlanningContextInput,
  GetAppTemplatePreviewInput,
  GetAppWorkspaceThemeContextInput,
  GetAppWorkspaceOutlineInput,
  GetAppWorkspaceRequirementsInput,
  ListAppTemplateGroupsResult,
  ListAppWorkspacesResult,
  OpenAppWorkspaceInput,
  PatchAppWorkspaceSettingsResult,
  PrepareAppPageFilesInput,
  PrepareAppPageFilesResult,
  PrepareAppExportModelInput,
  PrepareAppExportModelResult,
  RecordAppPagePlanInput,
  RecordAppPageProgressInput,
  RecordAppWorkspaceStyleGuideInput,
  RecordAppWorkspaceStyleGuideResult,
  GetAppWorkspaceStyleGuideStatusInput,
  GetAppWorkspaceStyleGuideStatusResult,
  InitializeAppPageProgressInput,
  RecordAppWorkspaceThemeTokenInput,
  RecordAppWorkspaceThemeTokenResult,
  RecordAppPdfExportInput,
  RecordAppPptxExportInput,
  GetAppExportArtifactInput,
  RenderAppWorkspaceDeckHtmlInput,
  RenderAppWorkspaceDeckHtmlResult,
  RenderAppWorkspacePagePreviewInput,
  RenderAppWorkspacePagePreviewResult,
  SelectAppWorkspaceTemplateInput,
  SelectAppWorkspaceTemplateResult,
  ConfirmAppWorkspaceOutlineInput,
  ResetAppWorkspaceOutlineInput,
  SaveAppWorkspaceOutlineDraftInput,
  UpdateAppWorkspaceRequirementsInput,
  UpdateAppWorkspacePagesInput,
  UpdateAppWorkspaceSettingsInput,
  UpdateAppWorkspaceTitleInput,
  ValidateAppWorkspaceThemeTokenInput,
  AppWorkspaceThemeContext,
  AppWorkspaceThemeValidationResult,
} from "./types.js";
