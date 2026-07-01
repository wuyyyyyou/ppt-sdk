import path from "node:path";
import { pathToFileURL } from "node:url";
import { access, mkdir, writeFile } from "node:fs/promises";

import { buildStandaloneDeckHtml } from "./build-deck.js";
import { prepareManifestRenderPlan } from "./manifest-render-plan.js";
import { withScreenshotRenderQueue } from "./screenshot-render-queue.js";
import {
  launchManagedBrowser as launchSharedManagedBrowser,
  waitForRenderReady,
} from "../runtime/browser-runtime.js";
import type {
  BuildDeckHtmlPagesAndScreenshotsFromManifestResult,
  BuildDeckHtmlPagesFromManifestResult,
  BuildDeckPageScreenshotFromManifestInput,
  BuildDeckPageScreenshotFromManifestResult,
  BuildDeckHtmlFromManifestFileOutput,
  BuildDeckHtmlFromManifestInput,
  BuildDeckHtmlFromManifestResult,
} from "./types.js";

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
  goto?: (
    url: string,
    options?: { waitUntil?: string | string[]; timeout?: number },
  ) => Promise<unknown>;
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

function sanitizeFileNamePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "deck";
}

export function buildSinglePagePreviewBaseFileName(input: {
  pageNumber: number;
  deckBaseName: string;
  slideId: string;
  layoutId: string;
}): string {
  return `${String(input.pageNumber).padStart(2, "0")}-${input.deckBaseName}-${sanitizeFileNamePart(
    input.slideId,
  )}-${sanitizeFileNamePart(
    input.layoutId,
  )}`;
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
  const browser = await launchSharedManagedBrowser(puppeteer, {
    purpose: "buildDeckHtmlFromManifest slide screenshots",
  }) as BrowserLike;
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
  return (await waitForRenderReady(page, {
    selector: SLIDE_RENDER_SELECTOR,
    timeoutMs,
    kindLabel: "Slide",
  })) as ElementHandleLike;
}

async function writeSlideScreenshots(
  slides: Array<{ html: string; outputPath: string; htmlPath?: string }>,
): Promise<void> {
  await withScreenshotRenderQueue(async () => {
    const runtime = await createManagedPage();

    try {
      await runtime.page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);

      for (const slide of slides) {
        if (slide.htmlPath && runtime.page.goto) {
          await runtime.page.goto(pathToFileURL(slide.htmlPath).href, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_RENDER_TIMEOUT_MS,
          });
        } else {
          await runtime.page.setContent(slide.html, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_RENDER_TIMEOUT_MS,
          });
        }
        const slideElement = await waitForSlideRenderReady(runtime.page);
        const screenshot = await slideElement.screenshot({ path: slide.outputPath });
        if (!screenshot) {
          throw new Error(`Failed to write slide screenshot: ${slide.outputPath}`);
        }
      }
    } finally {
      await runtime.close();
    }
  });
}

export async function buildDeckHtmlPagesFromManifest(
  input: BuildDeckHtmlFromManifestInput,
): Promise<BuildDeckHtmlPagesFromManifestResult> {
  const prepared = await prepareManifestRenderPlan(input);
  const slidesToWrite = prepared.slides;

  await mkdir(prepared.outputDir, { recursive: true });
  await Promise.all(
    slidesToWrite.map(async (slide) => {
      const fileName = `${String(slide.pageNumber).padStart(2, "0")}-${prepared.deckBaseName}-${sanitizeFileNamePart(
        slide.layoutId,
      )}.html`;
      const outputPath = path.join(prepared.outputDir, fileName);
      slide.fileName = fileName;
      slide.outputPath = outputPath;
      await writeFile(outputPath, slide.html, "utf8");
    }),
  );

  return {
    outputDir: prepared.outputDir,
    slides: slidesToWrite.map((slide) => ({
      slideId: slide.slideId,
      layoutId: slide.layoutId,
      title: slide.context.title,
      fileName: slide.fileName,
      outputPath: slide.outputPath,
      speakerNote: slide.speaker_note,
    })),
    slideCount: prepared.slideCount,
    title: prepared.title,
    manifestPath: prepared.manifestPath,
  };
}

export async function buildDeckHtmlPagesAndScreenshotsFromManifest(
  input: BuildDeckHtmlFromManifestInput,
): Promise<BuildDeckHtmlPagesAndScreenshotsFromManifestResult> {
  const prepared = await prepareManifestRenderPlan(input);
  const slidesToWrite = prepared.slides;

  await mkdir(prepared.outputDir, { recursive: true });
  const screenshotSlides = await Promise.all(
    slidesToWrite.map(async (slide) => {
      const baseFileName = `${String(slide.pageNumber).padStart(2, "0")}-${prepared.deckBaseName}-${sanitizeFileNamePart(
        slide.layoutId,
      )}`;
      const htmlFileName = `${baseFileName}.html`;
      const htmlPath = path.join(prepared.outputDir, htmlFileName);
      const screenshotFileName = `${baseFileName}.png`;
      const screenshotPath = path.join(prepared.outputDir, screenshotFileName);

      await writeFile(htmlPath, slide.html, "utf8");

      return {
        slide,
        htmlFileName,
        htmlPath,
        screenshotFileName,
        screenshotPath,
      };
    }),
  );

  await writeSlideScreenshots(
    screenshotSlides.map((slide) => ({
      html: slide.slide.html,
      htmlPath: slide.htmlPath,
      outputPath: slide.screenshotPath,
    })),
  );

  return {
    outputDir: prepared.outputDir,
    slides: screenshotSlides.map((slide) => ({
      slideId: slide.slide.slideId,
      layoutId: slide.slide.layoutId,
      title: slide.slide.context.title,
      htmlFileName: slide.htmlFileName,
      htmlPath: slide.htmlPath,
      screenshotFileName: slide.screenshotFileName,
      screenshotPath: slide.screenshotPath,
      speakerNote: slide.slide.speaker_note,
    })),
    slideCount: prepared.slideCount,
    title: prepared.title,
    manifestPath: prepared.manifestPath,
  };
}

export async function buildDeckPageScreenshotFromManifest(
  input: BuildDeckPageScreenshotFromManifestInput,
): Promise<BuildDeckPageScreenshotFromManifestResult> {
  const outputDir = resolveAbsolutePath(input.outputDir, "outputDir");
  const htmlOutputDir = resolveOptionalAbsolutePath(input.htmlOutputDir, "htmlOutputDir")
    ?? outputDir;
  const prepared = await prepareManifestRenderPlan({
    manifestPath: input.manifestPath,
    outputDir,
    name: input.name,
    singlePage: true,
    page: input.page,
    cwd: input.cwd,
  });
  const slide = prepared.slides[0];
  if (!slide) {
    throw new Error("Single-page render plan did not produce a slide");
  }
  const pageNumber = slide.pageNumber;
  const baseFileName = buildSinglePagePreviewBaseFileName({
    pageNumber,
    deckBaseName: prepared.deckBaseName,
    slideId: slide.slideId,
    layoutId: slide.layoutId,
  });

  await mkdir(outputDir, { recursive: true });
  await mkdir(htmlOutputDir, { recursive: true });

  const htmlFileName = `${baseFileName}.html`;
  const htmlPath = path.join(htmlOutputDir, htmlFileName);
  const screenshotFileName = `${baseFileName}.png`;
  const screenshotPath = path.join(outputDir, screenshotFileName);

  await writeFile(htmlPath, slide.html, "utf8");
  await writeSlideScreenshots([{ html: slide.html, htmlPath, outputPath: screenshotPath }]);

  return {
    manifestPath: prepared.manifestPath,
    outputDir,
    htmlOutputDir,
    slideId: slide.slideId,
    layoutId: slide.layoutId,
    title: slide.context.title,
    htmlFileName,
    htmlPath,
    screenshotFileName,
    screenshotPath,
    page: pageNumber,
    slideCount: prepared.slideCount,
  };
}

export async function buildDeckHtmlFromManifest(
  input: BuildDeckHtmlFromManifestInput,
): Promise<BuildDeckHtmlFromManifestResult> {
  const prepared = await prepareManifestRenderPlan(input);
  const title = prepared.title;
  const deckFileName = `${prepared.deckBaseName}-deck.html`;
  const deckOutputPath = path.join(prepared.outputDir, deckFileName);
  const deckHtml = prepared.singlePageIndex === null
    ? buildStandaloneDeckHtml({
      title,
      slides: prepared.slides,
      runtimeBundle: prepared.deckRuntimeBundle,
    })
    : "";

  await mkdir(prepared.outputDir, { recursive: true });
  if (prepared.singlePageIndex === null) {
    await writeFile(deckOutputPath, deckHtml, "utf8");
  }
  const slidesToWrite = prepared.slides;
  const screenshotSlides = await Promise.all(
    slidesToWrite.map(async (slide) => {
      const htmlFileName = slide.fileName.replace(/\.png$/, ".html");
      const htmlPath = path.join(prepared.outputDir, htmlFileName);
      await writeFile(htmlPath, slide.html, "utf8");
      return {
        html: slide.html,
        htmlPath,
        outputPath: slide.outputPath,
      };
    }),
  );
  await writeSlideScreenshots(screenshotSlides);

  return {
    deckHtml,
    deckFileName,
    deckOutputPath,
    outputDir: prepared.outputDir,
    deckGenerated: prepared.singlePageIndex === null,
    singlePage: prepared.singlePageIndex !== null,
    page: prepared.singlePageIndex === null ? null : prepared.singlePageIndex + 1,
    slideFiles: slidesToWrite.map((slide): BuildDeckHtmlFromManifestFileOutput => ({
      fileName: slide.fileName,
      outputPath: slide.outputPath,
      slideId: slide.slideId,
      layoutId: slide.layoutId,
      kind: "image",
      mimeType: "image/png",
    })),
    slideCount: prepared.slideCount,
    title,
    manifestPath: prepared.manifestPath,
  };
}
