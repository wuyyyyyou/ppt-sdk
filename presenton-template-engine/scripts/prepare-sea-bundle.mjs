import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const SEA_PREP_DIR = process.env.PRESENTON_TEMPLATE_ENGINE_SEA_PREP_DIR
  ? path.resolve(process.env.PRESENTON_TEMPLATE_ENGINE_SEA_PREP_DIR)
  : path.join(PROJECT_DIR, "sea-prep");
const SEA_APP_DIR = path.join(SEA_PREP_DIR, "app");
const SEA_MANIFEST_PATH = path.join(SEA_APP_DIR, ".sea-asset-manifest.json");
const SEA_CONFIG_PATH = path.join(SEA_PREP_DIR, "sea-config.json");
const SEA_BLOB_PATH = path.join(SEA_PREP_DIR, "sea.blob");
const SEA_MAIN_PATH = path.join(PROJECT_DIR, "scripts", "sea-bootstrap.cjs");

const INCLUDED_PATHS = [
  "package.json",
  "manifest.json",
  "example_plugin.js",
  "dist",
  "node_modules",
];

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function shouldSkipProjectPath(relativePath) {
  // Match on a posix-normalized path so the skip list also works on Windows
  // build runners, where path.relative yields backslash separators.
  const posixPath = toPosixPath(relativePath);
  return (
    posixPath === "node_modules/.package-lock.json" ||
    posixPath.startsWith("node_modules/.bin/") ||
    // Keep @types/* in the SEA bundle. The runtime pre-render TypeScript check
    // (assertLocalTemplateTypecheck) resolves React/JSX types from @types/react
    // and recharts' chart types from @types/d3-*. Without them, valid React such
    // as `<Component key={...} />` inside a .map() fails with TS2322
    // "Property 'key' does not exist", which the render-fix agent cannot repair
    // and loops on forever. Only @types/node is dropped: local templates are
    // forbidden from importing node builtins, and it is by far the largest
    // @types package (~2.3MB).
    posixPath === "node_modules/@types/node" ||
    posixPath.startsWith("node_modules/@types/node/") ||
    posixPath === "node_modules/postject" ||
    posixPath.startsWith("node_modules/postject/")
  );
}

async function copyIntoStage(relativePath) {
  const sourcePath = path.join(PROJECT_DIR, relativePath);
  const targetPath = path.join(SEA_APP_DIR, relativePath);

  await cp(sourcePath, targetPath, {
    recursive: true,
    dereference: true,
    force: true,
    filter(source) {
      const normalizedSource = path.resolve(source);
      const relativeSource = path.relative(PROJECT_DIR, normalizedSource);

      if (!relativeSource) {
        return true;
      }

      return !shouldSkipProjectPath(relativeSource);
    },
  });
}

async function collectFiles(rootDir) {
  const collected = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.relative(rootDir, absolutePath);
      if (relativePath === ".sea-asset-manifest.json") {
        continue;
      }

      const fileStat = await stat(absolutePath);
      const sha256 = createHash("sha256")
        .update(await readFile(absolutePath))
        .digest("hex");
      collected.push({
        assetKey: `app/${toPosixPath(relativePath)}`,
        relativePath: toPosixPath(relativePath),
        mode: fileStat.mode & 0o777,
        sha256,
      });
    }
  }

  await walk(rootDir);
  return collected;
}

async function main() {
  await rm(SEA_PREP_DIR, { recursive: true, force: true });
  await mkdir(SEA_APP_DIR, { recursive: true });

  for (const relativePath of INCLUDED_PATHS) {
    await copyIntoStage(relativePath);
  }

  const files = await collectFiles(SEA_APP_DIR);
  const manifest = {
    entry: "example_plugin.js",
    files,
  };

  await writeFile(SEA_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const assets = {
    "app/.sea-asset-manifest.json": SEA_MANIFEST_PATH,
  };

  for (const file of files) {
    assets[file.assetKey] = path.join(SEA_APP_DIR, file.relativePath);
  }

  const seaConfig = {
    main: SEA_MAIN_PATH,
    output: SEA_BLOB_PATH,
    disableExperimentalSEAWarning: true,
    assets,
  };

  await writeFile(SEA_CONFIG_PATH, `${JSON.stringify(seaConfig, null, 2)}\n`, "utf8");

  console.log(
    `Prepared SEA assets: ${files.length} files staged under ${path.relative(PROJECT_DIR, SEA_APP_DIR)}`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exit(1);
});
