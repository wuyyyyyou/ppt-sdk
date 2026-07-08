import { cp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const previewDir = path.join(projectDir, "dist", "template-previews");
const backupDir = path.join(os.tmpdir(), "presenton-template-engine-template-previews");

async function copyDirectoryIfPresent(source, target) {
  try {
    await rm(target, { recursive: true, force: true });
    await cp(source, target, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

const action = process.argv[2];
if (action === "save") {
  await copyDirectoryIfPresent(previewDir, backupDir);
} else if (action === "restore") {
  await copyDirectoryIfPresent(backupDir, previewDir);
  await rm(backupDir, { recursive: true, force: true });
} else {
  throw new Error('Usage: node ./scripts/preserve-dist-template-previews.mjs <save|restore>');
}
