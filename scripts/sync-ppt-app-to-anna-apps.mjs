#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(repoRoot, "ppt-app");
const defaultTargetDir = "/Users/leyouming/company_program/anna/anna-apps/apps/ppt-app";

const excludedDirNames = new Set([
  ".anna",
  ".build",
  ".cache",
  ".git",
  ".pytest_cache",
  ".scratch",
  ".skill",
  ".tmp",
  ".uv-cache",
  ".venv",
  "__pycache__",
  "coverage",
  "dist-anna",
  "node_modules",
  "reports",
  "sea-prep",
]);

function printUsage() {
  process.stdout.write(`Usage: node scripts/sync-ppt-app-to-anna-apps.mjs [options]

Options:
  --target <path>   Target Anna apps directory. Defaults to ${defaultTargetDir}
  --dry-run         Print the planned sync without building or writing the target.
  --force           Replace a dirty target app directory.
  --no-build        Skip the default build steps and copy existing local artifacts.
  --check           Run npm run check in ppt-app before syncing.
  --validate        Run npm run validate in ppt-app before syncing.
  --help            Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    targetDir: defaultTargetDir,
    dryRun: false,
    force: false,
    build: true,
    check: false,
    validate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--target requires a path value");
      }
      options.targetDir = value;
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--no-build") {
      options.build = false;
    } else if (arg === "--check") {
      options.check = true;
    } else if (arg === "--validate") {
      options.validate = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isIgnoredEnvFile(baseName) {
  return baseName === ".env" || (baseName.startsWith(".env.") && baseName !== ".env.example");
}

function shouldExclude(relativePath, dirent) {
  const normalized = toPosix(relativePath);
  const baseName = path.posix.basename(normalized);

  if (dirent.isDirectory()) {
    return excludedDirNames.has(baseName) || baseName.endsWith(".egg-info");
  }

  if (baseName === ".DS_Store" || isIgnoredEnvFile(baseName)) {
    return true;
  }
  if (baseName.endsWith(".pyc") || baseName.endsWith(".blob") || baseName.endsWith(".spec.bak")) {
    return true;
  }
  if (normalized === "bundle/anna-tool-ids.js") {
    return true;
  }
  if (normalized.endsWith("/theme/token.json")) {
    return true;
  }
  if (normalized.endsWith("/presenton_sdk_pptx_generator/_embedded_manifest.py")) {
    return true;
  }
  if (normalized.endsWith("/anna_search_executa/_embedded_manifest.py")) {
    return true;
  }

  return false;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function collectFiles(currentDir = sourceDir, prefix = "") {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
    if (shouldExclude(relativePath, entry)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, relativePath)));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(toPosix(relativePath));
    }
  }

  return files;
}

async function copyFilesToStage(files, stageDir) {
  for (const relativeFile of files) {
    const sourceFile = path.join(sourceDir, ...relativeFile.split("/"));
    const targetFile = path.join(stageDir, ...relativeFile.split("/"));
    const sourceStats = await stat(sourceFile);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await copyFile(sourceFile, targetFile);
    await chmod(targetFile, sourceStats.mode);
  }
}

async function applyTargetGitignoreOverrides(stageDir) {
  const appGitignorePath = path.join(stageDir, ".gitignore");
  const appTargetOverrides = `\

# Anna apps sync target: commit generated runtime artifacts that the monorepo root
# may otherwise ignore.
!executas/ppt-engine/dist/
!executas/ppt-engine/dist/**
`;
  const appCurrent = await readFile(appGitignorePath, "utf8");
  if (!appCurrent.includes("Anna apps sync target")) {
    await writeFile(appGitignorePath, `${appCurrent.replace(/\s*$/, "\n")}${appTargetOverrides}`);
  }

  const engineGitignorePath = path.join(stageDir, "executas", "ppt-engine", ".gitignore");
  const engineTargetOverrides = `\

# Anna apps sync target: commit the built runtime dist.
!dist/
!dist/**
`;
  const engineCurrent = await readFile(engineGitignorePath, "utf8");
  if (!engineCurrent.includes("Anna apps sync target")) {
    await writeFile(
      engineGitignorePath,
      `${engineCurrent.replace(/\s*$/, "\n")}${engineTargetOverrides}`,
    );
  }
}

function findAnnaAppsRoot(targetDir) {
  const resolved = path.resolve(targetDir);
  const root = path.parse(resolved).root;
  const parts = resolved.slice(root.length).split(path.sep);

  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === "anna-apps" && parts[index + 1] === "apps") {
      return path.join(root, ...parts.slice(0, index + 1));
    }
  }

  return "";
}

async function resolveAndValidateTarget(targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedSource = path.resolve(sourceDir);

  if (resolvedTarget === resolvedSource) {
    throw new Error("Target directory must not equal the source ppt-app directory");
  }
  if (path.basename(resolvedTarget) !== "ppt-app") {
    throw new Error(`Target directory must be named ppt-app: ${resolvedTarget}`);
  }

  const annaAppsRoot = findAnnaAppsRoot(resolvedTarget);
  if (!annaAppsRoot) {
    throw new Error(`Target must be under an anna-apps/apps directory: ${resolvedTarget}`);
  }
  if (!(await pathExists(annaAppsRoot))) {
    throw new Error(`Anna apps repository root does not exist: ${annaAppsRoot}`);
  }
  if (!(await pathExists(path.dirname(resolvedTarget)))) {
    throw new Error(`Target parent directory does not exist: ${path.dirname(resolvedTarget)}`);
  }

  await execFile("git", ["-C", annaAppsRoot, "rev-parse", "--show-toplevel"]);

  return { resolvedTarget, annaAppsRoot };
}

async function assertTargetClean({ annaAppsRoot, resolvedTarget, force, dryRun }) {
  const targetRelative = toPosix(path.relative(annaAppsRoot, resolvedTarget));
  const { stdout } = await execFile("git", [
    "-C",
    annaAppsRoot,
    "status",
    "--short",
    "--",
    targetRelative,
  ]);

  const status = stdout.trim();
  if (status && dryRun) {
    return status;
  }
  if (status && !force) {
    throw new Error(
      `Target has uncommitted changes. Commit/stash them or rerun with --force:\n${status}`,
    );
  }

  return status;
}

async function runCommand(command, args, cwd) {
  process.stdout.write(`[sync-ppt-app] run: ${command} ${args.join(" ")} (${cwd})\n`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code=${code ?? "null"} signal=${signal ?? "none"}`,
        ),
      );
    });
  });
}

async function runBuilds(options) {
  if (options.dryRun) {
    process.stdout.write("[sync-ppt-app] dry-run: would skip executing build commands\n");
    return;
  }
  if (!options.build) {
    process.stdout.write("[sync-ppt-app] --no-build: using existing local artifacts\n");
    return;
  }

  await runCommand("npm", ["run", "build:full"], path.join(sourceDir, "executas", "ppt-engine"));
  await runCommand("npm", ["run", "build"], sourceDir);
}

async function runOptionalChecks(options) {
  if (options.dryRun) {
    if (options.check) {
      process.stdout.write("[sync-ppt-app] dry-run: would run npm run check in ppt-app\n");
    }
    if (options.validate) {
      process.stdout.write("[sync-ppt-app] dry-run: would run npm run validate in ppt-app\n");
    }
    return;
  }

  if (options.check) {
    await runCommand("npm", ["run", "check"], sourceDir);
  }
  if (options.validate) {
    await runCommand("npm", ["run", "validate"], sourceDir);
  }
}

async function assertRuntimeArtifacts({ dryRun }) {
  const requiredArtifacts = [
    "executas/ppt-engine/dist/index.js",
    "public/template-previews",
    "bundle/index.html",
  ];
  const missing = [];

  for (const artifact of requiredArtifacts) {
    if (!(await pathExists(path.join(sourceDir, ...artifact.split("/"))))) {
      missing.push(artifact);
    }
  }

  if (missing.length === 0) {
    return;
  }

  const message =
    `Missing runtime artifact(s): ${missing.join(", ")}. ` +
    "Run without --no-build, or build them before syncing.";
  if (dryRun) {
    process.stdout.write(`[sync-ppt-app] dry-run warning: ${message}\n`);
    return;
  }

  throw new Error(message);
}

async function replaceTargetFromStage(stageDir, resolvedTarget) {
  const parentDir = path.dirname(resolvedTarget);
  const backupDir = path.join(
    parentDir,
    `.ppt-app-sync-backup-${process.pid}-${Date.now()}`,
  );

  let hasBackup = false;
  if (await pathExists(resolvedTarget)) {
    await rename(resolvedTarget, backupDir);
    hasBackup = true;
  }

  try {
    await rename(stageDir, resolvedTarget);
    if (hasBackup) {
      await rm(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (hasBackup && !(await pathExists(resolvedTarget))) {
      await rename(backupDir, resolvedTarget);
    }
    throw error;
  }
}

function summarizeFiles(files) {
  const runtimeFiles = files.filter(
    (file) =>
      file.startsWith("bundle/") ||
      file.startsWith("public/template-previews/") ||
      file.startsWith("executas/ppt-engine/dist/"),
  );

  return {
    total: files.length,
    runtime: runtimeFiles.length,
    hasBundleSidecar: files.includes("bundle/anna-tool-ids.js"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const { resolvedTarget, annaAppsRoot } = await resolveAndValidateTarget(options.targetDir);
  const existingTargetDirty = await assertTargetClean({
    annaAppsRoot,
    resolvedTarget,
    force: options.force,
    dryRun: options.dryRun,
  });

  process.stdout.write(`[sync-ppt-app] source: ${sourceDir}\n`);
  process.stdout.write(`[sync-ppt-app] target: ${resolvedTarget}\n`);
  process.stdout.write(`[sync-ppt-app] anna apps repo: ${annaAppsRoot}\n`);
  if (existingTargetDirty && options.force) {
    process.stdout.write("[sync-ppt-app] --force: target dirty changes will be overwritten\n");
  } else if (existingTargetDirty && options.dryRun) {
    process.stdout.write("[sync-ppt-app] dry-run: target has uncommitted changes; real sync would require --force\n");
  }

  await runBuilds(options);
  await runOptionalChecks(options);
  await assertRuntimeArtifacts({ dryRun: options.dryRun });

  const files = (await collectFiles()).sort();
  const summary = summarizeFiles(files);

  process.stdout.write(
    `[sync-ppt-app] selected ${summary.total} file(s), including ${summary.runtime} runtime artifact file(s)\n`,
  );
  if (summary.hasBundleSidecar) {
    throw new Error("bundle/anna-tool-ids.js was selected unexpectedly");
  }

  if (options.dryRun) {
    process.stdout.write("[sync-ppt-app] dry-run: target was not modified\n");
    process.stdout.write("[sync-ppt-app] excluded local state includes node_modules, .venv, .anna, caches, .env\n");
    return;
  }

  const stageDir = path.join(
    path.dirname(resolvedTarget),
    `.ppt-app-sync-stage-${process.pid}-${Date.now()}`,
  );
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  try {
    await copyFilesToStage(files, stageDir);
    await applyTargetGitignoreOverrides(stageDir);
    await replaceTargetFromStage(stageDir, resolvedTarget);
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }

  process.stdout.write(`[sync-ppt-app] synced ppt-app to ${resolvedTarget}\n`);
  process.stdout.write("[sync-ppt-app] next suggested commands:\n");
  process.stdout.write(`  cd ${annaAppsRoot}\n`);
  process.stdout.write("  git status --short\n");
  process.stdout.write("  git diff --stat\n");
  process.stdout.write("  pnpm install --lockfile-only  # when you need to update pnpm-lock.yaml\n");
}

await main().catch((error) => {
  process.stderr.write(`[sync-ppt-app] failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
