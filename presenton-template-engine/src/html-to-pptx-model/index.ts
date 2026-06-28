import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

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
import {
  launchManagedBrowser,
  waitForRenderReady,
} from "../runtime/browser-runtime.js";

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
  htmlFilePath?: string;
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

function debugLog(...args: unknown[]) {
  if (!DEBUG_HTML_TO_PPTX) {
    return;
  }
  console.error("[ppt-engine html-to-model]", ...args);
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
  let temporaryHtmlPath: string | null = null;

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

    if (ownedPage && runtime.page.goto) {
      const htmlFilePath = input.htmlFilePath ?? await writeTemporaryDeckHtml(input.html);
      if (!input.htmlFilePath) {
        temporaryHtmlPath = htmlFilePath;
      }

      debugLog("gotoHtmlFile.start", {
        deckSelector,
        contentTimeoutMs,
        htmlFilePath,
      });
      await runtime.page.goto(pathToFileURL(htmlFilePath).href, {
        waitUntil: input.contentWaitUntil ?? "domcontentloaded",
        timeout: contentTimeoutMs,
      });
      debugLog("gotoHtmlFile.done");
    } else {
      debugLog("setContent.start", {
        deckSelector,
        contentTimeoutMs,
      });
      await runtime.page.setContent(input.html, {
        waitUntil: input.contentWaitUntil ?? "domcontentloaded",
        timeout: contentTimeoutMs,
      });
      debugLog("setContent.done");
    }

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
    if (temporaryHtmlPath) {
      await rm(temporaryHtmlPath, { force: true }).catch((error: Error) => {
        debugLog("temporaryHtml.cleanup.error", error.stack ?? error.message);
      });
    }
    if (ownedPage) {
      await runtime.close();
    }
  }
}

async function writeTemporaryDeckHtml(html: string): Promise<string> {
  const dir = join(tmpdir(), "presenton-template-engine", "html-to-pptx-model");
  await mkdir(dir, { recursive: true });
  const htmlPath = join(dir, `deck-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(htmlPath, html, "utf8");
  return htmlPath;
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
  const browser = await launchManagedBrowser(puppeteer, {
    purpose: "convertDeckHtmlToPptxModel",
    launchOptions,
    dumpio: DEBUG_HTML_TO_PPTX,
  }) as BrowserLike;

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
  debugLog("waitForDeckRenderReady.start");
  await waitForRenderReady(page, {
    selector: deckSelector,
    timeoutMs,
    kindLabel: "Deck",
  });
  debugLog("waitForDeckRenderReady.done");
}
