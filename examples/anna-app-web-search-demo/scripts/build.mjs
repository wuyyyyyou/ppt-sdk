import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "src");
const bundleDir = resolve(root, "bundle");

await rm(bundleDir, { recursive: true, force: true });
await mkdir(bundleDir, { recursive: true });

for (const filename of ["index.html", "app.js", "style.css"]) {
  await copyFile(resolve(sourceDir, filename), resolve(bundleDir, filename));
}

console.log(`Built static bundle: ${bundleDir}`);
