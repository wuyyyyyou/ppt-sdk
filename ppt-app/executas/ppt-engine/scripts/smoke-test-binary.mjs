import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function usage() {
  return [
    "Usage:",
    "  node scripts/smoke-test-binary.mjs --binary <path> --extract-dir <path> --work-dir <path> --fixture-dir <path>",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    options[token.slice(2)] = path.resolve(value);
    index += 1;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) throw new Error(`Missing required option --${key}\n${usage()}`);
  return value;
}

function runProcess(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out running ${executable}: ${stderr}`));
    }, options.timeoutMs ?? 300_000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`${executable} exited with code ${code}: ${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    if (options.input !== undefined) child.stdin.end(options.input);
  });
}

async function invokeBinary(binaryPath, request, env) {
  const result = await runProcess(binaryPath, [], {
    env,
    input: `${JSON.stringify(request)}\n`,
  });
  const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let response = JSON.parse(lines.at(-1) ?? "null");
  const transportPath = response?.__file_transport ?? response?.__trans_file__;
  if (typeof transportPath === "string" && transportPath.length > 0) {
    response = JSON.parse(await readFile(transportPath, "utf8"));
    await rm(transportPath, { force: true }).catch(() => undefined);
  }
  if (response?.error) {
    throw new Error(`Binary JSON-RPC error: ${JSON.stringify(response.error)}`);
  }
  return response;
}

function resolveInside(rootPath, relativePath) {
  const candidate = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Browser executable escapes runtime directory: ${relativePath}`);
  }
  return candidate;
}

async function verifyBrowserVersion(extractDir) {
  const browserRoot = path.join(extractDir, "lib", "browser");
  const metadata = JSON.parse(await readFile(path.join(browserRoot, "runtime.json"), "utf8"));
  const executablePath = resolveInside(browserRoot, metadata.executable_path);
  let reportedVersion;
  if (process.platform === "win32") {
    const versionResult = await runProcess("powershell.exe", [
      "-NoProfile",
      "-Command",
      "(Get-Item -LiteralPath $env:PRESENTON_BROWSER_EXECUTABLE).VersionInfo.ProductVersion",
    ], {
      env: {
        ...process.env,
        PRESENTON_BROWSER_EXECUTABLE: executablePath,
      },
      timeoutMs: 30_000,
    });
    reportedVersion = versionResult.stdout.trim();
  } else {
    const result = await runProcess(executablePath, ["--version"], { timeoutMs: 30_000 });
    reportedVersion = `${result.stdout}\n${result.stderr}`.trim();
  }
  if (!reportedVersion.includes(metadata.browser_version)) {
    throw new Error(
      `Bundled Chrome version mismatch: expected ${metadata.browser_version}, got ${reportedVersion}`,
    );
  }
}

async function verifyConcurrentDescribe(binaryPath, env) {
  const request = { jsonrpc: "2.0", method: "describe", id: 1 };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => invokeBinary(binaryPath, request, env)),
  );
  for (const response of responses) {
    if (response?.result?.display_name !== "ppt-engine") {
      throw new Error(`Unexpected concurrent describe response: ${JSON.stringify(response)}`);
    }
  }
}

async function verifyRuntimeInfo(binaryPath, env) {
  const describeResponse = await invokeBinary(binaryPath, {
    jsonrpc: "2.0",
    method: "describe",
    id: 9,
  }, env);
  const runtimeInfoResponse = await invokeBinary(binaryPath, {
    jsonrpc: "2.0",
    method: "invoke",
    id: 10,
    params: {
      tool: "app_get_runtime_info",
      arguments: {},
    },
  }, env);
  const describedVersion = describeResponse?.result?.version;
  const runtimeVersion = runtimeInfoResponse?.result?.data?.ppt_engine_version;
  if (!describedVersion || runtimeVersion !== describedVersion) {
    throw new Error(
      `Binary runtime version mismatch: describe=${JSON.stringify(describedVersion)}, runtime=${JSON.stringify(runtimeVersion)}`,
    );
  }
}

async function verifyRenderedPng(pngPath) {
  const fileStat = await stat(pngPath);
  if (fileStat.size <= 0) throw new Error(`Rendered PNG is empty: ${pngPath}`);
  const image = sharp(pngPath);
  const [metadata, statistics] = await Promise.all([image.metadata(), image.stats()]);
  if (metadata.width !== 2560 || metadata.height !== 1440) {
    throw new Error(
      `Rendered PNG dimensions mismatch: expected 2560x1440, got ${metadata.width}x${metadata.height}`,
    );
  }
  if (!statistics.channels.some((channel) => channel.stdev > 1)) {
    throw new Error(`Rendered PNG has no meaningful pixel variance: ${pngPath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const binaryPath = requireOption(options, "binary");
  const extractDir = requireOption(options, "extract-dir");
  const workDir = requireOption(options, "work-dir");
  const fixtureDir = requireOption(options, "fixture-dir");
  const fixtureCopy = path.join(workDir, "fixture");
  const renderDir = path.join(workDir, "rendered");
  const legacySeaCacheDir = path.join(workDir, "legacy-sea-cache");

  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  await cp(fixtureDir, fixtureCopy, { recursive: true });

  const env = {
    ...process.env,
    PRESENTON_TEMPLATE_ENGINE_SEA_CACHE_DIR: legacySeaCacheDir,
  };

  await verifyBrowserVersion(extractDir);
  const domToPptxBundle = path.join(extractDir, "lib", "app", "dist", "vendor", "dom-to-pptx", "dom-to-pptx.bundle.js");
  if ((await stat(domToPptxBundle)).size <= 0) {
    throw new Error(`Bundled dom-to-pptx runtime is empty: ${domToPptxBundle}`);
  }
  await verifyConcurrentDescribe(binaryPath, env);
  await verifyRuntimeInfo(binaryPath, env);
  const legacyCacheStat = await stat(legacySeaCacheDir).catch(() => null);
  if (legacyCacheStat) {
    throw new Error(`Binary unexpectedly created the legacy SEA extraction cache: ${legacySeaCacheDir}`);
  }

  const renderResponse = await invokeBinary(binaryPath, {
    jsonrpc: "2.0",
    method: "invoke",
    id: 2,
    params: {
      tool: "buildDeckHtmlFromManifest",
      arguments: {
        manifest_path: path.join(fixtureCopy, "manifest.json"),
        output_dir: renderDir,
        name: "binary-browser-smoke",
      },
    },
  }, env);
  const renderResult = renderResponse?.result?.data;
  if (renderResult?.slide_count !== 1 || renderResult?.deck_generated !== true) {
    throw new Error(`Unexpected Binary render result: ${JSON.stringify(renderResponse)}`);
  }
  const pngPath = renderResult.slide_files?.[0]?.output_path;
  const deckHtmlPath = renderResult.deck_output_path;
  if (!pngPath || !deckHtmlPath) {
    throw new Error(`Binary render did not return expected artifacts: ${JSON.stringify(renderResult)}`);
  }
  await verifyRenderedPng(pngPath);
  const deckHtml = await readFile(deckHtmlPath, "utf8");
  if (!deckHtml.includes("PPT_ENGINE_BINARY_SMOKE")) {
    throw new Error("Rendered Deck HTML is missing the smoke marker");
  }

  process.stdout.write("Binary browser smoke test passed\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
