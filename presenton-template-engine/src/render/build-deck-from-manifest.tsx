import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

import { getLayoutByLayoutId } from "../app/presentation-templates/index.js";
import type { TemplateWithData } from "../app/presentation-templates/utils.js";
import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
} from "../local-template/loader.js";
import { buildStandaloneDeckHtml } from "./build-deck.js";
import { buildLocalBrowserRuntimeBundle, type LocalRuntimeEntry } from "./local-runtime-bundle.js";
import { getBrowserRenderRuntimeBundle } from "./runtime-bundle.js";
import type {
  BrowserRenderContext,
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
  localEntryPath?: string;
};

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  setViewport?: (viewport: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  }) => Promise<void>;
  setContent: (
    html: string,
    options?: { waitUntil?: string | string[]; timeout?: number },
  ) => Promise<void>;
  $: (selector: string) => Promise<ElementHandleLike | null>;
  close?: () => Promise<void>;
};

type ElementHandleLike = {
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
  screenshot: (options?: { path?: string }) => Promise<unknown>;
};

const DEFAULT_SLIDE_SCREENSHOT_VIEWPORT = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 2,
};
const DEFAULT_RENDER_TIMEOUT_MS = 300_000;
const SLIDE_RENDER_SELECTOR = "#presentation-slides-wrapper";
const DEFAULT_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=TranslateUI",
  "--disable-ipc-flooding-protection",
];
const CHROME_EXECUTABLE_ENV_KEYS = [
  "PRESENTON_CHROME_EXECUTABLE_PATH",
  "PUPPETEER_EXECUTABLE_PATH",
  "CHROME_PATH",
  "GOOGLE_CHROME_BIN",
];

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPlatformChromeExecutableCandidates(): string[] {
  if (process.platform === "darwin") {
    const homeDir = getNonEmptyString(process.env.HOME);
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      homeDir
        ? path.join(
          homeDir,
          "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        : null,
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ].filter((candidate): candidate is string => Boolean(candidate));
  }

  if (process.platform === "win32") {
    const localAppData = getNonEmptyString(process.env.LOCALAPPDATA);
    const programFiles = getNonEmptyString(process.env.PROGRAMFILES);
    const programFilesX86 = getNonEmptyString(process.env["PROGRAMFILES(X86)"]);
    return [
      localAppData
        ? path.join(localAppData, "Google/Chrome/Application/chrome.exe")
        : null,
      programFiles
        ? path.join(programFiles, "Google/Chrome/Application/chrome.exe")
        : null,
      programFilesX86
        ? path.join(programFilesX86, "Google/Chrome/Application/chrome.exe")
        : null,
    ].filter((candidate): candidate is string => Boolean(candidate));
  }

  return [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
}

function getConfiguredChromeExecutable(): { key: string; value: string } | null {
  for (const key of CHROME_EXECUTABLE_ENV_KEYS) {
    const value = getNonEmptyString(process.env[key]);
    if (value) {
      return { key, value };
    }
  }

  return null;
}

async function findFirstAccessiblePath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }

  return null;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createBrowserLaunchError(
  attempts: string[],
  fallbackError: unknown,
): Error {
  const details = attempts.length > 0
    ? ` ${attempts.join(" ")}`
    : "";
  return new Error(
    `Could not launch a managed browser for buildDeckHtmlFromManifest slide screenshots.${details} Puppeteer default launch also failed: ${formatErrorMessage(fallbackError)}`,
    { cause: fallbackError instanceof Error ? fallbackError : undefined },
  );
}

async function launchManagedBrowser(puppeteer: any): Promise<BrowserLike> {
  const normalizedLaunchOptions = {
    headless: true,
    args: DEFAULT_BROWSER_ARGS,
  };

  const configuredExecutable = getConfiguredChromeExecutable();
  if (configuredExecutable) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: configuredExecutable.value,
      })) as BrowserLike;
    } catch (error) {
      throw new Error(
        `Failed to launch browser for buildDeckHtmlFromManifest using ${configuredExecutable.key}="${configuredExecutable.value}": ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  const systemCandidates = [...new Set(getPlatformChromeExecutableCandidates())];
  const systemExecutablePath = await findFirstAccessiblePath(systemCandidates);
  const attempts: string[] = [];

  if (systemExecutablePath) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: systemExecutablePath,
      })) as BrowserLike;
    } catch (error) {
      attempts.push(
        `Tried system Chrome at "${systemExecutablePath}" first, but launch failed: ${formatErrorMessage(error)}.`,
      );
    }
  } else {
    attempts.push(
      `No system Chrome executable was found in known locations: ${systemCandidates.join(", ")}.`,
    );
  }

  try {
    return (await puppeteer.launch(normalizedLaunchOptions)) as BrowserLike;
  } catch (error) {
    throw createBrowserLaunchError(attempts, error);
  }
}

async function createManagedPage(): Promise<{
  browser: BrowserLike;
  page: PageLike;
  close: () => Promise<void>;
}> {
  let puppeteerModule: any;
  try {
    const importPuppeteer = new Function(
      "return import('puppeteer')",
    ) as () => Promise<any>;
    puppeteerModule = await importPuppeteer();
  } catch (error) {
    throw new Error(
      "buildDeckHtmlFromManifest requires `puppeteer` to be installed to render per-slide screenshots.",
      { cause: error },
    );
  }

  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await launchManagedBrowser(puppeteer);
  const page = await browser.newPage();

  return {
    browser,
    page,
    close: async () => {
      await page.close?.().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}

async function waitForSlideRenderReady(
  page: PageLike,
  timeoutMs = DEFAULT_RENDER_TIMEOUT_MS,
): Promise<ElementHandleLike> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const slideElement = await page.$(SLIDE_RENDER_SELECTOR);
    if (!slideElement) {
      await delay(50);
      continue;
    }

    const status = await slideElement.evaluate((el) =>
      el.getAttribute("data-presenton-render-status"),
    );

    if (status === "ready") {
      return slideElement;
    }

    if (status === "error") {
      const message = await slideElement.evaluate((el) =>
        el.getAttribute("data-presenton-render-message"),
      );
      throw new Error(
        message
          ? `Slide render failed: ${message}`
          : "Slide render failed with status=error",
      );
    }

    await delay(50);
  }

  throw new Error(
    `Timed out waiting for slide render ready: ${SLIDE_RENDER_SELECTOR} within ${timeoutMs}ms`,
  );
}

async function writeSlideScreenshots(
  slides: Array<{ html: string; outputPath: string }>,
): Promise<void> {
  const runtime = await createManagedPage();

  try {
    await runtime.page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);

    for (const slide of slides) {
      await runtime.page.setContent(slide.html, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_RENDER_TIMEOUT_MS,
      });
      const slideElement = await waitForSlideRenderReady(runtime.page);
      const screenshot = await slideElement.screenshot({ path: slide.outputPath });
      if (!screenshot) {
        throw new Error(`Failed to write slide screenshot: ${slide.outputPath}`);
      }
    }
  } finally {
    await runtime.close();
  }
}

function parseSinglePageIndex(
  input: BuildDeckHtmlFromManifestInput,
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

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
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
      const theme = normalizeTheme(slide.theme ?? manifest.theme);
      const slideTitle =
        slide.title ??
        `${resolvedSlide.templateGroup} - ${resolvedSlide.layoutName}`;

      const context: BrowserRenderContext = {
        templateGroup: resolvedSlide.templateGroup,
        layoutId: resolvedSlide.layoutId,
        slideData,
        speakerNote: slide.speaker_note ?? "",
        title: slideTitle,
        theme,
      };

      const html = buildSlideDocumentHtml({ context });
      const slideFileName = `${index + 1}-${deckBaseName}-${sanitizeFileNamePart(
        resolvedSlide.layoutId,
      )}.png`;
      const slideOutputPath = path.join(outputDir, slideFileName);

      return {
        context,
        html,
        slideId: slide.id,
        layoutId: resolvedSlide.layoutId,
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
          slide.layoutId,
          {
            layoutId: slide.layoutId,
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
    localRuntimeEntries.length > 0
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

  const slidesToWrite = singlePageIndex === null ? slidesWithRuntime : [slidesWithRuntime[singlePageIndex]];
  const title = manifest.title ?? "Presenton Manifest Deck";
  const deckFileName = `${deckBaseName}-deck.html`;
  const deckOutputPath = path.join(outputDir, deckFileName);
  const deckHtml = singlePageIndex === null
    ? buildStandaloneDeckHtml({
      title,
      slides: slidesWithRuntime,
      runtimeBundle: localDeckRuntimeBundle,
    })
    : "";

  await mkdir(outputDir, { recursive: true });
  if (singlePageIndex === null) {
    await writeFile(deckOutputPath, deckHtml, "utf8");
  }
  await writeSlideScreenshots(slidesToWrite);

  return {
    deckHtml,
    deckFileName,
    deckOutputPath,
    outputDir,
    deckGenerated: singlePageIndex === null,
    singlePage: singlePageIndex !== null,
    page: singlePageIndex === null ? null : singlePageIndex + 1,
    slideFiles: slidesToWrite.map((slide): BuildDeckHtmlFromManifestFileOutput => ({
      fileName: slide.fileName,
      outputPath: slide.outputPath,
      slideId: slide.slideId,
      layoutId: slide.layoutId,
      kind: "image",
      mimeType: "image/png",
    })),
    slideCount: slidesWithRuntime.length,
    title,
    manifestPath,
  };
}
