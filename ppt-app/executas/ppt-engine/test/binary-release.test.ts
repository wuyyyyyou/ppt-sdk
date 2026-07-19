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
      display_name: "ppt-engine",
      version: "9.8.7",
      tools: [],
    }, null, 2)}\n`,
    "utf8",
  );
  return manifestPath;
}

async function writeBrowserRuntime(extractDir: string, platformKey: string) {
  const browserRoot = path.join(extractDir, "lib", "browser");
  const executableRelativePath = platformKey.startsWith("windows-")
    ? "chrome-win64/chrome.exe"
    : "chrome-runtime/chrome";
  const executablePath = path.join(browserRoot, executableRelativePath);
  const executableContent = `fake chrome for ${platformKey}\n`;
  await mkdir(path.dirname(executablePath), { recursive: true });
  await writeFile(executablePath, executableContent, "utf8");
  await writeFile(
    path.join(browserRoot, "runtime.json"),
    `${JSON.stringify({
      schema_version: 1,
      browser: "chrome-for-testing",
      browser_version: "146.0.7680.153",
      puppeteer_version: "24.40.0",
      platform_key: platformKey,
      executable_path: executableRelativePath,
      executable_sha256: createHash("sha256").update(executableContent).digest("hex"),
    }, null, 2)}\n`,
    "utf8",
  );
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
    display_name: "ppt-engine",
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
  await writeBrowserRuntime(extractDir, "darwin-arm64");

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

test("verifyArchiveDirectory accepts an empty data directory with a bundled browser", async () => {
  const dir = await makeTempDir();
  const extractDir = path.join(dir, "extract");
  const toolManifest = {
    display_name: "ppt-engine",
    version: "9.8.7",
  };

  await mkdir(path.join(extractDir, "bin"), { recursive: true });
  await mkdir(path.join(extractDir, "lib"), { recursive: true });
  await mkdir(path.join(extractDir, "data"), { recursive: true });
  await writeFile(path.join(extractDir, "bin", "ppt-engine.exe"), "", "utf8");
  await writeBrowserRuntime(extractDir, "windows-x86_64");
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
    display_name: "ppt-engine",
    version: "9.8.7",
  };

  await mkdir(path.join(extractDir, "bin"), { recursive: true });
  await mkdir(path.join(extractDir, "lib"), { recursive: true });
  await mkdir(path.join(extractDir, "data"), { recursive: true });
  await writeFile(path.join(extractDir, "bin", "ppt-engine"), "", "utf8");
  await writeBrowserRuntime(extractDir, "linux-x86_64");
  await writeFile(
    path.join(extractDir, "manifest.json"),
    `${JSON.stringify(buildDistributionManifest(toolManifest), null, 2)}\n`,
    "utf8",
  );

  await verifyArchiveDirectory({
    toolManifest,
    extractDir,
    platformKey: "linux-x86_64",
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
      display_name: "ppt-engine",
      version: "9.8.7",
    },
  })}\n`);
});
