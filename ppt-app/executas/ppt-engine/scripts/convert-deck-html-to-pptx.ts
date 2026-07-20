import path from "node:path";
import { rename } from "node:fs/promises";

import { convertDeckHtmlToPptx } from "../src/pptx-export/dom-to-pptx.js";

const [htmlPath, outputPath, title = "deck"] = process.argv.slice(2);
if (!htmlPath || !path.isAbsolute(htmlPath) || !outputPath || !path.isAbsolute(outputPath)) {
  throw new Error("Usage: convert-deck-html-to-pptx.ts <absolute-html-path> <absolute-pptx-path> [title]");
}

const result = await convertDeckHtmlToPptx({ htmlPath, outputPath, title });
await rename(result.outputPath, outputPath);
process.stdout.write(`${JSON.stringify({
  pptx_path: outputPath,
  slide_count: result.slideCount,
  size_bytes: result.sizeBytes,
  warning_count: result.warningCount,
})}\n`);
