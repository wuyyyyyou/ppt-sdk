import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(projectDir, "src", "app", "authoring-kit");
const outputDir = path.join(projectDir, "dist", "authoring-kit");
const kitDir = path.join(outputDir, "kit");
const pageSourceStartersDir = path.join(outputDir, "page-source-starters");

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(kitDir, { recursive: true });

  for (const directoryName of ["foundations", "references"]) {
    await cp(path.join(sourceDir, directoryName), path.join(kitDir, directoryName), {
      recursive: true,
    });
  }
  await cp(path.join(sourceDir, "README.md"), path.join(kitDir, "README.md"));
  await cp(
    path.join(sourceDir, "page-source-starters"),
    pageSourceStartersDir,
    { recursive: true },
  );
}

await main();
