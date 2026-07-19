import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { BrowserPlatform } from "@puppeteer/browsers";
import {
  buildBrowserRuntimeMetadata,
  platformKeyForBrowserPlatform,
} from "../scripts/prepare-browser-runtime.mjs";

test("browser platform mapping excludes linux-aarch64", () => {
  assert.equal(platformKeyForBrowserPlatform(BrowserPlatform.MAC), "darwin-x86_64");
  assert.equal(platformKeyForBrowserPlatform(BrowserPlatform.MAC_ARM), "darwin-arm64");
  assert.equal(platformKeyForBrowserPlatform(BrowserPlatform.LINUX), "linux-x86_64");
  assert.equal(platformKeyForBrowserPlatform(BrowserPlatform.WIN64, "x64"), "windows-x86_64");
  assert.throws(
    () => platformKeyForBrowserPlatform(BrowserPlatform.LINUX_ARM, "arm64"),
    /does not publish a linux-aarch64/,
  );
});

test("browser runtime metadata records the copied executable checksum", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "browser-runtime-metadata-test-"));
  const outputDir = path.join(root, "lib", "browser");
  const executablePath = path.join(outputDir, "chrome-mac-arm64", "Chrome");
  const executableContent = "fake chrome";
  try {
    await mkdir(path.dirname(executablePath), { recursive: true });
    await writeFile(executablePath, executableContent, "utf8");
    const metadata = await buildBrowserRuntimeMetadata({
      browserVersion: "146.0.7680.153",
      executablePath,
      outputDir,
      platformKey: "darwin-arm64",
      puppeteerVersion: "24.40.0",
    });
    assert.deepEqual(metadata, {
      schema_version: 1,
      browser: "chrome-for-testing",
      browser_version: "146.0.7680.153",
      puppeteer_version: "24.40.0",
      platform_key: "darwin-arm64",
      executable_path: "chrome-mac-arm64/Chrome",
      executable_sha256: createHash("sha256").update(executableContent).digest("hex"),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
