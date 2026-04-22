#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const WORKSPACE_DIR = path.resolve(path.dirname(SCRIPT_PATH), "..");
const OUTPUT_ROOT = path.join(WORKSPACE_DIR, ".vscode", "pipeline-output");
const ENGINE_DIR = path.join(WORKSPACE_DIR, "presenton-template-engine");
const MODEL_DIR = path.join(WORKSPACE_DIR, "presenton-html-to-pptx-model");
const GENERATOR_DIR = path.join(WORKSPACE_DIR, "presenton-pptx-generator");
const GENERATOR_PYTHON = process.platform === "win32"
  ? path.join(GENERATOR_DIR, ".venv", "Scripts", "python.exe")
  : path.join(GENERATOR_DIR, ".venv", "bin", "python");

const GENERATE_TIMEOUT_MS = 15 * 60 * 1000;
const CHECK_TIMEOUT_MS = 30 * 1000;
const BROWSER_TROUBLESHOOTING_HINT = [
  "Ensure Chrome is available for Puppeteer.",
  "Try: cd presenton-html-to-pptx-model && npx puppeteer browsers install chrome",
].join(" ");

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/run-ppt-pipeline.mjs check-env",
      "  node scripts/run-ppt-pipeline.mjs generate --manifest <manifest.json> [--name <presentation-name>]",
      "",
      "Commands:",
      "  check-env    Validate the local toolchain needed by the VS Code PPT tasks.",
      "  generate     Run manifest -> deck html -> model json -> pptx.",
      "",
      "Options:",
      "  --manifest   Path to the manifest JSON file to render.",
      "  --name       Optional presentation name used for output file names.",
      "  --out-root   Optional output root directory. Defaults to .vscode/pipeline-output.",
      "  --require-manifest-json-name  Require the selected manifest file to be named manifest.json.",
      "  --help       Show this message.",
      "",
    ].join("\n"),
  );
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", options: {} };
  }

  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const separatorIndex = token.indexOf("=");
    const key = token.slice(2, separatorIndex === -1 ? undefined : separatorIndex);
    if (!key) {
      throw new Error(`Invalid option: ${token}`);
    }

    let value;
    if (separatorIndex !== -1) {
      value = token.slice(separatorIndex + 1);
    } else {
      const next = rest[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      value = next;
      index += 1;
    }

    options[key] = value;
  }

  return { command, options };
}

function resolveCliPath(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function sanitizeSegment(value, fallback = "presentation") {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function relativeToWorkspace(targetPath) {
  const relativePath = path.relative(WORKSPACE_DIR, targetPath);
  return relativePath && !relativePath.startsWith("..") ? relativePath : targetPath;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

async function ensureFileReadable(targetPath) {
  await access(targetPath, fsConstants.R_OK);
}

async function loadManifest(manifestPath) {
  const manifestText = await readFile(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Manifest is not valid JSON: ${detail}`);
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Manifest root must be a JSON object");
  }

  return { manifest, manifestText };
}

function buildRunContext({ manifestPath, presentationName, outRoot }) {
  const slug = sanitizeSegment(presentationName, "")
    || sanitizeSegment(path.basename(path.dirname(manifestPath)), "")
    || sanitizeSegment(path.basename(manifestPath, path.extname(manifestPath)), "")
    || "presentation";
  const timestamp = formatTimestamp(new Date());
  const runDir = path.join(outRoot, slug, timestamp);

  return {
    presentationName,
    slug,
    timestamp,
    runDir,
    manifestCopyPath: path.join(runDir, "manifest.json"),
    engineOutputDir: path.join(runDir, "engine"),
    modelOutputDir: path.join(runDir, "model"),
    generatorOutputDir: path.join(runDir, "generator"),
    logsDir: path.join(runDir, "logs"),
    modelOutputPath: path.join(runDir, "model", `${slug}-model.json`),
    pptxOutputPath: path.join(runDir, "generator", `${slug}.pptx`),
    summaryPath: path.join(runDir, "run-summary.json"),
  };
}

function createRpcRequest(id, method, params) {
  return {
    jsonrpc: "2.0",
    method,
    id,
    ...(params ? { params } : {}),
  };
}

function parseLastJsonLine(stdoutText) {
  const lines = stdoutText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      continue;
    }
  }

  return null;
}

async function writeStageLogs(logDir, stageName, payload) {
  await ensureDirectory(logDir);

  const requestPath = path.join(logDir, `${stageName}-request.json`);
  const responsePath = path.join(logDir, `${stageName}-response.json`);
  const stdoutPath = path.join(logDir, `${stageName}-stdout.log`);
  const stderrPath = path.join(logDir, `${stageName}-stderr.log`);

  await Promise.all([
    writeFile(requestPath, `${JSON.stringify(payload.request, null, 2)}\n`, "utf8"),
    writeFile(
      responsePath,
      payload.response === null
        ? "null\n"
        : `${JSON.stringify(payload.response, null, 2)}\n`,
      "utf8",
    ),
    writeFile(stdoutPath, payload.stdout, "utf8"),
    writeFile(stderrPath, payload.stderr, "utf8"),
  ]);

  return { requestPath, responsePath, stdoutPath, stderrPath };
}

async function resolveRpcResponse(rawResponse, cwd) {
  if (
    rawResponse
    && typeof rawResponse === "object"
    && typeof rawResponse.__file_transport === "string"
    && rawResponse.__file_transport.length > 0
  ) {
    const transportPath = path.isAbsolute(rawResponse.__file_transport)
      ? rawResponse.__file_transport
      : path.resolve(cwd, rawResponse.__file_transport);
    const transportText = await readFile(transportPath, "utf8");

    return {
      response: JSON.parse(transportText),
      transportPath,
    };
  }

  return {
    response: rawResponse,
    transportPath: null,
  };
}

async function invokeRpcStage({
  stageName,
  command,
  args,
  cwd,
  request,
  timeoutMs,
  logDir,
}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);

  let exitCode;
  try {
    child.stdin.end(`${JSON.stringify(request)}\n`);
    exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const rawResponse = parseLastJsonLine(stdout);
  const { response, transportPath } = rawResponse
    ? await resolveRpcResponse(rawResponse, cwd)
    : { response: null, transportPath: null };
  const logPaths = logDir
    ? await writeStageLogs(logDir, stageName, { request, response, stdout, stderr })
    : null;

  if (timedOut) {
    throw new Error(
      `${stageName} timed out after ${Math.floor(timeoutMs / 1000)}s${
        logPaths ? `; see ${relativeToWorkspace(logPaths.stderrPath)}` : ""
      }`,
    );
  }

  if (exitCode !== 0) {
    throw new Error(
      `${stageName} exited with code ${exitCode}${
        logPaths ? `; see ${relativeToWorkspace(logPaths.stderrPath)}` : ""
      }`,
    );
  }

  if (!response) {
    throw new Error(
      `${stageName} did not emit a JSON response${
        logPaths ? `; see ${relativeToWorkspace(logPaths.stdoutPath)}` : ""
      }`,
    );
  }

  if (response.error) {
    const hintedMessage = stageName.startsWith("model")
      && typeof response.error.message === "string"
      && response.error.message.includes("Failed to launch the browser process")
      ? `${response.error.message.trim()} ${BROWSER_TROUBLESHOOTING_HINT}`
      : response.error.message;
    throw new Error(
      `${stageName} failed: ${hintedMessage}${
        logPaths ? `; see ${relativeToWorkspace(logPaths.responsePath)}` : ""
      }`,
    );
  }

  return { response, logPaths, stdout, stderr, transportPath };
}

async function collectEnvironmentIssues() {
  const issues = [];

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
    issues.push({
      message: `Node.js 20+ is required. Current version: ${process.version}`,
      hint: "Use a Node 20+ shell before running the VS Code tasks.",
    });
  }

  const checks = [
    {
      filePath: path.join(ENGINE_DIR, "node_modules"),
      message: "presenton-template-engine dependencies are missing",
      hint: "Run: cd presenton-template-engine && npm install",
    },
    {
      filePath: path.join(ENGINE_DIR, "dist", "index.js"),
      message: "presenton-template-engine is not built",
      hint: "Run: cd presenton-template-engine && npm run build",
    },
    {
      filePath: path.join(MODEL_DIR, "node_modules"),
      message: "presenton-html-to-pptx-model dependencies are missing",
      hint: "Run: cd presenton-html-to-pptx-model && npm install",
    },
    {
      filePath: path.join(MODEL_DIR, "dist", "index.js"),
      message: "presenton-html-to-pptx-model is not built",
      hint: "Run: cd presenton-html-to-pptx-model && npm run build",
    },
    {
      filePath: GENERATOR_PYTHON,
      message: "presenton-pptx-generator virtualenv is missing",
      hint: [
        "Run:",
        "  cd presenton-pptx-generator",
        "  uv venv .venv",
        "  UV_CACHE_DIR=$(pwd)/.uv-cache uv pip install --python .venv/bin/python -e .",
      ].join("\n"),
    },
  ];

  for (const check of checks) {
    if (!(await pathExists(check.filePath))) {
      issues.push(check);
    }
  }

  return issues;
}

async function runDescribeChecks() {
  const describeRequest = createRpcRequest(1, "describe");

  await invokeRpcStage({
    stageName: "engine-describe",
    command: process.execPath,
    args: ["example_plugin.js"],
    cwd: ENGINE_DIR,
    request: describeRequest,
    timeoutMs: CHECK_TIMEOUT_MS,
  });

  await invokeRpcStage({
    stageName: "model-describe",
    command: process.execPath,
    args: ["example_plugin.js"],
    cwd: MODEL_DIR,
    request: describeRequest,
    timeoutMs: CHECK_TIMEOUT_MS,
  });

  await invokeRpcStage({
    stageName: "generator-describe",
    command: GENERATOR_PYTHON,
    args: ["example_plugin.py"],
    cwd: GENERATOR_DIR,
    request: describeRequest,
    timeoutMs: CHECK_TIMEOUT_MS,
  });
}

async function runModelBrowserSmokeCheck() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "presenton-ppt-pipeline-env-"));
  const htmlPath = path.join(tempDir, "deck.html");
  const outputPath = path.join(tempDir, "model.json");
  const html = [
    "<!doctype html>",
    "<html>",
    "<body>",
    '  <div id="presentation-slides-wrapper">',
    "    <div>",
    '      <div style="width:1280px;height:720px;background:#ffffff;position:relative;">',
    '        <h1 style="position:absolute;left:64px;top:64px;font-size:32px;color:#111827;">Env Check</h1>',
    "      </div>",
    "    </div>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");

  try {
    await writeFile(htmlPath, html, "utf8");
    const request = createRpcRequest(2, "invoke", {
      tool: "convertDeckHtmlToPptxModel",
      arguments: {
        cwd: tempDir,
        html_path: htmlPath,
        output_path: outputPath,
        name: "env-check",
      },
    });

    await invokeRpcStage({
      stageName: "model-browser-check",
      command: process.execPath,
      args: ["example_plugin.js"],
      cwd: MODEL_DIR,
      request,
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function checkEnvironment() {
  const issues = await collectEnvironmentIssues();
  if (issues.length > 0) {
    process.stderr.write("Environment check failed.\n\n");
    issues.forEach((issue, index) => {
      process.stderr.write(`${index + 1}. ${issue.message}\n`);
      process.stderr.write(`   ${issue.hint}\n`);
    });
    process.exitCode = 1;
    return;
  }

  try {
    await runDescribeChecks();
    await runModelBrowserSmokeCheck();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write("Environment check failed.\n\n");
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Environment check passed.\n");
  process.stdout.write(`- Node.js: ${process.version}\n`);
  process.stdout.write(`- Engine plugin: ${relativeToWorkspace(ENGINE_DIR)}\n`);
  process.stdout.write(`- Model plugin: ${relativeToWorkspace(MODEL_DIR)}\n`);
  process.stdout.write(`- Generator plugin: ${relativeToWorkspace(GENERATOR_DIR)}\n`);
  process.stdout.write("- Model browser smoke check: passed\n");
}

async function generatePipeline(options) {
  const manifestOption = options.manifest;
  if (!manifestOption) {
    throw new Error('Missing required option: "--manifest"');
  }

  const manifestPath = resolveCliPath(manifestOption);
  if (options["require-manifest-json-name"] !== undefined) {
    const actualFileName = path.basename(manifestPath);
    if (actualFileName !== "manifest.json") {
      throw new Error(
        [
          'PPT: Generate PPTX From Current Manifest expects the active editor to be a file named "manifest.json".',
          `Current file: ${actualFileName}`,
          "Switch to the target manifest.json tab and rerun Cmd/Ctrl+Shift+B.",
        ].join("\n"),
      );
    }
  }
  await ensureFileReadable(manifestPath);

  const manifestStat = await stat(manifestPath);
  if (!manifestStat.isFile()) {
    throw new Error(`Manifest path is not a file: ${manifestPath}`);
  }

  const issues = await collectEnvironmentIssues();
  if (issues.length > 0) {
    throw new Error(
      [
        "Environment is not ready:",
        ...issues.map((issue, index) => `${index + 1}. ${issue.message}\n   ${issue.hint}`),
      ].join("\n"),
    );
  }

  const { manifest, manifestText } = await loadManifest(manifestPath);
  const derivedName = typeof options.name === "string" && options.name.length > 0
    ? options.name
    : typeof manifest.title === "string" && manifest.title.trim().length > 0
      ? manifest.title.trim()
      : path.basename(manifestPath, path.extname(manifestPath));
  const outRoot = options["out-root"] ? resolveCliPath(options["out-root"]) : OUTPUT_ROOT;
  const runContext = buildRunContext({
    manifestPath,
    presentationName: derivedName,
    outRoot,
  });

  await Promise.all([
    ensureDirectory(runContext.engineOutputDir),
    ensureDirectory(runContext.modelOutputDir),
    ensureDirectory(runContext.generatorOutputDir),
    ensureDirectory(runContext.logsDir),
  ]);
  await writeFile(runContext.manifestCopyPath, manifestText, "utf8");

  process.stdout.write(`Manifest: ${relativeToWorkspace(manifestPath)}\n`);
  process.stdout.write(`Run directory: ${relativeToWorkspace(runContext.runDir)}\n`);
  process.stdout.write(`[1/3] Build deck HTML...\n`);

  const engineRequest = createRpcRequest(1, "invoke", {
    tool: "buildDeckHtmlFromManifest",
    arguments: {
      cwd: runContext.runDir,
      manifest_path: manifestPath,
      output_dir: runContext.engineOutputDir,
      name: runContext.slug,
    },
  });
  const engineStage = await invokeRpcStage({
    stageName: "engine",
    command: process.execPath,
    args: ["example_plugin.js"],
    cwd: ENGINE_DIR,
    request: engineRequest,
    timeoutMs: GENERATE_TIMEOUT_MS,
    logDir: runContext.logsDir,
  });

  const deckOutputPath = engineStage.response.result?.data?.deck_output_path;
  if (typeof deckOutputPath !== "string" || deckOutputPath.length === 0) {
    throw new Error("Engine stage did not return deck_output_path");
  }

  process.stdout.write(`[2/3] Convert deck HTML to model JSON...\n`);
  const modelRequest = createRpcRequest(2, "invoke", {
    tool: "convertDeckHtmlToPptxModel",
    arguments: {
      cwd: runContext.modelOutputDir,
      html_path: deckOutputPath,
      output_path: runContext.modelOutputPath,
      name: runContext.presentationName,
      screenshots_dir: path.join(runContext.modelOutputDir, "screenshots"),
    },
  });
  const modelStage = await invokeRpcStage({
    stageName: "model",
    command: process.execPath,
    args: ["example_plugin.js"],
    cwd: MODEL_DIR,
    request: modelRequest,
    timeoutMs: GENERATE_TIMEOUT_MS,
    logDir: runContext.logsDir,
  });

  const modelOutputPath = modelStage.response.result?.data?.output_path;
  if (typeof modelOutputPath !== "string" || modelOutputPath.length === 0) {
    throw new Error("Model stage did not return output_path");
  }

  process.stdout.write(`[3/3] Generate PPTX...\n`);
  const generatorRequest = createRpcRequest(3, "invoke", {
    tool: "generatePptx",
    arguments: {
      cwd: runContext.generatorOutputDir,
      model_path: modelOutputPath,
      output_path: runContext.pptxOutputPath,
    },
  });
  const generatorStage = await invokeRpcStage({
    stageName: "generator",
    command: GENERATOR_PYTHON,
    args: ["example_plugin.py"],
    cwd: GENERATOR_DIR,
    request: generatorRequest,
    timeoutMs: GENERATE_TIMEOUT_MS,
    logDir: runContext.logsDir,
  });

  const finalPptxPath = generatorStage.response.result?.data?.path;
  if (typeof finalPptxPath !== "string" || finalPptxPath.length === 0) {
    throw new Error("Generator stage did not return path");
  }

  const summary = {
    created_at: new Date().toISOString(),
    manifest_path: manifestPath,
    manifest_copy_path: runContext.manifestCopyPath,
    presentation_name: runContext.presentationName,
    slug: runContext.slug,
    run_dir: runContext.runDir,
    engine: {
      output_dir: runContext.engineOutputDir,
      deck_output_path: deckOutputPath,
      slide_count: engineStage.response.result?.data?.slide_count ?? null,
      log_paths: engineStage.logPaths,
    },
    model: {
      output_path: modelOutputPath,
      screenshots_dir: modelStage.response.result?.data?.screenshots_dir ?? null,
      slide_count: modelStage.response.result?.data?.slide_count ?? null,
      log_paths: modelStage.logPaths,
    },
    generator: {
      output_path: finalPptxPath,
      slide_count: generatorStage.response.result?.data?.slide_count ?? null,
      presentation_name: generatorStage.response.result?.data?.presentation_name ?? null,
      log_paths: generatorStage.logPaths,
    },
  };

  await writeFile(runContext.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  process.stdout.write("Pipeline completed.\n");
  process.stdout.write(`- Deck HTML: ${relativeToWorkspace(deckOutputPath)}\n`);
  process.stdout.write(`- Model JSON: ${relativeToWorkspace(modelOutputPath)}\n`);
  process.stdout.write(`- PPTX: ${relativeToWorkspace(finalPptxPath)}\n`);
  process.stdout.write(`- Summary: ${relativeToWorkspace(runContext.summaryPath)}\n`);
  process.stdout.write(`- Logs: ${relativeToWorkspace(runContext.logsDir)}\n`);
}

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));

  if (command === "help" || options.help) {
    printUsage();
    return;
  }

  switch (command) {
    case "check-env":
      await checkEnvironment();
      return;
    case "generate":
      await generatePipeline(options);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
