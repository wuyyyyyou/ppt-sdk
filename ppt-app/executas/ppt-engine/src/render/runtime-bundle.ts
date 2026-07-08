import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_MODULE_PATH = fileURLToPath(import.meta.url);
const CURRENT_MODULE_DIR = dirname(CURRENT_MODULE_PATH);

let runtimeBundleCache: string | null = null;
let runtimeDeckBundleCache: string | null = null;

function getCurrentModulePath(): string {
  return CURRENT_MODULE_PATH;
}

function getCurrentModuleDir(): string {
  return CURRENT_MODULE_DIR;
}

function bundleRuntimeFromSource(bundleFileName: string): string | null {
  const moduleDir = getCurrentModuleDir();
  const sourceEntryByBundleName: Record<string, string> = {
    "render-slide.global.js": join(moduleDir, "../browser/render-slide-auto.ts"),
    "render-deck.global.js": join(moduleDir, "../browser/render-deck-auto.ts"),
  };

  const entryPoint = sourceEntryByBundleName[bundleFileName];
  if (!entryPoint || !existsSync(entryPoint)) {
    return null;
  }

  const require = createRequire(getCurrentModulePath());
  const { buildSync } = require("esbuild") as typeof import("esbuild");
  const result = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: false,
  });

  const output = result.outputFiles?.[0]?.text;
  return output && output.length > 0 ? output : null;
}

function getRuntimeBundle(
  bundleFileName: string,
  cache: string | null,
): { cache: string; content: string } {
  if (cache) {
    return { cache, content: cache };
  }

  const candidateFiles = new Set<string>();

  const moduleDir = getCurrentModuleDir();
  candidateFiles.add(join(moduleDir, `browser/${bundleFileName}`));
  candidateFiles.add(join(moduleDir, `dist/browser/${bundleFileName}`));
  candidateFiles.add(join(moduleDir, `../browser/${bundleFileName}`));
  candidateFiles.add(join(moduleDir, `../dist/browser/${bundleFileName}`));

  const runtimeFile = Array.from(candidateFiles).find((candidate) =>
    existsSync(candidate),
  );

  try {
    if (!runtimeFile) {
      throw new Error("No runtime bundle candidate path exists");
    }
    const content = readFileSync(runtimeFile, "utf8");
    return {
      cache: content,
      content,
    };
  } catch (error) {
    const bundledContent = bundleRuntimeFromSource(bundleFileName);
    if (bundledContent) {
      return {
        cache: bundledContent,
        content: bundledContent,
      };
    }

    const detail =
      error instanceof Error ? error.message : "Unknown runtime bundle read error";
    throw new Error(
      `Failed to load browser render runtime bundle at "${runtimeFile}": ${detail}`,
    );
  }
}

export function getBrowserRenderRuntimeBundle(): string {
  const result = getRuntimeBundle("render-slide.global.js", runtimeBundleCache);
  runtimeBundleCache = result.cache;
  return result.content;
}

export function getBrowserRenderDeckRuntimeBundle(): string {
  const result = getRuntimeBundle("render-deck.global.js", runtimeDeckBundleCache);
  runtimeDeckBundleCache = result.cache;
  return result.content;
}
