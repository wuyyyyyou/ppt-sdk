import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { convertDeckHtmlToPptx } from "../pptx-export/dom-to-pptx.js";
import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
  resolveLocalTemplateProjectRoot,
} from "../local-template/loader.js";
import {
  staticizeHtmlDocuments,
  writeSlideScreenshots,
} from "./browser-artifacts.js";
import { sanitizeFileNamePart } from "./file-names.js";
import {
  buildPageSourceDocumentHtml,
  createPageSourceRenderContext,
} from "./page-source-document.js";
import { buildPageSourceRuntimeBundle } from "./page-source-runtime-bundle.js";
import { getTailwindBrowserRuntimeBundle } from "./tailwind-runtime.js";
import { buildStandaloneDeckHtml } from "./build-deck.js";

export interface BuildPageSourcePreviewInput {
  entryPath: string;
  outputDir: string;
  name?: string | null;
  generatePptx?: boolean | null;
}

export interface BuildPageSourcePreviewResult {
  entryPath: string;
  outputDir: string;
  name: string;
  html: string;
  htmlPath: string;
  screenshotPath: string;
  pptxPath: string | null;
}

function resolveAbsolutePath(value: string, fieldName: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`Field "${fieldName}" must be a non-empty string`);
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
  return path.normalize(value);
}

export function resolvePageSourcePreviewName(
  entryPath: string,
  requestedName?: string | null,
): string {
  if (requestedName !== undefined && requestedName !== null) {
    if (typeof requestedName !== "string" || requestedName.trim().length === 0) {
      throw new Error('Field "name" must be a non-empty string when provided');
    }
    return sanitizeFileNamePart(
      requestedName.replace(/([a-z0-9])([A-Z])/g, "$1-$2"),
      "preview",
    );
  }

  const extension = path.extname(entryPath);
  const baseName = path.basename(entryPath, extension).replace(/\.preview$/i, "");
  return sanitizeFileNamePart(
    baseName.replace(/([a-z0-9])([A-Z])/g, "$1-$2"),
    "preview",
  );
}

export async function buildPageSourcePreview(
  input: BuildPageSourcePreviewInput,
): Promise<BuildPageSourcePreviewResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Page Source preview input must be an object");
  }

  const entryPath = resolveAbsolutePath(input.entryPath, "entryPath");
  const outputDir = resolveAbsolutePath(input.outputDir, "outputDir");
  const name = resolvePageSourcePreviewName(entryPath, input.name);
  const previewId = `preview:${name}`;
  const projectRoot = await resolveLocalTemplateProjectRoot(entryPath);
  const resolvedEntryPath = await resolveLocalModulePath(
    entryPath,
    projectRoot,
    "Preview entry",
  );
  const moduleValue = await importLocalTemplateModule(resolvedEntryPath, projectRoot);
  assertLocalTemplateModule(moduleValue, resolvedEntryPath);

  const [runtimeBundle, tailwindRuntimeBundle] = await Promise.all([
    buildPageSourceRuntimeBundle({
      mode: "slide",
      cwd: projectRoot,
      entries: [{ pageId: previewId, absolutePath: resolvedEntryPath }],
    }),
    getTailwindBrowserRuntimeBundle(),
  ]);
  const context = createPageSourceRenderContext({
    id: previewId,
    title: name,
    templateGroup: "preview",
  });
  const runtimeHtml = buildPageSourceDocumentHtml({
    context,
    runtimeBundle,
    tailwindRuntimeBundle,
  });
  const htmlPath = path.join(outputDir, `${name}.html`);
  const screenshotPath = path.join(outputDir, `${name}-browser.png`);

  await mkdir(outputDir, { recursive: true });
  await writeFile(htmlPath, runtimeHtml, "utf8");
  await staticizeHtmlDocuments(
    [{ htmlPath, kind: "page" }],
    `buildPageSourcePreview static HTML for ${name}`,
  );
  await writeSlideScreenshots(
    [{ html: runtimeHtml, htmlPath, outputPath: screenshotPath }],
    `buildPageSourcePreview screenshot for ${name}`,
  );
  const html = await readFile(htmlPath, "utf8");

  let pptxPath: string | null = null;
  if (input.generatePptx) {
    const deckHtmlPath = path.join(outputDir, `${name}-deck.html`);
    await writeFile(deckHtmlPath, buildStandaloneDeckHtml({ title: name, slides: [{ html: runtimeHtml }] }), "utf8");
    await staticizeHtmlDocuments([{ htmlPath: deckHtmlPath, kind: "deck" }]);
    pptxPath = path.join(outputDir, `${name}.pptx`);
    const converted = await convertDeckHtmlToPptx({
      htmlPath: deckHtmlPath,
      outputPath: pptxPath,
      title: name,
      expectedSlideCount: 1,
    });
    await rename(converted.outputPath, pptxPath);
  }

  return {
    entryPath: resolvedEntryPath,
    outputDir,
    name,
    html,
    htmlPath,
    screenshotPath,
    pptxPath,
  };
}
