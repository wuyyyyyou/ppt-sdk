import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src");
const bundleDir = path.join(root, "bundle");

await mkdir(bundleDir, { recursive: true });
await Promise.all([
  cp(path.join(sourceDir, "app.js"), path.join(bundleDir, "app.js")),
  cp(path.join(sourceDir, "index.html"), path.join(bundleDir, "index.html")),
  cp(path.join(sourceDir, "style.css"), path.join(bundleDir, "style.css")),
]);

process.stdout.write("Built Agent Image Attachments Demo static bundle.\n");
