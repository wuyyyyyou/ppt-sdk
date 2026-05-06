import { access } from "node:fs/promises";
import path from "node:path";

import type { BrowserLike, PageLike } from "./types/browser.js";
import {
  createPresentationPptxModel,
  convertElementAttributesToPptxSlides,
  convertSlideElementAttributesToPptxSlideModel,
} from "./convert/element-attributes-to-pptx-model.js";
import {
  extractDeckPageToSlideAttributes,
  sortElementsForPpt,
  shouldKeepRootLevelElement,
  type ExtractDeckPageToSlideAttributesInput,
} from "./extract/deck-to-element-attributes.js";
import type { PptxPresentationModel } from "./types/pptx-models.js";

export * from "./types/browser.js";
export * from "./types/element-attributes.js";
export * from "./types/pptx-models.js";
export type { OrderedExtractedElement } from "./extract/deck-to-element-attributes.js";
export {
  convertElementAttributesToPptxSlides,
  convertSlideElementAttributesToPptxSlideModel,
  extractDeckPageToSlideAttributes,
  sortElementsForPpt,
  shouldKeepRootLevelElement,
};

export interface ConvertDeckPageToPptxModelInput
  extends ExtractDeckPageToSlideAttributesInput {
  name?: string;
}

export interface ConvertDeckHtmlToPptxModelInput {
  html: string;
  name?: string;
  page?: PageLike;
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  contentWaitUntil?: string | string[];
  contentTimeoutMs?: number;
  renderReadyTimeoutMs?: number;
  settleTimeMs?: number;
  deckSelector?: string;
  slideSelector?: string;
  screenshotsDir?: string;
  launchOptions?: Record<string, unknown>;
}

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 2,
};

const DEFAULT_DECK_SELECTOR = "#presentation-slides-wrapper";
const DECK_VIEWER_MODE_CLASS = "presenton-viewer-mode";
const DEBUG_HTML_TO_PPTX = process.env.PRESENTON_DEBUG_HTML_TO_PPTX === "1";
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

function debugLog(...args: unknown[]) {
  if (!DEBUG_HTML_TO_PPTX) {
    return;
  }
  console.error("[ppt-engine html-to-model]", ...args);
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

function getSystemChromeExecutableCandidates(): string[] {
  return [...new Set(getPlatformChromeExecutableCandidates())];
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
    `Could not launch a managed browser for convertDeckHtmlToPptxModel.${details} Puppeteer default launch also failed: ${formatErrorMessage(fallbackError)}`,
    { cause: fallbackError instanceof Error ? fallbackError : undefined },
  );
}

async function launchManagedBrowser(
  puppeteer: any,
  launchOptions?: Record<string, unknown>,
): Promise<BrowserLike> {
  const explicitExecutablePath = getNonEmptyString(launchOptions?.executablePath);
  const explicitChannel = getNonEmptyString(launchOptions?.channel);
  const normalizedLaunchOptions = {
    headless: true,
    dumpio: DEBUG_HTML_TO_PPTX,
    args: DEFAULT_BROWSER_ARGS,
    ...launchOptions,
  };

  if (explicitExecutablePath || explicitChannel) {
    try {
      return (await puppeteer.launch(normalizedLaunchOptions)) as BrowserLike;
    } catch (error) {
      const targetLabel = explicitExecutablePath
        ? `executablePath "${explicitExecutablePath}"`
        : `channel "${explicitChannel}"`;
      throw new Error(
        `Failed to launch browser for convertDeckHtmlToPptxModel using explicit ${targetLabel}: ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  const configuredExecutable = getConfiguredChromeExecutable();
  if (configuredExecutable) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: configuredExecutable.value,
      })) as BrowserLike;
    } catch (error) {
      throw new Error(
        `Failed to launch browser for convertDeckHtmlToPptxModel using ${configuredExecutable.key}="${configuredExecutable.value}": ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  const systemCandidates = getSystemChromeExecutableCandidates();
  const systemExecutablePath = await findFirstAccessiblePath(systemCandidates);
  const attempts: string[] = [];

  if (systemExecutablePath) {
    try {
      debugLog("launch.systemChrome", systemExecutablePath);
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: systemExecutablePath,
      })) as BrowserLike;
    } catch (error) {
      attempts.push(
        `Tried system Chrome at "${systemExecutablePath}" first, but launch failed: ${formatErrorMessage(error)}.`,
      );
      debugLog("launch.systemChrome.error", formatErrorMessage(error));
    }
  } else {
    attempts.push(
      `No system Chrome executable was found in known locations: ${systemCandidates.join(", ")}.`,
    );
    debugLog("launch.systemChrome.missing", systemCandidates);
  }

  try {
    debugLog("launch.puppeteerDefault");
    return (await puppeteer.launch(normalizedLaunchOptions)) as BrowserLike;
  } catch (error) {
    throw createBrowserLaunchError(attempts, error);
  }
}

export async function convertDeckPageToPptxModel(
  input: ConvertDeckPageToPptxModelInput,
): Promise<PptxPresentationModel> {
  const slidesAttributes = await extractDeckPageToSlideAttributes(input);
  return createPresentationPptxModel({
    name: input.name,
    slidesAttributes,
  });
}

export async function convertDeckHtmlToPptxModel(
  input: ConvertDeckHtmlToPptxModelInput,
): Promise<PptxPresentationModel> {
  const ownedPage = !input.page;
  const runtime = ownedPage
    ? await createManagedPage(input.launchOptions)
    : { page: input.page as PageLike, close: async () => {} };

  try {
    if (runtime.page.setViewport) {
      debugLog("setViewport.start");
      await runtime.page.setViewport(input.viewport ?? DEFAULT_VIEWPORT);
      debugLog("setViewport.done");
    }

    if (runtime.page.evaluateOnNewDocument) {
      debugLog("evaluateOnNewDocument.disableViewerMode.start");
      await runtime.page.evaluateOnNewDocument(() => {
        (window as typeof window & {
          __PRESENTON_DISABLE_VIEWER_MODE__?: boolean;
        }).__PRESENTON_DISABLE_VIEWER_MODE__ = true;
      });
      debugLog("evaluateOnNewDocument.disableViewerMode.done");
    }

    const deckSelector = input.deckSelector ?? DEFAULT_DECK_SELECTOR;
    const contentTimeoutMs = input.contentTimeoutMs ?? 300000;

    debugLog("setContent.start", {
      deckSelector,
      contentTimeoutMs,
    });
    await runtime.page.setContent(input.html, {
      waitUntil: input.contentWaitUntil ?? "domcontentloaded",
      timeout: contentTimeoutMs,
    });
    debugLog("setContent.done");

    debugLog("waitForDeckRenderReady.start");
    await waitForDeckRenderReady(
      runtime.page,
      deckSelector,
      input.renderReadyTimeoutMs ?? contentTimeoutMs,
    );
    debugLog("waitForDeckRenderReady.done");

    if (input.settleTimeMs && input.settleTimeMs > 0) {
      debugLog("settle.start", { settleTimeMs: input.settleTimeMs });
      await delay(input.settleTimeMs);
      debugLog("settle.done");
    }

    debugLog("normalizeDeckForExtraction.start");
    await normalizeDeckForExtraction(runtime.page, deckSelector);
    debugLog("normalizeDeckForExtraction.done");

    debugLog("extractDeckPageToSlideAttributes.start");
    return await convertDeckPageToPptxModel({
      page: runtime.page,
      name: input.name,
      deckSelector,
      slideSelector: input.slideSelector,
      screenshotsDir: input.screenshotsDir,
    });
  } finally {
    if (ownedPage) {
      await runtime.close();
    }
  }
}

async function normalizeDeckForExtraction(
  page: PageLike,
  deckSelector: string,
): Promise<void> {
  const deckElement = await page.$(deckSelector);
  if (!deckElement) {
    throw new Error(`Presentation slides wrapper not found: ${deckSelector}`);
  }

  await deckElement.evaluate(
    (el, viewerModeClass) => {
      const html = document.documentElement;
      (window as typeof window & {
        __PRESENTON_DISABLE_VIEWER_MODE__?: boolean;
      }).__PRESENTON_DISABLE_VIEWER_MODE__ = true;

      html.classList.remove(viewerModeClass);
      (el as HTMLElement).style.removeProperty("--presenton-viewer-scale");

      const slideShells = Array.from(
        el.querySelectorAll(':scope > [data-presenton-slide-shell="true"]'),
      ) as HTMLElement[];

      slideShells.forEach((slideShell: HTMLElement) => {
        slideShell.style.display = "block";
        slideShell.style.visibility = "visible";
        slideShell.style.pointerEvents = "auto";
        slideShell.style.position = "relative";
        slideShell.style.inset = "auto";
      });
    },
    DECK_VIEWER_MODE_CLASS,
  );

  await delay(0);
}

async function createManagedPage(launchOptions?: Record<string, unknown>): Promise<{
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
      "convertDeckHtmlToPptxModel requires `puppeteer` to be installed when no page is provided.",
      { cause: error },
    );
  }

  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await launchManagedBrowser(puppeteer, launchOptions);

  const page = await browser.newPage();
  const debugPage = page as PageLike & {
    on?: (event: string, listener: (...args: any[]) => void) => void;
  };
  if (DEBUG_HTML_TO_PPTX && typeof debugPage.on === "function") {
    debugPage.on("console", (message: { type: () => string; text: () => string }) => {
      debugLog("page.console", message.type(), message.text());
    });
    debugPage.on("pageerror", (error: Error) => {
      debugLog("page.pageerror", error.stack ?? error.message);
    });
    debugPage.on("error", (error: Error) => {
      debugLog("page.error", error.stack ?? error.message);
    });
    debugPage.on("close", () => {
      debugLog("page.close");
    });
  }

  return {
    browser,
    page,
    close: async () => {
      await page.close?.().catch((error: Error) => {
        debugLog("page.close.error", error.stack ?? error.message);
      });
      await browser.close().catch((error: Error) => {
        debugLog("browser.close.error", error.stack ?? error.message);
      });
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDeckRenderReady(
  page: PageLike,
  deckSelector: string,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const deckElement = await page.$(deckSelector);
    if (!deckElement) {
      debugLog("waitForDeckRenderReady.missingWrapper");
      await delay(50);
      continue;
    }

    const status = await deckElement.evaluate((el) =>
      el.getAttribute("data-presenton-render-status"),
    );
    debugLog("waitForDeckRenderReady.status", status);

    if (status === "ready") {
      return;
    }

    if (status === "error") {
      const message = await deckElement.evaluate((el) =>
        el.getAttribute("data-presenton-render-message"),
      );
      throw new Error(
        message
          ? `Deck render failed: ${message}`
          : "Deck render failed with status=error",
      );
    }

    await delay(50);
  }

  throw new Error(
    `Timed out waiting for deck render ready: ${deckSelector} within ${timeoutMs}ms`,
  );
}
