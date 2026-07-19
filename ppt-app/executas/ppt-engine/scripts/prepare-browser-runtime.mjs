import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Browser,
  BrowserPlatform,
  detectBrowserPlatform,
  install,
  resolveBuildId,
} from "@puppeteer/browsers";
import { PUPPETEER_REVISIONS } from "puppeteer-core/internal/revisions.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_DIR = path.resolve(path.dirname(SCRIPT_PATH), "..");
const BROWSER_RUNTIME_SCHEMA_VERSION = 1;

function usage() {
  return [
    "Usage:",
    "  node scripts/prepare-browser-runtime.mjs --cache-dir <path> --output-dir <path> --platform-key <key>",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    options[token.slice(2)] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option --${key}\n${usage()}`);
  }
  return path.resolve(value);
}

export function platformKeyForBrowserPlatform(platform, arch = os.arch()) {
  switch (platform) {
    case BrowserPlatform.MAC:
      return "darwin-x86_64";
    case BrowserPlatform.MAC_ARM:
      return "darwin-arm64";
    case BrowserPlatform.LINUX:
      return "linux-x86_64";
    case BrowserPlatform.LINUX_ARM:
      throw new Error("ppt-engine does not publish a linux-aarch64 Binary browser runtime");
    case BrowserPlatform.WIN64:
    case BrowserPlatform.WIN32:
      if (arch !== "x64" && arch !== "ia32") {
        throw new Error(`Unsupported Windows browser architecture: ${arch}`);
      }
      return "windows-x86_64";
    default:
      throw new Error(`Unsupported Puppeteer browser platform: ${platform}`);
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export async function buildBrowserRuntimeMetadata({
  browserVersion,
  executablePath,
  outputDir,
  platformKey,
  puppeteerVersion,
}) {
  const relativeExecutablePath = path.relative(outputDir, executablePath);
  if (
    !relativeExecutablePath
    || relativeExecutablePath.startsWith("..")
    || path.isAbsolute(relativeExecutablePath)
  ) {
    throw new Error(`Browser executable is outside the runtime directory: ${executablePath}`);
  }

  return {
    schema_version: BROWSER_RUNTIME_SCHEMA_VERSION,
    browser: "chrome-for-testing",
    browser_version: browserVersion,
    puppeteer_version: puppeteerVersion,
    platform_key: platformKey,
    executable_path: toPosixPath(relativeExecutablePath),
    executable_sha256: await sha256File(executablePath),
  };
}

export async function prepareBrowserRuntime({ cacheDir, outputDir, platformKey }) {
  const browserPlatform = detectBrowserPlatform();
  if (!browserPlatform) {
    throw new Error(`Puppeteer does not support this build platform: ${process.platform}/${process.arch}`);
  }

  const detectedPlatformKey = platformKeyForBrowserPlatform(browserPlatform);
  if (detectedPlatformKey !== platformKey) {
    throw new Error(
      `Browser platform mismatch: build requested ${platformKey}, Puppeteer detected ${detectedPlatformKey}`,
    );
  }

  const pinnedRevision = PUPPETEER_REVISIONS.chrome;
  if (!pinnedRevision) {
    throw new Error("The installed Puppeteer package does not declare a pinned Chrome revision");
  }
  const browserVersion = await resolveBuildId(Browser.CHROME, browserPlatform, pinnedRevision);
  if (!browserVersion) {
    throw new Error(`Could not resolve pinned Chrome revision: ${pinnedRevision}`);
  }

  await mkdir(cacheDir, { recursive: true });
  const installedBrowser = await install({
    browser: Browser.CHROME,
    buildId: browserVersion,
    cacheDir,
    platform: browserPlatform,
    downloadProgressCallback: "default",
  });

  const packageJson = JSON.parse(
    await readFile(path.join(PROJECT_DIR, "node_modules", "puppeteer", "package.json"), "utf8"),
  );
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(installedBrowser.path, outputDir, {
    recursive: true,
    dereference: false,
    force: true,
    verbatimSymlinks: true,
  });

  const copiedExecutablePath = path.join(
    outputDir,
    path.relative(installedBrowser.path, installedBrowser.executablePath),
  );
  const executableStat = await stat(copiedExecutablePath);
  if (!executableStat.isFile()) {
    throw new Error(`Copied Chrome executable is missing: ${copiedExecutablePath}`);
  }

  const metadata = await buildBrowserRuntimeMetadata({
    browserVersion: installedBrowser.buildId,
    executablePath: copiedExecutablePath,
    outputDir,
    platformKey,
    puppeteerVersion: packageJson.version,
  });
  await writeFile(
    path.join(outputDir, "runtime.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  return metadata;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const platformKey = options["platform-key"];
  if (!platformKey) {
    throw new Error(`Missing required option --platform-key\n${usage()}`);
  }
  const metadata = await prepareBrowserRuntime({
    cacheDir: requireOption(options, "cache-dir"),
    outputDir: requireOption(options, "output-dir"),
    platformKey,
  });
  process.stdout.write(`Prepared bundled ${metadata.browser} ${metadata.browser_version} for ${metadata.platform_key}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
