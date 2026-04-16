import path from "node:path";

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
  BuildDeckHtmlFromManifestInput,
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
      (typeof slide.data !== "object" || Array.isArray(slide.data))
    ) {
      throw new Error(`Slide "${slide.id}" field "data" must be an object when provided`);
    }
  });
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
  cwd: string,
): Promise<ResolvedManifestSlide> {
  switch (slide.source.type) {
    case "builtin":
      return resolveBuiltinSlide(slide);
    case "local":
      return resolveLocalSlide(slide, cwd);
    default:
      throw new Error(
        `Slide "${slide.id}" uses unsupported source type "${String((slide.source as { type?: unknown }).type)}"`,
      );
  }
}

function buildSlideDocumentHtml(input: {
  resolvedSlide: ResolvedManifestSlide;
  slide: DeckManifestSlideInput;
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
    ...(input.slide.data ?? {}),
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
): Promise<string> {
  if (!input || typeof input !== "object") {
    throw new Error("Manifest build input must be an object");
  }

  validateDeckManifest(input.manifest);

  const cwd = path.resolve(input.cwd ?? process.cwd());
  const slides = await Promise.all(
    input.manifest.slides.map(async (slide) => {
      const resolvedSlide = await resolveManifestSlide(slide, cwd);
      const html = buildSlideDocumentHtml({
        resolvedSlide,
        slide,
        deckTheme: input.manifest.theme,
      });

      return {
        html,
        speaker_note: slide.speaker_note ?? "",
      };
    }),
  );

  return buildStandaloneDeckHtml({
    title: input.manifest.title ?? "Presenton Manifest Deck",
    slides,
  });
}
