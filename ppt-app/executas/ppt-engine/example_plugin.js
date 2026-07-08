#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendAppWorkspaceLog,
  buildDeckHtmlFromManifest,
  convertDeckHtmlToPptxModel,
  createAppWorkspace,
  duplicateAppWorkspacePage,
  getAppExportArtifact,
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
  getDiscoveredTemplateGroup,
  listAppWorkspaces,
  listAppStyleProfiles,
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
  prepareAppDeckRefinementPageFiles,
  prepareAppPageFiles,
  prepareAppExportModel,
  prepareAppUploadedSourceAnalysisWorkspace,
  prepareAppResearchWorkspace,
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
  removeAppUploadedSource,
  recordAppUploadedSourceAnalysis,
  recordAppUploadedSourceAnalysisDraft,
  rasterizePptxToImages,
  renderAppWorkspaceDeckHtml,
  renderAppWorkspacePagePreview,
  runDeckValidation,
  selectAppWorkspaceTemplate,
  startAppPptxExportModel,
  invokeTaskStateMachine,
  updateAppWorkspaceOutline,
  updateAppWorkspacePages,
  updateAppWorkspaceSettings,
  updateAppWorkspaceTitle,
  uploadAppUploadedSource,
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

const previewFiles = new Map();
const previewImageFiles = new Map();
const artifactFiles = new Map();
const jsonPayloads = new Map();
const uploadedSourceUploadSessions = new Map();
const styleProfileReferenceUploadSessions = new Map();
let previewServerPromise = null;

const UPLOADED_SOURCE_UPLOAD_TTL_MS = 15 * 60 * 1000;
const UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES = 25 * 1024 * 1024;
const STYLE_PROFILE_REFERENCE_UPLOAD_TTL_MS = 15 * 60 * 1000;
const STYLE_PROFILE_REFERENCE_SINGLE_FILE_MAX_BYTES = 100 * 1024 * 1024;
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

function encodeRfc5987Value(value) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}

function sanitizeHeaderFileName(value) {
  const fallback = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/[^\x20-\x7e]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return fallback || "deck";
}

function getArtifactContentType(artifactType) {
  if (artifactType === "pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (artifactType === "pdf") {
    return "application/pdf";
  }
  return "application/octet-stream";
}

function writePlainResponse(response, statusCode, message, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(message);
}

function getUploadCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "PUT, OPTIONS",
    "access-control-allow-headers": "content-type, content-length",
  };
}

function cleanupExpiredUploadedSourceUploadSessions() {
  const now = Date.now();
  for (const [uploadId, session] of uploadedSourceUploadSessions) {
    if (Date.parse(session.expiresAt) > now) continue;
    uploadedSourceUploadSessions.delete(uploadId);
    void unlink(session.stagingPath).catch(() => undefined);
  }
}

function cleanupExpiredStyleProfileReferenceUploadSessions() {
  const now = Date.now();
  for (const [uploadId, session] of styleProfileReferenceUploadSessions) {
    if (Date.parse(session.expiresAt) > now) continue;
    styleProfileReferenceUploadSessions.delete(uploadId);
    void unlink(session.stagingPath).catch(() => undefined);
  }
}

async function writeUploadedSourceStagingFile(request, session) {
  await mkdir(path.dirname(session.stagingPath), { recursive: true });
  const handle = await open(session.stagingPath, "w");
  let received = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.byteLength;
      if (received > session.expectedSizeBytes || received > UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES) {
        throw new Error(`Uploaded source body exceeds expected size of ${session.expectedSizeBytes} bytes.`);
      }
      await handle.write(buffer);
    }
  } finally {
    await handle.close();
  }

  if (received !== session.expectedSizeBytes) {
    await unlink(session.stagingPath).catch(() => undefined);
    throw new Error(`Uploaded source body size mismatch: expected ${session.expectedSizeBytes} bytes, got ${received} bytes.`);
  }
  return received;
}

async function writeStyleProfileReferenceStagingFile(request, session) {
  await mkdir(path.dirname(session.stagingPath), { recursive: true });
  const handle = await open(session.stagingPath, "w");
  let received = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.byteLength;
      if (received > session.expectedSizeBytes || received > STYLE_PROFILE_REFERENCE_SINGLE_FILE_MAX_BYTES) {
        throw new Error(`Style Profile reference body exceeds expected size of ${session.expectedSizeBytes} bytes.`);
      }
      await handle.write(buffer);
    }
  } finally {
    await handle.close();
  }

  if (received !== session.expectedSizeBytes) {
    await unlink(session.stagingPath).catch(() => undefined);
    throw new Error(`Style Profile reference body size mismatch: expected ${session.expectedSizeBytes} bytes, got ${received} bytes.`);
  }
  return received;
}

async function handlePreviewRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = requestUrl.pathname.split("/").filter(Boolean);

  if (request.method === "OPTIONS" && parts.length === 3 && parts[0] === "upload") {
    response.writeHead(204, {
      "cache-control": "no-store",
      ...getUploadCorsHeaders(),
    });
    response.end();
    return;
  }

  if (request.method === "OPTIONS" && parts.length === 3 && parts[0] === "style-profile-upload") {
    response.writeHead(204, {
      "cache-control": "no-store",
      ...getUploadCorsHeaders(),
    });
    response.end();
    return;
  }

  if (parts.length === 3 && parts[0] === "upload") {
    cleanupExpiredUploadedSourceUploadSessions();
    const uploadId = parts[1];
    const token = parts[2];
    const session = uploadedSourceUploadSessions.get(uploadId);
    if (!session || session.token !== token) {
      writePlainResponse(response, 404, "Upload session expired or not found", getUploadCorsHeaders());
      return;
    }
    if (request.method !== "PUT") {
      writePlainResponse(response, 405, "Upload endpoint only accepts PUT", getUploadCorsHeaders());
      return;
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      uploadedSourceUploadSessions.delete(uploadId);
      await unlink(session.stagingPath).catch(() => undefined);
      writePlainResponse(response, 410, "Upload session expired", getUploadCorsHeaders());
      return;
    }
    if (session.committed) {
      writePlainResponse(response, 409, "Upload session already committed", getUploadCorsHeaders());
      return;
    }
    if (session.uploaded) {
      writePlainResponse(response, 409, "Upload session already received a binary body", getUploadCorsHeaders());
      return;
    }
    try {
      const received = await writeUploadedSourceStagingFile(request, session);
      session.receivedBytes = received;
      session.uploaded = true;
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...getUploadCorsHeaders(),
      });
      response.end(JSON.stringify({ ok: true, upload_id: uploadId, size_bytes: received }));
    } catch (error) {
      session.uploaded = false;
      session.receivedBytes = 0;
      await unlink(session.stagingPath).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Failed to receive uploaded source body";
      writePlainResponse(response, 413, message, getUploadCorsHeaders());
    }
    return;
  }

  if (parts.length === 3 && parts[0] === "style-profile-upload") {
    cleanupExpiredStyleProfileReferenceUploadSessions();
    const uploadId = parts[1];
    const token = parts[2];
    const session = styleProfileReferenceUploadSessions.get(uploadId);
    if (!session || session.token !== token) {
      writePlainResponse(response, 404, "Style Profile reference upload session expired or not found", getUploadCorsHeaders());
      return;
    }
    if (request.method !== "PUT") {
      writePlainResponse(response, 405, "Upload endpoint only accepts PUT", getUploadCorsHeaders());
      return;
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      styleProfileReferenceUploadSessions.delete(uploadId);
      await unlink(session.stagingPath).catch(() => undefined);
      writePlainResponse(response, 410, "Style Profile reference upload session expired", getUploadCorsHeaders());
      return;
    }
    if (session.committed) {
      writePlainResponse(response, 409, "Upload session already committed", getUploadCorsHeaders());
      return;
    }
    if (session.uploaded) {
      writePlainResponse(response, 409, "Upload session already received a binary body", getUploadCorsHeaders());
      return;
    }
    try {
      const received = await writeStyleProfileReferenceStagingFile(request, session);
      session.receivedBytes = received;
      session.uploaded = true;
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...getUploadCorsHeaders(),
      });
      response.end(JSON.stringify({ ok: true, upload_id: uploadId, size_bytes: received }));
    } catch (error) {
      session.uploaded = false;
      session.receivedBytes = 0;
      await unlink(session.stagingPath).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Failed to receive Style Profile reference body";
      writePlainResponse(response, 413, message, getUploadCorsHeaders());
    }
    return;
  }

  if (parts.length === 3 && parts[0] === "preview" && parts[2] === "deck.html") {
    const previewId = parts[1];
    const htmlPath = previewFiles.get(previewId);
    if (!htmlPath) {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end("Preview expired or not found");
      return;
    }

    try {
      const html = await readFile(htmlPath, "utf8");
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(html);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read preview HTML";
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(message);
    }
    return;
  }

  if (parts.length === 3 && parts[0] === "preview" && parts[2] === "slide.png") {
    const previewId = parts[1];
    const imagePath = previewImageFiles.get(previewId);
    if (!imagePath) {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end("Preview image expired or not found");
      return;
    }

    try {
      const imageBuffer = await readFile(imagePath);
      response.writeHead(200, {
        "content-type": "image/png",
        "content-length": imageBuffer.byteLength,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(imageBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read preview image";
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(message);
    }
    return;
  }

  if (parts.length === 3 && parts[0] === "artifact") {
    const artifactId = parts[1];
    const artifact = artifactFiles.get(artifactId);
    if (!artifact) {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end("Artifact expired or not found");
      return;
    }

    try {
      const fileBuffer = await readFile(artifact.path);
      const fallbackFileName = sanitizeHeaderFileName(artifact.filename);
      response.writeHead(200, {
        "content-type": getArtifactContentType(artifact.artifactType),
        "content-length": fileBuffer.byteLength,
        "content-disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeRfc5987Value(artifact.filename)}`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(fileBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read artifact";
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(message);
    }
    return;
  }

  if (parts.length === 3 && parts[0] === "json") {
    const payloadId = parts[1];
    const payload = jsonPayloads.get(payloadId);
    if (!payload) {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end("JSON payload expired or not found");
      return;
    }

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": payload.byteLength,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    });
    response.end(payload.body);
    return;
  }

  {
    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end("Not found");
    return;
  }
}

function ensurePreviewServer() {
  if (previewServerPromise) {
    return previewServerPromise;
  }

  previewServerPromise = new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      void handlePreviewRequest(request, response);
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind local preview server"));
        return;
      }

      process.stderr.write(`Preview server listening on 127.0.0.1:${address.port}\n`);
      resolve({ server, port: address.port });
    });
  });

  return previewServerPromise;
}

async function registerPreviewHtml(htmlPath) {
  const normalizedHtmlPath = path.normalize(htmlPath);
  const htmlStat = await stat(normalizedHtmlPath);
  if (!htmlStat.isFile()) {
    throw new Error(`Preview HTML is not a file: ${normalizedHtmlPath}`);
  }

  const { port } = await ensurePreviewServer();
  const previewId = randomUUID();
  previewFiles.set(previewId, normalizedHtmlPath);

  return `http://127.0.0.1:${port}/preview/${previewId}/deck.html`;
}

async function registerPreviewImage(imagePath) {
  const normalizedImagePath = path.normalize(imagePath);
  const imageStat = await stat(normalizedImagePath);
  if (!imageStat.isFile()) {
    throw new Error(`Preview image is not a file: ${normalizedImagePath}`);
  }

  const { port } = await ensurePreviewServer();
  const previewId = randomUUID();
  previewImageFiles.set(previewId, normalizedImagePath);

  return `http://127.0.0.1:${port}/preview/${previewId}/slide.png`;
}

async function registerArtifactDownload({ path: artifactPath, filename, artifact_type: artifactType }) {
  const normalizedArtifactPath = path.normalize(artifactPath);
  const artifactStat = await stat(normalizedArtifactPath);
  if (!artifactStat.isFile()) {
    throw new Error(`Export artifact is not a file: ${normalizedArtifactPath}`);
  }

  const { port } = await ensurePreviewServer();
  const artifactId = randomUUID();
  const safeUrlName = encodeURIComponent(filename);
  artifactFiles.set(artifactId, {
    path: normalizedArtifactPath,
    filename,
    artifactType,
  });

  return `http://127.0.0.1:${port}/artifact/${artifactId}/${safeUrlName}`;
}

async function registerJsonPayload(value, filename) {
  const body = `${JSON.stringify(value)}\n`;
  const { port } = await ensurePreviewServer();
  const payloadId = randomUUID();
  const safeUrlName = encodeURIComponent(sanitizeHeaderFileName(filename || "payload.json"));
  jsonPayloads.set(payloadId, {
    body,
    byteLength: Buffer.byteLength(body, "utf8"),
  });

  return `http://127.0.0.1:${port}/json/${payloadId}/${safeUrlName}`;
}

async function registerJsonReference(value, filename, urlFieldName) {
  return {
    [urlFieldName]: await registerJsonPayload(value, filename),
  };
}

async function registerWorkspaceJsonReference(value) {
  return registerJsonReference(value, "workspace.json", "workspace_url");
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

  return registerWorkspaceJsonReference(await createAppWorkspace({ title }));
}

async function toolAppOpenWorkspace(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return registerWorkspaceJsonReference(await openAppWorkspace({ workspace_dir: workspaceDir }));
}

async function toolAppBeginUploadedSourceUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  cleanupExpiredUploadedSourceUploadSessions();
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.filename !== "string" || args.filename.trim().length === 0) {
    throw new Error('"filename" must be a non-empty string');
  }
  const sizeBytes = Number(args.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('"size_bytes" must be a positive number');
  }
  if (sizeBytes > UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES) {
    throw new Error(`Uploaded source file exceeds the single-file limit of ${UPLOADED_SOURCE_SINGLE_FILE_MAX_BYTES} bytes.`);
  }

  const { port } = await ensurePreviewServer();
  const uploadId = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + UPLOADED_SOURCE_UPLOAD_TTL_MS).toISOString();
  const stagingPath = path.join(UPLOADED_SOURCE_STAGING_DIR, `${uploadId}.upload`);
  uploadedSourceUploadSessions.set(uploadId, {
    uploadId,
    token,
    workspaceDir,
    filename: args.filename,
    mimeType: typeof args.mime_type === "string" ? args.mime_type : "",
    expectedSizeBytes: Math.floor(sizeBytes),
    stagingPath,
    expiresAt,
    uploaded: false,
    committed: false,
    receivedBytes: 0,
  });

  return {
    workspace_dir: workspaceDir,
    upload_id: uploadId,
    upload_url: `http://127.0.0.1:${port}/upload/${encodeURIComponent(uploadId)}/${encodeURIComponent(token)}`,
    expires_at: expiresAt,
    size_bytes: Math.floor(sizeBytes),
  };
}

async function toolAppCommitUploadedSourceUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  cleanupExpiredUploadedSourceUploadSessions();
  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.upload_id !== "string" || args.upload_id.trim().length === 0) {
    throw new Error('"upload_id" must be a non-empty string');
  }
  const uploadId = args.upload_id;
  const session = uploadedSourceUploadSessions.get(uploadId);
  if (!session) {
    throw new Error(`Uploaded source upload session not found or expired: ${uploadId}`);
  }
  if (session.workspaceDir !== workspaceDir) {
    throw new Error("Uploaded source upload session workspace mismatch.");
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    uploadedSourceUploadSessions.delete(uploadId);
    await unlink(session.stagingPath).catch(() => undefined);
    throw new Error(`Uploaded source upload session expired: ${uploadId}`);
  }
  if (!session.uploaded || session.receivedBytes !== session.expectedSizeBytes) {
    throw new Error(`Uploaded source upload session has not received the expected binary body: ${uploadId}`);
  }

  try {
    session.committed = true;
    return await commitAppUploadedSourceUpload({
      workspace_dir: workspaceDir,
      upload_id: uploadId,
      filename: session.filename,
      mime_type: session.mimeType,
      staging_file_path: session.stagingPath,
      expected_size_bytes: session.expectedSizeBytes,
    });
  } finally {
    uploadedSourceUploadSessions.delete(uploadId);
    await unlink(session.stagingPath).catch(() => undefined);
  }
}

async function toolAppListStyleProfiles() {
  return listAppStyleProfiles();
}

async function toolAppPrepareStyleProfileCreation(args) {
  if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
    throw new Error("Arguments must be an object");
  }

  return prepareAppStyleProfileCreation({
    display_name: readOptionalStringArg(args ?? {}, "display_name"),
  });
}

async function toolAppBeginStyleProfileReferenceUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  cleanupExpiredStyleProfileReferenceUploadSessions();
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  if (typeof args.filename !== "string" || args.filename.trim().length === 0) {
    throw new Error('"filename" must be a non-empty string');
  }
  const sizeBytes = Number(args.size_bytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('"size_bytes" must be a positive number');
  }
  if (sizeBytes > STYLE_PROFILE_REFERENCE_SINGLE_FILE_MAX_BYTES) {
    throw new Error(`Style Profile reference file exceeds the single-file limit of ${STYLE_PROFILE_REFERENCE_SINGLE_FILE_MAX_BYTES} bytes.`);
  }

  const { port } = await ensurePreviewServer();
  const uploadId = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + STYLE_PROFILE_REFERENCE_UPLOAD_TTL_MS).toISOString();
  const stagingPath = path.join(STYLE_PROFILE_REFERENCE_STAGING_DIR, `${uploadId}.upload`);
  styleProfileReferenceUploadSessions.set(uploadId, {
    uploadId,
    token,
    creationId: args.creation_id,
    filename: args.filename,
    mimeType: typeof args.mime_type === "string" ? args.mime_type : "",
    expectedSizeBytes: Math.floor(sizeBytes),
    stagingPath,
    expiresAt,
    uploaded: false,
    committed: false,
    receivedBytes: 0,
  });

  return {
    creation_id: args.creation_id,
    upload_id: uploadId,
    upload_url: `http://127.0.0.1:${port}/style-profile-upload/${encodeURIComponent(uploadId)}/${encodeURIComponent(token)}`,
    expires_at: expiresAt,
    size_bytes: Math.floor(sizeBytes),
  };
}

async function toolAppCommitStyleProfileReferenceUpload(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  cleanupExpiredStyleProfileReferenceUploadSessions();
  if (typeof args.creation_id !== "string" || args.creation_id.trim().length === 0) {
    throw new Error('"creation_id" must be a non-empty string');
  }
  if (typeof args.upload_id !== "string" || args.upload_id.trim().length === 0) {
    throw new Error('"upload_id" must be a non-empty string');
  }
  const uploadId = args.upload_id;
  const session = styleProfileReferenceUploadSessions.get(uploadId);
  if (!session) {
    throw new Error(`Style Profile reference upload session not found or expired: ${uploadId}`);
  }
  if (session.creationId !== args.creation_id) {
    throw new Error("Style Profile reference upload session creation workspace mismatch.");
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    styleProfileReferenceUploadSessions.delete(uploadId);
    await unlink(session.stagingPath).catch(() => undefined);
    throw new Error(`Style Profile reference upload session expired: ${uploadId}`);
  }
  if (!session.uploaded || session.receivedBytes !== session.expectedSizeBytes) {
    throw new Error(`Style Profile reference upload session has not received the expected binary body: ${uploadId}`);
  }

  try {
    session.committed = true;
    return await commitAppStyleProfileReferenceUpload({
      creation_id: args.creation_id,
      upload_id: uploadId,
      filename: session.filename,
      mime_type: session.mimeType,
      staging_file_path: session.stagingPath,
      expected_size_bytes: session.expectedSizeBytes,
    });
  } finally {
    styleProfileReferenceUploadSessions.delete(uploadId);
    await unlink(session.stagingPath).catch(() => undefined);
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

async function toolAppUploadUploadedSource(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.filename !== "string" || args.filename.trim().length === 0) {
    throw new Error('"filename" must be a non-empty string');
  }
  if (typeof args.content_base64 !== "string" || args.content_base64.trim().length === 0) {
    throw new Error('"content_base64" must be a non-empty base64 string');
  }

  return uploadAppUploadedSource({
    workspace_dir: workspaceDir,
    filename: args.filename,
    mime_type: typeof args.mime_type === "string" ? args.mime_type : undefined,
    content_base64: args.content_base64,
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

async function toolAppAppendWorkspaceLog(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const channel = args.channel;
  const supportedChannels = [
    "ai-outline",
    "ai-outline-interactions",
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

async function toolAppUpdateWorkspaceOutline(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const outline = args.outline;
  if (!outline || typeof outline !== "object" || Array.isArray(outline)) {
    throw new Error('"outline" must be an object');
  }

  return registerWorkspaceJsonReference(await updateAppWorkspaceOutline({
    workspace_dir: workspaceDir,
    outline,
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
  }), "select-template.json", "result_url");
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
    "result_url",
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
  const pageIndex = Number(args.page_index);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error('"page_index" must be a non-negative integer');
  }

  const result = await renderAppWorkspacePagePreview({
    workspace_dir: workspaceDir,
    page_index: pageIndex,
  });

  return {
    ...result,
    preview_url: await registerPreviewHtml(result.html_path),
    screenshot_url: await registerPreviewImage(result.screenshot_path),
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
      preview_url: await registerPreviewHtml(slide.html_path),
      screenshot_url: await registerPreviewImage(slide.screenshot_path),
    })),
  );

  return {
    ...result,
    slides,
    preview_url: slides[0]?.preview_url ?? null,
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
      preview_url: await registerPreviewHtml(slide.html_path),
      screenshot_url: await registerPreviewImage(slide.screenshot_path),
    })),
  );

  return {
    ...result,
    slides,
    preview_url: slides[0]?.preview_url ?? null,
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

async function toolAppGetExportArtifactDownloadUrl(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const artifactType = args.artifact_type;
  if (artifactType !== "pptx" && artifactType !== "pdf") {
    throw new Error('"artifact_type" must be "pptx" or "pdf"');
  }

  const artifact = await getAppExportArtifact({
    workspace_dir: workspaceDir,
    artifact_type: artifactType,
  });
  const downloadUrl = await registerArtifactDownload(artifact);

  return {
    ...artifact,
    download_url: downloadUrl,
  };
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

async function toolValidateDeckFromManifest(args) {
  if (!args || typeof args !== "object") {
    throw new Error("Arguments must be an object");
  }

  const manifestPath = readRequiredAbsolutePathArg(args, "manifest_path");
  const outputDir = readRequiredAbsolutePathArg(args, "output_dir");
  const cwd = readOptionalAbsolutePathArg(args, "cwd");
  const deckHtmlPath = readOptionalAbsolutePathArg(args, "deck_html_path");

  const includeRenderedChecks = args.include_rendered_checks !== undefined
    ? Boolean(args.include_rendered_checks)
    : args.includeRenderedChecks !== undefined
      ? Boolean(args.includeRenderedChecks)
      : false;
  const page = args.page !== undefined ? Number(args.page) : undefined;
  if (args.page !== undefined && !Number.isFinite(page)) {
    throw new Error('"page" must be an integer');
  }

  const report = await runDeckValidation({
    cwd,
    manifestPath,
    outputDir,
    name: typeof args.name === "string" && args.name.length > 0 ? args.name : undefined,
    singlePage: args.single_page !== undefined ? Boolean(args.single_page) : undefined,
    page,
    includeRenderedChecks,
    renderedArtifacts: deckHtmlPath
      ? { deckHtmlPath }
      : undefined,
  });

  return {
    ok: report.ok,
    summary: report.summary,
    diagnostics: report.diagnostics,
    artifacts: report.artifacts ?? null,
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
  app_begin_uploaded_source_upload: toolAppBeginUploadedSourceUpload,
  app_commit_uploaded_source_upload: toolAppCommitUploadedSourceUpload,
  app_list_style_profiles: toolAppListStyleProfiles,
  app_prepare_style_profile_creation: toolAppPrepareStyleProfileCreation,
  app_begin_style_profile_reference_upload: toolAppBeginStyleProfileReferenceUpload,
  app_commit_style_profile_reference_upload: toolAppCommitStyleProfileReferenceUpload,
  app_get_style_profile_creation_context: toolAppGetStyleProfileCreationContext,
  app_get_style_profile_draft_fingerprint: toolAppGetStyleProfileDraftFingerprint,
  app_get_style_profile_draft: toolAppGetStyleProfileDraft,
  app_publish_style_profile: toolAppPublishStyleProfile,
  app_select_workspace_style_profile: toolAppSelectWorkspaceStyleProfile,
  app_get_workspace_style_profile: toolAppGetWorkspaceStyleProfile,
  app_clear_workspace_style_profile: toolAppClearWorkspaceStyleProfile,
  app_rasterize_pptx_to_images: toolAppRasterizePptxToImages,
  app_upload_uploaded_source: toolAppUploadUploadedSource,
  app_list_uploaded_sources: toolAppListUploadedSources,
  app_remove_uploaded_source: toolAppRemoveUploadedSource,
  app_prepare_uploaded_source_analysis_workspace: toolAppPrepareUploadedSourceAnalysisWorkspace,
  app_record_uploaded_source_analysis_draft: toolAppRecordUploadedSourceAnalysisDraft,
  app_get_uploaded_source_analysis_draft: toolAppGetUploadedSourceAnalysisDraft,
  app_get_uploaded_source_analysis_draft_fingerprint: toolAppGetUploadedSourceAnalysisDraftFingerprint,
  app_record_uploaded_source_analysis: toolAppRecordUploadedSourceAnalysis,
  app_get_uploaded_source_analysis: toolAppGetUploadedSourceAnalysis,
  app_append_workspace_log: toolAppAppendWorkspaceLog,
  app_get_workspace_outline: toolAppGetWorkspaceOutline,
  app_update_workspace_outline: toolAppUpdateWorkspaceOutline,
  app_update_workspace_pages: toolAppUpdateWorkspacePages,
  app_duplicate_workspace_page: toolAppDuplicateWorkspacePage,
  app_update_workspace_settings: toolAppUpdateWorkspaceSettings,
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
  app_get_export_artifact_download_url: toolAppGetExportArtifactDownloadUrl,
  app_prepare_export_model: toolAppPrepareExportModel,
  app_export_pdf: toolAppExportPdf,
  app_record_pptx_export: toolAppRecordPptxExport,
  app_record_pdf_export: toolAppRecordPdfExport,
  listDiscoveredTemplateGroupSummaries: toolListDiscoveredTemplateGroupSummaries,
  getAllDiscoveredTemplateGroups: toolGetAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup: toolGetDiscoveredTemplateGroup,
  buildDeckHtmlFromManifest: toolBuildDeckHtmlFromManifest,
  validateDeckFromManifest: toolValidateDeckFromManifest,
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
