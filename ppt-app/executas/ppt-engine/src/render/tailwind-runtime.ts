import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_MODULE_PATH = fileURLToPath(import.meta.url);
const CURRENT_MODULE_DIR = path.dirname(CURRENT_MODULE_PATH);
const engineRequire = createRequire(CURRENT_MODULE_PATH);

let tailwindBrowserRuntimePromise: Promise<string> | null = null;

function resolveTailwindBrowserRuntimePath(): string {
  const candidates = [
    path.join(CURRENT_MODULE_DIR, "../browser/tailwind-runtime.global.js"),
    path.join(CURRENT_MODULE_DIR, "../../dist/browser/tailwind-runtime.global.js"),
    engineRequire.resolve("@tailwindcss/browser"),
  ];
  const runtimePath = candidates.find((candidate) => existsSync(candidate));
  if (!runtimePath) {
    throw new Error("Failed to locate the bundled Tailwind browser runtime");
  }
  return runtimePath;
}

export function getTailwindBrowserRuntimeBundle(): Promise<string> {
  tailwindBrowserRuntimePromise ??= readFile(resolveTailwindBrowserRuntimePath(), "utf8");
  return tailwindBrowserRuntimePromise;
}
