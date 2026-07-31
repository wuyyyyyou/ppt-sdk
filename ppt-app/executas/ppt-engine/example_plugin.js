#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { createReadStream, readFileSync } from "node:fs";
import { mkdir, open, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { parseHostUploadConfirmation } from "./host-upload-confirmation.js";
import {
  createHostUploadCache,
  hostUploadCacheKey,
  readCachedHostUpload,
  storeHostUpload,
} from "./host-upload-cache.js";
import {
  APS_FILES_DOWNLOAD_SCOPE,
  ApsFilesClient,
  ApsFilesError,
} from "./aps-files-client.js";
import { attachInvokeContext, bindInvoke } from "./invoke-context.js";

import {
  appendAppWorkspaceLog,
  beginAppGenerationRun,
  prepareAppGenerationRun,
  abandonAppGenerationRun,
  commitAppGenerationRun,
  cleanupAppGenerationRun,
  getAppWorkspaceGenerationRun,
  buildDeckHtmlFromManifest,
  createAppWorkspace,
  deleteAppWorkspace,
  duplicateAppWorkspace,
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
  getAppPageEditContext,
  getAppPptxExportStatus,
  getAppWorkspaceCover,
  getAppWorkspacePageImage,
  getRenderedAppWorkspaceDeckHtml,
  fingerprintWorkspacePageSource,
  installWorkspaceAuthoringKit,
  listAppUploadedSources,
  commitAppUploadedSourceUpload,
  getAppUploadedSourceAnalysis,
  getAppUploadedSourceAnalysisDraft,
  getAppUploadedSourceAnalysisDraftFingerprint,
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
  patchAppWorkspaceDefaults,
  prepareAppDeckRefinementPageFiles,
  prepareAppPageRefinement,
  commitAppDeckRefinement,
  prepareAppPageFiles,
  prepareAppWorkspaceDiagnosticBundle,
  prepareAppUploadedSourceAnalysisWorkspace,
  prepareAppSharedResearchWorkspace,
  getAppSharedResearchContext,
  patchAppSharedResearchProgress,
  publishPreparedAppWebResearchBatch,
  publishPreparedAppImageResearchBatch,
  appendAppWebResearchBatch,
  appendAppImageResearchBatch,
  importAppSharedResearchImage,
  downloadResearchImage,
  prepareWorkspacePageSources,
  reconcileWorkspacePageSources,
  recordAppWorkspaceStyleGuide,
  getAppWorkspaceStyleGuideStatus,
  getAppWorkspaceStyleGuide,
  initializeAppPageProgress,
  recordAppPagePlan,
  recordAppPageProgress,
  recordAppPdfExport,
  recordAppWorkspaceThemeToken,
  rebuildWorkspaceDeckManifest,
  removeAppUploadedSource,
  recordAppUploadedSourceAnalysis,
  recordAppUploadedSourceAnalysisDraft,
  rasterizePptxToImages,
  renderAppWorkspaceDeckHtml,
  renderAppWorkspacePagePreview,
  saveAppManualPageRevision,
  restoreAppPageSourceVersion,
  selectAppWorkspaceTemplate,
  startAppPptxExport,
  invokeTaskStateMachine,
  confirmAppWorkspaceOutline,
  resetAppWorkspaceOutline,
  saveAppWorkspaceOutlineDraft,
  updateAppWorkspaceRequirements,
  confirmAppWorkspaceRequirements,
  updateAppWorkspacePages,
  updateAppWorkspaceSettings,
  updateAppWorkspaceTitle,
  validateAppWorkspaceThemeToken,
  abandonPerformanceRun,
  appendPerformanceEvents,
  deletePerformanceRun,
  finalizePerformanceRun,
  getActivePerformanceRun,
  getPerformanceReportPath,
  listPerformanceRuns,
  regeneratePerformanceReport,
  startPerformanceRun,
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
const MAX_HOST_UPLOAD_JSON_REFERENCE_BYTES = 512 * 1024;
const SHARED_RESEARCH_CONTEXT_INLINE_MAX_BYTES = 48 * 1024;

function readToolManifest() {
  const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
  return {
    ...manifest,
    tools: manifest.tools.map((tool) => {
      if (!tool.name.startsWith("app_") || tool.name.includes("performance_")) return tool;
      return {
        ...tool,
        parameters: [
          ...(Array.isArray(tool.parameters) ? tool.parameters : []),
          {
            name: "performance_context",
            type: "object",
            required: false,
            description: "Optional bounded Performance Trace context supplied by PPT App; it never becomes a Workspace artifact.",
          },
        ],
      };
    }),
  };
}

const MANIFEST = readToolManifest();

function toolAppGetRuntimeInfo() {
  return {
    ppt_engine_version: MANIFEST.version,
    performance_testing: {
      supported: true,
      schema_version: 1,
    },
  };
}

function readPerformanceContext(args) {
  const value = args?.performance_context;
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error('"performance_context" must be an object');
  }
  const required = ["run_id", "trace_id", "span_id"];
  for (const key of required) {
    if (typeof value[key] !== "string" || value[key].length < 8 || value[key].length > 128) {
      throw new Error(`"performance_context.${key}" is invalid`);
    }
  }
  for (const key of ["parent_span_id", "operation_name", "workspace_id"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 160)) {
      throw new Error(`"performance_context.${key}" is invalid`);
    }
  }
  return {
    run_id: value.run_id,
    trace_id: value.trace_id,
    span_id: value.span_id,
    ...(value.parent_span_id ? { parent_span_id: value.parent_span_id } : {}),
    ...(value.operation_name ? { operation_name: value.operation_name } : {}),
    ...(value.workspace_id ? { workspace_id: value.workspace_id } : {}),
  };
}

let performanceSequence = 0;
const PLUGIN_PERFORMANCE_QUEUE_LIMIT = 1_000;
const pluginPerformanceQueue = [];
let pluginPerformanceDrain = null;
let pluginPerformanceDropped = 0;

function createPluginPerformanceEvent(context, eventType, fields = {}) {
  return {
    schema_version: 1,
    event_id: randomUUID(),
    event_type: eventType,
    recorded_at: new Date().toISOString(),
    producer_id: `ppt-engine-${process.pid}`,
    sequence_number: performanceSequence++,
    trace_id: context.trace_id,
    span_id: context.span_id,
    parent_span_id: context.parent_span_id,
    operation_name: context.operation_name,
    workspace_id: context.workspace_id,
    ...fields,
  };
}

function recordToolPerformance(context, event) {
  if (!context) return;
  if (pluginPerformanceQueue.length >= PLUGIN_PERFORMANCE_QUEUE_LIMIT) {
    pluginPerformanceDropped += 1;
    return;
  }
  pluginPerformanceQueue.push({ runId: context.run_id, event });
  void flushPluginPerformanceQueue();
}

async function flushPluginPerformanceQueue() {
  if (pluginPerformanceDrain) return pluginPerformanceDrain;
  pluginPerformanceDrain = (async () => {
    while (pluginPerformanceQueue.length > 0) {
      const runId = pluginPerformanceQueue[0].runId;
      const batch = [];
      while (batch.length < 100 && pluginPerformanceQueue[0]?.runId === runId) {
        batch.push(pluginPerformanceQueue.shift().event);
      }
      if (pluginPerformanceDropped > 0) {
        const dropped = pluginPerformanceDropped;
        pluginPerformanceDropped = 0;
        batch.push({
          schema_version: 1,
          event_id: randomUUID(),
          event_type: "data.loss",
          recorded_at: new Date().toISOString(),
          producer_id: `ppt-engine-${process.pid}`,
          sequence_number: performanceSequence++,
          attributes: { dropped_count: dropped, reason: "backend_queue_overflow" },
        });
      }
      try {
        await appendPerformanceEvents({ run_id: runId, events: batch });
      } catch (error) {
        process.stderr.write(`[performance] failed to append event batch: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  })().finally(() => {
    pluginPerformanceDrain = null;
    if (pluginPerformanceQueue.length > 0) void flushPluginPerformanceQueue();
  });
  return pluginPerformanceDrain;
}

async function toolAppListPerformanceRuns() {
  return listPerformanceRuns();
}

async function toolAppStartPerformanceRun(args) {
  return startPerformanceRun({
    app_version: typeof args?.app_version === "string" ? args.app_version : undefined,
    environment: args?.environment && typeof args.environment === "object" && !Array.isArray(args.environment) ? args.environment : undefined,
    initial_settings: args?.initial_settings && typeof args.initial_settings === "object" && !Array.isArray(args.initial_settings) ? args.initial_settings : undefined,
  });
}

async function toolAppAppendPerformanceEvents(args) {
  return appendPerformanceEvents({ run_id: args?.run_id, events: args?.events });
}

async function toolAppFinalizePerformanceRun(args) {
  await flushPluginPerformanceQueue();
  return finalizePerformanceRun({
    run_id: args?.run_id,
    locale: args?.locale === "zh" ? "zh" : "en",
    force: args?.force === true,
  });
}

async function toolAppRegeneratePerformanceReport(args) {
  return regeneratePerformanceReport({
    run_id: args?.run_id,
    locale: args?.locale === "zh" ? "zh" : "en",
  });
}

async function toolAppAbandonPerformanceRun(args) {
  await flushPluginPerformanceQueue();
  return abandonPerformanceRun({ run_id: args?.run_id });
}

async function toolAppDeletePerformanceRun(args) {
  return deletePerformanceRun({ run_id: args?.run_id });
}

async function toolAppPreparePerformanceReport(args) {
  const result = await getPerformanceReportPath({ run_id: args?.run_id });
  return {
    run: result.run,
    report_upload: await uploadLocalFileToHost({
      filePath: result.report_path,
      filename: `${result.run.run_id}-report.html`,
      mimeType: "text/plain",
      purpose: "user_artifact",
      operationId: "app_prepare_performance_report",
      source: "ppt-engine.performance-report",
      reuseWhileValid: true,
    }),
  };
}

async function toolAppResolveHostUploadJsonReference(args) {
  const hostUpload = readHostUploadRefArg(args, "host_upload");
  if (hostUpload.mime_type !== "application/json") {
    throw new Error('Host Upload JSON reference MIME type must be "application/json"');
  }
  if (hostUpload.size_bytes > MAX_HOST_UPLOAD_JSON_REFERENCE_BYTES) {
    throw new Error(
      `Host Upload JSON reference is ${hostUpload.size_bytes} bytes; ` +
      `server-side CORS fallback is limited to ${MAX_HOST_UPLOAD_JSON_REFERENCE_BYTES} bytes.`,
    );
  }

  const response = await fetch(hostUpload.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Host Upload JSON reference download failed: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Host Upload JSON reference download returned an empty response body.");
  }

  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;
    if (
      receivedBytes > hostUpload.size_bytes
      || receivedBytes > MAX_HOST_UPLOAD_JSON_REFERENCE_BYTES
    ) {
      throw new Error(
        `Host Upload JSON reference size mismatch: expected ${hostUpload.size_bytes} bytes, ` +
        `got more than ${hostUpload.size_bytes} bytes.`,
      );
    }
    chunks.push(buffer);
  }

  if (receivedBytes !== hostUpload.size_bytes) {
    throw new Error(
      `Host Upload JSON reference size mismatch: expected ${hostUpload.size_bytes} bytes, ` +
      `got ${receivedBytes} bytes.`,
    );
  }

  return JSON.parse(Buffer.concat(chunks, receivedBytes).toString("utf8"));
}

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
      params: attachInvokeContext(Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined),
      )),
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
const hostUploadCache = createHostUploadCache();
const apsFilesClient = new ApsFilesClient({
  writeFrame: (message) => writeStdoutLine(JSON.stringify(message)),
});
const exportMirrorPublishQueues = new Map();
const workspaceDiagnosticBundleQueues = new Map();

function redactStorageResponse(value) {
  if (Array.isArray(value)) return value.map(redactStorageResponse);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/(authorization|token|signature|signed[_-]?url|put[_-]?url|download[_-]?url|get[_-]?url)/i.test(key) || key.toLowerCase() === "url") {
      return [key, "[REDACTED]"];
    }
    return [key, redactStorageResponse(child)];
  }));
}

function storageErrorRecord(error) {
  const redactMessage = (message) => String(message).replace(/https?:\/\/\S+/gi, "[REDACTED_URL]");
  return {
    name: error?.name || "Error",
    message: redactMessage(error instanceof Error ? error.message : String(error)),
    ...(Number.isInteger(error?.code) ? { code: error.code } : {}),
    ...(error?.data && typeof error.data === "object" ? { data: redactStorageResponse(error.data) } : {}),
  };
}

function createStorageTransferLogger(context = {}) {
  const transferId = `transfer-${randomUUID()}`;
  const workspaceDir = typeof context.workspaceDir === "string" ? context.workspaceDir : "";
  const base = {
    schema_version: 1,
    transfer_id: transferId,
    operation_id: context.operationId,
    parent_interaction_id: context.parentInteractionId,
    source: context.source || "ppt-engine-host-upload",
    transport: context.transport || "host_upload",
    filename: context.filename,
    mime_type: context.mimeType,
    size_bytes: context.sizeBytes,
  };
  return {
    log(phase, status, extra = {}) {
      if (!workspaceDir) return;
      void appendAppWorkspaceLog({
        workspace_dir: workspaceDir,
        channel: "storage-transport",
        entry: {
          event: status === "failed" ? "storage.transfer.failed" : `storage.transfer.${phase}`,
          ...base,
          phase,
          status,
          ...extra,
        },
      }).catch(() => undefined);
    },
  };
}

function createApsTransferLogger({ workspaceDir, source, filename, mimeType, sizeBytes, path: apsPath, operationId, parentInteractionId }) {
  return createStorageTransferLogger({
    workspaceDir,
    source,
    filename,
    mimeType,
    sizeBytes,
    transport: "aps_files",
    operationId: operationId || apsPath,
    parentInteractionId,
  });
}

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
const MANUAL_PAGE_STAGING_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "manual-page-staging",
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

async function uploadLocalFileToHost({ filePath, filename, mimeType, purpose, workspaceDir, operationId, source, reuseWhileValid }) {
  const normalizedPath = path.normalize(filePath);
  const fileStat = await stat(normalizedPath);
  if (!fileStat.isFile()) {
    throw new Error(`Host Upload source path is not a file: ${normalizedPath}`);
  }
  const cacheKey = reuseWhileValid
    ? hostUploadCacheKey({
        filePath: normalizedPath,
        sizeBytes: fileStat.size,
        mtimeMs: fileStat.mtimeMs,
        mimeType,
        purpose: purpose || "user_artifact",
      })
    : null;
  if (cacheKey) {
    // Not a transfer, so it stays out of the storage transfer log by design.
    const cached = readCachedHostUpload(hostUploadCache, cacheKey);
    if (cached) return cached;
  }
  const safeFilename = assertSafeUploadFilename(filename || path.basename(normalizedPath));
  if (typeof mimeType !== "string" || mimeType.trim().length === 0 || mimeType === "application/octet-stream") {
    throw new Error(`Host Upload MIME type must be specific for ${safeFilename}`);
  }
  const sizeBytes = fileStat.size;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const logger = createStorageTransferLogger({ workspaceDir, operationId, source, filename: safeFilename, mimeType: mimeType.trim(), sizeBytes });
    let currentPhase = "started";
    logger.log("started", "started", { purpose: purpose || "user_artifact", attempt, max_attempts: 3 });
    try {
    currentPhase = "negotiate";
    const negotiated = await hostUploadClient.negotiate({
      filename: safeFilename,
      mimeType: mimeType.trim(),
      sizeBytes,
      purpose: purpose || "user_artifact",
    });
    if (!negotiated || typeof negotiated.put_url !== "string" || typeof negotiated.r2_key !== "string") {
      throw new Error("host/uploadFile negotiate returned an invalid response");
    }
    logger.log("negotiate", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(negotiated) });
    currentPhase = "put";
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
    logger.log("put", "succeeded", { http_status: putResponse.status });
    currentPhase = "confirm";
    const confirmed = await hostUploadClient.confirm(negotiated.r2_key);
    logger.log("confirm", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(confirmed) });
    const result = parseHostUploadConfirmation({
      confirmed,
      negotiated,
      mimeType: mimeType.trim(),
      fallbackSizeBytes: sizeBytes,
      filename: safeFilename,
    });
    logger.log("finished", "succeeded", { r2_key: result.r2_key, expires_at: result.expires_at });
      if (cacheKey) storeHostUpload(hostUploadCache, cacheKey, result);
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const deterministic = /permission|forbidden|unauthori[sz]ed|quota|file too large|payload too large|mime|purpose|invalid (?:argument|parameter)|unsupported/i.test(message);
      const retryable = !deterministic && attempt < 3;
      logger.log(currentPhase, "failed", {
        error: storageErrorRecord(error),
        attempt,
        max_attempts: 3,
        retryable,
      });
      if (!retryable) throw error;
    }
  }
  throw lastError;
}

async function uploadJsonToHost(value, filename, context = {}) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  return uploadBufferToHost({
    buffer: body,
    filename,
    mimeType: "application/json",
    purpose: "user_artifact",
    ...context,
  });
}

async function uploadBufferToHost({ buffer, filename, mimeType, purpose, workspaceDir, operationId, source }) {
  const safeFilename = assertSafeUploadFilename(filename);
  if (!Buffer.isBuffer(buffer) || buffer.byteLength <= 0) {
    throw new Error(`Host Upload buffer must not be empty for ${safeFilename}`);
  }
  if (typeof mimeType !== "string" || mimeType.trim().length === 0 || mimeType === "application/octet-stream") {
    throw new Error(`Host Upload MIME type must be specific for ${safeFilename}`);
  }
  const logger = createStorageTransferLogger({ workspaceDir, operationId, source, filename: safeFilename, mimeType: mimeType.trim(), sizeBytes: buffer.byteLength });
  let currentPhase = "started";
  logger.log("started", "started", { purpose: purpose || "user_artifact" });
  try {
    currentPhase = "negotiate";
    const negotiated = await hostUploadClient.negotiate({
      filename: safeFilename,
      mimeType: mimeType.trim(),
      sizeBytes: buffer.byteLength,
      purpose: purpose || "user_artifact",
    });
    if (!negotiated || typeof negotiated.put_url !== "string" || typeof negotiated.r2_key !== "string") {
      throw new Error("host/uploadFile negotiate returned an invalid response");
    }
    logger.log("negotiate", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(negotiated) });
    currentPhase = "put";
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
    logger.log("put", "succeeded", { http_status: putResponse.status });
    currentPhase = "confirm";
    const confirmed = await hostUploadClient.confirm(negotiated.r2_key);
    logger.log("confirm", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(confirmed) });
    const result = parseHostUploadConfirmation({
      confirmed,
      negotiated,
      mimeType: mimeType.trim(),
      fallbackSizeBytes: buffer.byteLength,
      filename: safeFilename,
    });
    logger.log("finished", "succeeded", { r2_key: result.r2_key, expires_at: result.expires_at });
    return result;
  } catch (error) {
    logger.log(currentPhase, "failed", { error: storageErrorRecord(error) });
    throw error;
  }
}

const PREVIEW_IMAGE_MIME_TYPES = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function uploadPreviewImage(imagePath, context = {}) {
  const extension = path.extname(imagePath).toLowerCase();
  const mimeType = PREVIEW_IMAGE_MIME_TYPES[extension];
  if (!mimeType) {
    throw new Error(`Host Upload preview image type is not supported: ${imagePath}`);
  }
  return uploadLocalFileToHost({
    filePath: imagePath,
    filename: `${path.basename(imagePath, extension) || "slide"}${extension}`,
    mimeType,
    // Rendered previews are immutable for a given mtime, so repeat views can
    // reuse the confirmed reference instead of re-uploading the same bytes.
    reuseWhileValid: true,
    ...context,
    purpose: "user_artifact",
  });
}

async function registerJsonReference(value, filename, uploadFieldName) {
  return registerJsonReferenceWithContext(value, filename, uploadFieldName, {});
}

async function registerJsonReferenceWithContext(value, filename, uploadFieldName, context) {
  return {
    [uploadFieldName]: await uploadJsonToHost(value, filename, context),
  };
}

async function registerWorkspaceJsonReference(value, workspaceDir) {
  const resolvedWorkspaceDir = workspaceDir || value?.workspace_dir;
  return registerJsonReferenceWithContext(value, "workspace.json", "workspace_upload", {
    workspaceDir: resolvedWorkspaceDir,
    source: "ppt-engine.workspace-json-reference",
  });
}

async function maybeRegisterSharedResearchContextReference(value) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") <= SHARED_RESEARCH_CONTEXT_INLINE_MAX_BYTES) return value;
  return registerJsonReferenceWithContext(value, "shared-research-context.json", "result_upload", {
    workspaceDir: value?.workspace_dir,
    source: "ppt-engine.shared-research-context",
  });
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

async function toolAppPatchWorkspaceDefaults(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  if (!args.setting || typeof args.setting !== "object" || Array.isArray(args.setting)) {
    throw new Error('"setting" must be an object');
  }
  return patchAppWorkspaceDefaults({ setting: args.setting });
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
    "research-web-interactions",
    "ai-theme",
    "ai-theme-interactions",
    "storage-transport",
  ];
  if (!supportedChannels.includes(channel)) {
    throw new Error(`"channel" must be one of: ${supportedChannels.join(", ")}`);
  }

  const hasInlineEntry = args.entry !== undefined;
  const hasEntryUpload = args.entry_upload !== undefined;
  if (hasInlineEntry === hasEntryUpload) {
    throw new Error('Exactly one of "entry" or "entry_upload" must be provided');
  }
  const entry = hasEntryUpload
    ? await toolAppResolveHostUploadJsonReference({ host_upload: args.entry_upload })
    : args.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error('Workspace log entry must be a JSON object');
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

async function toolAppConfirmWorkspaceRequirements(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const requirements = args.requirements;
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) throw new Error('"requirements" must be an object');
  const preset = requirements.selections?.visual_style_preset;
  let stagingPath;
  let expectedSizeBytes;
  if (preset) {
    const hostUpload = readHostUploadRefArg(args, "host_upload");
    if (hostUpload.mime_type !== "text/markdown") throw new Error('Template Style Guide MIME type must be "text/markdown"');
    expectedSizeBytes = Number(args.size_bytes);
    if (!Number.isFinite(expectedSizeBytes) || Math.floor(expectedSizeBytes) !== hostUpload.size_bytes) throw new Error("Template Style Guide Host Upload size mismatch");
    stagingPath = path.join(STYLE_GUIDE_STAGING_DIR, `${randomUUID()}.md`);
    await downloadHostUploadToStaging({ hostUpload, stagingPath, expectedSizeBytes: Math.floor(expectedSizeBytes) });
  }
  try {
    return registerWorkspaceJsonReference(await confirmAppWorkspaceRequirements({
      workspace_dir: workspaceDir,
      requirements,
      style_guide_staging_file_path: stagingPath,
      style_guide_expected_size_bytes: expectedSizeBytes,
      clear_style_guide: Boolean(args.clear_style_guide),
    }));
  } finally {
    if (stagingPath) await unlink(stagingPath).catch(() => undefined);
  }
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

async function toolAppDuplicateWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (args.title !== undefined && typeof args.title !== "string") {
    throw new Error('"title" must be a string');
  }

  return duplicateAppWorkspace({
    workspace_dir: workspaceDir,
    title: typeof args.title === "string" ? args.title : undefined,
  });
}

async function toolAppDeleteWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return deleteAppWorkspace({ workspace_dir: workspaceDir });
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

async function toolAppPrepareSharedResearchWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  return maybeRegisterSharedResearchContextReference(await prepareAppSharedResearchWorkspace({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    reset_progress: args.reset_progress === true,
  }));
}

async function toolAppGetSharedResearchContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  return maybeRegisterSharedResearchContextReference(await getAppSharedResearchContext({ workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir") }));
}

async function toolAppPatchSharedResearchProgress(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  if (!Array.isArray(args.operations) || args.operations.some((operation) => !operation || typeof operation !== "object" || Array.isArray(operation))) {
    throw new Error('"operations" must be an array of objects');
  }
  return patchAppSharedResearchProgress({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    operations: args.operations,
  });
}

async function toolAppPublishPreparedWebResearchBatch(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  return publishPreparedAppWebResearchBatch({ workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir") });
}

async function toolAppPublishPreparedImageResearchBatch(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  return publishPreparedAppImageResearchBatch({ workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir") });
}

async function toolAppAppendWebResearchBatch(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  return appendAppWebResearchBatch({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    markdown: readRequiredStringArg(args, "markdown"),
  });
}

async function toolAppAppendImageResearchBatch(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  if (!args.batch || typeof args.batch !== "object" || Array.isArray(args.batch)) throw new Error('"batch" must be an object');
  return appendAppImageResearchBatch({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    batch: args.batch,
  });
}

function researchImageStagingDirectory(imagesDir, operationId) {
  const safeOperationId = operationId.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "research";
  return path.join(imagesDir, ".staging", safeOperationId);
}

function assertResearchImageStagingPath(imagesDir, value) {
  assertAbsolutePath(value, "existing_file_path");
  const stagingRoot = path.resolve(imagesDir, ".staging");
  const resolved = path.resolve(value);
  if (resolved !== stagingRoot && !resolved.startsWith(`${stagingRoot}${path.sep}`)) {
    throw new Error('"existing_file_path" must be inside research/evidence/images/.staging');
  }
  return resolved;
}

async function toolAppPrepareSharedResearchImageCandidate(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const operationId = readRequiredStringArg(args, "operation_id");
  const candidateId = assertSafeUploadFilename(readRequiredStringArg(args, "candidate_id"));
  const sourceUrl = readRequiredStringArg(args, "source_url");
  const context = await getAppSharedResearchContext({ workspace_dir: workspaceDir });
  const stagingDir = researchImageStagingDirectory(context.images_dir, operationId);
  const existingFilePath = typeof args.existing_file_path === "string" && args.existing_file_path.length > 0
    ? assertResearchImageStagingPath(context.images_dir, args.existing_file_path)
    : undefined;
  const expectedSha256 = typeof args.expected_sha256 === "string" && /^[a-f0-9]{64}$/i.test(args.expected_sha256)
    ? args.expected_sha256.toLowerCase()
    : undefined;
  const downloadLogger = createStorageTransferLogger({
    workspaceDir,
    operationId,
    source: "ppt-engine.research-image-download",
    transport: "https_download",
    filename: candidateId,
  });
  let sourceOrigin;
  try {
    sourceOrigin = new URL(sourceUrl).origin;
  } catch {
    sourceOrigin = "invalid";
  }
  downloadLogger.log("started", "started", { candidate_id: candidateId, source_origin: sourceOrigin });
  let downloaded;
  try {
    downloaded = await downloadResearchImage({
      url: sourceUrl,
      staging_dir: stagingDir,
      candidate_id: candidateId,
      existing_file_path: existingFilePath,
      expected_sha256: expectedSha256,
      onEvent: (event) => downloadLogger.log(event.phase, event.status, { candidate_id: candidateId, ...event.details }),
    });
    downloadLogger.log("finished", "succeeded", {
      candidate_id: candidateId,
      mime_type: downloaded.mime_type,
      size_bytes: downloaded.bytes_size,
      sha256: downloaded.sha256,
      width: downloaded.width,
      height: downloaded.height,
      redirects: downloaded.redirects,
    });
  } catch (error) {
    downloadLogger.log("download", "failed", { candidate_id: candidateId, error: storageErrorRecord(error) });
    throw error;
  }

  return {
    workspace_dir: workspaceDir,
    candidate_id: candidateId,
    local_file_path: downloaded.file_path,
    final_url: downloaded.final_url,
    mime_type: downloaded.mime_type,
    bytes_size: downloaded.bytes_size,
    sha256: downloaded.sha256,
    width: downloaded.width,
    height: downloaded.height,
  };
}

async function toolAppUploadSharedResearchImageCandidate(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const operationId = readRequiredStringArg(args, "operation_id");
  const candidateId = assertSafeUploadFilename(readRequiredStringArg(args, "candidate_id"));
  const context = await getAppSharedResearchContext({ workspace_dir: workspaceDir });
  const localFilePath = assertResearchImageStagingPath(context.images_dir, readRequiredAbsolutePathArg(args, "local_file_path"));
  const mimeType = readRequiredStringArg(args, "mime_type");
  const hostUpload = await uploadLocalFileToHost({
    filePath: localFilePath,
    filename: path.basename(localFilePath),
    mimeType,
    purpose: "image_input",
    workspaceDir,
    operationId,
    source: "ppt-engine.research-image-session-upload",
    reuseWhileValid: true,
  });
  return { workspace_dir: workspaceDir, candidate_id: candidateId, host_upload: hostUpload };
}

async function toolAppImportSharedResearchImageLocal(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const context = await getAppSharedResearchContext({ workspace_dir: workspaceDir });
  const localFilePath = assertResearchImageStagingPath(context.images_dir, readRequiredAbsolutePathArg(args, "local_file_path"));
  const result = await importAppSharedResearchImage({
    workspace_dir: workspaceDir,
    candidate_id: readRequiredStringArg(args, "candidate_id"),
    staging_file_path: localFilePath,
    expected_size_bytes: Number(args.size_bytes),
    expected_sha256: readRequiredStringArg(args, "sha256"),
    mime_type: readRequiredStringArg(args, "mime_type"),
  });
  await unlink(localFilePath).catch(() => undefined);
  return result;
}

async function toolAppCleanupSharedResearchImageStaging(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const operationId = readRequiredStringArg(args, "operation_id");
  const context = await getAppSharedResearchContext({ workspace_dir: workspaceDir });
  await rm(path.join(context.images_dir, ".staging"), { recursive: true, force: true });
  return { workspace_dir: workspaceDir, operation_id: operationId, cleaned: true };
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

  return renderAppWorkspacePagePreview({
    workspace_dir: workspaceDir,
    page_id: pageId,
  });
}

async function toolAppUploadCurrentPageScreenshot(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" ? args.page_id.trim() : "";
  if (!pageId) throw new Error('"page_id" must be a non-empty string');

  const progress = await getAppPageProgress({ workspace_dir: workspaceDir });
  const pageProgress = progress.pages.find((item) => item.page_id === pageId);
  if (!pageProgress) throw new Error(`Unknown page_id "${pageId}" in page-progress.json`);
  const screenshotPath = pageProgress.last_screenshot_path;
  if (!screenshotPath) throw new Error(`Page "${pageId}" does not have a current screenshot`);
  const normalizedWorkspaceDir = path.resolve(workspaceDir);
  const normalizedScreenshotPath = path.resolve(screenshotPath);
  const relativePath = path.relative(normalizedWorkspaceDir, normalizedScreenshotPath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Page "${pageId}" screenshot is outside its Workspace`);
  }
  if (path.extname(normalizedScreenshotPath).toLowerCase() !== ".png") {
    throw new Error(`Page "${pageId}" screenshot must be a PNG file`);
  }
  return uploadPreviewImage(normalizedScreenshotPath, {
    workspaceDir: normalizedWorkspaceDir,
    source: "ppt-engine.current-page-screenshot",
  });
}

async function toolAppGetPageEditContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" ? args.page_id.trim() : "";
  if (!pageId) throw new Error('"page_id" must be a non-empty string');
  const result = await getAppPageEditContext({ workspace_dir: workspaceDir, page_id: pageId });
  return {
    ...result,
    html_upload: await uploadLocalFileToHost({
      filePath: result.html_path,
      filename: `${pageId}.html`,
      mimeType: "text/plain",
      purpose: "user_artifact",
      workspaceDir,
      source: "ppt-engine.manual-page-edit-context",
    }),
    screenshot_upload: await uploadPreviewImage(result.screenshot_path, {
      workspaceDir,
      source: "ppt-engine.manual-page-edit-context-screenshot",
    }),
  };
}

async function toolAppSaveManualPageRevision(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" ? args.page_id.trim() : "";
  if (!pageId) throw new Error('"page_id" must be a non-empty string');
  const baseRevision = Number(args.base_revision);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new Error('"base_revision" must be a non-negative integer');
  const expectedSizeBytes = Number(args.size_bytes);
  if (!Number.isInteger(expectedSizeBytes) || expectedSizeBytes <= 0 || expectedSizeBytes > 64 * 1024 * 1024) {
    throw new Error('"size_bytes" must be between 1 and 67108864');
  }
  const hostUpload = readHostUploadRefArg(args, "host_upload");
  if (hostUpload.mime_type !== "text/plain") throw new Error('"host_upload.mime_type" must be "text/plain"');
  const stagingPath = path.join(MANUAL_PAGE_STAGING_DIR, `${pageId}-${randomUUID()}.html`);
  try {
    await downloadHostUploadToStaging({ hostUpload, stagingPath, expectedSizeBytes });
    const result = await saveAppManualPageRevision({
      workspace_dir: workspaceDir,
      page_id: pageId,
      base_revision: baseRevision,
      staging_file_path: stagingPath,
      expected_size_bytes: expectedSizeBytes,
    });
    return {
      ...result,
      screenshot_upload: await uploadPreviewImage(result.manifest.screenshot_path, {
        workspaceDir,
        source: "ppt-engine.manual-page-revision-screenshot",
      }),
    };
  } finally {
    await unlink(stagingPath).catch(() => undefined);
  }
}

async function toolAppRestorePageSourceVersion(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = typeof args.page_id === "string" ? args.page_id.trim() : "";
  if (!pageId) throw new Error('"page_id" must be a non-empty string');
  const result = await restoreAppPageSourceVersion({ workspace_dir: workspaceDir, page_id: pageId });
  return {
    ...result,
    html_upload: await uploadLocalFileToHost({
      filePath: result.html_path,
      filename: `${pageId}.html`,
      mimeType: "text/plain",
      purpose: "user_artifact",
      workspaceDir,
      source: "ppt-engine.restored-page-source-html",
    }),
    screenshot_upload: await uploadPreviewImage(result.screenshot_path, {
      workspaceDir,
      source: "ppt-engine.restored-page-source-screenshot",
    }),
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
  return result;
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
      screenshot_upload: await uploadPreviewImage(slide.screenshot_path, {
        workspaceDir,
        source: "ppt-engine.deck-screenshot",
      }),
    })),
  );

  return {
    ...result,
    slides,
  };
}

async function toolAppGetWorkspaceCover(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const cover = await getAppWorkspaceCover({ workspace_dir: workspaceDir });
  return {
    ...cover,
    cover_upload: await uploadPreviewImage(cover.cover_path, {
      workspaceDir,
      source: "ppt-engine.workspace-cover",
    }),
  };
}

async function toolAppGetWorkspacePageImage(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = readRequiredStringArg(args, "page_id");
  let width;
  if (args.width !== undefined && args.width !== null) {
    if (typeof args.width !== "number" || !Number.isFinite(args.width) || args.width <= 0) {
      throw new Error('"width" must be a positive number');
    }
    width = args.width;
  }

  const image = await getAppWorkspacePageImage({
    workspace_dir: workspaceDir,
    page_id: pageId,
    ...(width === undefined ? {} : { width }),
  });
  return {
    ...image,
    image_upload: await uploadPreviewImage(image.image_path, {
      workspaceDir,
      source: "ppt-engine.workspace-page-image",
    }),
  };
}

async function toolAppStartPptxExport(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return startAppPptxExport({
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
    const transferLogger = createApsTransferLogger({
      workspaceDir,
      source: "ppt-engine.export-artifact-mirror",
      filename: snapshot.filename,
      mimeType: snapshot.content_type,
      sizeBytes: snapshot.size_bytes,
      path: snapshot.mirror_path,
      operationId: `app_publish_export_artifact:${artifactType}`,
    });
    transferLogger.log("started", "started", { aps_path: snapshot.mirror_path, artifact_type: artifactType });
    try {
      const upload = await apsFilesClient.uploadBegin({
        path: snapshot.mirror_path,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: APS_FILES_DOWNLOAD_SCOPE,
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
      transferLogger.log("negotiate", "succeeded", { response: redactStorageResponse(upload), aps_path: snapshot.mirror_path });
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
      transferLogger.log("put", "succeeded", { http_status: putResponse.status, aps_path: snapshot.mirror_path });
      const putEtag = putResponse.headers.get("etag") ?? undefined;
      const completed = await apsFilesClient.uploadComplete({
        path: snapshot.mirror_path,
        etag: putEtag,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: APS_FILES_DOWNLOAD_SCOPE,
      });
      transferLogger.log("commit", "succeeded", { response: redactStorageResponse(completed), aps_path: snapshot.mirror_path });
      const mirror = {
        provider: "aps.files",
        scope: APS_FILES_DOWNLOAD_SCOPE,
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
      transferLogger.log("finished", "succeeded", { aps_path: snapshot.mirror_path, etag: committed.etag });
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
    } catch (error) {
      transferLogger.log("unknown", "failed", { aps_path: snapshot.mirror_path, error: storageErrorRecord(error) });
      throw error;
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
  const transferLogger = createApsTransferLogger({
    workspaceDir,
    source: "ppt-engine.export-artifact-download-url",
    filename: status.artifact.filename,
    mimeType: status.mirror.content_type,
    sizeBytes: status.mirror.size_bytes,
    path: status.mirror.path,
    operationId: `app_get_export_artifact_download_url:${artifactType}`,
  });
  transferLogger.log("started", "started", { aps_path: status.mirror.path, artifact_type: artifactType });
  try {
    const download = await apsFilesClient.downloadUrl({
      path: status.mirror.path,
      expiresIn: 600,
      scope: APS_FILES_DOWNLOAD_SCOPE,
    });
    if (!download || typeof download.url !== "string" || download.url.length === 0) {
      throw new Error("files/download_url did not return a valid URL");
    }
    transferLogger.log("download_url", "succeeded", {
      aps_path: status.mirror.path,
      response: redactStorageResponse(download),
    });
    transferLogger.log("finished", "succeeded", { aps_path: status.mirror.path, expires_at: download.expires_at });
    return {
      status: "ready",
      reason: null,
      artifact: status.artifact,
      mirror: status.mirror,
      download_url: download.url,
      expires_at: typeof download.expires_at === "string" ? download.expires_at : null,
    };
  } catch (error) {
    transferLogger.log("download_url", "failed", { aps_path: status.mirror.path, error: storageErrorRecord(error) });
    throw error;
  }
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
    const transferLogger = createApsTransferLogger({
      workspaceDir,
      source: "ppt-engine.workspace-diagnostic-bundle",
      filename: snapshot.filename,
      mimeType: snapshot.content_type,
      sizeBytes: snapshot.size_bytes,
      path: snapshot.aps_path,
      operationId: "app_prepare_workspace_diagnostic_bundle",
    });
    transferLogger.log("started", "started", { aps_path: snapshot.aps_path });
    try {
      const upload = await apsFilesClient.uploadBegin({
        path: snapshot.aps_path,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: APS_FILES_DOWNLOAD_SCOPE,
        metadata: {
          workspace_id: snapshot.workspace_id,
          artifact_type: "workspace_diagnostic_bundle",
          created_at: snapshot.created_at,
        },
      });
      if (!upload || typeof upload.put_url !== "string" || upload.put_url.length === 0) {
        throw new Error("files/upload_begin did not return a valid put_url");
      }
      transferLogger.log("negotiate", "succeeded", { response: redactStorageResponse(upload), aps_path: snapshot.aps_path });

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
      transferLogger.log("put", "succeeded", { http_status: putResponse.status, aps_path: snapshot.aps_path });

      const putEtag = putResponse.headers.get("etag") ?? undefined;
      const completed = await apsFilesClient.uploadComplete({
        path: snapshot.aps_path,
        etag: putEtag,
        sizeBytes: snapshot.size_bytes,
        contentType: snapshot.content_type,
        scope: APS_FILES_DOWNLOAD_SCOPE,
      });
      transferLogger.log("commit", "succeeded", { response: redactStorageResponse(completed), aps_path: snapshot.aps_path });
      const download = await apsFilesClient.downloadUrl({
        path: snapshot.aps_path,
        expiresIn: 600,
        scope: APS_FILES_DOWNLOAD_SCOPE,
      });
      if (!download || typeof download.url !== "string" || download.url.length === 0) {
        throw new Error("files/download_url did not return a valid URL");
      }
      transferLogger.log("download_url", "succeeded", {
        aps_path: snapshot.aps_path,
        response: redactStorageResponse(download),
      });
      transferLogger.log("finished", "succeeded", { aps_path: snapshot.aps_path, expires_at: download.expires_at });

      const sizeBytes = Number.isFinite(Number(completed?.size_bytes))
        ? Math.floor(Number(completed.size_bytes))
        : snapshot.size_bytes;
      return {
        status: "ready",
        workspace_id: snapshot.workspace_id,
        filename: snapshot.filename,
        size_bytes: sizeBytes,
        download_url: download.url,
        expires_at: typeof download.expires_at === "string" ? download.expires_at : null,
        // ADR-0025: the Host can save this object itself, which keeps the signed
        // URL out of the App unless the fallback route is needed.
        mirror: {
          provider: "aps.files",
          scope: APS_FILES_DOWNLOAD_SCOPE,
          path: snapshot.aps_path,
          content_type: snapshot.content_type,
          content_disposition: contentDisposition,
          size_bytes: sizeBytes,
        },
      };
    } catch (error) {
      transferLogger.log("unknown", "failed", { aps_path: snapshot.aps_path, error: storageErrorRecord(error) });
      throw error;
    } finally {
      await unlink(snapshot.archive_path).catch(() => undefined);
    }
  });
}

async function toolAppBeginGenerationRun(args) {
  return beginAppGenerationRun({
    workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir"),
    run_kind: args.run_kind,
    origin_page_id: typeof args.origin_page_id === "string" ? args.origin_page_id : null,
  });
}

async function toolAppPrepareGenerationRun(args) {
  if (typeof args.run_id !== "string" || !args.run_id) throw new Error('Missing required parameter: "run_id"');
  return prepareAppGenerationRun({ run_id: args.run_id });
}

async function toolAppAbandonGenerationRun(args) {
  if (typeof args.run_id !== "string" || !args.run_id) throw new Error('Missing required parameter: "run_id"');
  return abandonAppGenerationRun({ run_id: args.run_id });
}

async function toolAppCommitGenerationRun(args) {
  if (typeof args.run_id !== "string" || !args.run_id) throw new Error('Missing required parameter: "run_id"');
  return commitAppGenerationRun({ run_id: args.run_id });
}

async function toolAppCleanupGenerationRun(args) {
  if (typeof args.run_id !== "string" || !args.run_id) throw new Error('Missing required parameter: "run_id"');
  return cleanupAppGenerationRun({ run_id: args.run_id });
}

async function toolAppGetWorkspaceGenerationRun(args) {
  return getAppWorkspaceGenerationRun({ workspace_dir: readRequiredAbsolutePathArg(args, "workspace_dir") });
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
  app_get_runtime_info: toolAppGetRuntimeInfo,
  app_list_performance_runs: toolAppListPerformanceRuns,
  app_start_performance_run: toolAppStartPerformanceRun,
  app_append_performance_events: toolAppAppendPerformanceEvents,
  app_finalize_performance_run: toolAppFinalizePerformanceRun,
  app_regenerate_performance_report: toolAppRegeneratePerformanceReport,
  app_abandon_performance_run: toolAppAbandonPerformanceRun,
  app_delete_performance_run: toolAppDeletePerformanceRun,
  app_prepare_performance_report: toolAppPreparePerformanceReport,
  app_resolve_host_upload_json_reference: toolAppResolveHostUploadJsonReference,
  app_begin_generation_run: toolAppBeginGenerationRun,
  app_prepare_generation_run: toolAppPrepareGenerationRun,
  app_abandon_generation_run: toolAppAbandonGenerationRun,
  app_commit_generation_run: toolAppCommitGenerationRun,
  app_cleanup_generation_run: toolAppCleanupGenerationRun,
  app_get_workspace_generation_run: toolAppGetWorkspaceGenerationRun,
  app_list_workspaces: toolAppListWorkspaces,
  app_patch_workspace_defaults: toolAppPatchWorkspaceDefaults,
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
  app_confirm_workspace_requirements: toolAppConfirmWorkspaceRequirements,
  app_get_workspace_outline: toolAppGetWorkspaceOutline,
  app_reset_workspace_outline: toolAppResetWorkspaceOutline,
  app_save_workspace_outline_draft: toolAppSaveWorkspaceOutlineDraft,
  app_confirm_workspace_outline: toolAppConfirmWorkspaceOutline,
  app_update_workspace_pages: toolAppUpdateWorkspacePages,
  app_duplicate_workspace_page: toolAppDuplicateWorkspacePage,
  app_update_workspace_settings: toolAppUpdateWorkspaceSettings,
  app_patch_workspace_settings: toolAppPatchWorkspaceSettings,
  app_update_workspace_title: toolAppUpdateWorkspaceTitle,
  app_duplicate_workspace: toolAppDuplicateWorkspace,
  app_delete_workspace: toolAppDeleteWorkspace,
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
  app_prepare_shared_research_workspace: toolAppPrepareSharedResearchWorkspace,
  app_get_shared_research_context: toolAppGetSharedResearchContext,
  app_patch_shared_research_progress: toolAppPatchSharedResearchProgress,
  app_publish_prepared_web_research_batch: toolAppPublishPreparedWebResearchBatch,
  app_publish_prepared_image_research_batch: toolAppPublishPreparedImageResearchBatch,
  app_append_web_research_batch: toolAppAppendWebResearchBatch,
  app_append_image_research_batch: toolAppAppendImageResearchBatch,
  app_prepare_shared_research_image_candidate: toolAppPrepareSharedResearchImageCandidate,
  app_upload_shared_research_image_candidate: toolAppUploadSharedResearchImageCandidate,
  app_import_shared_research_image_local: toolAppImportSharedResearchImageLocal,
  app_cleanup_shared_research_image_staging: toolAppCleanupSharedResearchImageStaging,
  app_record_page_progress: toolAppRecordPageProgress,
  app_render_workspace_page_preview: toolAppRenderWorkspacePagePreview,
  app_upload_current_page_screenshot: toolAppUploadCurrentPageScreenshot,
  app_get_page_edit_context: toolAppGetPageEditContext,
  app_save_manual_page_revision: toolAppSaveManualPageRevision,
  app_restore_page_source_version: toolAppRestorePageSourceVersion,
  app_get_rendered_deck_html: toolAppGetRenderedDeckHtml,
  app_get_workspace_cover: toolAppGetWorkspaceCover,
  app_get_workspace_page_image: toolAppGetWorkspacePageImage,
  app_render_deck_html: toolAppRenderDeckHtml,
  app_start_pptx_export: toolAppStartPptxExport,
  app_get_pptx_export_status: toolAppGetPptxExportStatus,
  app_publish_export_artifact: toolAppPublishExportArtifact,
  app_get_export_artifact_download_url: toolAppGetExportArtifactDownloadUrl,
  app_prepare_workspace_diagnostic_bundle: toolAppPrepareWorkspaceDiagnosticBundle,
  app_export_pdf: toolAppExportPdf,
  app_record_pdf_export: toolAppRecordPdfExport,
  listDiscoveredTemplateGroupSummaries: toolListDiscoveredTemplateGroupSummaries,
  getAllDiscoveredTemplateGroups: toolGetAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup: toolGetDiscoveredTemplateGroup,
  buildDeckHtmlFromManifest: toolBuildDeckHtmlFromManifest,
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

  const isPerformanceControl = tool.startsWith("app_") && tool.includes("performance_");
  let performanceContext = null;
  try {
    performanceContext = isPerformanceControl ? null : readPerformanceContext(args);
  } catch (error) {
    return makeResponse(id, undefined, createInvalidParamsError(error instanceof Error ? error.message : String(error)));
  }
  const startedAt = performance.now();
  if (performanceContext) {
    recordToolPerformance(
      performanceContext,
      createPluginPerformanceEvent(performanceContext, "span.started", {
        attributes: { layer: "ppt-engine", tool },
      }),
    );
  }
  try {
    const data = await fn(args);
    if (performanceContext) {
      recordToolPerformance(
        performanceContext,
        createPluginPerformanceEvent(performanceContext, "span.finished", {
          duration_ms: performance.now() - startedAt,
          status: "ok",
          attributes: { layer: "ppt-engine", tool, duration_source: "monotonic" },
        }),
      );
    }
    return makeResponse(id, { success: true, data, tool });
  } catch (error) {
    if (performanceContext) {
      recordToolPerformance(
        performanceContext,
        createPluginPerformanceEvent(performanceContext, "span.finished", {
          duration_ms: performance.now() - startedAt,
          status: "error",
          attributes: { layer: "ppt-engine", tool, duration_source: "monotonic" },
        }),
      );
    }
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
      return bindInvoke(params, () => (
        TASK_STATE_MACHINE_TOOL_NAMES.includes(params?.tool)
          ? invokeTaskStateMachine({ jsonrpc: "2.0", id, method, params })
          : handleInvoke(id, params)
      ));
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
