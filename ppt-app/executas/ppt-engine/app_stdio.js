#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));

// Anna runtime does not currently understand the plugin's __file_transport
// pointer protocol, so this adapter reads the file and inlines the JSON-RPC
// response back into stdout. Very large payloads can crash the runtime's
// line-based parser, so cap the inlined size and return a JSON-RPC error.
const MAX_INLINE_TRANSPORT_BYTES = 1024 * 1024;

const child = spawn(process.execPath, ["example_plugin.js"], {
  cwd: pluginDir,
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  process.stderr.write(
    `ppt-engine app stdio child exited code=${code ?? "null"} signal=${signal ?? "none"}\n`,
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
    const transportStat = await stat(transportPath);
    if (transportStat.size > MAX_INLINE_TRANSPORT_BYTES) {
      process.stderr.write(
        `ppt-engine app stdio refusing to inline ${transportStat.size} bytes from ${transportPath}; ` +
          `payload exceeds ${MAX_INLINE_TRANSPORT_BYTES} byte cap. ` +
          `Return a URL or external reference instead of embedding large data in the JSON-RPC response.\n`,
      );
      return JSON.stringify({
        jsonrpc: "2.0",
        id: parsed.id ?? null,
        error: {
          code: -32603,
          message:
            `ppt-engine app stdio refusing to inline ${transportStat.size}-byte tool response ` +
            `(cap ${MAX_INLINE_TRANSPORT_BYTES}). ` +
            `Have the tool return a URL or external reference instead of embedding the data.`,
        },
      });
    }
    return (await readFile(transportPath, "utf8")).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      jsonrpc: "2.0",
      id: parsed.id ?? null,
      error: {
        code: -32603,
        message: `ppt-engine app stdio failed to read file transport response: ${message}`,
      },
    });
  }
}
