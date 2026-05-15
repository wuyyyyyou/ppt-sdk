import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(appDir, "..");

export const localToolPaths = {
  appDir,
  repoRoot,
  pptEngineDir: path.join(repoRoot, "presenton-template-engine"),
  pptGenerDir: path.join(repoRoot, "presenton-pptx-generator")
};
