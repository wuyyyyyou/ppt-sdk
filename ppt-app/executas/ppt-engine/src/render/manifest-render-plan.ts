import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
} from "../local-template/loader.js";
import {
  buildPageSourceRuntimeBundles,
  type PageSourceRuntimeEntry,
} from "./page-source-runtime-bundle.js";
import { getBrowserRenderRuntimeBundle } from "./runtime-bundle.js";
import { getTailwindBrowserRuntimeBundle } from "./tailwind-runtime.js";
import type {
  BrowserRenderContext,
  DeckManifestInput,
  DeckManifestSlideInput,
} from "./types.js";

const PAGE_ID_PATTERN = /^page-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MANIFEST_FIELDS = new Set(["title", "slides"]);
const SLIDE_FIELDS = new Set(["id", "source"]);
const DECK_RUNTIME_BUNDLE_KEY = "deck";

function slideRuntimeBundleKey(pageId: string): string {
  return `slide:${pageId}`;
}

type PreparedManifestSlide = {
  context: BrowserRenderContext;
  html: string;
  sourceIndex: number;
  pageNumber: number;
  slideId: string;
  layoutId: string;
  runtimeLayoutId: string;
  fileName: string;
  outputPath: string;
  speaker_note: string;
  localEntryPath: string;
};

export interface ManifestRenderPlan {
  manifestPath: string;
  manifestCwd: string;
  outputDir: string;
  deckBaseName: string;
  title: string;
  singlePageIndex: number | null;
  slideCount: number;
  slides: PreparedManifestSlide[];
  deckRuntimeBundle: string | null;
  tailwindRuntimeBundle: string;
}

function resolveAbsolutePath(targetPath: string, fieldName: string): string {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error(`Field "${fieldName}" must be a non-empty string`);
  }
  if (!path.isAbsolute(targetPath)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
  return path.normalize(targetPath);
}

function resolveOptionalAbsolutePath(
  targetPath: string | null | undefined,
  fieldName: string,
): string | undefined {
  return targetPath === undefined || targetPath === null
    ? undefined
    : resolveAbsolutePath(targetPath, fieldName);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  label: string,
) {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new Error(`${label} contains unsupported field "${unsupported[0]}"`);
  }
}

function expectedPageSource(pageId: string): string {
  return `./slides/${pageId}.tsx`;
}

export function validateDeckManifest(value: unknown): asserts value is DeckManifestInput {
  if (!isPlainRecord(value)) {
    throw new Error('Field "manifest" must be an object');
  }
  assertOnlyFields(value, MANIFEST_FIELDS, "Manifest");
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    throw new Error('Field "manifest.title" must be a non-empty string');
  }
  if (!Array.isArray(value.slides) || value.slides.length === 0) {
    throw new Error('Field "manifest.slides" must be a non-empty array');
  }

  const seenPageIds = new Set<string>();
  value.slides.forEach((slideValue, index) => {
    if (!isPlainRecord(slideValue)) {
      throw new Error(`Slide at index ${index} must be an object`);
    }
    assertOnlyFields(slideValue, SLIDE_FIELDS, `Slide at index ${index}`);
    if (typeof slideValue.id !== "string" || !PAGE_ID_PATTERN.test(slideValue.id)) {
      throw new Error(`Slide at index ${index} field "id" must be an opaque page UUID`);
    }
    if (seenPageIds.has(slideValue.id)) {
      throw new Error(`Duplicate manifest slide id "${slideValue.id}"`);
    }
    seenPageIds.add(slideValue.id);
    const expectedSource = expectedPageSource(slideValue.id);
    if (slideValue.source !== expectedSource) {
      throw new Error(
        `Slide "${slideValue.id}" field "source" must equal "${expectedSource}"`,
      );
    }
  });
}

function sanitizeFileNamePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "deck";
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildSlideDocumentHtml(input: {
  context: BrowserRenderContext;
  runtimeBundle?: string | null;
  tailwindRuntimeBundle: string;
}): string {
  const runtimeBundle = input.runtimeBundle ?? getBrowserRenderRuntimeBundle();
  const serializedContext = escapeJsonForInlineScript(input.context);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${input.context.title}</title>`,
    "  <style>",
    "    html, body { margin: 0; padding: 0; width: 1280px; min-height: 720px; overflow: hidden; background: #ffffff; }",
    "    body { position: relative; font-family: system-ui, sans-serif; }",
    "    #presentation-slides-wrapper { width: 1280px; min-height: 720px; }",
    '    [data-presenton-render-status="error"] { display: flex; align-items: center; justify-content: center; color: #991b1b; background: #fef2f2; font-size: 14px; padding: 24px; box-sizing: border-box; }',
    "  </style>",
    '  <script data-presenton-runtime="tailwind">',
    input.tailwindRuntimeBundle,
    "  </script>",
    "</head>",
    "<body>",
    '  <div id="presentation-slides-wrapper" data-presenton-render-status="loading"></div>',
    "  <script>",
    `    window.__PRESENTON_RENDER_CONTEXT__ = ${serializedContext};`,
    "  </script>",
    "  <script>",
    runtimeBundle,
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function parseSinglePageIndex(
  input: { singlePage?: boolean | null; page?: number | null },
  slideCount: number,
): number | null {
  if (!input.singlePage) return null;
  if (input.page === undefined || input.page === null) {
    throw new Error('Field "page" is required when "singlePage" is true');
  }
  if (!Number.isInteger(input.page)) {
    throw new Error('Field "page" must be an integer');
  }
  if (input.page < 1 || input.page > slideCount) {
    throw new Error(`Field "page" must be between 1 and ${slideCount}`);
  }
  return input.page - 1;
}

async function resolvePageSource(
  slide: DeckManifestSlideInput,
  manifestCwd: string,
): Promise<string> {
  const absolutePath = await resolveLocalModulePath(
    slide.source,
    manifestCwd,
    `Slide "${slide.id}"`,
  );
  const moduleValue = await importLocalTemplateModule(absolutePath, manifestCwd);
  assertLocalTemplateModule(moduleValue, absolutePath);
  return absolutePath;
}

export async function prepareManifestRenderPlan(input: {
  manifestPath: string;
  outputDir: string;
  name?: string | null;
  singlePage?: boolean | null;
  page?: number | null;
  cwd?: string | null;
}): Promise<ManifestRenderPlan> {
  if (!input || typeof input !== "object") {
    throw new Error("Manifest build input must be an object");
  }
  resolveOptionalAbsolutePath(input.cwd, "cwd");
  const manifestPath = resolveAbsolutePath(input.manifestPath, "manifestPath");
  const outputDir = resolveAbsolutePath(input.outputDir, "outputDir");
  const manifestValue = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  validateDeckManifest(manifestValue);
  const manifest = manifestValue;
  const manifestCwd = path.dirname(manifestPath);
  const deckBaseName = sanitizeFileNamePart(input.name ?? manifest.title);
  const singlePageIndex = parseSinglePageIndex(input, manifest.slides.length);
  const selected = singlePageIndex === null
    ? manifest.slides.map((slide, sourceIndex) => ({ slide, sourceIndex }))
    : [{ slide: manifest.slides[singlePageIndex]!, sourceIndex: singlePageIndex }];

  const resolved = await Promise.all(selected.map(async ({ slide, sourceIndex }) => ({
    slide,
    sourceIndex,
    absolutePath: await resolvePageSource(slide, manifestCwd),
  })));
  const runtimeEntries: PageSourceRuntimeEntry[] = resolved.map((entry) => ({
    pageId: entry.slide.id,
    absolutePath: entry.absolutePath,
  }));
  const tailwindRuntimeBundle = await getTailwindBrowserRuntimeBundle();
  const runtimeBundles = await buildPageSourceRuntimeBundles({
    cwd: manifestCwd,
    bundles: [
      ...runtimeEntries.map((entry) => ({
        key: slideRuntimeBundleKey(entry.pageId),
        mode: "slide" as const,
        entries: [entry],
      })),
      ...(singlePageIndex === null
        ? [{
          key: DECK_RUNTIME_BUNDLE_KEY,
          mode: "deck" as const,
          entries: runtimeEntries,
        }]
        : []),
    ],
  });
  const deckRuntimeBundle = singlePageIndex === null
    ? runtimeBundles.get(DECK_RUNTIME_BUNDLE_KEY) ?? null
    : null;
  if (singlePageIndex === null && !deckRuntimeBundle) {
    throw new Error("Failed to build Page Source deck runtime bundle");
  }

  const slides: PreparedManifestSlide[] = resolved.map(({ slide, sourceIndex, absolutePath }) => {
    const slideRuntimeBundle = runtimeBundles.get(slideRuntimeBundleKey(slide.id));
    if (!slideRuntimeBundle) {
      throw new Error(`Failed to build Page Source slide runtime bundle "${slide.id}"`);
    }
    const pageNumber = sourceIndex + 1;
    const context: BrowserRenderContext = {
      templateGroup: "authoring-kit",
      layoutId: slide.id,
      runtimeLayoutId: slide.id,
      slideData: {},
      speakerNote: "",
      title: `${manifest.title} – ${pageNumber}`,
      theme: {
        logoUrl: null,
        companyName: null,
        colors: {},
        variables: {},
        fontName: null,
        fontUrl: null,
      },
    };
    const fileName = `${pageNumber}-${deckBaseName}-${sanitizeFileNamePart(slide.id)}.png`;
    return {
      context,
      html: buildSlideDocumentHtml({
        context,
        runtimeBundle: slideRuntimeBundle,
        tailwindRuntimeBundle,
      }),
      sourceIndex,
      pageNumber,
      slideId: slide.id,
      layoutId: slide.id,
      runtimeLayoutId: slide.id,
      fileName,
      outputPath: path.join(outputDir, fileName),
      speaker_note: "",
      localEntryPath: absolutePath,
    };
  });

  return {
    manifestPath,
    manifestCwd,
    outputDir,
    deckBaseName,
    title: manifest.title,
    singlePageIndex,
    slideCount: manifest.slides.length,
    slides,
    deckRuntimeBundle,
    tailwindRuntimeBundle,
  };
}
