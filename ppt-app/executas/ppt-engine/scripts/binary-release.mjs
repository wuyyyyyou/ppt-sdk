import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BINARY_NAME = "ppt-engine";
const WINDOWS_BINARY_NAME = `${BINARY_NAME}.exe`;

function usage() {
  return [
    "Usage:",
    "  node scripts/binary-release.mjs write-manifest --tool-manifest <path> --output <path>",
    "  node scripts/binary-release.mjs write-sha256 --file <path> --output <path>",
    "  node scripts/binary-release.mjs verify-archive --tool-manifest <path> --extract-dir <path> --platform-key <key>",
    "  node scripts/binary-release.mjs verify-describe --tool-manifest <path>",
  ].join("\n");
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const options = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return { command, options };
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readToolManifest(filePath) {
  const manifest = await readJson(filePath);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Tool manifest must be a JSON object");
  }
  if (typeof manifest.display_name !== "string" || manifest.display_name.length === 0) {
    throw new Error("Tool manifest must include a non-empty display_name");
  }
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Tool manifest must include a non-empty version");
  }
  return manifest;
}

export function buildDistributionManifest(toolManifest) {
  return {
    display_name: toolManifest.display_name,
    version: toolManifest.version,
    runtime: {
      binary: {
        entrypoint: {
          default: `bin/${BINARY_NAME}`,
          "windows-x86_64": `bin/${WINDOWS_BINARY_NAME}`,
          "windows-arm64": `bin/${WINDOWS_BINARY_NAME}`,
        },
        lib_dirs: ["lib"],
        data_dirs: ["data"],
        permissions: {
          [`bin/${BINARY_NAME}`]: "0o755",
        },
      },
    },
  };
}

function assertDeepEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label} mismatch: expected ${expectedText}, got ${actualText}`);
  }
}

async function assertDirectory(targetPath, label) {
  const fileStat = await stat(targetPath).catch(() => null);
  if (!fileStat?.isDirectory()) {
    throw new Error(`Missing ${label} directory: ${targetPath}`);
  }
}

async function assertFile(targetPath, label) {
  const fileStat = await stat(targetPath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`Missing ${label} file: ${targetPath}`);
  }
}

function resolveInside(rootPath, relativePath, label) {
  const candidate = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its runtime directory: ${relativePath}`);
  }
  return candidate;
}

async function verifyBrowserRuntime(extractDir, platformKey) {
  const browserRoot = path.join(extractDir, "lib", "browser");
  const metadataPath = path.join(browserRoot, "runtime.json");
  await assertFile(metadataPath, "bundled browser runtime metadata");
  const metadata = await readJson(metadataPath);
  if (metadata.schema_version !== 1) {
    throw new Error(`Bundled browser schema mismatch: expected 1, got ${metadata.schema_version}`);
  }
  if (metadata.browser !== "chrome-for-testing") {
    throw new Error(`Bundled browser mismatch: expected chrome-for-testing, got ${metadata.browser}`);
  }
  if (metadata.platform_key !== platformKey) {
    throw new Error(
      `Bundled browser platform mismatch: expected ${platformKey}, got ${metadata.platform_key}`,
    );
  }
  if (typeof metadata.browser_version !== "string" || metadata.browser_version.length === 0) {
    throw new Error("Bundled browser metadata is missing browser_version");
  }
  if (typeof metadata.puppeteer_version !== "string" || metadata.puppeteer_version.length === 0) {
    throw new Error("Bundled browser metadata is missing puppeteer_version");
  }
  if (typeof metadata.executable_path !== "string" || metadata.executable_path.length === 0) {
    throw new Error("Bundled browser metadata is missing executable_path");
  }
  if (!/^[a-f0-9]{64}$/.test(metadata.executable_sha256 ?? "")) {
    throw new Error("Bundled browser metadata has invalid executable_sha256");
  }

  const executablePath = resolveInside(
    browserRoot,
    metadata.executable_path,
    "Bundled browser executable",
  );
  await assertFile(executablePath, "bundled Chrome executable");
  const actualSha256 = createHash("sha256").update(await readFile(executablePath)).digest("hex");
  if (actualSha256 !== metadata.executable_sha256) {
    throw new Error(
      `Bundled Chrome checksum mismatch: expected ${metadata.executable_sha256}, got ${actualSha256}`,
    );
  }
  return { executablePath, metadata };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeManifest(options) {
  const toolManifest = await readToolManifest(requireOption(options, "tool-manifest"));
  const outputPath = requireOption(options, "output");
  const manifest = buildDistributionManifest(toolManifest);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function writeSha256(options) {
  const filePath = requireOption(options, "file");
  const outputPath = requireOption(options, "output");
  const hash = createHash("sha256").update(await readFile(filePath)).digest("hex");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${hash}  ${path.basename(filePath)}\n`, "ascii");
}

export async function verifyArchiveDirectory({ toolManifest, extractDir, platformKey }) {
  const expectedDistributionManifest = buildDistributionManifest(toolManifest);

  await assertDirectory(path.join(extractDir, "bin"), "bin");
  await assertDirectory(path.join(extractDir, "lib"), "lib");
  await assertDirectory(path.join(extractDir, "data"), "data");
  await assertFile(path.join(extractDir, "manifest.json"), "binary distribution manifest");

  const binaryFileName = platformKey.startsWith("windows-") ? WINDOWS_BINARY_NAME : BINARY_NAME;
  await assertFile(path.join(extractDir, "bin", binaryFileName), "binary entrypoint");
  await verifyBrowserRuntime(extractDir, platformKey);

  const distributionManifest = await readJson(path.join(extractDir, "manifest.json"));
  assertDeepEqual(distributionManifest, expectedDistributionManifest, "Binary distribution manifest");
}

async function verifyArchive(options) {
  await verifyArchiveDirectory({
    toolManifest: await readToolManifest(requireOption(options, "tool-manifest")),
    extractDir: requireOption(options, "extract-dir"),
    platformKey: requireOption(options, "platform-key"),
  });
}

async function verifyDescribe(options) {
  const toolManifest = await readToolManifest(requireOption(options, "tool-manifest"));
  const input = (await readStdin()).trim();
  if (!input) {
    throw new Error("Missing describe response on stdin");
  }

  const response = JSON.parse(input);
  const result = response?.result;
  if (!result || typeof result !== "object") {
    throw new Error("Describe response must include a result object");
  }
  if (result.display_name !== toolManifest.display_name) {
    throw new Error(`Describe display_name mismatch: expected ${toolManifest.display_name}, got ${result.display_name}`);
  }
  if (result.version !== toolManifest.version) {
    throw new Error(`Describe version mismatch: expected ${toolManifest.version}, got ${result.version}`);
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "write-manifest":
      await writeManifest(options);
      return;
    case "write-sha256":
      await writeSha256(options);
      return;
    case "verify-archive":
      await verifyArchive(options);
      return;
    case "verify-describe":
      await verifyDescribe(options);
      return;
    default:
      throw new Error(command ? `Unknown command: ${command}\n${usage()}` : usage());
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
