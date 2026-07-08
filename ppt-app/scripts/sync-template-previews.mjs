#!/usr/bin/env node

import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pptAppDir = path.resolve(scriptDir, "..");
const sourceDir = path.join(
  pptAppDir,
  "executas",
  "ppt-engine",
  "dist",
  "template-previews",
  "groups",
);
const targetDir = path.join(pptAppDir, "public", "template-previews");

function logInfo(message) {
  process.stdout.write(`[sync-template-previews] ${message}\n`);
}

function logWarn(message) {
  process.stderr.write(`[sync-template-previews] ${message}\n`);
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function syncGroupPreviewImages(fromGroupDir, toGroupDir) {
  await mkdir(toGroupDir, { recursive: true });
  const files = await readdir(fromGroupDir, { withFileTypes: true });
  let copiedFiles = 0;

  for (const file of files) {
    if (!file.isFile() || path.extname(file.name).toLowerCase() !== ".png") {
      continue;
    }

    await copyFile(path.join(fromGroupDir, file.name), path.join(toGroupDir, file.name));
    copiedFiles += 1;
  }

  return copiedFiles;
}

async function main() {
  if (!(await pathExists(sourceDir))) {
    logWarn(
      `Source not found: ${sourceDir}. Run "npm run build:full" (or "npm run build:template-previews") in ppt-app/executas/ppt-engine to generate previews. Skipping.`,
    );
    return;
  }

  const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
  const groupDirs = sourceEntries.filter((entry) => entry.isDirectory());
  if (groupDirs.length === 0) {
    logWarn(`Source ${sourceDir} contains no template groups. Skipping.`);
    return;
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  let copiedGroups = 0;
  let copiedFiles = 0;
  for (const groupEntry of groupDirs) {
    const fromGroupDir = path.join(sourceDir, groupEntry.name);
    const toGroupDir = path.join(targetDir, groupEntry.name);
    const groupCopiedFiles = await syncGroupPreviewImages(fromGroupDir, toGroupDir);
    copiedGroups += 1;
    copiedFiles += groupCopiedFiles;
  }

  logInfo(
    `Synced ${copiedFiles} preview file(s) from ${copiedGroups} group(s) into ${path.relative(pptAppDir, targetDir)}`,
  );
}

await main().catch((error) => {
  logWarn(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
