#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  getAppTemplatePreview,
  getAppPagePlan,
  getAppPageProgress,
  getAppPptxExportStatus,
  getAppResearchCurationDraft,
  getAppResearchEvidence,
  getAppResearchPlan,
  getAppResearchStatus,
  getAllDiscoveredTemplateGroups,
  getAppWorkspaceOutline,
  getDiscoveredTemplateGroup,
  listAppWorkspaces,
  listAppTemplateGroups,
  listDiscoveredTemplateGroupSummaries,
  openAppWorkspace,
  prepareAppPageFiles,
  prepareAppExportModel,
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

const previewFiles = new Map();
const previewImageFiles = new Map();
const artifactFiles = new Map();
let previewServerPromise = null;

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

async function handlePreviewRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = requestUrl.pathname.split("/").filter(Boolean);

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
  return openAppWorkspace({ workspace_dir: workspaceDir });
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

  return updateAppWorkspaceOutline({
    workspace_dir: workspaceDir,
    outline,
  });
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

  return updateAppWorkspaceSettings({
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

  return updateAppWorkspacePages({
    workspace_dir: workspaceDir,
    pages,
  });
}

async function toolAppDuplicateWorkspacePage(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.page_id !== "string" || args.page_id.trim().length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }

  return duplicateAppWorkspacePage({
    workspace_dir: workspaceDir,
    page_id: args.page_id,
    title: typeof args.title === "string" ? args.title : undefined,
  });
}

async function toolAppUpdateWorkspaceTitle(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  if (typeof args.title !== "string" || args.title.trim().length === 0) {
    throw new Error('"title" must be a non-empty string');
  }

  return updateAppWorkspaceTitle({
    workspace_dir: workspaceDir,
    title: args.title,
  });
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

  return selectAppWorkspaceTemplate({
    workspace_dir: workspaceDir,
    template_group: args.template_group,
  });
}

async function toolAppGetTemplatePlanningContext(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  return getAppTemplatePlanningContext({ workspace_dir: workspaceDir });
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
  return getAppResearchEvidence({ workspace_dir: workspaceDir });
}

async function toolAppRecordResearchCurationDraft(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pageId = args.page_id;
  const draftType = args.draft_type;
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
  if (typeof args.page_id !== "string" || args.page_id.trim().length === 0) {
    throw new Error('"page_id" must be a non-empty string');
  }
  const patch = args.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error('"patch" must be an object');
  }

  return recordAppPageProgress({
    workspace_dir: workspaceDir,
    page_id: args.page_id,
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
  return recordAppPptxExport({
    workspace_dir: workspaceDir,
    pptx_path: pptxPath,
    generator_result: args.generator_result,
  });
}

async function toolAppRecordPdfExport(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }

  const workspaceDir = readRequiredAbsolutePathArg(args, "workspace_dir");
  const pdfPath = readRequiredAbsolutePathArg(args, "pdf_path");
  return recordAppPdfExport({
    workspace_dir: workspaceDir,
    pdf_path: pdfPath,
  });
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
  app_record_page_plan: toolAppRecordPagePlan,
  app_get_page_plan: toolAppGetPagePlan,
  app_prepare_page_files: toolAppPreparePageFiles,
  app_get_page_progress: toolAppGetPageProgress,
  app_prepare_research_workspace: toolAppPrepareResearchWorkspace,
  app_record_research_plan: toolAppRecordResearchPlan,
  app_get_research_plan: toolAppGetResearchPlan,
  app_record_research_evidence: toolAppRecordResearchEvidence,
  app_record_research_evidence_page: toolAppRecordResearchEvidencePage,
  app_get_research_evidence: toolAppGetResearchEvidence,
  app_record_research_curation_draft: toolAppRecordResearchCurationDraft,
  app_get_research_curation_draft: toolAppGetResearchCurationDraft,
  app_record_research_evidence_page_markdown: toolAppRecordResearchEvidencePageMarkdown,
  app_record_research_status: toolAppRecordResearchStatus,
  app_record_research_status_page: toolAppRecordResearchStatusPage,
  app_get_research_status: toolAppGetResearchStatus,
  app_record_page_progress: toolAppRecordPageProgress,
  app_render_workspace_page_preview: toolAppRenderWorkspacePagePreview,
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
