import { constants } from "node:fs";
import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const BROWSER_RUNTIME_SCHEMA_VERSION = 1;

export interface BundledBrowserRuntimeMetadata {
  schema_version: number;
  browser: "chrome-for-testing";
  browser_version: string;
  puppeteer_version: string;
  platform_key: string;
  executable_path: string;
  executable_sha256: string;
}

export interface ResolveBundledBrowserRuntimeInput {
  isSeaProcess?: boolean;
  binaryPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
}

function expectedPlatformKey(platform: NodeJS.Platform, arch: string): string {
  if (platform === "darwin" && arch === "x64") return "darwin-x86_64";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "linux" && arch === "x64") return "linux-x86_64";
  if (platform === "win32" && (arch === "x64" || arch === "ia32")) {
    return "windows-x86_64";
  }
  throw new Error(`Unsupported ppt-engine Binary browser platform: ${platform}/${arch}`);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Bundled browser runtime metadata has invalid ${field}`);
  }
  return value.trim();
}

function parseMetadata(raw: unknown): BundledBrowserRuntimeMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Bundled browser runtime metadata must be a JSON object");
  }
  const record = raw as Record<string, unknown>;
  if (record.schema_version !== BROWSER_RUNTIME_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported bundled browser runtime schema: ${String(record.schema_version)}`,
    );
  }
  if (record.browser !== "chrome-for-testing") {
    throw new Error(`Unsupported bundled browser: ${String(record.browser)}`);
  }
  const executableSha256 = requireNonEmptyString(
    record.executable_sha256,
    "executable_sha256",
  );
  if (!/^[a-f0-9]{64}$/.test(executableSha256)) {
    throw new Error("Bundled browser runtime metadata has invalid executable_sha256");
  }
  return {
    schema_version: BROWSER_RUNTIME_SCHEMA_VERSION,
    browser: "chrome-for-testing",
    browser_version: requireNonEmptyString(record.browser_version, "browser_version"),
    puppeteer_version: requireNonEmptyString(record.puppeteer_version, "puppeteer_version"),
    platform_key: requireNonEmptyString(record.platform_key, "platform_key"),
    executable_path: requireNonEmptyString(record.executable_path, "executable_path"),
    executable_sha256: executableSha256,
  };
}

function resolveInside(rootPath: string, relativePath: string): string {
  const candidate = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Bundled browser executable path escapes lib/browser: ${relativePath}`);
  }
  return candidate;
}

export async function resolveBundledBrowserExecutable(
  input: ResolveBundledBrowserRuntimeInput = {},
): Promise<string | null> {
  const seaModuleSpecifier = ["node", "sea"].join(":");
  const isSeaProcess = input.isSeaProcess ?? (
    await import(seaModuleSpecifier)
  ).isSea();
  if (!isSeaProcess) {
    return null;
  }

  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const binaryPath = await realpath(input.binaryPath ?? process.execPath);
  const distributionRoot = path.dirname(path.dirname(binaryPath));
  const browserRoot = path.join(distributionRoot, "lib", "browser");
  const metadataPath = path.join(browserRoot, "runtime.json");

  let metadata: BundledBrowserRuntimeMetadata;
  try {
    metadata = parseMetadata(JSON.parse(await readFile(metadataPath, "utf8")));
  } catch (error) {
    throw new Error(
      `Invalid bundled browser runtime at "${metadataPath}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  const platformKey = expectedPlatformKey(platform, arch);
  if (metadata.platform_key !== platformKey) {
    throw new Error(
      `Bundled browser platform mismatch: expected ${platformKey}, got ${metadata.platform_key}`,
    );
  }

  const executablePath = resolveInside(browserRoot, metadata.executable_path);
  try {
    await access(
      executablePath,
      platform === "win32" ? constants.F_OK : constants.F_OK | constants.X_OK,
    );
  } catch (error) {
    throw new Error(
      `Bundled Chrome executable is missing or not executable: "${executablePath}"`,
      { cause: error instanceof Error ? error : undefined },
    );
  }
  return executablePath;
}
