import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const PROJECT_DIR = path.join(WORKSPACE_DIR, "presenton-template-engine");
const DEFAULT_STDIN_FILE = path.join(SCRIPT_DIR, "describe-stdin.json");
const DEFAULT_STDOUT_FILE = path.join(SCRIPT_DIR, "stdout.json");

function resolvePath(filePath, fallbackPath) {
  if (!filePath) {
    return fallbackPath;
  }

  return path.isAbsolute(filePath) ? filePath : path.resolve(WORKSPACE_DIR, filePath);
}

async function main() {
  const stdinFile = resolvePath(process.env.ENGINE_STDIN_FILE, DEFAULT_STDIN_FILE);
  const stdoutFile = resolvePath(process.env.ENGINE_STDOUT_FILE, DEFAULT_STDOUT_FILE);

  const rawInput = await readFile(stdinFile, "utf8");
  const request = JSON.parse(rawInput);
  const serializedRequest = `${JSON.stringify(request)}\n`;

  const child = spawn(process.execPath, ["example_plugin.js"], {
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

  await writeFile(stdoutFile, stdout, "utf8");

  process.stdout.write(`engine stdout written to ${stdoutFile}\n`);

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
