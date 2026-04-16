#!/usr/bin/env node

import readline from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { convertDeckHtmlToPptxModel } from "./dist/index.js";

const TOOL_NAME = "convertDeckHtmlToPptxModel";

const MANIFEST = {
  name: "presenton-html-to-pptx-model-plugin",
  display_name: "Presenton HTML To PPTX Model Plugin",
  version: "0.1.0",
  description:
    "Anna Executa plugin for converting rendered deck HTML files into PPTX presentation model JSON files.",
  author: "Anna Developer",
  tools: [
    {
      name: TOOL_NAME,
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

function invalidParams(message) {
  return { code: -32602, message };
}

function resolveFromCwd(cwd, targetPath) {
  if (typeof targetPath !== "string" || targetPath.length === 0) {
    throw new Error("Expected a non-empty path string");
  }

  const baseDir = cwd ? path.resolve(cwd) : process.cwd();
  return path.resolve(baseDir, targetPath);
}

function ensureObjectArguments(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Arguments must be an object");
  }
}

async function toolConvertDeckHtmlToPptxModel(args) {
  ensureObjectArguments(args);

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

async function handleInvoke(id, params = {}) {
  const tool = params.tool;
  const args = params.arguments ?? {};

  if (!tool || typeof tool !== "string") {
    return makeResponse(id, undefined, invalidParams("Missing 'tool' in params"));
  }

  if (tool !== TOOL_NAME) {
    return makeResponse(id, undefined, {
      code: -32601,
      message: `Unknown tool: ${tool}`,
      data: { available_tools: [TOOL_NAME] },
    });
  }

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return makeResponse(
      id,
      undefined,
      invalidParams("'arguments' must be an object"),
    );
  }

  try {
    const data = await toolConvertDeckHtmlToPptxModel(args);
    return makeResponse(id, { success: true, data, tool });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool execution failed";
    const code =
      /missing required|must be|expected a non-empty/i.test(message) ? -32602 : -32603;

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

process.stderr.write("🔌 Presenton HTML to PPTX model Executa plugin started\n");
process.stderr.write(`   Tools: ${TOOL_NAME}\n`);

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
