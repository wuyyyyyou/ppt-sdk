#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import readline from "node:readline";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendAppWorkspaceLog,
  buildDeckHtmlFromManifest,
  convertDeckHtmlToPptxModel,
  createAppWorkspace,
  forkTemplateGroup,
  getAppTemplateGroup,
  getAppTemplatePreview,
  getAllDiscoveredTemplateGroups,
  getAppWorkspaceOutline,
  getDiscoveredTemplateGroup,
  listAppWorkspaces,
  listAppTemplateGroups,
  listDiscoveredTemplateGroupSummaries,
  openAppWorkspace,
  renderAppWorkspaceDeckHtml,
  runDeckValidation,
  selectAppWorkspaceTemplate,
  describeTaskStateMachine,
  invokeTaskStateMachine,
  updateAppWorkspaceOutline,
  updateAppWorkspaceSettings,
  updateAppWorkspaceTitle,
} from "./dist/index.js";

const TOOL_NAMES = [
  "app_list_workspaces",
  "app_create_workspace",
  "app_open_workspace",
  "app_append_workspace_log",
  "app_get_workspace_outline",
  "app_update_workspace_outline",
  "app_update_workspace_settings",
  "app_update_workspace_title",
  "app_list_template_groups",
  "app_get_template_group",
  "app_get_template_preview",
  "app_select_workspace_template",
  "app_render_deck_html",
  "listDiscoveredTemplateGroupSummaries",
  "getAllDiscoveredTemplateGroups",
  "getDiscoveredTemplateGroup",
  "buildDeckHtmlFromManifest",
  "convertDeckHtmlToPptxModel",
  "validateDeckFromManifest",
  "forkTemplateGroup",
];
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

const MANIFEST = {
  name: "tool-lightvoss_5433-ppt-engine-6443rj2a",
  display_name: "ppt-engine",
  version: "2.0.0",
  description:
    "Anna Executa plugin for Presenton template discovery, manifest-based deck HTML generation, deck HTML to PPTX model conversion, and stability validation.",
  author: "Anna Developer",
  tools: [
    {
      name: "app_list_workspaces",
      description:
        "Scan the default PPT task workspace root and return existing ppt-YYYYMMDD-HHmmss workspaces.",
      parameters: [],
    },
    {
      name: "app_create_workspace",
      description:
        "Create a new PPT task workspace under the default workspace root and initialize core JSON files.",
      parameters: [
        {
          name: "title",
          type: "string",
          description: "Optional project title. Defaults to the generated workspace id.",
          required: false,
        },
      ],
    },
    {
      name: "app_open_workspace",
      description:
        "Open an existing PPT task workspace and initialize any missing core JSON files.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
      ],
    },
    {
      name: "app_update_workspace_settings",
      description:
        "Update setting.json for an existing PPT task workspace and return the refreshed workspace.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
        {
          name: "setting",
          type: "object",
          description: "Partial settings object to merge into setting.json.",
          required: true,
        },
      ],
    },
    {
      name: "app_append_workspace_log",
      description:
        "Append one JSONL log entry under an existing PPT task workspace .log directory.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
        {
          name: "channel",
          type: "string",
          description: "Workspace log channel. Currently supports ai-outline.",
          required: true,
        },
        {
          name: "entry",
          type: "object",
          description: "JSON-serializable log entry to append.",
          required: true,
        },
      ],
    },
    {
      name: "app_get_workspace_outline",
      description:
        "Read and normalize outline.json for an existing PPT task workspace.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
      ],
    },
    {
      name: "app_update_workspace_outline",
      description:
        "Write outline.json for an existing PPT task workspace and return the refreshed workspace.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
        {
          name: "outline",
          type: "object",
          description: "Outline artifact with title, items, source, status, and updated_at fields.",
          required: true,
        },
      ],
    },
    {
      name: "app_update_workspace_title",
      description:
        "Update task.json title for an existing PPT task workspace and return the refreshed workspace.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
        {
          name: "title",
          type: "string",
          description: "New workspace title.",
          required: true,
        },
      ],
    },
    {
      name: "app_list_template_groups",
      description:
        "List builtin PPT template groups with static preview metadata for the app template picker.",
      parameters: [],
    },
    {
      name: "app_get_template_group",
      description:
        "Return one builtin PPT template group with layout details for the app template picker.",
      parameters: [
        {
          name: "group_id",
          type: "string",
          description: "Template group id, such as red-finance-v3.",
          required: true,
        },
      ],
    },
    {
      name: "app_get_template_preview",
      description:
        "Return one static template preview image as a data URL.",
      parameters: [
        {
          name: "group_id",
          type: "string",
          description: "Template group id.",
          required: true,
        },
        {
          name: "layout_id",
          type: "string",
          description: "Optional full layout id. Defaults to the group's primary preview.",
          required: false,
        },
      ],
    },
    {
      name: "app_select_workspace_template",
      description:
        "Select a template group for an app workspace and fork it into workspace/template.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
        {
          name: "template_group",
          type: "string",
          description: "Builtin template group id to fork into the workspace template directory.",
          required: true,
        },
      ],
    },
    {
      name: "app_render_deck_html",
      description:
        "Render the selected workspace template manifest to reviewable deck HTML and return a local preview URL.",
      parameters: [
        {
          name: "workspace_dir",
          type: "string",
          description: "Absolute path to an existing ppt-YYYYMMDD-HHmmss workspace.",
          required: true,
        },
      ],
    },
    {
      name: "listDiscoveredTemplateGroupSummaries",
      description:
        "List discovered template group summaries from builtin and optional local template roots.",
      parameters: [
        {
          name: "include_builtin",
          type: "boolean",
          description: "Whether to include builtin template groups. Defaults to true.",
          required: false,
          default: true,
        },
        {
          name: "local_roots",
          type: "array",
          items: { type: "string" },
          description: "Optional list of absolute local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Optional absolute working directory used by local template discovery.",
          required: false,
        },
      ],
    },
    {
      name: "getAllDiscoveredTemplateGroups",
      description:
        "Return all discovered template groups with full layout details from builtin and optional local roots.",
      parameters: [
        {
          name: "include_builtin",
          type: "boolean",
          description: "Whether to include builtin template groups. Defaults to true.",
          required: false,
          default: true,
        },
        {
          name: "local_roots",
          type: "array",
          items: { type: "string" },
          description: "Optional list of absolute local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Optional absolute working directory used by local template discovery.",
          required: false,
        },
      ],
    },
    {
      name: "getDiscoveredTemplateGroup",
      description:
        "Return one discovered template group with layouts from builtin and optional local roots.",
      parameters: [
        {
          name: "group_id",
          type: "string",
          description: "Template group id to look up.",
          required: true,
        },
        {
          name: "include_builtin",
          type: "boolean",
          description: "Whether to include builtin template groups. Defaults to true.",
          required: false,
          default: true,
        },
        {
          name: "local_roots",
          type: "array",
          items: { type: "string" },
          description: "Optional list of absolute local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Optional absolute working directory used by local template discovery.",
          required: false,
        },
      ],
    },
    {
      name: "buildDeckHtmlFromManifest",
      description:
        "Build a deck viewer HTML and one rendered PNG image per slide from a manifest JSON file, write them to an output directory, and return the generated file paths.",
      parameters: [
        {
          name: "manifest_path",
          type: "string",
          description:
            "Absolute path to a manifest JSON file.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description:
            "Optional absolute working directory retained for compatibility.",
          required: false,
        },
        {
          name: "output_dir",
          type: "string",
          description:
            "Absolute directory where the generated deck HTML and per-slide PNG images should be written.",
          required: true,
        },
        {
          name: "name",
          type: "string",
          description:
            "Optional base name for generated files. Defaults to manifest.title after filename sanitization.",
          required: false,
        },
        {
          name: "single_page",
          type: "boolean",
          description:
            "Whether to generate only one slide PNG image. Defaults to false.",
          required: false,
          default: false,
        },
        {
          name: "page",
          type: "integer",
          description:
            "1-based page number to generate when single_page is true.",
          required: false,
        },
      ],
    },
    {
      name: "validateDeckFromManifest",
      description:
        "Run static and optional rendered stability validation on a manifest deck and return structured diagnostics.",
      parameters: [
        {
          name: "manifest_path",
          type: "string",
          description:
            "Absolute path to a manifest JSON file.",
          required: true,
        },
        {
          name: "output_dir",
          type: "string",
          description:
            "Absolute output directory used for generated validation artifacts when rendered checks need to build deck HTML.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description:
            "Optional absolute working directory retained for compatibility.",
          required: false,
        },
        {
          name: "name",
          type: "string",
          description: "Optional presentation name forwarded to the validation engine.",
          required: false,
        },
        {
          name: "single_page",
          type: "boolean",
          description:
            "Whether to validate only one slide from the manifest. Defaults to false.",
          required: false,
          default: false,
        },
        {
          name: "page",
          type: "integer",
          description:
            "1-based page number to validate when single_page is true.",
          required: false,
        },
        {
          name: "include_rendered_checks",
          type: "boolean",
          description:
            "Whether to run browser-based rendered validation. Defaults to false.",
          required: false,
          default: false,
        },
        {
          name: "deck_html_path",
          type: "string",
          description:
            "Optional absolute prebuilt deck HTML path to reuse instead of rebuilding during rendered validation.",
          required: false,
        },
      ],
    },
    {
      name: "convertDeckHtmlToPptxModel",
      description:
        "Convert a rendered deck HTML file into a PptxPresentationModel JSON file and return the output path.",
      parameters: [
        {
          name: "html_path",
          type: "string",
          description: "Absolute path to the rendered deck HTML file to convert.",
          required: true,
        },
        {
          name: "output_path",
          type: "string",
          description: "Absolute path where the generated PPTX model JSON file should be written.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description: "Optional absolute working directory retained for compatibility.",
          required: false,
        },
        {
          name: "name",
          type: "string",
          description: "Optional presentation name to store in the generated model.",
          required: false,
        },
        {
          name: "settle_time_ms",
          type: "integer",
          description: "Optional delay after render-ready before DOM extraction.",
          required: false,
        },
        {
          name: "screenshots_dir",
          type: "string",
          description:
            "Optional absolute directory for screenshot fallback assets used during extraction.",
          required: false,
        },
      ],
    },
    {
      name: "forkTemplateGroup",
      description:
        "Fork a builtin template group into a target local directory with TSX slides, group.json, manifest.json, catalog.json, and data assets.",
      parameters: [
        {
          name: "template_group",
          type: "string",
          description: "Builtin template group id to fork, such as general or red-finance.",
          required: true,
        },
        {
          name: "out_dir",
          type: "string",
          description:
            "Absolute target directory for the forked template group.",
          required: true,
        },
        {
          name: "manifest_title",
          type: "string",
          description: "Optional title to write into the generated manifest.json.",
          required: false,
        },
        {
          name: "overwrite",
          type: "boolean",
          description:
            "Whether to replace a non-empty output directory. Defaults to false.",
          required: false,
          default: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Optional absolute working directory retained for compatibility.",
          required: false,
        },
      ],
    },
  ],
  runtime: {
    type: "npm",
    min_version: "1.0.0",
  },
};

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
let previewServerPromise = null;

async function handlePreviewRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = requestUrl.pathname.split("/").filter(Boolean);

  if (parts.length !== 3 || parts[0] !== "preview" || parts[2] !== "deck.html") {
    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end("Not found");
    return;
  }

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
  if (channel !== "ai-outline") {
    throw new Error('"channel" must be "ai-outline"');
  }

  const entry = args.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error('"entry" must be an object');
  }

  return appendAppWorkspaceLog({
    workspace_dir: workspaceDir,
    channel,
    entry,
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
    })),
  );

  return {
    ...result,
    slides,
    preview_url: slides[0]?.preview_url ?? null,
  };
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
  app_create_workspace: toolAppCreateWorkspace,
  app_open_workspace: toolAppOpenWorkspace,
  app_append_workspace_log: toolAppAppendWorkspaceLog,
  app_get_workspace_outline: toolAppGetWorkspaceOutline,
  app_update_workspace_outline: toolAppUpdateWorkspaceOutline,
  app_update_workspace_settings: toolAppUpdateWorkspaceSettings,
  app_update_workspace_title: toolAppUpdateWorkspaceTitle,
  app_list_template_groups: toolAppListTemplateGroups,
  app_get_template_group: toolAppGetTemplateGroup,
  app_get_template_preview: toolAppGetTemplatePreview,
  app_select_workspace_template: toolAppSelectWorkspaceTemplate,
  app_render_deck_html: toolAppRenderDeckHtml,
  listDiscoveredTemplateGroupSummaries: toolListDiscoveredTemplateGroupSummaries,
  getAllDiscoveredTemplateGroups: toolGetAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup: toolGetDiscoveredTemplateGroup,
  buildDeckHtmlFromManifest: toolBuildDeckHtmlFromManifest,
  validateDeckFromManifest: toolValidateDeckFromManifest,
  convertDeckHtmlToPptxModel: toolConvertDeckHtmlToPptxModel,
  forkTemplateGroup: toolForkTemplateGroup,
};

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
      data: { available_tools: TOOL_NAMES },
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
      const stateMachineManifest = await describeTaskStateMachine();
      return makeResponse(id, {
        ...MANIFEST,
        tools: [
          ...MANIFEST.tools,
          ...stateMachineManifest.tools,
        ],
      });
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
        tools_count: MANIFEST.tools.length + TASK_STATE_MACHINE_TOOL_NAMES.length,
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
process.stderr.write(`   Tools: ${[...TOOL_NAMES, ...TASK_STATE_MACHINE_TOOL_NAMES].join(", ")}\n`);

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
