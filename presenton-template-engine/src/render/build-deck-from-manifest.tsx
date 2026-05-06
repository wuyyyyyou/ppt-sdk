import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getLayoutByLayoutId } from "../app/presentation-templates/index.js";
import type { TemplateWithData } from "../app/presentation-templates/utils.js";
import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
  loadLocalTemplateRenderRuntime,
  resolveLocalModulePath,
  type LocalSlideComponent as SlideComponent,
  type LocalTemplateRenderRuntime,
} from "../local-template/loader.js";
import { buildStandaloneDeckHtml } from "./build-deck.js";
import type {
  BrowserRenderTheme,
  BuildDeckHtmlFromManifestFileOutput,
  BuildDeckHtmlFromManifestInput,
  BuildDeckHtmlFromManifestResult,
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
  component: SlideComponent;
  sourceLabel: string;
  renderRuntime?: LocalTemplateRenderRuntime | null;
};

const TAILWIND_CDN_SCRIPT = '<script src="https://cdn.tailwindcss.com"></script>';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function parseSinglePageIndex(input: BuildDeckHtmlFromManifestInput, slideCount: number): number | null {
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

function normalizeTheme(input?: TemplateRenderThemeInput | null): BrowserRenderTheme {
  const colors = input?.colors ?? input?.data?.colors ?? {};
  const font = input?.fonts?.body ?? input?.data?.fonts?.textFont ?? null;

  return {
    logoUrl: input?.logo_url ?? null,
    companyName: input?.company_name ?? null,
    colors: { ...colors },
    fontName: font?.name ?? null,
    fontUrl: font?.url ?? null,
  };
}

function buildThemeInlineStyle(
  theme: BrowserRenderTheme,
): React.CSSProperties & Record<string, string> {
  const style: React.CSSProperties & Record<string, string> = {};

  const assign = (key: string, value?: string | null) => {
    if (typeof value === "string" && value.length > 0) {
      style[key] = value;
    }
  };

  assign("--primary-color", theme.colors.primary);
  assign("--background-color", theme.colors.background);
  assign("--card-color", theme.colors.card);
  assign("--stroke", theme.colors.stroke);
  assign("--primary-text", theme.colors.primary_text);
  assign("--background-text", theme.colors.background_text);

  if (theme.fontName) {
    style.fontFamily = `"${theme.fontName}"`;
    assign("--heading-font-family", `"${theme.fontName}"`);
    assign("--body-font-family", `"${theme.fontName}"`);
  }

  for (let index = 0; index < 10; index += 1) {
    assign(
      `--graph-${index}`,
      theme.colors[`graph_${index}`] ?? theme.colors[`graph-${index}`] ?? null,
    );
  }

  return style;
}

function buildFontHeadTags(theme: BrowserRenderTheme): string[] {
  if (!theme.fontName || !theme.fontUrl) {
    return [];
  }

  const isCssUrl =
    /\.css(\?|$)/i.test(theme.fontUrl) ||
    theme.fontUrl.includes("fonts.googleapis.com");

  if (isCssUrl) {
    return [
      `<link rel="stylesheet" href="${escapeHtml(theme.fontUrl)}" data-presenton-font-url="${escapeHtml(theme.fontUrl)}" />`,
    ];
  }

  return [
    [
      "<style>",
      `@font-face { font-family: '${theme.fontName}'; src: url('${theme.fontUrl}'); font-style: normal; font-display: swap; }`,
      "</style>",
    ].join("\n"),
  ];
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    component: typedLayout.component as SlideComponent,
    sourceLabel: `builtin:${typedLayout.layoutId}`,
    renderRuntime: null,
  };
}

async function resolveLocalSlide(
  slide: DeckManifestSlideInput,
  cwd: string,
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
  const renderRuntime = loadLocalTemplateRenderRuntime(cwd);

  return {
    slideId: slide.id,
    layoutId: moduleValue.layoutId,
    layoutName: moduleValue.layoutName,
    layoutDescription: moduleValue.layoutDescription,
    templateGroup: "local",
    component: moduleValue.default,
    sourceLabel: absolutePath,
    renderRuntime,
  };
}

async function resolveManifestSlide(
  slide: DeckManifestSlideInput,
  manifestCwd: string,
): Promise<ResolvedManifestSlide> {
  switch (slide.source.type) {
    case "builtin":
      return resolveBuiltinSlide(slide);
    case "local":
      return resolveLocalSlide(slide, manifestCwd);
    default:
      throw new Error(
        `Slide "${slide.id}" uses unsupported source type "${String((slide.source as { type?: unknown }).type)}"`,
      );
  }
}

function buildSlideDocumentHtml(input: {
  resolvedSlide: ResolvedManifestSlide;
  slide: DeckManifestSlideInput;
  slideData: Record<string, unknown>;
  deckTheme?: TemplateRenderThemeInput | null;
}): string {
  const theme = normalizeTheme(input.slide.theme ?? input.deckTheme);
  const slideTitle =
    input.slide.title ??
    `${input.resolvedSlide.templateGroup} - ${input.resolvedSlide.layoutName}`;
  const LayoutComponent = input.resolvedSlide.component;
  const renderRuntime = input.resolvedSlide.renderRuntime;
  const ReactForRender = renderRuntime?.react ?? React;
  const renderMarkup = renderRuntime?.renderToStaticMarkup ?? renderToStaticMarkup;
  const slideData = {
    ...input.slideData,
    _logo_url__: theme.logoUrl ?? null,
    __companyName__: theme.companyName ?? null,
  };

  const componentMarkup = renderMarkup(
    ReactForRender.createElement(
      "div",
      {
        "data-layout": input.resolvedSlide.layoutId,
        "data-group": input.resolvedSlide.templateGroup,
        "data-manifest-slide-id": input.slide.id,
        style: buildThemeInlineStyle(theme),
      },
      ReactForRender.createElement(LayoutComponent, { data: slideData }),
    ),
  );

  const headTags = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=1280, initial-scale=1" />',
    `<title>${escapeHtml(slideTitle)}</title>`,
    "<style>",
    "  html, body {",
    "    margin: 0;",
    "    padding: 0;",
    "    width: 1280px;",
    "    min-height: 720px;",
    "    overflow: hidden;",
    `    background: ${theme.colors.background ?? "#ffffff"};`,
    "  }",
    "  body {",
    "    position: relative;",
    "  }",
    "  #presentation-slides-wrapper {",
    "    width: 1280px;",
    "    min-height: 720px;",
    "  }",
    "</style>",
    ...buildFontHeadTags(theme),
    TAILWIND_CDN_SCRIPT,
  ].join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    headTags,
    "</head>",
    "<body>",
    '  <div id="presentation-slides-wrapper">',
    "    <div>",
    componentMarkup,
    "    </div>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}

export async function buildDeckHtmlFromManifest(
  input: BuildDeckHtmlFromManifestInput,
): Promise<BuildDeckHtmlFromManifestResult> {
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
  const slides = await Promise.all(
    manifest.slides.map(async (slide, index) => {
      const resolvedSlide = await resolveManifestSlide(slide, manifestCwd);
      const slideData = await resolveSlideData(slide, manifestCwd);
      const html = buildSlideDocumentHtml({
        resolvedSlide,
        slide,
        slideData,
        deckTheme: manifest.theme,
      });
      const slideFileName = `${index + 1}-${deckBaseName}-${sanitizeFileNamePart(
        resolvedSlide.layoutId,
      )}.html`;
      const slideOutputPath = path.join(outputDir, slideFileName);

      return {
        html,
        slideId: slide.id,
        layoutId: resolvedSlide.layoutId,
        fileName: slideFileName,
        outputPath: slideOutputPath,
        speaker_note: slide.speaker_note ?? "",
      };
    }),
  );
  const slidesToWrite = singlePageIndex === null ? slides : [slides[singlePageIndex]];

  const title = manifest.title ?? "Presenton Manifest Deck";
  const deckFileName = `${deckBaseName}-deck.html`;
  const deckOutputPath = path.join(outputDir, deckFileName);
  const deckHtml = singlePageIndex === null
    ? buildStandaloneDeckHtml({
      title,
      slides,
    })
    : "";

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    ...(singlePageIndex === null ? [writeFile(deckOutputPath, deckHtml, "utf8")] : []),
    ...slidesToWrite.map((slide) =>
      writeFile(
        slide.outputPath,
        slide.html,
        "utf8",
      )),
  ]);

  return {
    deckHtml,
    deckFileName,
    deckOutputPath,
    outputDir,
    deckGenerated: singlePageIndex === null,
    singlePage: singlePageIndex !== null,
    page: singlePageIndex === null ? null : singlePageIndex + 1,
    slideFiles: slidesToWrite.map((slide) => ({
      fileName: slide.fileName,
      outputPath: slide.outputPath,
      slideId: slide.slideId,
      layoutId: slide.layoutId,
    })),
    slideCount: slides.length,
    title,
    manifestPath,
  };
}
