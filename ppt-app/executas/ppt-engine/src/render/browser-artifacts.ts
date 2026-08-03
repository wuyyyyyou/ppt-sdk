import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  closeManagedBrowser,
  launchManagedBrowser,
  waitForRenderReady,
} from "../runtime/browser-runtime.js";
import { withScreenshotRenderQueue } from "./screenshot-render-queue.js";
import {
  installRenderReadinessTracking,
  serializeRenderedPageToStaticHtml,
  waitForRenderReadiness,
  type StaticHtmlDocumentKind,
} from "./static-html.js";

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
  process?: () => {
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
    kill: (signal: NodeJS.Signals) => boolean;
  } | null;
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
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
  evaluateOnNewDocument?: (
    pageFunction: string | ((...args: any[]) => unknown),
    ...args: any[]
  ) => Promise<unknown>;
  close: () => Promise<void>;
};

type ElementHandleLike = {
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
  screenshot: (options?: { path?: string }) => Promise<unknown>;
};

type ManagedPageRuntime = {
  browser: BrowserLike;
  page: PageLike | null;
  close: () => Promise<void>;
};

const DEFAULT_SLIDE_SCREENSHOT_VIEWPORT = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 2,
};
const DEFAULT_RENDER_TIMEOUT_MS = 300_000;
const PAGE_BROWSER_OPERATION_TIMEOUT_MS = 50_000;
const DECK_BROWSER_OPERATION_TIMEOUT_MS = 100_000;
const MAX_BROWSER_OPERATION_TIMEOUT_MS = 10 * 60_000;
const SLIDE_RENDER_SELECTOR = "#presentation-slides-wrapper";

function scaleBrowserOperationTimeout(perItemTimeoutMs: number, itemCount: number): number {
  return Math.min(
    MAX_BROWSER_OPERATION_TIMEOUT_MS,
    Math.max(perItemTimeoutMs, perItemTimeoutMs * Math.max(1, itemCount)),
  );
}

async function createManagedPage(
  purpose: string,
  onBrowserCreated?: (runtime: ManagedPageRuntime) => void,
): Promise<ManagedPageRuntime> {
  let puppeteerModule: any;
  try {
    const importPuppeteer = new Function(
      "return import('puppeteer')",
    ) as () => Promise<any>;
    puppeteerModule = await importPuppeteer();
  } catch (error) {
    throw new Error(
      `${purpose} requires \`puppeteer\` to be installed`,
      { cause: error },
    );
  }

  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await launchManagedBrowser(puppeteer, { purpose }) as BrowserLike;
  let closePromise: Promise<void> | null = null;
  const runtime: ManagedPageRuntime = {
    browser,
    page: null,
    close: () => {
      closePromise ??= closeManagedBrowser({
        purpose,
        page: runtime.page,
        browser,
      });
      return closePromise;
    },
  };
  onBrowserCreated?.(runtime);
  runtime.page = await browser.newPage();
  return runtime;
}

async function withQueuedManagedPage<T>(
  purpose: string,
  timeoutMs: number,
  operation: (page: PageLike) => Promise<T>,
): Promise<T> {
  let runtime: ManagedPageRuntime | null = null;
  let timedOut = false;

  return withScreenshotRenderQueue(async () => {
    runtime = await createManagedPage(purpose, (createdRuntime) => {
      runtime = createdRuntime;
    });
    if (timedOut) {
      await runtime.close();
      throw new Error(`${purpose} was cancelled after its queue operation timed out`);
    }
    if (!runtime.page) {
      throw new Error(`${purpose} did not create a browser page`);
    }
    try {
      return await operation(runtime.page);
    } finally {
      await runtime.close();
    }
  }, {
    timeoutMs,
    label: purpose,
    onTimeout: async () => {
      timedOut = true;
      await runtime?.close();
    },
  });
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

export async function writeSlideScreenshots(
  slides: Array<{ html: string; outputPath: string; htmlPath?: string }>,
  purpose = "Page Source slide screenshots",
  options: { requireTailwind?: boolean; allowFailedImages?: boolean; validateManualSlideShell?: boolean } = {},
): Promise<void> {
  const operationTimeoutMs = scaleBrowserOperationTimeout(
    PAGE_BROWSER_OPERATION_TIMEOUT_MS,
    slides.length,
  );
  await withQueuedManagedPage(purpose, operationTimeoutMs, async (page) => {
    await page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);
    await installRenderReadinessTracking(page);

    for (const slide of slides) {
      if (slide.htmlPath && page.goto) {
        await page.goto(pathToFileURL(slide.htmlPath).href, {
          waitUntil: "domcontentloaded",
          timeout: DEFAULT_RENDER_TIMEOUT_MS,
        });
      } else {
        await page.setContent(slide.html, {
          waitUntil: "domcontentloaded",
          timeout: DEFAULT_RENDER_TIMEOUT_MS,
        });
      }
      const slideElement = await waitForSlideRenderReady(page);
      await waitForRenderReadiness(page, {
        timeoutMs: 30_000,
        requireTailwind: options.requireTailwind,
        allowFailedImages: options.allowFailedImages,
      });
      if (options.validateManualSlideShell) {
        await page.evaluate(() => {
          const shells = Array.from(document.querySelectorAll<HTMLElement>('[data-presenton-slide-shell="true"]'));
          if (shells.length !== 1) throw new Error(`Manual page must contain exactly one slide shell; found ${shells.length}`);
          const shell = shells[0]!;
          const rect = shell.getBoundingClientRect();
          const style = getComputedStyle(shell);
          if (Math.round(rect.width) !== 1280 || Math.round(rect.height) !== 720) {
            throw new Error(`Manual page slide shell must measure 1280x720; measured ${rect.width}x${rect.height}`);
          }
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            throw new Error("Manual page slide shell must be visible");
          }
          const fontFamilies = new Set<string>();
          for (const element of [shell, ...Array.from(shell.querySelectorAll<HTMLElement>("*"))]) {
            const computed = getComputedStyle(element);
            if (computed.display !== "none" && computed.visibility !== "hidden" && element.textContent?.trim()) {
              const family = computed.fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
              if (family) fontFamilies.add(family);
            }
          }
          for (const family of fontFamilies) {
            if (document.fonts && !document.fonts.check(`16px "${family}"`)) {
              throw new Error(`Manual page font failed to load: ${family}`);
            }
          }
        });
      }
      const screenshot = await slideElement.screenshot({ path: slide.outputPath });
      if (!screenshot) {
        throw new Error(`Failed to write slide screenshot: ${slide.outputPath}`);
      }
    }
  });
}

export async function staticizeAndWriteSlideScreenshots(
  slides: Array<{ htmlPath: string; outputPath: string }>,
  purpose = "Page Source static HTML and slide screenshots",
): Promise<void> {
  const operationTimeoutMs = scaleBrowserOperationTimeout(
    PAGE_BROWSER_OPERATION_TIMEOUT_MS * 2,
    slides.length,
  );
  await withQueuedManagedPage(purpose, operationTimeoutMs, async (page) => {
    if (!page.goto) {
      throw new Error("Static HTML generation requires browser file navigation support");
    }
    await page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);
    await installRenderReadinessTracking(page);

    for (const slide of slides) {
      const slideUrl = pathToFileURL(slide.htmlPath).href;
      await page.goto(slideUrl, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_RENDER_TIMEOUT_MS,
      });
      await waitForSlideRenderReady(page);
      await waitForRenderReadiness(page, { timeoutMs: 30_000 });
      const staticHtml = await serializeRenderedPageToStaticHtml(page, "page");
      await writeFile(slide.htmlPath, staticHtml, "utf8");

      // The screenshot must come from the persisted snapshot, not the live
      // React document that produced it.
      await page.goto(slideUrl, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_RENDER_TIMEOUT_MS,
      });
      const slideElement = await waitForSlideRenderReady(page);
      await waitForRenderReadiness(page, { timeoutMs: 30_000 });
      const screenshot = await slideElement.screenshot({ path: slide.outputPath });
      if (!screenshot) {
        throw new Error(`Failed to write slide screenshot: ${slide.outputPath}`);
      }
    }
  });
}

export async function staticizeHtmlDocuments(
  documents: Array<{ htmlPath: string; kind: StaticHtmlDocumentKind }>,
  purpose = "Page Source static HTML generation",
): Promise<void> {
  const operationTimeoutMs = Math.min(
    MAX_BROWSER_OPERATION_TIMEOUT_MS,
    documents.reduce(
      (total, document) => total + (
        document.kind === "deck"
          ? DECK_BROWSER_OPERATION_TIMEOUT_MS
          : PAGE_BROWSER_OPERATION_TIMEOUT_MS
      ),
      0,
    ) || PAGE_BROWSER_OPERATION_TIMEOUT_MS,
  );
  await withQueuedManagedPage(purpose, operationTimeoutMs, async (page) => {
    await page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);
    await installRenderReadinessTracking(page);
    for (const document of documents) {
      if (!page.goto) {
        throw new Error("Static HTML generation requires browser file navigation support");
      }
      await page.goto(pathToFileURL(document.htmlPath).href, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_RENDER_TIMEOUT_MS,
      });
      await waitForSlideRenderReady(page);
      await waitForRenderReadiness(page, {
        timeoutMs: document.kind === "deck" ? 60_000 : 30_000,
      });
      const staticHtml = await serializeRenderedPageToStaticHtml(
        page,
        document.kind,
      );
      await writeFile(document.htmlPath, staticHtml, "utf8");
    }
  });
}
