#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildDeckHtmlFromManifest,
  convertDeckHtmlToPptxModel,
  forkTemplateGroup,
  getAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup,
  listDiscoveredTemplateGroupSummaries,
  runDeckValidation,
} from "./dist/index.js";

const TOOL_NAMES = [
  "listDiscoveredTemplateGroupSummaries",
  "getAllDiscoveredTemplateGroups",
  "getDiscoveredTemplateGroup",
  "buildDeckHtmlFromManifest",
  "convertDeckHtmlToPptxModel",
  "validateDeckFromManifest",
  "forkTemplateGroup",
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
  version: "0.1.0",
  description:
    "Anna Executa plugin for Presenton template discovery, manifest-based deck HTML generation, deck HTML to PPTX model conversion, and stability validation.",
  author: "Anna Developer",
  tools: [
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
          description: "Optional list of local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory used to resolve local template paths.",
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
          description: "Optional list of local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory used to resolve local template paths.",
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
          description: "Optional list of local template root directories.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory used to resolve local template paths.",
          required: false,
        },
      ],
    },
    {
      name: "buildDeckHtmlFromManifest",
      description:
        "Build a deck viewer HTML and one HTML file per slide from a manifest JSON file, write them to an output directory, and return the generated file paths.",
      parameters: [
        {
          name: "manifest_path",
          type: "string",
          description:
            "Path to a manifest JSON file. Relative paths are resolved from cwd when provided.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description:
            "Working directory used to resolve manifest_path and relative output paths.",
          required: false,
        },
        {
          name: "output_dir",
          type: "string",
          description:
            "Directory where the generated deck HTML and per-slide HTML files should be written. Relative paths are resolved from cwd when provided.",
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
            "Whether to generate only one slide HTML file. Defaults to false.",
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
            "Path to a manifest JSON file. Relative paths are resolved from cwd when provided.",
          required: true,
        },
        {
          name: "output_dir",
          type: "string",
          description:
            "Output directory used for generated validation artifacts when rendered checks need to build deck HTML.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description:
            "Working directory used to resolve manifest_path and relative output paths.",
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
            "Optional prebuilt deck HTML path to reuse instead of rebuilding during rendered validation.",
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
          description: "Path to the rendered deck HTML file to convert.",
          required: true,
        },
        {
          name: "output_path",
          type: "string",
          description: "Path where the generated PPTX model JSON file should be written.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory used to resolve relative input and output paths.",
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
            "Optional directory for screenshot fallback assets used during extraction.",
          required: false,
        },
      ],
    },
    {
      name: "forkTemplateGroup",
      description:
        "Fork a builtin template group into a target local directory with TSX slides, group.json, manifest.json, and package metadata.",
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
            "Target directory for the forked template group. Relative paths are resolved from cwd when provided.",
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
          name: "install_dependencies",
          type: "boolean",
          description:
            "Whether to run npm install in the forked template directory after files are generated. Defaults to false.",
          required: false,
          default: false,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory used to resolve out_dir when it is relative.",
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
    input.local_roots = localRoots;
  }

  if (args.cwd !== undefined) {
    if (typeof args.cwd !== "string" || args.cwd.length === 0) {
      throw new Error('"cwd" must be a non-empty string when provided');
    }
    input.cwd = args.cwd;
  }

  return input;
}

function resolveFromCwd(cwd, targetPath) {
  if (typeof targetPath !== "string" || targetPath.length === 0) {
    throw new Error("Expected a non-empty path string");
  }

  if (path.isAbsolute(targetPath)) {
    return path.normalize(targetPath);
  }

  const baseDir = cwd ? path.resolve(cwd) : process.cwd();
  return path.resolve(baseDir, targetPath);
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
      const resolvedCwd = resolveFromCwd(null, requestedCwd);
      const cwdStat = await stat(resolvedCwd);
      if (cwdStat.isDirectory()) {
        candidates.push(path.join(resolvedCwd, FILE_TRANSPORT_DIRNAME));
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

  if (typeof args.manifest_path !== "string" || args.manifest_path.length === 0) {
    throw new Error('Missing required parameter: "manifest_path"');
  }

  if (typeof args.output_dir !== "string" || args.output_dir.length === 0) {
    throw new Error('Missing required parameter: "output_dir"');
  }

  const page = args.page !== undefined ? Number(args.page) : undefined;
  if (args.page !== undefined && !Number.isFinite(page)) {
    throw new Error('"page" must be an integer');
  }

  const requestedCwd = args.cwd ? resolveFromCwd(null, args.cwd) : null;
  const result = await buildDeckHtmlFromManifest({
    cwd: requestedCwd ?? undefined,
    manifestPath: args.manifest_path,
    outputDir: args.output_dir,
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

  if (typeof args.manifest_path !== "string" || args.manifest_path.length === 0) {
    throw new Error('Missing required parameter: "manifest_path"');
  }

  if (typeof args.output_dir !== "string" || args.output_dir.length === 0) {
    throw new Error('Missing required parameter: "output_dir"');
  }

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
    cwd: typeof args.cwd === "string" && args.cwd.length > 0
      ? resolveFromCwd(null, args.cwd)
      : undefined,
    manifestPath: args.manifest_path,
    outputDir: args.output_dir,
    name: typeof args.name === "string" && args.name.length > 0 ? args.name : undefined,
    singlePage: args.single_page !== undefined ? Boolean(args.single_page) : undefined,
    page,
    includeRenderedChecks,
    renderedArtifacts: typeof args.deck_html_path === "string" && args.deck_html_path.length > 0
      ? { deckHtmlPath: args.deck_html_path }
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

  if (typeof args.html_path !== "string" || args.html_path.length === 0) {
    throw new Error('Missing required parameter: "html_path"');
  }

  if (typeof args.output_path !== "string" || args.output_path.length === 0) {
    throw new Error('Missing required parameter: "output_path"');
  }

  const cwd = args.cwd ? resolveFromCwd(null, args.cwd) : process.cwd();
  const htmlPath = resolveFromCwd(cwd, args.html_path);
  const outputPath = resolveFromCwd(cwd, args.output_path);
  const screenshotsDir =
    typeof args.screenshots_dir === "string" && args.screenshots_dir.length > 0
      ? resolveFromCwd(cwd, args.screenshots_dir)
      : undefined;
  const html = await readFile(htmlPath, "utf8");
  const name =
    typeof args.name === "string" && args.name.length > 0
      ? args.name
      : path.basename(htmlPath, path.extname(htmlPath));

  const model = await convertDeckHtmlToPptxModel({
    html,
    name,
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

  const resolvedCwd = args.cwd !== undefined ? resolveFromCwd(null, args.cwd) : null;
  const outDir = resolveFromCwd(resolvedCwd, outDirValue);
  const result = await forkTemplateGroup({
    templateGroup,
    outDir,
    manifestTitle: typeof args.manifest_title === "string"
      ? args.manifest_title
      : typeof args.manifestTitle === "string"
        ? args.manifestTitle
        : undefined,
    overwrite: args.overwrite !== undefined ? Boolean(args.overwrite) : undefined,
    installDependencies: args.install_dependencies !== undefined
      ? Boolean(args.install_dependencies)
      : args.installDependencies !== undefined
        ? Boolean(args.installDependencies)
        : undefined,
  });

  return {
    ...result,
    template_group: templateGroup,
    dependencies_installed: result.dependenciesInstalled,
    install_command: result.installCommand,
    package_lock_path: result.packageLockPath,
    node_modules_path: result.nodeModulesPath,
    manifest_slide_count: Array.isArray(result.manifest?.slides) ? result.manifest.slides.length : 0,
  };
}

const TOOL_DISPATCH = {
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
    case "describe":
      return makeResponse(id, MANIFEST);
    case "invoke":
      return handleInvoke(id, params);
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
let didHandleRequest = false;

process.stderr.write("🔌 Presenton template engine Executa plugin started\n");
process.stderr.write(`   Tools: ${TOOL_NAMES.join(", ")}\n`);

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed || didHandleRequest) {
    return;
  }
  didHandleRequest = true;

  const { request, parseErrorResponse } = parseRequestLine(trimmed);
  process.stderr.write(`${summarizeIncomingRequest(request, trimmed)}\n`);

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
    rl.close();
    process.exit(0);
  }
});
