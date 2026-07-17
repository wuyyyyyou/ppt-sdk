import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
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
 * Uploaded images arrive from the frontend as embedded data URLs. Persist them
 * into `<workspace>/presentation/assets/` (content-hash filenames, matching how
 * Model0 images are archived) and rewrite the document to reference the file
 * path, so stored revisions never carry base64 payloads.
 */
export async function materializeEmbeddedPresentationImages(
  workspaceDir: string,
  document: PresentationDocument,
): Promise<PresentationDocument> {
  const next = structuredClone(document);
  const assetsDir = path.join(workspaceDir, "presentation", "assets");
  const archivedBySrc = new Map<string, string>();

  for (const slide of next.slides) {
    for (const element of slide.elements) {
      if (element.type !== "image" || !element.src.startsWith("data:")) continue;

      let archivedPath = archivedBySrc.get(element.src);
      if (!archivedPath) {
        const match = /^data:([^;,]+);base64,(.+)$/s.exec(element.src);
        if (!match) continue;
        const [, mime, base64] = match;
        let content: Buffer;
        try {
          content = Buffer.from(base64!, "base64");
        } catch {
          continue;
        }
        if (content.length === 0) continue;
        const extension = EXTENSION_BY_MIME[mime!.toLowerCase()] ?? ".png";
        const digest = createHash("sha256").update(content).digest("hex").slice(0, 20);
        archivedPath = path.join(assetsDir, `${digest}${extension}`);
        await mkdir(assetsDir, { recursive: true });
        try {
          await stat(archivedPath);
        } catch {
          await writeFile(archivedPath, content);
        }
        archivedBySrc.set(element.src, archivedPath);
      }

      element.src = archivedPath;
      const picture = (element.sourceData as { picture?: { path?: string; is_network?: boolean } }).picture;
      if (picture) {
        picture.path = archivedPath;
        picture.is_network = false;
      }
    }
  }
  return next;
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
