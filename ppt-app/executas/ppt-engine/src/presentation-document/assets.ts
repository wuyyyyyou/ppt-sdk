import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresentationDocument } from "./types.js";

/** Skip anything above this size so one oversized image cannot blow up the
 *  tool response (which must fit through the Host Upload JSON transport). */
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function localImageFilePath(src: string): string | null {
  if (src.startsWith("file://")) {
    try {
      return fileURLToPath(src);
    } catch {
      return null;
    }
  }
  if (/^[a-z]+:/i.test(src)) return null;
  return src;
}

/**
 * Browsers cannot load the local file paths stored in image `src` references,
 * so tool responses ship a sidecar map of `src` → data URL for the frontend
 * renderer. The stored document keeps path references only.
 */
export async function collectPresentationImageAssets(
  document: PresentationDocument,
): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  for (const slide of document.slides) {
    for (const element of slide.elements) {
      if (element.type !== "image" || typeof element.src !== "string") continue;
      if (element.src in assets) continue;
      const filePath = localImageFilePath(element.src);
      if (!filePath) continue;
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile() || fileStat.size > MAX_INLINE_IMAGE_BYTES) continue;
        const mime = MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "image/png";
        const content = await readFile(filePath);
        assets[element.src] = `data:${mime};base64,${content.toString("base64")}`;
      } catch {
        // Missing files surface through validatePresentationAssets at export
        // time; previews simply fall back to the raw src.
      }
    }
  }
  return assets;
}
