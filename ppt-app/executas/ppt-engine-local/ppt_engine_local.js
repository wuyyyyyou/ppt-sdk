#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shimDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(shimDir, "../../..");
const engineDir = path.join(repoRoot, "presenton-template-engine");

const child = spawn(process.execPath, ["example_plugin.js"], {
  cwd: engineDir,
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  process.stderr.write(
    `ppt-engine-local child exited code=${code ?? "null"} signal=${signal ?? "none"}\n`
  );
  process.exit(code ?? (signal ? 1 : 0));
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

process.stdin.pipe(child.stdin);

const stdoutLines = createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

stdoutLines.on("line", async (line) => {
  const resolved = await resolveFileTransportLine(line);
  process.stdout.write(`${resolved}\n`);
});

async function resolveFileTransportLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return line;
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return line;
  }

  const transportPath =
    typeof parsed.__file_transport === "string"
      ? parsed.__file_transport
      : typeof parsed.__trans_file__ === "string"
        ? parsed.__trans_file__
        : "";

  if (!transportPath) {
    return line;
  }

  try {
    return (await readFile(transportPath, "utf8")).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      jsonrpc: "2.0",
      id: parsed.id ?? null,
      error: {
        code: -32603,
        message: `ppt-engine-local failed to read file transport response: ${message}`,
      },
    });
  }
}
