import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

import { buildDistributionManifest, verifyArchiveDirectory } from "../scripts/binary-release.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = path.join(PROJECT_DIR, "scripts", "binary-release.mjs");

async function makeTempDir() {
  return mkdir(path.join(os.tmpdir(), `binary-release-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`), {
    recursive: true,
  });
}

async function writeToolManifest(dir: string) {
  const manifestPath = path.join(dir, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      name: "tool-example-ppt-engine",
      display_name: "ppt-engine",
      version: "9.8.7",
      tools: [],
    }, null, 2)}\n`,
    "utf8",
  );
  return manifestPath;
}

async function runBinaryRelease(args: string[], input?: string) {
  if (input !== undefined) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
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
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(new Error(`binary-release exited with code ${code}: ${stderr}`));
      });
      child.stdin.end(input);
    });
  }

  return execFileAsync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
  });
}

test("write-manifest writes the Anna binary distribution manifest", async () => {
  const dir = await makeTempDir();
  const toolManifestPath = await writeToolManifest(dir);
  const outputPath = path.join(dir, "stage", "manifest.json");

  await runBinaryRelease([
    "write-manifest",
    "--tool-manifest",
    toolManifestPath,
    "--output",
    outputPath,
  ]);

  const manifest = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(manifest, {
    name: "tool-example-ppt-engine",
    version: "9.8.7",
    runtime: {
      binary: {
        entrypoint: {
          default: "bin/ppt-engine",
          "windows-x86_64": "bin/ppt-engine.exe",
          "windows-arm64": "bin/ppt-engine.exe",
        },
        lib_dirs: ["lib"],
        data_dirs: ["data"],
        permissions: {
          "bin/ppt-engine": "0o755",
        },
      },
    },
  });
});

test("write-sha256 writes lowercase checksum and archive basename", async () => {
  const dir = await makeTempDir();
  const archivePath = path.join(dir, "tool-v1-darwin-arm64.tar.gz");
  const outputPath = `${archivePath}.sha256`;
  await writeFile(archivePath, "archive bytes", "utf8");

  await runBinaryRelease([
    "write-sha256",
    "--file",
    archivePath,
    "--output",
    outputPath,
  ]);

  const expectedHash = createHash("sha256").update("archive bytes").digest("hex");
  assert.equal(
    await readFile(outputPath, "utf8"),
    `${expectedHash}  tool-v1-darwin-arm64.tar.gz\n`,
  );
});

test("verify-archive validates structure and top-level manifest", async () => {
  const dir = await makeTempDir();
  const toolManifestPath = await writeToolManifest(dir);
  const extractDir = path.join(dir, "extract");
  await mkdir(path.join(extractDir, "bin"), { recursive: true });
  await mkdir(path.join(extractDir, "lib"), { recursive: true });
  await mkdir(path.join(extractDir, "data"), { recursive: true });
  await writeFile(path.join(extractDir, "bin", "ppt-engine"), "", "utf8");

  await runBinaryRelease([
    "write-manifest",
    "--tool-manifest",
    toolManifestPath,
    "--output",
    path.join(extractDir, "manifest.json"),
  ]);

  await runBinaryRelease([
    "verify-archive",
    "--tool-manifest",
    toolManifestPath,
    "--extract-dir",
    extractDir,
    "--platform-key",
    "darwin-arm64",
  ]);
});

test("verifyArchiveDirectory accepts empty lib and data directories", async () => {
  const dir = await makeTempDir();
  const extractDir = path.join(dir, "extract");
  const toolManifest = {
    name: "tool-example-ppt-engine",
    version: "9.8.7",
  };

  await mkdir(path.join(extractDir, "bin"), { recursive: true });
  await mkdir(path.join(extractDir, "lib"), { recursive: true });
  await mkdir(path.join(extractDir, "data"), { recursive: true });
  await writeFile(path.join(extractDir, "bin", "ppt-engine.exe"), "", "utf8");
  await writeFile(
    path.join(extractDir, "manifest.json"),
    `${JSON.stringify(buildDistributionManifest(toolManifest), null, 2)}\n`,
    "utf8",
  );

  await verifyArchiveDirectory({
    toolManifest,
    extractDir,
    platformKey: "windows-x86_64",
  });
});

test("verifyArchiveDirectory accepts Linux platform keys", async () => {
  const dir = await makeTempDir();
  const extractDir = path.join(dir, "extract");
  const toolManifest = {
    name: "tool-example-ppt-engine",
    version: "9.8.7",
  };

  await mkdir(path.join(extractDir, "bin"), { recursive: true });
  await mkdir(path.join(extractDir, "lib"), { recursive: true });
  await mkdir(path.join(extractDir, "data"), { recursive: true });
  await writeFile(path.join(extractDir, "bin", "ppt-engine"), "", "utf8");
  await writeFile(
    path.join(extractDir, "manifest.json"),
    `${JSON.stringify(buildDistributionManifest(toolManifest), null, 2)}\n`,
    "utf8",
  );

  await verifyArchiveDirectory({
    toolManifest,
    extractDir,
    platformKey: "linux-aarch64",
  });
});

test("verify-describe validates Executa tool identity", async () => {
  const dir = await makeTempDir();
  const toolManifestPath = await writeToolManifest(dir);

  await runBinaryRelease([
    "verify-describe",
    "--tool-manifest",
    toolManifestPath,
  ], `${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      name: "tool-example-ppt-engine",
      version: "9.8.7",
    },
  })}\n`);
});
