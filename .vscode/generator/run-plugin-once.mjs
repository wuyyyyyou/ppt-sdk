import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const PROJECT_DIR = path.join(WORKSPACE_DIR, "presenton-pptx-generator");
const PYTHON_PATH = path.join(PROJECT_DIR, ".venv", "bin", "python");
const DEFAULT_STDIN_FILE = path.join(SCRIPT_DIR, "describe-stdin.json");
const DEFAULT_STDOUT_FILE = path.join(SCRIPT_DIR, "stdout.json");

function resolvePath(filePath, fallbackPath) {
  if (!filePath) {
    return fallbackPath;
  }

  return path.isAbsolute(filePath) ? filePath : path.resolve(WORKSPACE_DIR, filePath);
}

function expandWorkspacePlaceholders(value) {
  if (typeof value === "string") {
    return value.replaceAll("${workspaceFolder}", WORKSPACE_DIR);
  }

  if (Array.isArray(value)) {
    return value.map((item) => expandWorkspacePlaceholders(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandWorkspacePlaceholders(item)]),
    );
  }

  return value;
}

async function main() {
  const stdinFile = resolvePath(process.env.GENERATOR_STDIN_FILE, DEFAULT_STDIN_FILE);
  const stdoutFile = resolvePath(process.env.GENERATOR_STDOUT_FILE, DEFAULT_STDOUT_FILE);

  const rawInput = await readFile(stdinFile, "utf8");
  const request = expandWorkspacePlaceholders(JSON.parse(rawInput));
  const serializedRequest = `${JSON.stringify(request)}\n`;

  const child = spawn(PYTHON_PATH, ["example_plugin.py"], {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdin.end(serializedRequest);

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  await mkdir(path.dirname(stdoutFile), { recursive: true });
  await writeFile(stdoutFile, stdout, "utf8");

  process.stdout.write(`generator stdout written to ${stdoutFile}\n`);

  if (exitCode !== 0) {
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
    process.exit(exitCode ?? 1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
