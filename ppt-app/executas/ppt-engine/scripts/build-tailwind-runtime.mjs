import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("@tailwindcss/browser/package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const expectedVersion = "4.3.2";
if (packageJson.version !== expectedVersion) {
  throw new Error(
    `Expected @tailwindcss/browser ${expectedVersion}, received ${packageJson.version}`,
  );
}

const sourcePath = require.resolve("@tailwindcss/browser");
const outputPath = path.join(projectDir, "dist", "browser", "tailwind-runtime.global.js");
await mkdir(path.dirname(outputPath), { recursive: true });
await copyFile(sourcePath, outputPath);
console.log(`Built local Tailwind browser runtime: ${path.relative(projectDir, outputPath)}`);
