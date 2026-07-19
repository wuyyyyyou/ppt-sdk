import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveBundledBrowserExecutable } from "../../src/runtime/bundled-browser-runtime.ts";

async function makeDistribution(platformKey = "linux-x86_64") {
  const root = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-browser-runtime-test-"));
  const binaryPath = path.join(root, "bin", "ppt-engine");
  const browserRoot = path.join(root, "lib", "browser");
  const executablePath = path.join(browserRoot, "chrome-linux64", "chrome");
  await mkdir(path.dirname(binaryPath), { recursive: true });
  await mkdir(path.dirname(executablePath), { recursive: true });
  await writeFile(binaryPath, "binary", "utf8");
  await writeFile(executablePath, "chrome", "utf8");
  await chmod(executablePath, 0o755);
  await writeFile(
    path.join(browserRoot, "runtime.json"),
    `${JSON.stringify({
      schema_version: 1,
      browser: "chrome-for-testing",
      browser_version: "146.0.7680.153",
      puppeteer_version: "24.40.0",
      platform_key: platformKey,
      executable_path: "chrome-linux64/chrome",
      executable_sha256: "a".repeat(64),
    }, null, 2)}\n`,
    "utf8",
  );
  return { root, binaryPath, browserRoot, executablePath };
}

test("source mode does not require a bundled browser runtime", async () => {
  assert.equal(
    await resolveBundledBrowserExecutable({ isSeaProcess: false }),
    null,
  );
});

test("Binary mode resolves Chrome relative to process.execPath", async () => {
  const fixture = await makeDistribution();
  try {
    assert.equal(
      await resolveBundledBrowserExecutable({
        isSeaProcess: true,
        binaryPath: fixture.binaryPath,
        platform: "linux",
        arch: "x64",
      }),
      await realpath(fixture.executablePath),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Binary mode rejects browser metadata for another platform", async () => {
  const fixture = await makeDistribution("darwin-arm64");
  try {
    await assert.rejects(
      () => resolveBundledBrowserExecutable({
        isSeaProcess: true,
        binaryPath: fixture.binaryPath,
        platform: "linux",
        arch: "x64",
      }),
      /platform mismatch/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Binary mode rejects executable paths outside lib/browser", async () => {
  const fixture = await makeDistribution();
  try {
    await writeFile(
      path.join(fixture.browserRoot, "runtime.json"),
      `${JSON.stringify({
        schema_version: 1,
        browser: "chrome-for-testing",
        browser_version: "146.0.7680.153",
        puppeteer_version: "24.40.0",
        platform_key: "linux-x86_64",
        executable_path: "../../../bin/ppt-engine",
        executable_sha256: "a".repeat(64),
      })}\n`,
      "utf8",
    );
    await assert.rejects(
      () => resolveBundledBrowserExecutable({
        isSeaProcess: true,
        binaryPath: fixture.binaryPath,
        platform: "linux",
        arch: "x64",
      }),
      /escapes lib\/browser/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
