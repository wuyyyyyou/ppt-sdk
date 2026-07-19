#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { createReadStream, readFileSync } from "node:fs";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { parseHostUploadConfirmation } from "./host-upload-confirmation.js";
import { ApsFilesClient, ApsFilesError } from "./aps-files-client.js";

import {
  appendAppWorkspaceLog,
  buildDeckHtmlFromManifest,
  convertDeckHtmlToPptxModel,
  createAppWorkspace,
  duplicateAppWorkspacePage,
  ensureConfirmedOutlinePageIds,
  createAppExportArtifactSnapshot,
  commitAppExportArtifactMirror,
  getAppExportArtifactMirrorStatus,
  exportAppPdf,
  forkTemplateGroup,
  getAppWorkspaceDefaults,
  getAppTemplateGroup,
  getAppTemplatePlanningContext,
  getAppWorkspaceThemeContext,
  getAppTemplatePreview,
  getAppWorkspacePageFileFingerprints,
  getAppPagePlan,
  getAppPageProgress,
  getAppPptxExportStatus,
  getRenderedAppWorkspaceDeckHtml,
  fingerprintWorkspacePageSource,
  installWorkspaceAuthoringKit,
  listAppUploadedSources,
  commitAppUploadedSourceUpload,
  getAppUploadedSourceAnalysis,
  getAppUploadedSourceAnalysisDraft,
  getAppUploadedSourceAnalysisDraftFingerprint,
  getAppResearchCurationDraft,
  getAppResearchCurationDraftFingerprint,
  getAppResearchEvidence,
  getAppResearchPlan,
  getAppResearchStatus,
  finalizeAppResearchVisualAssets,
  getAllDiscoveredTemplateGroups,
  getAppWorkspaceOutline,
  getAppWorkspaceRequirements,
  getDiscoveredTemplateGroup,
  listAppWorkspaces,
  listAppStyleProfiles,
  getAppStyleProfile,
  getAppStyleProfilePreview,
  prepareAppStyleProfileCreation,
  commitAppStyleProfileReferenceUpload,
  getAppStyleProfileCreationContext,
  getAppStyleProfileDraft,
  getAppStyleProfileDraftFingerprint,
  publishAppStyleProfile,
  selectAppWorkspaceStyleProfile,
  getAppWorkspaceStyleProfile,
  clearAppWorkspaceStyleProfile,
  listAppTemplateGroups,
  listDiscoveredTemplateGroupSummaries,
  openAppWorkspace,
  patchAppWorkspaceSettings,
  prepareAppDeckRefinementPageFiles,
  prepareAppPageRefinement,
  commitAppDeckRefinement,
  prepareAppPageFiles,
  prepareAppExportModel,
  prepareAppWorkspaceDiagnosticBundle,
  prepareAppUploadedSourceAnalysisWorkspace,
  prepareAppResearchWorkspace,
  prepareWorkspacePageSources,
  reconcileWorkspacePageSources,
  recordAppWorkspaceStyleGuide,
  getAppWorkspaceStyleGuideStatus,
  getAppWorkspaceStyleGuide,
  initializeAppPageProgress,
  recordAppPagePlan,
  recordAppPageProgress,
  recordAppPdfExport,
  recordAppPptxExport,
  recordAppResearchCurationDraft,
  recordAppResearchEvidence,
  recordAppResearchEvidencePage,
  recordAppResearchEvidencePageMarkdown,
  recordAppResearchPlan,
  recordAppResearchStatus,
  recordAppResearchStatusPage,
  recordAppWorkspaceThemeToken,
  rebuildWorkspaceDeckManifest,
  removeAppUploadedSource,
  recordAppUploadedSourceAnalysis,
  recordAppUploadedSourceAnalysisDraft,
  rasterizePptxToImages,
  renderAppWorkspaceDeckHtml,
  renderAppWorkspacePagePreview,
  selectAppWorkspaceTemplate,
  startAppPptxExportModel,
  invokeTaskStateMachine,
  confirmAppWorkspaceOutline,
  resetAppWorkspaceOutline,
  saveAppWorkspaceOutlineDraft,
  updateAppWorkspaceRequirements,
  updateAppWorkspacePages,
  updateAppWorkspaceSettings,
  updateAppWorkspaceTitle,
  validateAppWorkspaceThemeToken,
} from "./dist/index.js";

const TASK_STATE_MACHINE_TOOL_NAMES = [
  "create_task_project",
  "open_task_project",
  "query_task_state",
  "record_requirements",
  "record_template_selection",
  "record_outline",
  "record_page_plan",
  "start_page_iteration",
  "record_page_progress",
  "record_deck_review_feedback",
  "advance_task_state",
  "rewind_task_state",
  "branch_task_project",
  "list_task_checkpoints",
  "recover_task_project",
  "validate_task_project",
];
const FILE_TRANSPORT_DIRNAME = ".executa-file-transport";
const FILE_TRANSPORT_FALLBACK_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "file-transport",
);
const MAX_STDOUT_RESPONSE_BYTES = 512 * 1024;
const PROTOCOL_VERSION_V2 = "2.0";
const HOST_UPLOAD_METHOD = "host/uploadFile";
const UPLOAD_ERR_NOT_GRANTED = -32201;
const UPLOAD_ERR_TIMEOUT = -32208;
const UPLOAD_ERR_NOT_NEGOTIATED = -32210;

function readToolManifest() {
  return JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
}

const MANIFEST = readToolManifest();

function makeResponse(id, result, error) {
  const response = { jsonrpc: "2.0", id };
  if (error !== undefined) {
    response.error = error;
  } else {
    response.result = result;
  }
  return response;
}

function createInvalidParamsError(message) {
  return { code: -32602, message };
}

class HostUploadError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = "HostUploadError";
    this.code = code;
    this.data = data;
  }
}

class ExecutaHostUploadClient {
  constructor() {
    this.pending = new Map();
    this.disabledReason = "host/uploadFile has not been negotiated; call initialize with Executa protocol 2.0 first.";
  }

  enable() {
    this.disabledReason = "";
  }

  disable(reason) {
    this.disabledReason = reason || "host/uploadFile is not available.";
  }

  dispatchResponse(message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || "method" in message) {
      return false;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return false;
    }
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new HostUploadError(
        Number.isInteger(message.error.code) ? message.error.code : -32603,
        typeof message.error.message === "string" ? message.error.message : "host/uploadFile failed",
        message.error.data,
      ));
      return true;
    }
    pending.resolve(message.result ?? {});
    return true;
  }

  async negotiate({ filename, mimeType, sizeBytes, purpose, metadata }) {
    return this.call({
      mode: "negotiate",
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      purpose,
      metadata,
    });
  }

  async confirm(r2Key) {
    return this.call({
      mode: "confirm",
      r2_key: r2Key,
    });
  }

  async call(params, timeoutMs = 120_000) {
    if (this.disabledReason) {
      process.stderr.write(
        `host/uploadFile proceeding without negotiated initialize: ${this.disabledReason}\n`,
      );
    }

    const id = `host-upload-${Date.now()}-${process.pid}-${randomUUID()}`;
    const message = {
      jsonrpc: "2.0",
      id,
      method: HOST_UPLOAD_METHOD,
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined),
      ),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new HostUploadError(
          UPLOAD_ERR_TIMEOUT,
          `${HOST_UPLOAD_METHOD} timed out after ${timeoutMs}ms`,
        ));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      writeStdoutLine(JSON.stringify(message)).catch((error) => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}

const hostUploadClient = new ExecutaHostUploadClient();
const apsFilesClient = new ApsFilesClient({
  writeFrame: (message) => writeStdoutLine(JSON.stringify(message)),
});
const exportMirrorPublishQueues = new Map();
const workspaceDiagnosticBundleQueues = new Map();

async function withExportMirrorPublishQueue(queueKey, operation) {
  const previous = exportMirrorPublishQueues.get(queueKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  exportMirrorPublishQueues.set(queueKey, current);
  try {
    return await current;
  } finally {
    if (exportMirrorPublishQueues.get(queueKey) === current) {
      exportMirrorPublishQueues.delete(queueKey);
    }
  }
}

async function withWorkspaceDiagnosticBundleQueue(workspaceDir, operation) {
  const previous = workspaceDiagnosticBundleQueues.get(workspaceDir) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  workspaceDiagnosticBundleQueues.set(workspaceDir, current);
  try {
    return await current;
  } finally {
    if (workspaceDiagnosticBundleQueues.get(workspaceDir) === current) {
      workspaceDiagnosticBundleQueues.delete(workspaceDir);
    }
  }
}

function formatRpcId(id) {
  if (id === null) {
    return "null";
  }

  if (id === undefined) {
    return "undefined";
  }

  return String(id);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function truncateForLog(value, maxLength = 160) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function parseJsonArrayArgument(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDiscoveryInput(args = {}) {
  const input = {};

  if (args.include_builtin !== undefined) {
    input.include_builtin = Boolean(args.include_builtin);
  }

  if (args.local_roots !== undefined) {
    const localRoots = parseJsonArrayArgument(args.local_roots);
    if (!Array.isArray(localRoots) || localRoots.some((item) => typeof item !== "string")) {
      throw new Error('"local_roots" must be an array of strings');
    }
    localRoots.forEach((item, index) => {
      assertAbsolutePath(item, `local_roots[${index}]`);
    });
    input.local_roots = localRoots;
  }

  if (args.cwd !== undefined) {
    if (typeof args.cwd !== "string" || args.cwd.length === 0) {
      throw new Error('"cwd" must be a non-empty string when provided');
    }
    assertAbsolutePath(args.cwd, "cwd");
    input.cwd = args.cwd;
  }

  return input;
}

function assertAbsolutePath(value, parameterName) {
  if (!path.isAbsolute(value)) {
    throw new Error(`"${parameterName}" must be an absolute path`);
  }
}

function readRequiredAbsolutePathArg(args, parameterName) {
  const value = args?.[parameterName];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required parameter: "${parameterName}"`);
  }

  assertAbsolutePath(value, parameterName);
  return path.normalize(value);
}

function readOptionalAbsolutePathArg(args, parameterName) {
  const value = args?.[parameterName];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`"${parameterName}" must be a non-empty string when provided`);
  }

  assertAbsolutePath(value, parameterName);
  return path.normalize(value);
}

function readOptionalStringArg(args, parameterName) {
  const value = args?.[parameterName];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`"${parameterName}" must be a non-empty string when provided`);
  }
  return value;
}

function readRequiredStringArg(args, parameterName) {
  const value = args?.[parameterName];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required parameter: "${parameterName}"`);
  }
  return value;
}

const UPLOADED_SOURCE_STAGING_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "uploaded-source-staging",
);
const STYLE_PROFILE_REFERENCE_STAGING_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "style-profile-reference-staging",
);
const STYLE_GUIDE_STAGING_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "style-guide-staging",
);

function assertSafeUploadFilename(filename) {
  if (typeof filename !== "string" || filename.trim().length === 0) {
    throw new Error('"filename" must be a non-empty string');
  }
  const trimmed = filename.trim();
  if (trimmed.includes("/") || trimmed.includes("\\") || path.basename(trimmed) !== trimmed) {
    throw new Error('"filename" must not contain path separators');
  }
  return trimmed;
}

function buildAttachmentContentDisposition(filename) {
  assertSafeUploadFilename(filename);
  const baseName = path.basename(filename);
  const fallback = baseName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_") || "download";
  const encoded = encodeURIComponent(baseName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function readHostUploadRefArg(args, parameterName = "host_upload") {
  const value = args?.[parameterName];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${parameterName}" must be a HostUploadRef object`);
  }
  if (value.transport !== "host_upload") {
    throw new Error(`"${parameterName}.transport" must be "host_upload"`);
  }
  if (typeof value.r2_key !== "string" || value.r2_key.trim().length === 0) {
    throw new Error(`"${parameterName}.r2_key" must be a non-empty string`);
  }
  if (typeof value.url !== "string" || value.url.trim().length === 0) {
    throw new Error(`"${parameterName}.url" must be a non-empty string`);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(value.url);
  } catch {
    throw new Error(`"${parameterName}.url" must be a valid URL`);
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error(`"${parameterName}.url" must use HTTPS`);
  }
  if (typeof value.mime_type !== "string" || value.mime_type.trim().length === 0) {
    throw new Error(`"${parameterName}.mime_type" must be a non-empty string`);
  }
  const sizeBytes = Number(value.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error(`"${parameterName}.size_bytes" must be a positive number`);
  }
  return {
    transport: "host_upload",
    r2_key: value.r2_key,
    url: value.url,
    mime_type: value.mime_type,
    size_bytes: Math.floor(sizeBytes),
    filename: typeof value.filename === "string" ? value.filename : undefined,
    expires_at: typeof value.expires_at === "string" ? value.expires_at : undefined,
    expires_in: typeof value.expires_in === "number" ? value.expires_in : undefined,
    mode: "negotiate+confirm",
  };
}

async function downloadHostUploadToStaging({ hostUpload, stagingPath, expectedSizeBytes }) {
  const response = await fetch(hostUpload.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Host Upload download failed: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Host Upload download returned an empty response body.");
  }

  await mkdir(path.dirname(stagingPath), { recursive: true });
  const handle = await open(stagingPath, "w");
  let receivedBytes = 0;
  try {
    for await (const chunk of Readable.fromWeb(response.body)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > expectedSizeBytes) {
        throw new Error(
          `Host Upload size mismatch: expected ${expectedSizeBytes} bytes, got more than ${expectedSizeBytes} bytes.`,
        );
      }
      await handle.write(buffer);
    }
  } finally {
    await handle.close();
  }

  if (receivedBytes !== expectedSizeBytes || receivedBytes !== hostUpload.size_bytes) {
    throw new Error(
      `Host Upload size mismatch: expected ${expectedSizeBytes} bytes, got ${receivedBytes} bytes.`,
    );
  }
  return receivedBytes;
}

async function uploadLocalFileToHost({ filePath, filename, mimeType, purpose }) {
  const normalizedPath = path.normalize(filePath);
  const fileStat = await stat(normalizedPath);
  if (!fileStat.isFile()) {
    throw new Error(`Host Upload source path is not a file: ${normalizedPath}`);
  }
  const safeFilename = assertSafeUploadFilename(filename || path.basename(normalizedPath));
  if (typeof mimeType !== "string" || mimeType.trim().length === 0 || mimeType === "application/octet-stream") {
    throw new Error(`Host Upload MIME type must be specific for ${safeFilename}`);
  }
  const sizeBytes = fileStat.size;
  const negotiated = await hostUploadClient.negotiate({
    filename: safeFilename,
    mimeType: mimeType.trim(),
    sizeBytes,
    purpose: purpose || "user_artifact",
  });
  if (!negotiated || typeof negotiated.put_url !== "string" || typeof negotiated.r2_key !== "string") {
    throw new Error("host/uploadFile negotiate returned an invalid response");
  }
  const putResponse = await fetch(negotiated.put_url, {
    method: "PUT",
    headers: {
      ...(negotiated.headers ?? {}),
      "Content-Length": String(sizeBytes),
    },
    body: createReadStream(normalizedPath),
    duplex: "half",
  });
  if (!putResponse.ok) {
    const message = await putResponse.text().catch(() => "");
    throw new Error(message || `Host Upload PUT failed: HTTP ${putResponse.status}`);
  }
  const confirmed = await hostUploadClient.confirm(negotiated.r2_key);
  return parseHostUploadConfirmation({
    confirmed,
    negotiated,
    mimeType: mimeType.trim(),
    fallbackSizeBytes: sizeBytes,
    filename: safeFilename,
  });
}

async function uploadJsonToHost(value, filename) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  return uploadBufferToHost({
    buffer: body,
    filename,
    mimeType: "application/json",
    purpose: "user_artifact",
  });
}

async function uploadBufferToHost({ buffer, filename, mimeType, purpose }) {
  const safeFilename = assertSafeUploadFilename(filename);
  if (!Buffer.isBuffer(buffer) || buffer.byteLength <= 0) {
    throw new Error(`Host Upload buffer must not be empty for ${safeFilename}`);
  }
  if (typeof mimeType !== "string" || mimeType.trim().length === 0 || mimeType === "application/octet-stream") {
    throw new Error(`Host Upload MIME type must be specific for ${safeFilename}`);
  }
  const negotiated = await hostUploadClient.negotiate({
    filename: safeFilename,
    mimeType: mimeType.trim(),
    sizeBytes: buffer.byteLength,
    purpose: purpose || "user_artifact",
  });
  if (!negotiated || typeof negotiated.put_url !== "string" || typeof negotiated.r2_key !== "string") {
    throw new Error("host/uploadFile negotiate returned an invalid response");
  }
  const putResponse = await fetch(negotiated.put_url, {
    method: "PUT",
    headers: {
      ...(negotiated.headers ?? {}),
      "Content-Length": String(buffer.byteLength),
    },
    body: buffer,
  });
  if (!putResponse.ok) {
    const message = await putResponse.text().catch(() => "");
    throw new Error(message || `Host Upload PUT failed: HTTP ${putResponse.status}`);
  }
  const confirmed = await hostUploadClient.confirm(negotiated.r2_key);
  return parseHostUploadConfirmation({
    confirmed,
    negotiated,
    mimeType: mimeType.trim(),
    fallbackSizeBytes: buffer.byteLength,
    filename: safeFilename,
  });
}

async function uploadPreviewImage(imagePath) {
  return uploadLocalFileToHost({
    filePath: imagePath,
    filename: `${path.basename(imagePath, path.extname(imagePath)) || "slide"}.png`,
    mimeType: "image/png",
    purpose: "user_artifact",
  });
}

async function registerJsonReference(value, filename, uploadFieldName) {
  return {
    [uploadFieldName]: await uploadJsonToHost(value, filename),
  };
}

async function registerWorkspaceJsonReference(value) {
  return registerJsonReference(value, "workspace.json", "workspace_upload");
}

function parseRequestLine(line) {
  try {
    return {
      request: JSON.parse(line),
      parseErrorResponse: null,
    };
  } catch {
    return {
      request: null,
      parseErrorResponse: makeResponse(null, undefined, {
        code: -32700,
        message: "Parse error",
      }),
    };
  }
}

function summarizeIncomingRequest(request, rawLine) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return `← invalid-json raw=${truncateForLog(rawLine)}`;
  }

  const id = formatRpcId(request.id);
  const method = isNonEmptyString(request.method) ? request.method : "<missing>";

  if (method !== "invoke") {
    return `← method=${method} id=${id}`;
  }

  const tool = isNonEmptyString(request.params?.tool) ? request.params.tool : "<missing>";
  return `← method=invoke id=${id} tool=${tool}`;
}

function summarizeResponse(request, response) {
  const id = formatRpcId(response?.id);

  if (response?.error) {
    return `id=${id} error_code=${response.error.code} error_message=${JSON.stringify(response.error.message)}`;
  }

  if (request?.method === "invoke") {
    const tool = isNonEmptyString(request.params?.tool) ? request.params.tool : "<missing>";
    return `id=${id} tool=${tool} status=success`;
  }

  return `id=${id} status=success`;
}

function shouldUseFileTransport(request) {
  return request?.method === "invoke";
}

async function resolveTransportDirectories(request) {
  const candidates = [];
  const requestedCwd = request?.params?.arguments?.cwd;

  if (isNonEmptyString(requestedCwd)) {
    try {
      assertAbsolutePath(requestedCwd, "cwd");
      const cwdStat = await stat(requestedCwd);
      if (cwdStat.isDirectory()) {
        candidates.push(path.join(path.normalize(requestedCwd), FILE_TRANSPORT_DIRNAME));
      }
    } catch {
      // Ignore invalid or inaccessible cwd and fall back to the plugin temp directory.
    }
  }

  candidates.push(FILE_TRANSPORT_FALLBACK_DIR);
  return [...new Set(candidates)];
}

async function writeStdoutLine(payload) {
  await new Promise((resolve, reject) => {
    process.stdout.write(`${payload}\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function buildTransportFileName() {
  return `executa-resp-${Date.now()}-${process.pid}-${randomUUID()}.json`;
}

async function writeResponseToTransportFile(serializedResponse, transportDir) {
  await mkdir(transportDir, { recursive: true });
  const transportPath = path.join(transportDir, buildTransportFileName());
  await writeFile(transportPath, serializedResponse, "utf8");
  return transportPath;
}

async function emitResponse(request, response) {
  const serializedResponse = JSON.stringify(response);
  const responseBytes = Buffer.byteLength(serializedResponse, "utf8");

  if (!shouldUseFileTransport(request)) {
    await writeStdoutLine(serializedResponse);
    process.stderr.write(`→ stdout ${summarizeResponse(request, response)} bytes=${responseBytes}\n`);
    return;
  }

  try {
    const transportDirectories = await resolveTransportDirectories(request);
    let lastError = null;

    for (const transportDir of transportDirectories) {
      try {
        const transportPath = await writeResponseToTransportFile(serializedResponse, transportDir);
        const pointer = JSON.stringify({
          jsonrpc: "2.0",
          id: response.id ?? null,
          __trans_file__: transportPath,
          __file_transport: transportPath,
        });
        await writeStdoutLine(pointer);
        process.stderr.write(
          `→ file_transport ${summarizeResponse(request, response)} bytes=${responseBytes} path=${transportPath}\n`,
        );
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("No writable transport directory available");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown file transport error";
    const fallbackResponse = responseBytes <= MAX_STDOUT_RESPONSE_BYTES
      ? response
      : makeResponse(response.id ?? null, undefined, {
        code: -32603,
        message: `Failed to write file transport response: ${message}`,
      });
    const fallbackSerialized = JSON.stringify(fallbackResponse);
    const fallbackBytes = Buffer.byteLength(fallbackSerialized, "utf8");

    await writeStdoutLine(fallbackSerialized);
    process.stderr.write(
      `→ stdout_fallback ${summarizeResponse(request, fallbackResponse)} bytes=${fallbackBytes} transport_error=${JSON.stringify(message)}\n`,
    );
  }
}

async function toolListDiscoveredTemplateGroupSummaries(args) {
  const input = normalizeDiscoveryInput(args);
  const groups = await listDiscoveredTemplateGroupSummaries(input);
  return {
    groups,
    count: groups.length,
  };
}

async function toolAppListWorkspaces() {
  return listAppWorkspaces();
}

async function toolAppGetWorkspaceDefaults() {
  return getAppWorkspaceDefaults();
}

async function toolAppCreateWorkspace(args) {
  if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
    throw new Error("Arguments must be an object");
  }

  const title =
    typeof args?.title === "string" && args.title.trim().length > 0
      ? args.title.trim()
      : undefined;

  return createAppWorkspace({ title });
}

async function toolAppOpenWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return registerWorkspaceJsonReference(await openAppWorkspace({ workspace_dir: workspaceDir }));
}

async function toolAppInstallWorkspaceAuthoringKit(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return installWorkspaceAuthoringKit({ workspace_dir: workspaceDir });
}

async function toolAppEnsureConfirmedOutlinePageIds(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return ensureConfirmedOutlinePageIds({ workspace_dir: workspaceDir });
}

async function toolAppPrepareWorkspacePageSources(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return prepareWorkspacePageSources({
    workspace_dir: workspaceDir,
    reset_existing: args?.reset_existing === true,
  });
}

async function toolAppReconcileWorkspacePageSources(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return reconcileWorkspacePageSources({ workspace_dir: workspaceDir });
}

async function toolAppCommitWorkspaceStyleGuideHostUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const hostUpload = readHostUploadRefArg(args, "host_upload");
  if (hostUpload.mime_type !== "text/markdown") {
    throw new Error('Workspace Style Guide Host Upload MIME type must be "text/markdown"');
  }
  const sizeBytes = Number(args.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || Math.floor(sizeBytes) !== hostUpload.size_bytes) {
    throw new Error("Workspace Style Guide Host Upload size mismatch");
  }
  const stagingPath = path.join(STYLE_GUIDE_STAGING_DIR, `${randomUUID()}.md`);
  try {
    await downloadHostUploadToStaging({
      hostUpload,
      stagingPath,
      expectedSizeBytes: Math.floor(sizeBytes),
    });
    return await recordAppWorkspaceStyleGuide({
      workspace_dir: workspaceDir,
      staging_file_path: stagingPath,
      expected_size_bytes: Math.floor(sizeBytes),
    });
  } finally {
    await unlink(stagingPath).catch(() => undefined);
  }
}

async function toolAppGetWorkspaceStyleGuideStatus(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppWorkspaceStyleGuideStatus({ workspace_dir: workspaceDir });
}

async function toolAppGetWorkspaceStyleGuide(args) {
  return getAppWorkspaceStyleGuide({ workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir") });
}

async function toolAppPreparePageRefinement(args) {
  return prepareAppPageRefinement({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    page_id: readRequiredStringArg(args, "page_id"),
    refinement_request: readRequiredStringArg(args, "refinement_request"),
  });
}

async function toolAppCommitDeckRefinement(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const styleAction = readRequiredStringArg(args, "style_guide_action");
  let stagingPath;
  let expectedSizeBytes;
  if (styleAction === "regenerate") {
    const uploadArgs = args.style_guide_upload;
    if (!uploadArgs || typeof uploadArgs !== "object" || Array.isArray(uploadArgs)) {
      throw new Error('"style_guide_upload" is required when regenerating the Style Guide');
    }
    const hostUpload = readHostUploadRefArg(uploadArgs, "host_upload");
    if (hostUpload.mime_type !== "text/markdown") throw new Error('Replacement Style Guide MIME type must be "text/markdown"');
    expectedSizeBytes = Number(uploadArgs.size_bytes);
    if (!Number.isFinite(expectedSizeBytes) || Math.floor(expectedSizeBytes) !== hostUpload.size_bytes) {
      throw new Error("Replacement Style Guide Host Upload size mismatch");
    }
    stagingPath = path.join(STYLE_GUIDE_STAGING_DIR, `${randomUUID()}.md`);
    await downloadHostUploadToStaging({ hostUpload, stagingPath, expectedSizeBytes: Math.floor(expectedSizeBytes) });
  }
  try {
    return await commitAppDeckRefinement({
      workspace_dir: workspaceDir,
      refinement_request: readRequiredStringArg(args, "refinement_request"),
      title: readRequiredStringArg(args, "title"),
      output_language_change: args.output_language_change ?? { changed: false },
      style_guide_action: styleAction,
      style_guide_staging_file_path: stagingPath,
      style_guide_expected_size_bytes: expectedSizeBytes,
      operations: Array.isArray(args.operations) ? args.operations : [],
    });
  } finally {
    if (stagingPath) await unlink(stagingPath).catch(() => undefined);
  }
}

async function toolAppInitializePageProgress(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return initializeAppPageProgress({ workspace_dir: workspaceDir });
}

async function toolAppRebuildWorkspaceDeckManifest(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return rebuildWorkspaceDeckManifest({ workspace_dir: workspaceDir });
}

async function toolAppGetWorkspacePageSourceFingerprint(args) {
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args?.page_id !== "string" || args.page_id.length === 0) {
    throw new Error('Missing required parameter: "page_id"');
  }
  return fingerprintWorkspacePageSource({
    workspace_dir: workspaceDir,
    page_id: args.page_id,
  });
}

async function toolAppCommitUploadedSourceHostUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const filename = assertSafeUploadFilename(args.filename);
  const hostUpload = readHostUploadRefArg(args, "host_upload");
  const sizeBytes = Number(args.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('"size_bytes" must be a positive number');
  }
  if (Math.floor(sizeBytes) !== hostUpload.size_bytes) {
    throw new Error(`Host Upload size mismatch: input size_bytes=${Math.floor(sizeBytes)} host_upload.size_bytes=${hostUpload.size_bytes}`);
  }
  const mimeType = typeof args.mime_type === "string" && args.mime_type.trim().length > 0
    ? args.mime_type.trim()
    : hostUpload.mime_type;
  if (mimeType !== hostUpload.mime_type) {
    throw new Error("Host Upload MIME type mismatch.");
  }
  if (filename !== (hostUpload.filename || filename)) {
    throw new Error("Host Upload filename mismatch.");
  }

  const uploadId = randomUUID();
  const stagingPath = path.join(UPLOADED_SOURCE_STAGING_DIR, `${uploadId}.upload`);
  try {
    await downloadHostUploadToStaging({
      hostUpload,
      stagingPath,
      expectedSizeBytes: Math.floor(sizeBytes),
    });
    const result = await commitAppUploadedSourceUpload({
      workspace_dir: workspaceDir,
      upload_id: uploadId,
      filename,
      mime_type: mimeType,
      staging_file_path: stagingPath,
      expected_size_bytes: Math.floor(sizeBytes),
    });
    return {
      ...result,
      host_upload: hostUpload,
    };
  } finally {
    await unlink(stagingPath).catch(() => undefined);
  }
}

async function toolAppListStyleProfiles() {
  return listAppStyleProfiles();
}

async function readStyleProfileIdArg(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.style_profile_id !== "string" || args.style_profile_id.trim().length === 0) {
    throw new Error('"style_profile_id" must be a non-empty string');
  }
  return args.style_profile_id;
}

async function uploadStyleProfileReferenceImagePreview(image) {
  const { file_path, ...publicImage } = image;
  return {
    ...publicImage,
    image_upload: await uploadLocalFileToHost({
      filePath: file_path,
      filename: image.filename,
      mimeType: image.mime_type,
      purpose: "image_reference",
    }),
  };
}

async function toolAppGetStyleProfilePreview(args) {
  const styleProfileId = await readStyleProfileIdArg(args);
  const result = await getAppStyleProfilePreview({ style_profile_id: styleProfileId });
  return {
    ...result,
    cover_image: result.cover_image
      ? await uploadStyleProfileReferenceImagePreview(result.cover_image)
      : null,
  };
}

async function toolAppGetStyleProfile(args) {
  const styleProfileId = await readStyleProfileIdArg(args);
  const result = await getAppStyleProfile({ style_profile_id: styleProfileId });
  return {
    ...result,
    reference_images: await Promise.all(
      result.reference_images.map((image) => uploadStyleProfileReferenceImagePreview(image)),
    ),
  };
}

async function toolAppPrepareStyleProfileCreation(args) {
  if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
    throw new Error("Arguments must be an object");
  }

  return prepareAppStyleProfileCreation({
    display_name: readOptionalStringArg(args ?? {}, "display_name"),
  });
}

async function toolAppCommitStyleProfileReferenceHostUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  const creationId = args.creation_id;
  const filename = assertSafeUploadFilename(args.filename);
  const hostUpload = readHostUploadRefArg(args, "host_upload");
  const sizeBytes = Number(args.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('"size_bytes" must be a positive number');
  }
  if (Math.floor(sizeBytes) !== hostUpload.size_bytes) {
    throw new Error(`Host Upload size mismatch: input size_bytes=${Math.floor(sizeBytes)} host_upload.size_bytes=${hostUpload.size_bytes}`);
  }
  const mimeType = typeof args.mime_type === "string" && args.mime_type.trim().length > 0
    ? args.mime_type.trim()
    : hostUpload.mime_type;
  if (mimeType !== hostUpload.mime_type) {
    throw new Error("Host Upload MIME type mismatch.");
  }
  if (filename !== (hostUpload.filename || filename)) {
    throw new Error("Host Upload filename mismatch.");
  }

  const uploadId = randomUUID();
  const stagingPath = path.join(STYLE_PROFILE_REFERENCE_STAGING_DIR, `${uploadId}.upload`);
  try {
    await downloadHostUploadToStaging({
      hostUpload,
      stagingPath,
      expectedSizeBytes: Math.floor(sizeBytes),
    });
    const result = await commitAppStyleProfileReferenceUpload({
      creation_id: creationId,
      upload_id: uploadId,
      filename,
      mime_type: mimeType,
      staging_file_path: stagingPath,
      expected_size_bytes: Math.floor(sizeBytes),
    });
    return {
      ...result,
      host_upload: hostUpload,
    };
  } finally {
    await unlink(stagingPath).catch(() => undefined);
  }
}

async function toolAppGetStyleProfileCreationContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  return getAppStyleProfileCreationContext({ creation_id: args.creation_id });
}

async function toolAppGetStyleProfileDraftFingerprint(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  return getAppStyleProfileDraftFingerprint({ creation_id: args.creation_id });
}

async function toolAppGetStyleProfileDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  return getAppStyleProfileDraft({ creation_id: args.creation_id });
}

async function toolAppPublishStyleProfile(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  return publishAppStyleProfile({
    creation_id: args.creation_id,
    display_name: readOptionalStringArg(args, "display_name"),
  });
}

async function toolAppSelectWorkspaceStyleProfile(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.style_profile_id !== "string" || args.style_profile_id.trim().length === 0) {
    throw new Error('"style_profile_id" must be a non-empty string');
  }
  return registerWorkspaceJsonReference(await selectAppWorkspaceStyleProfile({
    workspace_dir: workspaceDir,
    style_profile_id: args.style_profile_id,
  }));
}

async function toolAppGetWorkspaceStyleProfile(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppWorkspaceStyleProfile({ workspace_dir: workspaceDir });
}

async function toolAppClearWorkspaceStyleProfile(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return registerWorkspaceJsonReference(await clearAppWorkspaceStyleProfile({ workspace_dir: workspaceDir }));
}

async function toolAppRasterizePptxToImages(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const pptxPath = readRequiredAbsolutePathArg(args, "pptx_path");
  const outputDir = readRequiredAbsolutePathArg(args, "output_dir");
  const targetHeight = args.target_height === undefined
    ? undefined
    : Number(args.target_height);
  if (
    targetHeight !== undefined
    && (!Number.isInteger(targetHeight) || targetHeight <= 0)
  ) {
    throw new Error('"target_height" must be a positive integer');
  }

  return rasterizePptxToImages({
    pptx_path: pptxPath,
    output_dir: outputDir,
    target_height: targetHeight,
    overwrite: args.overwrite === true,
  });
}

async function toolAppListUploadedSources(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return listAppUploadedSources({
    workspace_dir: workspaceDir,
    include_removed: args.include_removed === true,
  });
}

async function toolAppRemoveUploadedSource(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.uploaded_source_id !== "string" || args.uploaded_source_id.trim().length === 0) {
    throw new Error('"uploaded_source_id" must be a non-empty string');
  }

  return removeAppUploadedSource({
    workspace_dir: workspaceDir,
    uploaded_source_id: args.uploaded_source_id,
  });
}

function readUploadedSourceAnalysisDraftTypeArg(args) {
  const draftType = args.draft_type;
  if (draftType !== "factual" && draftType !== "visual") {
    throw new Error('"draft_type" must be either "factual" or "visual"');
  }
  return draftType;
}

async function toolAppPrepareUploadedSourceAnalysisWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return prepareAppUploadedSourceAnalysisWorkspace({ workspace_dir: workspaceDir });
}

async function toolAppRecordUploadedSourceAnalysisDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const draftType = readUploadedSourceAnalysisDraftTypeArg(args);
  if (!args.draft || typeof args.draft !== "object" || Array.isArray(args.draft)) {
    throw new Error('"draft" must be an object');
  }
  return recordAppUploadedSourceAnalysisDraft({
    workspace_dir: workspaceDir,
    draft_type: draftType,
    draft_id: typeof args.draft_id === "string" ? args.draft_id : undefined,
    draft: args.draft,
  });
}

async function toolAppGetUploadedSourceAnalysisDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppUploadedSourceAnalysisDraft({
    workspace_dir: workspaceDir,
    draft_type: readUploadedSourceAnalysisDraftTypeArg(args),
    draft_id: typeof args.draft_id === "string" ? args.draft_id : undefined,
  });
}

async function toolAppGetUploadedSourceAnalysisDraftFingerprint(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppUploadedSourceAnalysisDraftFingerprint({
    workspace_dir: workspaceDir,
    draft_type: readUploadedSourceAnalysisDraftTypeArg(args),
    draft_id: typeof args.draft_id === "string" ? args.draft_id : undefined,
  });
}

async function toolAppRecordUploadedSourceAnalysis(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (!args.analysis || typeof args.analysis !== "object" || Array.isArray(args.analysis)) {
    throw new Error('"analysis" must be an object');
  }
  return recordAppUploadedSourceAnalysis({
    workspace_dir: workspaceDir,
    analysis: args.analysis,
  });
}

async function toolAppGetUploadedSourceAnalysis(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppUploadedSourceAnalysis({ workspace_dir: workspaceDir });
}

async function toolAppGetWorkspaceOutline(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppWorkspaceOutline({ workspace_dir: workspaceDir });
}

async function toolAppGetWorkspaceRequirements(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppWorkspaceRequirements({ workspace_dir: workspaceDir });
}

async function toolAppAppendWorkspaceLog(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const channel = args.channel;
  const supportedChannels = [
    "ai-requirements",
    "ai-requirements-interactions",
    "ai-outline",
    "ai-outline-interactions",
    "ai-style-guide",
    "ai-style-guide-interactions",
    "ai-page-plan",
    "ai-page-plan-interactions",
    "ai-page-agent",
    "ai-page-agent-interactions",
    "ai-page-agent-stream",
    "ai-research",
    "ai-research-interactions",
    "ai-theme",
    "ai-theme-interactions",
  ];
  if (!supportedChannels.includes(channel)) {
    throw new Error(`"channel" must be one of: ${supportedChannels.join(", ")}`);
  }

  const entry = args.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error('"entry" must be an object');
  }
  const payloadKeys = Array.isArray(args.payload_keys)
    ? args.payload_keys.filter((key) => typeof key === "string" && key.length > 0)
    : undefined;
  const inlinePayloadMaxBytes =
    typeof args.inline_payload_max_bytes === "number"
      ? args.inline_payload_max_bytes
      : undefined;

  return appendAppWorkspaceLog({
    workspace_dir: workspaceDir,
    channel,
    entry,
    payload_keys: payloadKeys,
    inline_payload_max_bytes: inlinePayloadMaxBytes,
  });
}

function readOutlineInput(args) {
  const outline = args.outline;
  if (!outline || typeof outline !== "object" || Array.isArray(outline)) {
    throw new Error('"outline" must be an object');
  }
  return outline;
}

async function toolAppResetWorkspaceOutline(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return registerWorkspaceJsonReference(await resetAppWorkspaceOutline({
    workspace_dir: workspaceDir,
  }));
}

async function toolAppSaveWorkspaceOutlineDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const outline = readOutlineInput(args);

  return registerWorkspaceJsonReference(await saveAppWorkspaceOutlineDraft({
    workspace_dir: workspaceDir,
    outline,
  }));
}

async function toolAppConfirmWorkspaceOutline(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const outline = readOutlineInput(args);

  return registerWorkspaceJsonReference(await confirmAppWorkspaceOutline({
    workspace_dir: workspaceDir,
    outline,
  }));
}

async function toolAppUpdateWorkspaceRequirements(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const requirements = args.requirements;
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    throw new Error('"requirements" must be an object');
  }

  return registerWorkspaceJsonReference(await updateAppWorkspaceRequirements({
    workspace_dir: workspaceDir,
    requirements,
  }));
}

async function toolAppUpdateWorkspaceSettings(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const setting = args.setting;
  if (!setting || typeof setting !== "object" || Array.isArray(setting)) {
    throw new Error('"setting" must be an object');
  }

  return registerWorkspaceJsonReference(await updateAppWorkspaceSettings({
    workspace_dir: workspaceDir,
    setting,
    persist_as_default: args.persist_as_default === true,
  }));
}

async function toolAppPatchWorkspaceSettings(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const setting = args.setting;
  if (!setting || typeof setting !== "object" || Array.isArray(setting)) {
    throw new Error('"setting" must be an object');
  }

  return patchAppWorkspaceSettings({
    workspace_dir: workspaceDir,
    setting,
    persist_as_default: args.persist_as_default === true,
  });
}

async function toolAppUpdateWorkspacePages(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pages = args.pages;
  if (!Array.isArray(pages)) {
    throw new Error('"pages" must be an array');
  }

  return registerWorkspaceJsonReference(await updateAppWorkspacePages({
    workspace_dir: workspaceDir,
    pages,
  }));
}

async function toolAppDuplicateWorkspacePage(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.page_id !== "string" || args.page_id.trim().length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }

  return registerWorkspaceJsonReference(await duplicateAppWorkspacePage({
    workspace_dir: workspaceDir,
    page_id: args.page_id,
    title: typeof args.title === "string" ? args.title : undefined,
  }));
}

async function toolAppUpdateWorkspaceTitle(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.title !== "string" || args.title.trim().length === 0) {
    throw new Error('"title" must be a non-empty string');
  }

  return registerWorkspaceJsonReference(await updateAppWorkspaceTitle({
    workspace_dir: workspaceDir,
    title: args.title,
  }));
}

async function toolAppListTemplateGroups() {
  return listAppTemplateGroups();
}

async function toolAppGetTemplateGroup(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  if (typeof args.group_id !== "string" || args.group_id.length === 0) {
    throw new Error('Missing required parameter: "group_id"');
  }

  return getAppTemplateGroup({ group_id: args.group_id });
}

async function toolAppGetTemplatePreview(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  if (typeof args.group_id !== "string" || args.group_id.length === 0) {
    throw new Error('Missing required parameter: "group_id"');
  }

  if (
    args.layout_id !== undefined &&
    (typeof args.layout_id !== "string" || args.layout_id.length === 0)
  ) {
    throw new Error('"layout_id" must be a non-empty string when provided');
  }

  return getAppTemplatePreview({
    group_id: args.group_id,
    layout_id: args.layout_id,
  });
}

async function toolAppSelectWorkspaceTemplate(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.template_group !== "string" || args.template_group.trim().length === 0) {
    throw new Error('"template_group" must be a non-empty string');
  }

  return registerJsonReference(await selectAppWorkspaceTemplate({
    workspace_dir: workspaceDir,
    template_group: args.template_group,
  }), "select-template.json", "result_upload");
}

async function toolAppGetTemplatePlanningContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppTemplatePlanningContext({ workspace_dir: workspaceDir });
}

async function toolAppGetWorkspaceThemeContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppWorkspaceThemeContext({ workspace_dir: workspaceDir });
}

async function toolAppValidateWorkspaceThemeToken(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (args.token === undefined) {
    throw new Error('"token" is required');
  }

  return validateAppWorkspaceThemeToken({
    workspace_dir: workspaceDir,
    token: args.token,
  });
}

async function toolAppRecordWorkspaceThemeToken(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (args.use_default !== true && args.token === undefined) {
    throw new Error('"token" is required unless "use_default" is true');
  }

  return registerWorkspaceJsonReference(await recordAppWorkspaceThemeToken({
    workspace_dir: workspaceDir,
    token: args.token,
    use_default: args.use_default === true,
  }));
}

async function toolAppRecordPagePlan(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pagePlan = args.page_plan;
  if (!pagePlan || typeof pagePlan !== "object" || Array.isArray(pagePlan)) {
    throw new Error('"page_plan" must be an object');
  }

  return recordAppPagePlan({
    workspace_dir: workspaceDir,
    page_plan: pagePlan,
  });
}

async function toolAppGetPagePlan(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppPagePlan({ workspace_dir: workspaceDir });
}

async function toolAppPreparePageFiles(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return prepareAppPageFiles({ workspace_dir: workspaceDir });
}

async function toolAppPrepareDeckRefinementPageFiles(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const newPageIds = Array.isArray(args.new_page_ids)
    ? args.new_page_ids.filter((item) => typeof item === "string")
    : [];
  return prepareAppDeckRefinementPageFiles({
    workspace_dir: workspaceDir,
    new_page_ids: newPageIds,
  });
}

async function toolAppGetWorkspacePageFileFingerprints(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const slidePath = typeof args.slide_path === "string" ? args.slide_path : "";
  const dataPath = typeof args.data_path === "string" ? args.data_path : "";
  if (!slidePath) {
    throw new Error('Missing required parameter: "slide_path"');
  }
  if (!dataPath) {
    throw new Error('Missing required parameter: "data_path"');
  }

  return getAppWorkspacePageFileFingerprints({
    workspace_dir: workspaceDir,
    slide_path: slidePath,
    data_path: dataPath,
  });
}

async function toolAppGetPageProgress(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppPageProgress({ workspace_dir: workspaceDir });
}

async function toolAppPrepareResearchWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return prepareAppResearchWorkspace({ workspace_dir: workspaceDir });
}

async function toolAppRecordResearchPlan(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const researchPlan = args.research_plan;
  if (!researchPlan || typeof researchPlan !== "object" || Array.isArray(researchPlan)) {
    throw new Error('"research_plan" must be an object');
  }
  return recordAppResearchPlan({ workspace_dir: workspaceDir, research_plan: researchPlan });
}

async function toolAppGetResearchPlan(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppResearchPlan({ workspace_dir: workspaceDir });
}

async function toolAppRecordResearchEvidence(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const evidence = args.evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error('"evidence" must be an object');
  }
  return recordAppResearchEvidence({ workspace_dir: workspaceDir, evidence });
}

async function toolAppRecordResearchEvidencePage(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageEvidence = args.page_evidence;
  if (!pageEvidence || typeof pageEvidence !== "object" || Array.isArray(pageEvidence)) {
    throw new Error('"page_evidence" must be an object');
  }
  return recordAppResearchEvidencePage({
    workspace_dir: workspaceDir,
    page_evidence: pageEvidence,
  });
}

async function toolAppGetResearchEvidence(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return registerJsonReference(
    await getAppResearchEvidence({ workspace_dir: workspaceDir }),
    "research-evidence.json",
    "result_upload",
  );
}

async function toolAppFinalizeResearchVisualAssets(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  if (typeof pageId !== "string" || pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  const visualAssets = args.visual_assets;
  if (!Array.isArray(visualAssets)) {
    throw new Error('"visual_assets" must be an array');
  }
  const rawImageIndexPaths = Array.isArray(args.raw_image_index_paths)
    ? args.raw_image_index_paths.filter((item) => typeof item === "string")
    : undefined;
  return finalizeAppResearchVisualAssets({
    workspace_dir: workspaceDir,
    page_id: pageId,
    visual_assets: visualAssets,
    raw_image_index_paths: rawImageIndexPaths,
  });
}

async function toolAppRecordResearchCurationDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  const draftType = args.draft_type;
  const draftId = readOptionalStringArg(args, "draft_id");
  const draft = args.draft;
  if (typeof pageId !== "string" || pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (draftType !== "web" && draftType !== "visual") {
    throw new Error('"draft_type" must be either "web" or "visual"');
  }
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new Error('"draft" must be an object');
  }
  return recordAppResearchCurationDraft({
    workspace_dir: workspaceDir,
    page_id: pageId,
    draft_type: draftType,
    draft_id: draftId,
    draft,
  });
}

async function toolAppGetResearchCurationDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  const draftType = args.draft_type;
  const draftId = readOptionalStringArg(args, "draft_id");
  if (typeof pageId !== "string" || pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (draftType !== "web" && draftType !== "visual") {
    throw new Error('"draft_type" must be either "web" or "visual"');
  }
  return getAppResearchCurationDraft({
    workspace_dir: workspaceDir,
    page_id: pageId,
    draft_type: draftType,
    draft_id: draftId,
  });
}

async function toolAppGetResearchCurationDraftFingerprint(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  const draftType = args.draft_type;
  const draftId = readOptionalStringArg(args, "draft_id");
  if (typeof pageId !== "string" || pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (draftType !== "web" && draftType !== "visual") {
    throw new Error('"draft_type" must be either "web" or "visual"');
  }
  return getAppResearchCurationDraftFingerprint({
    workspace_dir: workspaceDir,
    page_id: pageId,
    draft_type: draftType,
    draft_id: draftId,
  });
}

async function toolAppRecordResearchEvidencePageMarkdown(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  const markdown = args.markdown;
  if (typeof pageId !== "string" || pageId.length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  if (typeof markdown !== "string") {
    throw new Error('"markdown" must be a string');
  }
  return recordAppResearchEvidencePageMarkdown({
    workspace_dir: workspaceDir,
    page_id: pageId,
    markdown,
  });
}

async function toolAppRecordResearchStatus(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const status = args.status;
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    throw new Error('"status" must be an object');
  }
  return recordAppResearchStatus({ workspace_dir: workspaceDir, status });
}

async function toolAppRecordResearchStatusPage(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageStatus = args.page_status;
  if (!pageStatus || typeof pageStatus !== "object" || Array.isArray(pageStatus)) {
    throw new Error('"page_status" must be an object');
  }
  return recordAppResearchStatusPage({
    workspace_dir: workspaceDir,
    page_status: pageStatus,
  });
}

async function toolAppGetResearchStatus(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppResearchStatus({ workspace_dir: workspaceDir });
}

async function toolAppRecordPageProgress(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" && args.page_id.trim().length > 0
    ? args.page_id
    : undefined;
  if (args.page_id !== undefined && !pageId) {
    throw new Error('"page_id" must be a non-empty string when provided');
  }
  const patch = args.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error('"patch" must be an object');
  }

  return recordAppPageProgress({
    workspace_dir: workspaceDir,
    page_id: pageId,
    patch,
  });
}

async function toolAppRenderWorkspacePagePreview(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" ? args.page_id.trim() : "";
  if (!pageId) {
    throw new Error('"page_id" must be a non-empty string');
  }

  const result = await renderAppWorkspacePagePreview({
    workspace_dir: workspaceDir,
    page_id: pageId,
  });

  return {
    ...result,
    screenshot_upload: await uploadPreviewImage(result.screenshot_path),
  };
}

async function toolAppRenderDeckHtml(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const result = await renderAppWorkspaceDeckHtml({
    workspace_dir: workspaceDir,
  });
  const slides = await Promise.all(
    result.slides.map(async (slide) => ({
      ...slide,
      screenshot_upload: await uploadPreviewImage(slide.screenshot_path),
    })),
  );

  return {
    ...result,
    slides,
  };
}

async function toolAppGetRenderedDeckHtml(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const result = await getRenderedAppWorkspaceDeckHtml({
    workspace_dir: workspaceDir,
  });
  const slides = await Promise.all(
    result.slides.map(async (slide) => ({
      ...slide,
      screenshot_upload: await uploadPreviewImage(slide.screenshot_path),
    })),
  );

  return {
    ...result,
    slides,
  };
}

async function toolAppPrepareExportModel(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return prepareAppExportModel({
    workspace_dir: workspaceDir,
  });
}

async function toolAppStartPptxExportModel(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return startAppPptxExportModel({
    workspace_dir: workspaceDir,
  });
}

async function toolAppGetPptxExportStatus(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppPptxExportStatus({
    workspace_dir: workspaceDir,
  });
}

async function toolAppPublishExportArtifact(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const artifactType = args.artifact_type;
  if (artifactType !== "pptx" && artifactType !== "pdf") {
    throw new Error('"artifact_type" must be "pptx" or "pdf"');
  }

  return withExportMirrorPublishQueue(`${workspaceDir}\0${artifactType}`, async () => {
    const current = await getAppExportArtifactMirrorStatus({
      workspace_dir: workspaceDir,
      artifact_type: artifactType,
    });
    if (current.status === "ready") {
      return {
        status: "ready",
        artifact: current.artifact,
        mirror: current.mirror,
        published: false,
      };
    }

    const snapshot = await createAppExportArtifactSnapshot({
      workspace_dir: workspaceDir,
      artifact_type: artifactType,
    });
    try {
      const upload = await apsFilesClient.uploadBegin({
        path: snapshot.mirror_path,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: "app",
        metadata: {
          workspace_id: snapshot.workspace_id,
          artifact_type: snapshot.artifact_type,
          source_updated_at: snapshot.updated_at,
          source_sha256: snapshot.source_sha256,
        },
      });
      if (!upload || typeof upload.put_url !== "string" || upload.put_url.length === 0) {
        throw new Error("files/upload_begin did not return a valid put_url");
      }
      const contentDisposition = buildAttachmentContentDisposition(snapshot.filename);
      const putResponse = await fetch(upload.put_url, {
        method: "PUT",
        headers: {
          ...(upload.headers ?? {}),
          "Content-Length": String(snapshot.size_bytes),
          "Content-Disposition": contentDisposition,
        },
        body: createReadStream(snapshot.snapshot_path),
        duplex: "half",
      });
      if (!putResponse.ok) {
        const message = await putResponse.text().catch(() => "");
        throw new Error(message || `APS Files PUT failed: HTTP ${putResponse.status}`);
      }
      const putEtag = putResponse.headers.get("etag") ?? undefined;
      const completed = await apsFilesClient.uploadComplete({
        path: snapshot.mirror_path,
        etag: putEtag,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: "app",
      });
      const mirror = {
        provider: "aps.files",
        scope: "app",
        path: snapshot.mirror_path,
        etag: typeof completed?.etag === "string" ? completed.etag : putEtag ?? "",
        size_bytes: Number.isFinite(Number(completed?.size_bytes))
          ? Math.floor(Number(completed.size_bytes))
          : snapshot.size_bytes,
        content_type: snapshot.content_type,
        content_disposition: contentDisposition,
        source_updated_at: snapshot.updated_at,
        source_sha256: snapshot.source_sha256,
        published_at: new Date().toISOString(),
      };
      const committed = await commitAppExportArtifactMirror({
        workspace_dir: workspaceDir,
        artifact_type: artifactType,
        expected_updated_at: snapshot.updated_at,
        expected_sha256: snapshot.source_sha256,
        mirror,
      });
      return {
        status: "ready",
        artifact: {
          workspace_dir: snapshot.workspace_dir,
          workspace_id: snapshot.workspace_id,
          title: snapshot.title,
          artifact_type: snapshot.artifact_type,
          path: snapshot.path,
          filename: snapshot.filename,
          updated_at: snapshot.updated_at,
          mirror: committed,
        },
        mirror: committed,
        published: true,
      };
    } finally {
      await unlink(snapshot.snapshot_path).catch(() => undefined);
    }
  });
}

async function toolAppGetExportArtifactDownloadUrl(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const artifactType = args.artifact_type;
  if (artifactType !== "pptx" && artifactType !== "pdf") {
    throw new Error('"artifact_type" must be "pptx" or "pdf"');
  }

  const status = await getAppExportArtifactMirrorStatus({
    workspace_dir: workspaceDir,
    artifact_type: artifactType,
  });
  if (status.status !== "ready" || !status.mirror) {
    return {
      status: status.status,
      reason: status.reason,
      artifact: status.artifact,
      mirror: status.mirror,
      download_url: null,
      expires_at: null,
    };
  }
  const download = await apsFilesClient.downloadUrl({
    path: status.mirror.path,
    expiresIn: 600,
    scope: "app",
  });
  if (!download || typeof download.url !== "string" || download.url.length === 0) {
    throw new Error("files/download_url did not return a valid URL");
  }

  return {
    status: "ready",
    reason: null,
    artifact: status.artifact,
    mirror: status.mirror,
    download_url: download.url,
    expires_at: typeof download.expires_at === "string" ? download.expires_at : null,
  };
}

async function toolAppPrepareWorkspaceDiagnosticBundle(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return withWorkspaceDiagnosticBundleQueue(workspaceDir, async () => {
    const snapshot = await prepareAppWorkspaceDiagnosticBundle({
      workspace_dir: workspaceDir,
    });
    try {
      const upload = await apsFilesClient.uploadBegin({
        path: snapshot.aps_path,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: "app",
        metadata: {
          workspace_id: snapshot.workspace_id,
          artifact_type: "workspace_diagnostic_bundle",
          created_at: snapshot.created_at,
        },
      });
      if (!upload || typeof upload.put_url !== "string" || upload.put_url.length === 0) {
        throw new Error("files/upload_begin did not return a valid put_url");
      }

      const contentDisposition = buildAttachmentContentDisposition(snapshot.filename);
      const putResponse = await fetch(upload.put_url, {
        method: "PUT",
        headers: {
          ...(upload.headers ?? {}),
          "Content-Length": String(snapshot.size_bytes),
          "Content-Disposition": contentDisposition,
        },
        body: createReadStream(snapshot.archive_path),
        duplex: "half",
      });
      if (!putResponse.ok) {
        const message = await putResponse.text().catch(() => "");
        throw new Error(message || `APS Files PUT failed: HTTP ${putResponse.status}`);
      }

      const putEtag = putResponse.headers.get("etag") ?? undefined;
      const completed = await apsFilesClient.uploadComplete({
        path: snapshot.aps_path,
        etag: putEtag,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: "app",
      });
      const download = await apsFilesClient.downloadUrl({
        path: snapshot.aps_path,
        expiresIn: 600,
        scope: "app",
      });
      if (!download || typeof download.url !== "string" || download.url.length === 0) {
        throw new Error("files/download_url did not return a valid URL");
      }

      return {
        status: "ready",
        workspace_id: snapshot.workspace_id,
        filename: snapshot.filename,
        size_bytes: Number.isFinite(Number(completed?.size_bytes))
          ? Math.floor(Number(completed.size_bytes))
          : snapshot.size_bytes,
        download_url: download.url,
        expires_at: typeof download.expires_at === "string" ? download.expires_at : null,
      };
    } finally {
      await unlink(snapshot.archive_path).catch(() => undefined);
    }
  });
}

async function toolAppExportPdf(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return exportAppPdf({
    workspace_dir: workspaceDir,
  });
}

async function toolAppRecordPptxExport(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pptxPath = readRequiredAbsolutePathArg(args, "pptx_path");
  return registerWorkspaceJsonReference(await recordAppPptxExport({
    workspace_dir: workspaceDir,
    pptx_path: pptxPath,
    generator_result: args.generator_result,
  }));
}

async function toolAppRecordPdfExport(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pdfPath = readRequiredAbsolutePathArg(args, "pdf_path");
  return registerWorkspaceJsonReference(await recordAppPdfExport({
    workspace_dir: workspaceDir,
    pdf_path: pdfPath,
  }));
}

async function toolGetAllDiscoveredTemplateGroups(args) {
  const input = normalizeDiscoveryInput(args);
  const groups = await getAllDiscoveredTemplateGroups(input);
  return {
    groups,
    count: groups.length,
  };
}

async function toolGetDiscoveredTemplateGroup(args) {
  if (!args || typeof args.group_id !== "string" || args.group_id.length === 0) {
    throw new Error('Missing required parameter: "group_id"');
  }

  const group = await getDiscoveredTemplateGroup({
    ...normalizeDiscoveryInput(args),
    group_id: args.group_id,
  });

  return {
    group,
    found: Boolean(group),
  };
}

async function toolBuildDeckHtmlFromManifest(args) {
  if (!args || typeof args !== "object") {
    throw new Error("Arguments must be an object");
  }

  if (args.manifest !== undefined) {
    throw new Error('"manifest" is no longer supported; use "manifest_path"');
  }

  const manifestPath = readRequiredAbsolutePathArg(args, "manifest_path");
  const outputDir = readRequiredAbsolutePathArg(args, "output_dir");
  const cwd = readOptionalAbsolutePathArg(args, "cwd");

  const page = args.page !== undefined ? Number(args.page) : undefined;
  if (args.page !== undefined && !Number.isFinite(page)) {
    throw new Error('"page" must be an integer');
  }

  const result = await buildDeckHtmlFromManifest({
    cwd,
    manifestPath,
    outputDir,
    name: typeof args.name === "string" && args.name.length > 0 ? args.name : undefined,
    singlePage: args.single_page !== undefined ? Boolean(args.single_page) : undefined,
    page,
  });

  return {
    output_dir: result.outputDir,
    deck_output_path: result.deckGenerated ? result.deckOutputPath : null,
    deck_file_name: result.deckGenerated ? result.deckFileName : null,
    deck_generated: result.deckGenerated,
    single_page: result.singlePage,
    page: result.page,
    slide_files: result.slideFiles.map((file) => ({
      file_name: file.fileName,
      output_path: file.outputPath,
      slide_id: file.slideId ?? null,
      layout_id: file.layoutId ?? null,
      kind: file.kind ?? "image",
      mime_type: file.mimeType ?? "image/png",
    })),
    slide_count: result.slideCount,
    title: result.title,
    manifest_path: result.manifestPath,
  };
}

async function toolConvertDeckHtmlToPptxModel(args) {
  if (!args || typeof args !== "object") {
    throw new Error("Arguments must be an object");
  }

  readOptionalAbsolutePathArg(args, "cwd");
  const htmlPath = readRequiredAbsolutePathArg(args, "html_path");
  const outputPath = readRequiredAbsolutePathArg(args, "output_path");
  const screenshotsDir = readOptionalAbsolutePathArg(args, "screenshots_dir");
  const html = await readFile(htmlPath, "utf8");
  const name =
    typeof args.name === "string" && args.name.length > 0
      ? args.name
      : path.basename(htmlPath, path.extname(htmlPath));
  const deviceScaleFactor = args.device_scale_factor !== undefined
    ? Number(args.device_scale_factor)
    : args.deviceScaleFactor !== undefined
      ? Number(args.deviceScaleFactor)
      : undefined;
  if (
    deviceScaleFactor !== undefined
    && (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0)
  ) {
    throw new Error('"device_scale_factor" must be a positive number');
  }

  const model = await convertDeckHtmlToPptxModel({
    html,
    name,
    viewport: deviceScaleFactor
      ? { width: 1280, height: 720, deviceScaleFactor }
      : undefined,
    settleTimeMs:
      typeof args.settle_time_ms === "number" ? args.settle_time_ms : undefined,
    screenshotsDir,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");

  return {
    output_path: outputPath,
    html_path: htmlPath,
    slide_count: Array.isArray(model.slides) ? model.slides.length : 0,
    name: model.name ?? name,
    screenshots_dir: screenshotsDir ?? null,
  };
}

async function toolForkTemplateGroup(args) {
  if (!args || typeof args !== "object") {
    throw new Error("Arguments must be an object");
  }

  const templateGroup = typeof args.template_group === "string"
    ? args.template_group
    : typeof args.templateGroup === "string"
      ? args.templateGroup
      : null;
  if (!templateGroup || templateGroup.length === 0) {
    throw new Error('Missing required parameter: "template_group"');
  }

  const outDirValue = typeof args.out_dir === "string"
    ? args.out_dir
    : typeof args.outDir === "string"
      ? args.outDir
      : null;
  if (!outDirValue || outDirValue.length === 0) {
    throw new Error('Missing required parameter: "out_dir"');
  }

  readOptionalAbsolutePathArg(args, "cwd");
  assertAbsolutePath(outDirValue, "out_dir");
  const outDir = path.normalize(outDirValue);
  const result = await forkTemplateGroup({
    templateGroup,
    outDir,
    manifestTitle: typeof args.manifest_title === "string"
      ? args.manifest_title
      : typeof args.manifestTitle === "string"
        ? args.manifestTitle
        : undefined,
    overwrite: args.overwrite !== undefined ? Boolean(args.overwrite) : undefined,
  });

  return {
    ...result,
    template_group: templateGroup,
    manifest_slide_count: Array.isArray(result.manifest?.slides) ? result.manifest.slides.length : 0,
  };
}

const TOOL_DISPATCH = {
  app_list_workspaces: toolAppListWorkspaces,
  app_get_workspace_defaults: toolAppGetWorkspaceDefaults,
  app_create_workspace: toolAppCreateWorkspace,
  app_open_workspace: toolAppOpenWorkspace,
  app_install_workspace_authoring_kit: toolAppInstallWorkspaceAuthoringKit,
  app_ensure_confirmed_outline_page_ids: toolAppEnsureConfirmedOutlinePageIds,
  app_prepare_workspace_page_sources: toolAppPrepareWorkspacePageSources,
  app_reconcile_workspace_page_sources: toolAppReconcileWorkspacePageSources,
  app_prepare_page_refinement: toolAppPreparePageRefinement,
  app_commit_deck_refinement: toolAppCommitDeckRefinement,
  app_commit_workspace_style_guide_host_upload: toolAppCommitWorkspaceStyleGuideHostUpload,
  app_get_workspace_style_guide_status: toolAppGetWorkspaceStyleGuideStatus,
  app_get_workspace_style_guide: toolAppGetWorkspaceStyleGuide,
  app_initialize_page_progress: toolAppInitializePageProgress,
  app_rebuild_workspace_deck_manifest: toolAppRebuildWorkspaceDeckManifest,
  app_get_workspace_page_source_fingerprint: toolAppGetWorkspacePageSourceFingerprint,
  app_commit_uploaded_source_host_upload: toolAppCommitUploadedSourceHostUpload,
  app_list_style_profiles: toolAppListStyleProfiles,
  app_get_style_profile_preview: toolAppGetStyleProfilePreview,
  app_get_style_profile: toolAppGetStyleProfile,
  app_prepare_style_profile_creation: toolAppPrepareStyleProfileCreation,
  app_commit_style_profile_reference_host_upload: toolAppCommitStyleProfileReferenceHostUpload,
  app_get_style_profile_creation_context: toolAppGetStyleProfileCreationContext,
  app_get_style_profile_draft_fingerprint: toolAppGetStyleProfileDraftFingerprint,
  app_get_style_profile_draft: toolAppGetStyleProfileDraft,
  app_publish_style_profile: toolAppPublishStyleProfile,
  app_select_workspace_style_profile: toolAppSelectWorkspaceStyleProfile,
  app_get_workspace_style_profile: toolAppGetWorkspaceStyleProfile,
  app_clear_workspace_style_profile: toolAppClearWorkspaceStyleProfile,
  app_rasterize_pptx_to_images: toolAppRasterizePptxToImages,
  app_list_uploaded_sources: toolAppListUploadedSources,
  app_remove_uploaded_source: toolAppRemoveUploadedSource,
  app_prepare_uploaded_source_analysis_workspace: toolAppPrepareUploadedSourceAnalysisWorkspace,
  app_record_uploaded_source_analysis_draft: toolAppRecordUploadedSourceAnalysisDraft,
  app_get_uploaded_source_analysis_draft: toolAppGetUploadedSourceAnalysisDraft,
  app_get_uploaded_source_analysis_draft_fingerprint: toolAppGetUploadedSourceAnalysisDraftFingerprint,
  app_record_uploaded_source_analysis: toolAppRecordUploadedSourceAnalysis,
  app_get_uploaded_source_analysis: toolAppGetUploadedSourceAnalysis,
  app_append_workspace_log: toolAppAppendWorkspaceLog,
  app_get_workspace_requirements: toolAppGetWorkspaceRequirements,
  app_update_workspace_requirements: toolAppUpdateWorkspaceRequirements,
  app_get_workspace_outline: toolAppGetWorkspaceOutline,
  app_reset_workspace_outline: toolAppResetWorkspaceOutline,
  app_save_workspace_outline_draft: toolAppSaveWorkspaceOutlineDraft,
  app_confirm_workspace_outline: toolAppConfirmWorkspaceOutline,
  app_update_workspace_pages: toolAppUpdateWorkspacePages,
  app_duplicate_workspace_page: toolAppDuplicateWorkspacePage,
  app_update_workspace_settings: toolAppUpdateWorkspaceSettings,
  app_patch_workspace_settings: toolAppPatchWorkspaceSettings,
  app_update_workspace_title: toolAppUpdateWorkspaceTitle,
  app_list_template_groups: toolAppListTemplateGroups,
  app_get_template_group: toolAppGetTemplateGroup,
  app_get_template_preview: toolAppGetTemplatePreview,
  app_select_workspace_template: toolAppSelectWorkspaceTemplate,
  app_get_template_planning_context: toolAppGetTemplatePlanningContext,
  app_get_workspace_theme_context: toolAppGetWorkspaceThemeContext,
  app_validate_workspace_theme_token: toolAppValidateWorkspaceThemeToken,
  app_record_workspace_theme_token: toolAppRecordWorkspaceThemeToken,
  app_record_page_plan: toolAppRecordPagePlan,
  app_get_page_plan: toolAppGetPagePlan,
  app_prepare_page_files: toolAppPreparePageFiles,
  app_prepare_deck_refinement_page_files: toolAppPrepareDeckRefinementPageFiles,
  app_get_workspace_page_file_fingerprints: toolAppGetWorkspacePageFileFingerprints,
  app_get_page_progress: toolAppGetPageProgress,
  app_prepare_research_workspace: toolAppPrepareResearchWorkspace,
  app_record_research_plan: toolAppRecordResearchPlan,
  app_get_research_plan: toolAppGetResearchPlan,
  app_record_research_evidence: toolAppRecordResearchEvidence,
  app_record_research_evidence_page: toolAppRecordResearchEvidencePage,
  app_get_research_evidence: toolAppGetResearchEvidence,
  app_finalize_research_visual_assets: toolAppFinalizeResearchVisualAssets,
  app_record_research_curation_draft: toolAppRecordResearchCurationDraft,
  app_get_research_curation_draft: toolAppGetResearchCurationDraft,
  app_get_research_curation_draft_fingerprint: toolAppGetResearchCurationDraftFingerprint,
  app_record_research_evidence_page_markdown: toolAppRecordResearchEvidencePageMarkdown,
  app_record_research_status: toolAppRecordResearchStatus,
  app_record_research_status_page: toolAppRecordResearchStatusPage,
  app_get_research_status: toolAppGetResearchStatus,
  app_record_page_progress: toolAppRecordPageProgress,
  app_render_workspace_page_preview: toolAppRenderWorkspacePagePreview,
  app_get_rendered_deck_html: toolAppGetRenderedDeckHtml,
  app_render_deck_html: toolAppRenderDeckHtml,
  app_start_pptx_export_model: toolAppStartPptxExportModel,
  app_get_pptx_export_status: toolAppGetPptxExportStatus,
  app_publish_export_artifact: toolAppPublishExportArtifact,
  app_get_export_artifact_download_url: toolAppGetExportArtifactDownloadUrl,
  app_prepare_workspace_diagnostic_bundle: toolAppPrepareWorkspaceDiagnosticBundle,
  app_prepare_export_model: toolAppPrepareExportModel,
  app_export_pdf: toolAppExportPdf,
  app_record_pptx_export: toolAppRecordPptxExport,
  app_record_pdf_export: toolAppRecordPdfExport,
  listDiscoveredTemplateGroupSummaries: toolListDiscoveredTemplateGroupSummaries,
  getAllDiscoveredTemplateGroups: toolGetAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup: toolGetDiscoveredTemplateGroup,
  buildDeckHtmlFromManifest: toolBuildDeckHtmlFromManifest,
  convertDeckHtmlToPptxModel: toolConvertDeckHtmlToPptxModel,
  forkTemplateGroup: toolForkTemplateGroup,
};

function getManifestToolNames() {
  if (!Array.isArray(MANIFEST.tools)) {
    throw new Error("manifest.json must include a tools array");
  }

  return MANIFEST.tools.map((tool) => {
    if (!tool || typeof tool !== "object" || typeof tool.name !== "string" || tool.name.length === 0) {
      throw new Error("manifest.json tools entries must include non-empty name values");
    }
    return tool.name;
  });
}

function validateToolManifest() {
  const manifestToolNames = getManifestToolNames();
  const seenToolNames = new Set();
  const duplicateToolNames = manifestToolNames.filter((toolName) => {
    if (seenToolNames.has(toolName)) {
      return true;
    }
    seenToolNames.add(toolName);
    return false;
  });
  const routedToolNames = new Set([
    ...Object.keys(TOOL_DISPATCH),
    ...TASK_STATE_MACHINE_TOOL_NAMES,
  ]);
  const missingHandlers = manifestToolNames.filter((toolName) => !routedToolNames.has(toolName));
  const missingManifestEntries = Array.from(routedToolNames).filter(
    (toolName) => !seenToolNames.has(toolName),
  );

  if (duplicateToolNames.length > 0 || missingHandlers.length > 0 || missingManifestEntries.length > 0) {
    throw new Error([
      "manifest.json tool declarations do not match plugin dispatch.",
      duplicateToolNames.length > 0 ? `duplicate tools: ${duplicateToolNames.join(", ")}` : "",
      missingHandlers.length > 0 ? `missing handlers: ${missingHandlers.join(", ")}` : "",
      missingManifestEntries.length > 0 ? `missing manifest entries: ${missingManifestEntries.join(", ")}` : "",
    ].filter(Boolean).join(" "));
  }

  return manifestToolNames;
}

const MANIFEST_TOOL_NAMES = validateToolManifest();

async function handleInvoke(id, params = {}) {
  const tool = params.tool;
  const args = params.arguments ?? {};

  if (!tool || typeof tool !== "string") {
    return makeResponse(id, undefined, createInvalidParamsError("Missing 'tool' in params"));
  }

  const fn = TOOL_DISPATCH[tool];
  if (!fn) {
    return makeResponse(id, undefined, {
      code: -32601,
      message: `Unknown tool: ${tool}`,
      data: { available_tools: MANIFEST_TOOL_NAMES },
    });
  }

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return makeResponse(
      id,
      undefined,
      createInvalidParamsError("'arguments' must be an object"),
    );
  }

  try {
    const data = await fn(args);
    return makeResponse(id, { success: true, data, tool });
  } catch (error) {
    if (error instanceof HostUploadError || error instanceof ApsFilesError) {
      return makeResponse(id, undefined, {
        code: error.code,
        message: error.message,
        data: error.data,
      });
    }
    const message = error instanceof SyntaxError
      ? `Invalid JSON content: ${error.message}`
      : error instanceof Error
        ? error.message
        : "Tool execution failed";

    const code = /missing required|must be|provide either/i.test(message) ? -32602 : -32603;
    return makeResponse(id, undefined, { code, message });
  }
}

async function handleRequest(request) {
  const { id, method, params = {} } = request;

  switch (method) {
    case "initialize": {
      const protocolVersion = params?.protocolVersion === PROTOCOL_VERSION_V2
        ? PROTOCOL_VERSION_V2
        : params?.protocolVersion === "1.1"
          ? "1.1"
          : PROTOCOL_VERSION_V2;
      if (protocolVersion === PROTOCOL_VERSION_V2) {
        hostUploadClient.enable();
      } else {
        hostUploadClient.disable(
          `host did not negotiate Executa protocol 2.0 (protocolVersion=${JSON.stringify(params?.protocolVersion)})`,
        );
      }
      return makeResponse(id, {
        protocolVersion,
        serverInfo: {
          name: MANIFEST.display_name ?? MANIFEST.name ?? "ppt-engine",
          version: MANIFEST.version,
        },
        client_capabilities: protocolVersion === PROTOCOL_VERSION_V2 ? { upload: {} } : {},
        capabilities: protocolVersion === PROTOCOL_VERSION_V2
          ? { storage: { files: true } }
          : {},
      });
    }
    case "describe": {
      return makeResponse(id, MANIFEST);
    }
    case "invoke":
      return TASK_STATE_MACHINE_TOOL_NAMES.includes(params?.tool)
        ? invokeTaskStateMachine({ jsonrpc: "2.0", id, method, params })
        : handleInvoke(id, params);
    case "health":
      return makeResponse(id, {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: MANIFEST.version,
        tools_count: MANIFEST.tools.length,
      });
    default:
      return makeResponse(id, undefined, {
        code: -32601,
        message: `Method not found: ${method}`,
      });
  }
}

const rl = readline.createInterface({ input: process.stdin });
let isShuttingDown = false;
let pendingRequests = 0;

function exitWhenDrained() {
  if (isShuttingDown && pendingRequests === 0) {
    process.exit(0);
  }
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  if (signal) {
    process.stderr.write(`Received ${signal}; shutting down\n`);
  }
  rl.close();
}

process.stderr.write("🔌 Presenton template engine Executa plugin started\n");
process.stderr.write(`   Tools: ${MANIFEST_TOOL_NAMES.join(", ")}\n`);

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed || isShuttingDown) {
    return;
  }

  const { request, parseErrorResponse } = parseRequestLine(trimmed);
  if (!parseErrorResponse && request && typeof request === "object" && !Array.isArray(request) && !("method" in request)) {
    if (!hostUploadClient.dispatchResponse(request) && !apsFilesClient.dispatchResponse(request)) {
      process.stderr.write(`← unmatched-response id=${formatRpcId(request.id)}\n`);
    }
    return;
  }
  process.stderr.write(`${summarizeIncomingRequest(request, trimmed)}\n`);

  pendingRequests += 1;
  try {
    const response = parseErrorResponse ?? await handleRequest(request);
    await emitResponse(request, response);
  } catch (error) {
    const fallbackResponse = makeResponse(null, undefined, {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      });
    await emitResponse(request, fallbackResponse);
    process.stderr.write(
      `→ error ${summarizeResponse(request, fallbackResponse)} bytes=${Buffer.byteLength(JSON.stringify(fallbackResponse), "utf8")}\n`,
    );
  } finally {
    pendingRequests -= 1;
    exitWhenDrained();
  }
});

rl.on("close", () => {
  isShuttingDown = true;
  exitWhenDrained();
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
