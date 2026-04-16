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
  deviceScaleFactor: 1,
};

const DEFAULT_DECK_SELECTOR = "#presentation-slides-wrapper";
const DEBUG_HTML_TO_PPTX = process.env.PRESENTON_DEBUG_HTML_TO_PPTX === "1";

function debugLog(...args: unknown[]) {
  if (!DEBUG_HTML_TO_PPTX) {
    return;
  }
  console.error("[presenton-html-to-pptx-model]", ...args);
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
  const browser = (await puppeteer.launch({
    headless: true,
    dumpio: DEBUG_HTML_TO_PPTX,
    args: [
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
    ],
    ...launchOptions,
  })) as BrowserLike;

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
