import path from "node:path";
import { readFile } from "node:fs/promises";

import { getLayoutByLayoutId } from "../app/presentation-templates/index.js";
import type { TemplateWithData } from "../app/presentation-templates/utils.js";
import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
} from "../local-template/loader.js";
import {
  buildLocalBrowserRuntimeBundle,
  type LocalRuntimeEntry,
} from "./local-runtime-bundle.js";
import { getBrowserRenderRuntimeBundle } from "./runtime-bundle.js";
import type {
  BrowserRenderContext,
  BrowserRenderTheme,
  DeckManifestInput,
  DeckManifestSlideInput,
  TemplateRenderThemeInput,
} from "./types.js";

type ResolvedManifestSlide = {
  slideId: string;
  layoutId: string;
  layoutName: string;
  layoutDescription: string;
  templateGroup: string;
  localEntryPath?: string;
};

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
  localEntryPath?: string;
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
  if (targetPath === undefined || targetPath === null) {
    return undefined;
  }

  return resolveAbsolutePath(targetPath, fieldName);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function normalizeTheme(input?: TemplateRenderThemeInput | null): BrowserRenderTheme {
  const colors = { ...(input?.colors ?? {}), ...(input?.data?.colors ?? {}) };
  const font = input?.fonts?.body ?? input?.data?.fonts?.textFont ?? null;

  return {
    logoUrl: input?.logo_url ?? null,
    companyName: input?.company_name ?? null,
    colors: { ...colors },
    fontName: font?.name ?? null,
    fontUrl: font?.url ?? null,
  };
}

async function resolveLocalTemplateGroupId(manifestCwd: string): Promise<string> {
  const groupPath = path.join(manifestCwd, "group.json");

  try {
    const rawValue = JSON.parse(await readFile(groupPath, "utf8")) as unknown;
    if (
      isPlainRecord(rawValue) &&
      typeof rawValue.group_id === "string" &&
      rawValue.group_id.length > 0
    ) {
      return rawValue.group_id;
    }
  } catch {
    // Fall back to the manifest directory name when no group metadata exists.
  }

  return path.basename(manifestCwd);
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function validateDeckManifest(manifest: DeckManifestInput): void {
  if (!manifest || typeof manifest !== "object") {
    throw new Error('Field "manifest" must be an object');
  }

  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    throw new Error('Field "manifest.slides" must be a non-empty array');
  }

  const seenSlideIds = new Set<string>();
  manifest.slides.forEach((slide, index) => {
    if (!slide || typeof slide !== "object") {
      throw new Error(`Slide at index ${index} must be an object`);
    }

    if (!slide.id || typeof slide.id !== "string") {
      throw new Error(`Slide at index ${index} is missing required field "id"`);
    }

    if (seenSlideIds.has(slide.id)) {
      throw new Error(`Duplicate manifest slide id "${slide.id}"`);
    }
    seenSlideIds.add(slide.id);

    if (!slide.source || typeof slide.source !== "object") {
      throw new Error(`Slide "${slide.id}" is missing required field "source"`);
    }

    if (!slide.source.type || typeof slide.source.type !== "string") {
      throw new Error(`Slide "${slide.id}" is missing required field "source.type"`);
    }

    if (
      slide.data !== undefined &&
      slide.data !== null &&
      !isPlainRecord(slide.data)
    ) {
      throw new Error(`Slide "${slide.id}" field "data" must be an object when provided`);
    }

    if (
      slide.data_path !== undefined &&
      slide.data_path !== null &&
      (typeof slide.data_path !== "string" || slide.data_path.length === 0)
    ) {
      throw new Error(`Slide "${slide.id}" field "data_path" must be a non-empty string when provided`);
    }
  });
}

async function resolveSlideData(
  slide: DeckManifestSlideInput,
  manifestCwd: string,
): Promise<Record<string, unknown>> {
  if (typeof slide.data_path === "string" && slide.data_path.length > 0) {
    const absolutePath = path.resolve(manifestCwd, slide.data_path);
    const rawValue = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
    if (!isPlainRecord(rawValue)) {
      throw new Error(`Slide "${slide.id}" data_path must point to a JSON object: ${slide.data_path}`);
    }
    return rawValue;
  }

  if (isPlainRecord(slide.data)) {
    return slide.data;
  }

  return {};
}

function normalizeBuiltinLayoutId(templateGroup: string, layoutId: string): string {
  if (!layoutId) {
    throw new Error('Missing required field "source.layout_id"');
  }

  if (layoutId.includes(":")) {
    const [groupId] = layoutId.split(":");
    if (groupId !== templateGroup) {
      throw new Error(
        `Layout "${layoutId}" does not belong to template group "${templateGroup}"`,
      );
    }
    return layoutId;
  }

  return `${templateGroup}:${layoutId}`;
}

function resolveBuiltinSlide(slide: DeckManifestSlideInput): ResolvedManifestSlide {
  if (slide.source.type !== "builtin") {
    throw new Error(`Slide "${slide.id}" is not a builtin source`);
  }

  if (
    !slide.source.template_group ||
    typeof slide.source.template_group !== "string"
  ) {
    throw new Error(
      `Slide "${slide.id}" is missing required field "source.template_group"`,
    );
  }

  const layoutId = normalizeBuiltinLayoutId(
    slide.source.template_group,
    slide.source.layout_id,
  );
  const layout = getLayoutByLayoutId(layoutId);

  if (!layout) {
    throw new Error(
      `Slide "${slide.id}" references unknown builtin layout "${layoutId}"`,
    );
  }

  const typedLayout = layout as TemplateWithData;
  return {
    slideId: slide.id,
    layoutId: typedLayout.layoutId,
    layoutName: typedLayout.layoutName,
    layoutDescription: typedLayout.layoutDescription,
    templateGroup: slide.source.template_group,
  };
}

async function resolveLocalSlide(
  slide: DeckManifestSlideInput,
  cwd: string,
  templateGroup: string,
): Promise<ResolvedManifestSlide> {
  if (slide.source.type !== "local") {
    throw new Error(`Slide "${slide.id}" is not a local source`);
  }

  if (!slide.source.path || typeof slide.source.path !== "string") {
    throw new Error(`Slide "${slide.id}" is missing required field "source.path"`);
  }

  const absolutePath = await resolveLocalModulePath(
    slide.source.path,
    cwd,
    `Slide "${slide.id}"`,
  );
  const moduleValue = await importLocalTemplateModule(absolutePath, cwd);
  assertLocalTemplateModule(moduleValue, absolutePath);

  return {
    slideId: slide.id,
    layoutId: `${templateGroup}:${moduleValue.layoutId}`,
    layoutName: moduleValue.layoutName,
    layoutDescription: moduleValue.layoutDescription,
    templateGroup,
    localEntryPath: absolutePath,
  };
}

async function resolveManifestSlide(
  slide: DeckManifestSlideInput,
  manifestCwd: string,
): Promise<ResolvedManifestSlide> {
  switch (slide.source.type) {
    case "builtin":
      return resolveBuiltinSlide(slide);
    case "local": {
      const templateGroup = await resolveLocalTemplateGroupId(manifestCwd);
      return resolveLocalSlide(slide, manifestCwd, templateGroup);
    }
    default:
      throw new Error(
        `Slide "${slide.id}" uses unsupported source type "${String((slide.source as { type?: unknown }).type)}"`,
      );
  }
}

function buildSlideDocumentHtml(input: {
  context: BrowserRenderContext;
  runtimeBundle?: string | null;
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
    "    html, body {",
    "      margin: 0;",
    "      padding: 0;",
    "      width: 1280px;",
    "      min-height: 720px;",
    "      overflow: hidden;",
    `      background: ${input.context.theme.colors.background ?? "#ffffff"};`,
    "    }",
    "    body {",
    "      position: relative;",
    "      font-family: system-ui, sans-serif;",
    "    }",
    "    #presentation-slides-wrapper {",
    "      width: 1280px;",
    "      min-height: 720px;",
    "    }",
    '    [data-presenton-render-status="error"] {',
    "      display: flex;",
    "      align-items: center;",
    "      justify-content: center;",
    "      color: #991b1b;",
    "      background: #fef2f2;",
    "      font-size: 14px;",
    "      padding: 24px;",
    "      box-sizing: border-box;",
    "    }",
    "  </style>",
    "  <script>",
    "    window.tailwind = window.tailwind || {};",
    "  </script>",
    '  <script src="https://cdn.tailwindcss.com"></script>',
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
  if (!input.singlePage) {
    return null;
  }

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

export async function prepareManifestRenderPlan(
  input: {
    manifestPath: string;
    outputDir: string;
    name?: string | null;
    singlePage?: boolean | null;
    page?: number | null;
    cwd?: string | null;
  },
): Promise<ManifestRenderPlan> {
  if (!input || typeof input !== "object") {
    throw new Error("Manifest build input must be an object");
  }

  if (!input.manifestPath || typeof input.manifestPath !== "string") {
    throw new Error('Field "manifestPath" must be a non-empty string');
  }

  if (!input.outputDir || typeof input.outputDir !== "string") {
    throw new Error('Field "outputDir" must be a non-empty string');
  }

  resolveOptionalAbsolutePath(input.cwd, "cwd");
  const manifestPath = resolveAbsolutePath(input.manifestPath, "manifestPath");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeckManifestInput;
  validateDeckManifest(manifest);

  const manifestCwd = path.dirname(manifestPath);
  const outputDir = resolveAbsolutePath(input.outputDir, "outputDir");
  const deckBaseName = sanitizeFileNamePart(
    input.name ??
    (typeof manifest.title === "string" && manifest.title.length > 0
      ? manifest.title
      : "presenton-manifest-deck"),
  );
  const singlePageIndex = parseSinglePageIndex(input, manifest.slides.length);
  const slideEntries =
    singlePageIndex === null
      ? manifest.slides.map((slide, sourceIndex) => ({ slide, sourceIndex }))
      : [{
        slide: manifest.slides[singlePageIndex],
        sourceIndex: singlePageIndex,
      }];

  const slides = await Promise.all(
    slideEntries.map(async ({ slide, sourceIndex }) => {
      const resolvedSlide = await resolveManifestSlide(slide, manifestCwd);
      const slideData = await resolveSlideData(slide, manifestCwd);
      const theme = normalizeTheme(slide.theme ?? manifest.theme);
      const runtimeLayoutId = resolvedSlide.localEntryPath
        ? `${resolvedSlide.templateGroup}:${slide.id}`
        : resolvedSlide.layoutId;
      const slideTitle =
        slide.title ??
        `${resolvedSlide.templateGroup} - ${resolvedSlide.layoutName}`;

      const context: BrowserRenderContext = {
        templateGroup: resolvedSlide.templateGroup,
        layoutId: resolvedSlide.layoutId,
        runtimeLayoutId,
        slideData,
        speakerNote: slide.speaker_note ?? "",
        title: slideTitle,
        theme,
      };

      const html = buildSlideDocumentHtml({ context });
      const pageNumber = sourceIndex + 1;
      const slideFileName = `${pageNumber}-${deckBaseName}-${sanitizeFileNamePart(
        resolvedSlide.layoutId,
      )}.png`;
      const slideOutputPath = path.join(outputDir, slideFileName);

      return {
        context,
        html,
        sourceIndex,
        pageNumber,
        slideId: slide.id,
        layoutId: resolvedSlide.layoutId,
        runtimeLayoutId,
        fileName: slideFileName,
        outputPath: slideOutputPath,
        speaker_note: slide.speaker_note ?? "",
        localEntryPath: resolvedSlide.localEntryPath,
      };
    }),
  );

  const localRuntimeEntries = Array.from(
    new Map(
      slides
        .filter(
          (slide): slide is typeof slide & { localEntryPath: string } =>
            typeof slide.localEntryPath === "string" && slide.localEntryPath.length > 0,
        )
        .map((slide) => [
          slide.runtimeLayoutId,
          {
            layoutId: slide.runtimeLayoutId,
            absolutePath: slide.localEntryPath,
          } satisfies LocalRuntimeEntry,
        ]),
    ).values(),
  );
  const localSlideRuntimeBundle =
    localRuntimeEntries.length > 0
      ? await buildLocalBrowserRuntimeBundle({
        mode: "slide",
        cwd: manifestCwd,
        entries: localRuntimeEntries,
      })
      : null;
  const localDeckRuntimeBundle =
    singlePageIndex === null && localRuntimeEntries.length > 0
      ? await buildLocalBrowserRuntimeBundle({
        mode: "deck",
        cwd: manifestCwd,
        entries: localRuntimeEntries,
      })
      : null;
  const slidesWithRuntime = slides.map((slide) => ({
    ...slide,
    html: buildSlideDocumentHtml({
      context: slide.context,
      runtimeBundle: slide.localEntryPath ? localSlideRuntimeBundle : null,
    }),
  }));

  return {
    manifestPath,
    manifestCwd,
    outputDir,
    deckBaseName,
    title: manifest.title ?? "Presenton Manifest Deck",
    singlePageIndex,
    slideCount: manifest.slides.length,
    slides: slidesWithRuntime,
    deckRuntimeBundle: localDeckRuntimeBundle,
  };
}
