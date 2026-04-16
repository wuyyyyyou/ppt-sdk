import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let runtimeBundleCache: string | null = null;
let runtimeDeckBundleCache: string | null = null;

function getRuntimeBundle(
  bundleFileName: string,
  cache: string | null,
): { cache: string; content: string } {
  if (cache) {
    return { cache, content: cache };
  }

  const candidateFiles = new Set<string>();

  if (typeof __filename !== "undefined") {
    const currentDir = dirname(__filename);
    candidateFiles.add(join(currentDir, `browser/${bundleFileName}`));
    candidateFiles.add(join(currentDir, `dist/browser/${bundleFileName}`));
    candidateFiles.add(join(currentDir, `../browser/${bundleFileName}`));
    candidateFiles.add(join(currentDir, `../dist/browser/${bundleFileName}`));
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
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
