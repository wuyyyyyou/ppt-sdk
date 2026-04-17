#!/usr/bin/env node

import readline from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDeckHtmlFromManifest,
  forkTemplateGroup,
  getAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup,
  listDiscoveredTemplateGroupSummaries,
} from "./dist/index.js";

const TOOL_NAMES = [
  "listDiscoveredTemplateGroupSummaries",
  "getAllDiscoveredTemplateGroups",
  "getDiscoveredTemplateGroup",
  "buildDeckHtmlFromManifest",
  "forkTemplateGroup",
];

const MANIFEST = {
  name: "ppt-engine",
  display_name: "ppt-engine",
  version: "0.0.2",
  description:
    "Anna Executa plugin for Presenton template discovery and manifest-based deck HTML generation.",
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
        "Build deck HTML from a manifest object or manifest JSON file, write it to disk, and return the output path.",
      parameters: [
        {
          name: "manifest",
          type: "object",
          description: "Manifest object to render. Provide this or manifest_path.",
          required: false,
        },
        {
          name: "manifest_path",
          type: "string",
          description:
            "Path to a manifest JSON file. Relative paths are resolved from cwd when provided.",
          required: false,
        },
        {
          name: "cwd",
          type: "string",
          description:
            "Working directory used to resolve manifest_path, local slide paths, and relative output paths.",
          required: false,
        },
        {
          name: "output_path",
          type: "string",
          description:
            "File path where the generated deck HTML should be written. Relative paths are resolved from cwd when provided.",
          required: true,
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

async function loadManifest(args) {
  const hasManifest = args.manifest !== undefined;
  const hasManifestPath = args.manifest_path !== undefined;

  if (hasManifest && hasManifestPath) {
    throw new Error('Provide either "manifest" or "manifest_path", not both');
  }

  if (!hasManifest && !hasManifestPath) {
    throw new Error('Missing required "manifest" or "manifest_path"');
  }

  if (hasManifest) {
    if (!args.manifest || typeof args.manifest !== "object" || Array.isArray(args.manifest)) {
      throw new Error('"manifest" must be an object');
    }

    return {
      manifest: args.manifest,
      manifestPath: null,
      manifestCwd: args.cwd ? resolveFromCwd(null, args.cwd) : process.cwd(),
    };
  }

  if (typeof args.manifest_path !== "string" || args.manifest_path.length === 0) {
    throw new Error('"manifest_path" must be a non-empty string');
  }

  const manifestPath = resolveFromCwd(args.cwd, args.manifest_path);
  const manifestRaw = await readFile(manifestPath, "utf8");

  return {
    manifest: JSON.parse(manifestRaw),
    manifestPath,
    manifestCwd: path.dirname(manifestPath),
  };
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

  if (typeof args.output_path !== "string" || args.output_path.length === 0) {
    throw new Error('Missing required parameter: "output_path"');
  }

  const requestedCwd = args.cwd ? resolveFromCwd(null, args.cwd) : null;
  const { manifest, manifestPath, manifestCwd } = await loadManifest({
    ...args,
    cwd: requestedCwd ?? undefined,
  });
  const cwd = requestedCwd ?? manifestCwd;
  const outputPath = resolveFromCwd(cwd, args.output_path);
  const html = await buildDeckHtmlFromManifest({
    cwd,
    manifest,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");

  return {
    output_path: outputPath,
    bytes: Buffer.byteLength(html, "utf8"),
    slide_count: Array.isArray(manifest.slides) ? manifest.slides.length : 0,
    title: typeof manifest.title === "string" ? manifest.title : null,
    manifest_path: manifestPath,
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
  });

  return {
    ...result,
    template_group: templateGroup,
    manifest_slide_count: Array.isArray(result.manifest?.slides) ? result.manifest.slides.length : 0,
  };
}

const TOOL_DISPATCH = {
  listDiscoveredTemplateGroupSummaries: toolListDiscoveredTemplateGroupSummaries,
  getAllDiscoveredTemplateGroups: toolGetAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup: toolGetDiscoveredTemplateGroup,
  buildDeckHtmlFromManifest: toolBuildDeckHtmlFromManifest,
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

async function handleRequest(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return makeResponse(null, undefined, {
      code: -32700,
      message: "Parse error",
    });
  }

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

process.stderr.write("🔌 Presenton template engine Executa plugin started\n");
process.stderr.write(`   Tools: ${TOOL_NAMES.join(", ")}\n`);

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  process.stderr.write(`← ${trimmed}\n`);

  try {
    const response = await handleRequest(trimmed);
    const serialized = JSON.stringify(response);
    process.stdout.write(`${serialized}\n`);
    process.stderr.write(`→ ${serialized}\n`);
  } catch (error) {
    const fallback = JSON.stringify(
      makeResponse(null, undefined, {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      }),
    );
    process.stdout.write(`${fallback}\n`);
    process.stderr.write(`→ ${fallback}\n`);
  }
});
