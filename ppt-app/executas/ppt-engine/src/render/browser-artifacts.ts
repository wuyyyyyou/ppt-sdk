import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
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

async function createManagedPage(purpose: string): Promise<{
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
      `${purpose} requires \`puppeteer\` to be installed`,
      { cause: error },
    );
  }

  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await launchManagedBrowser(puppeteer, { purpose }) as BrowserLike;
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

export async function writeSlideScreenshots(
  slides: Array<{ html: string; outputPath: string; htmlPath?: string }>,
  purpose = "Page Source slide screenshots",
  options: { requireTailwind?: boolean; allowFailedImages?: boolean; validateManualSlideShell?: boolean } = {},
): Promise<void> {
  await withScreenshotRenderQueue(async () => {
    const runtime = await createManagedPage(purpose);

    try {
      await runtime.page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);
      await installRenderReadinessTracking(runtime.page);

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
        await waitForRenderReadiness(runtime.page, {
          timeoutMs: 30_000,
          requireTailwind: options.requireTailwind,
          allowFailedImages: options.allowFailedImages,
        });
        if (options.validateManualSlideShell) {
          await runtime.page.evaluate(() => {
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
    } finally {
      await runtime.close();
    }
  });
}

export async function staticizeHtmlDocuments(
  documents: Array<{ htmlPath: string; kind: StaticHtmlDocumentKind }>,
  purpose = "Page Source static HTML generation",
): Promise<void> {
  await withScreenshotRenderQueue(async () => {
    const runtime = await createManagedPage(purpose);
    try {
      await runtime.page.setViewport?.(DEFAULT_SLIDE_SCREENSHOT_VIEWPORT);
      await installRenderReadinessTracking(runtime.page);
      for (const document of documents) {
        if (!runtime.page.goto) {
          throw new Error("Static HTML generation requires browser file navigation support");
        }
        await runtime.page.goto(pathToFileURL(document.htmlPath).href, {
          waitUntil: "domcontentloaded",
          timeout: DEFAULT_RENDER_TIMEOUT_MS,
        });
        await waitForSlideRenderReady(runtime.page);
        await waitForRenderReadiness(runtime.page, {
          timeoutMs: document.kind === "deck" ? 60_000 : 30_000,
        });
        const staticHtml = await serializeRenderedPageToStaticHtml(
          runtime.page,
          document.kind,
        );
        await writeFile(document.htmlPath, staticHtml, "utf8");
      }
    } finally {
      await runtime.close();
    }
  });
}
