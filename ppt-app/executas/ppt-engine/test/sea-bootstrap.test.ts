import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const {
  CACHE_SCHEMA_VERSION,
  ensureExtractedApp,
  resolveBundleFilePath,
} = require("../scripts/sea-bootstrap.cjs") as {
  CACHE_SCHEMA_VERSION: number;
  ensureExtractedApp: (options: {
    cacheRoot: string;
    manifestContent: string;
    readAssetBuffer: (assetKey: string) => Buffer;
  }) => { bundleId: string; bundleRoot: string; entryPath: string };
  resolveBundleFilePath: (bundleRoot: string, relativePath: string) => string;
};

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(TEST_DIR, "fixtures", "sea-cache-worker.cjs");

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-sea-cache-test-"));
  const cacheRoot = path.join(root, "cache");
  const assetRoot = path.join(root, "assets");
  const manifestPath = path.join(root, "manifest.json");
  const files = [
    { relativePath: "example_plugin.js", content: "export const marker = 'entry';\n", mode: 0o644 },
    { relativePath: "package.json", content: "{\"type\":\"module\"}\n", mode: 0o644 },
    { relativePath: "dist/index.js", content: "export const value = 42;\n", mode: 0o644 },
  ];

  await mkdir(assetRoot, { recursive: true });
  for (const file of files) {
    const assetPath = path.join(assetRoot, file.relativePath);
    await mkdir(path.dirname(assetPath), { recursive: true });
    await writeFile(assetPath, file.content, "utf8");
  }

  const manifest = {
    entry: "example_plugin.js",
    files: files.map((file) => ({
      assetKey: `app/${file.relativePath}`,
      relativePath: file.relativePath,
      mode: file.mode,
      sha256: createHash("sha256").update(file.content).digest("hex"),
    })),
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, manifestContent, "utf8");

  return { root, cacheRoot, assetRoot, manifestPath, manifestContent };
}

function runWorker(input: {
  cacheRoot: string;
  manifestPath: string;
  assetRoot: string;
}): Promise<{ bundleId: string; bundleRoot: string; entryPath: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      WORKER_PATH,
      input.cacheRoot,
      input.manifestPath,
      input.assetRoot,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`SEA cache worker exited with ${code}: ${stderr}`));
        return;
      }
      resolve(JSON.parse(stdout.trim()));
    });
  });
}

test("SEA cache schema uses the v2 namespace contract", () => {
  assert.equal(CACHE_SCHEMA_VERSION, 2);
});

test("SEA cache rejects asset paths that escape the bundle root", () => {
  assert.throws(
    () => resolveBundleFilePath("/tmp/bundle", "../outside.js"),
    /escapes the bundle root/,
  );
});

test("SEA cache validates asset checksums before publication", async () => {
  const fixture = await makeFixture();
  try {
    const invalidManifest = JSON.parse(fixture.manifestContent);
    invalidManifest.files[0].sha256 = "0".repeat(64);
    assert.throws(
      () => ensureExtractedApp({
        cacheRoot: fixture.cacheRoot,
        manifestContent: `${JSON.stringify(invalidManifest)}\n`,
        readAssetBuffer(assetKey: string) {
          return require("node:fs").readFileSync(
            path.join(fixture.assetRoot, assetKey.replace(/^app\//, "")),
          );
        },
      }),
      /checksum mismatch/,
    );
    const cacheEntries = await readdir(fixture.cacheRoot);
    assert.deepEqual(cacheEntries, []);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("eight processes can publish and reuse one fresh SEA cache concurrently", async () => {
  const fixture = await makeFixture();
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => runWorker(fixture)));
    assert.equal(new Set(results.map((result) => result.bundleRoot)).size, 1);
    assert.equal(new Set(results.map((result) => result.entryPath)).size, 1);

    const bundleRoot = results[0]!.bundleRoot;
    assert.equal(await readFile(path.join(bundleRoot, ".ready"), "utf8"), results[0]!.bundleId);
    assert.equal(await readFile(path.join(bundleRoot, "dist", "index.js"), "utf8"), "export const value = 42;\n");
    assert.ok((await stat(path.join(bundleRoot, "example_plugin.js"))).isFile());

    const cacheEntries = await readdir(fixture.cacheRoot);
    assert.deepEqual(cacheEntries, [results[0]!.bundleId]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("an invalid ready cache is quarantined and rebuilt", async () => {
  const fixture = await makeFixture();
  try {
    const first = await runWorker(fixture);
    await rm(path.join(first.bundleRoot, "example_plugin.js"));

    const repaired = await runWorker(fixture);
    assert.equal(repaired.bundleRoot, first.bundleRoot);
    assert.equal(
      await readFile(path.join(repaired.bundleRoot, "example_plugin.js"), "utf8"),
      "export const marker = 'entry';\n",
    );
    assert.deepEqual(await readdir(fixture.cacheRoot), [first.bundleId]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
