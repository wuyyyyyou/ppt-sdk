import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { buildDeckHtmlFromManifest } from "../../render/build-deck-from-manifest.js";
import type {
  RenderedSlideInfo,
  RenderedValidationArtifacts,
  RenderedValidationContext,
  ValidationBrowserLike,
  ValidationContext,
  ValidationElementHandleLike,
  ValidationPageLike,
  ValidationViewport,
} from "../types.js";

const DEFAULT_VIEWPORT: ValidationViewport = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
};

export const DEFAULT_DECK_SELECTOR = "#presentation-slides-wrapper";
export const DEFAULT_SLIDE_SELECTOR = '[data-presenton-slide-shell="true"]';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createManagedValidationPage(
  launchOptions?: Record<string, unknown>,
): Promise<{
  browser: ValidationBrowserLike;
  page: ValidationPageLike;
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
      "Rendered validation requires `puppeteer` to be installed when no page is provided.",
      { cause: error },
    );
  }

  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await puppeteer.launch({
    headless: true,
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
  }) as ValidationBrowserLike;

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

async function resolveRenderedOutputDir(context: ValidationContext): Promise<string> {
  if (context.outputDir && context.outputDir.length > 0) {
    return path.resolve(context.outputDir, "validation-rendered");
  }

  return mkdtemp(path.join(os.tmpdir(), "presenton-validation-rendered-"));
}

async function loadDeckHtmlFromArtifacts(
  artifacts: RenderedValidationArtifacts | null | undefined,
): Promise<string> {
  const buildResult = artifacts?.deckBuildResult;
  if (buildResult?.deckHtml) {
    return buildResult.deckHtml;
  }

  if (artifacts?.deckHtmlPath) {
    return readFile(artifacts.deckHtmlPath, "utf8");
  }

  throw new Error("Rendered validation artifacts do not contain deck HTML content.");
}

export async function prepareRenderedValidationArtifacts(
  context: ValidationContext,
): Promise<RenderedValidationArtifacts> {
  if (context.renderedArtifacts?.deckBuildResult?.deckHtml) {
    return context.renderedArtifacts;
  }

  if (context.renderedArtifacts?.deckHtmlPath) {
    return context.renderedArtifacts;
  }

  const outputDir = await resolveRenderedOutputDir(context);
  const deckBuildResult = await buildDeckHtmlFromManifest({
    cwd: context.cwd ?? undefined,
    manifestPath: context.manifestPath,
    outputDir,
    name: context.name ?? undefined,
  });

  const nextArtifacts: RenderedValidationArtifacts = {
    ...context.renderedArtifacts,
    deckBuildResult,
    deckHtmlPath: deckBuildResult.deckOutputPath,
  };
  context.renderedArtifacts = nextArtifacts;
  return nextArtifacts;
}

export async function waitForDeckRenderReady(
  page: ValidationPageLike,
  deckSelector = DEFAULT_DECK_SELECTOR,
  timeoutMs = 30_000,
): Promise<ValidationElementHandleLike> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const deckElement = await page.$(deckSelector);
    if (!deckElement) {
      await delay(50);
      continue;
    }

    const status = await deckElement.evaluate((el) =>
      el.getAttribute("data-presenton-render-status"),
    );

    if (status === "ready") {
      return deckElement;
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

export async function collectRenderedSlideInfos(
  deckElement: ValidationElementHandleLike,
  slideSelector = DEFAULT_SLIDE_SELECTOR,
): Promise<RenderedSlideInfo[]> {
  const slideElements = await deckElement.$$(slideSelector);
  const slides = await Promise.all(slideElements.map((slideElement, slideIndex) =>
    slideElement.evaluate((shell, index) => {
      const shellElement = shell as Element;
      const rootElement = shellElement.querySelector(
        "[data-manifest-slide-id], [data-presenton-deck-slot], [data-presenton-static-slide]",
      );
      const slideId =
        rootElement?.getAttribute("data-manifest-slide-id")
        ?? shellElement.querySelector("[data-manifest-slide-id]")?.getAttribute("data-manifest-slide-id")
        ?? null;
      const layoutId =
        rootElement?.getAttribute("data-layout")
        ?? shellElement.querySelector("[data-layout]")?.getAttribute("data-layout")
        ?? null;
      const templateGroup =
        rootElement?.getAttribute("data-group")
        ?? shellElement.querySelector("[data-group]")?.getAttribute("data-group")
        ?? null;
      const rootSelector = slideId
        ? `[data-manifest-slide-id="${slideId}"]`
        : layoutId
          ? `[data-layout="${layoutId}"]`
          : null;

      return {
        slideIndex: index as number,
        slideId,
        layoutId,
        templateGroup,
        shellSelector: `${slideSelector}:nth-of-type(${(index as number) + 1})`,
        rootSelector,
        childElementCount: shellElement.children.length,
        screenshotRegionCount: shellElement.querySelectorAll('[data-pptx-export="screenshot"]').length,
      } satisfies RenderedSlideInfo;
    }, slideIndex)
  ));

  return slides;
}

export async function prepareRenderedValidationContext(
  context: ValidationContext,
): Promise<RenderedValidationContext> {
  if (context.rendered) {
    return context.rendered;
  }

  const artifacts = await prepareRenderedValidationArtifacts(context);
  const html = await loadDeckHtmlFromArtifacts(artifacts);
  const deckSelector = context.renderedOptions?.deckSelector ?? DEFAULT_DECK_SELECTOR;
  const slideSelector = context.renderedOptions?.slideSelector ?? DEFAULT_SLIDE_SELECTOR;
  const ownedPage = !context.renderedOptions?.page;
  const runtime = ownedPage
    ? await createManagedValidationPage(context.renderedOptions?.launchOptions)
    : {
      page: context.renderedOptions?.page as ValidationPageLike,
      close: async () => {},
    };

  try {
    await runtime.page.setViewport?.(context.renderedOptions?.viewport ?? DEFAULT_VIEWPORT);
    await runtime.page.setContent(html, {
      waitUntil: context.renderedOptions?.contentWaitUntil ?? "domcontentloaded",
      timeout: context.renderedOptions?.contentTimeoutMs ?? 300_000,
    });

    const deckElement = await waitForDeckRenderReady(
      runtime.page,
      deckSelector,
      context.renderedOptions?.renderReadyTimeoutMs
        ?? context.renderedOptions?.contentTimeoutMs
        ?? 300_000,
    );

    if (context.renderedOptions?.settleTimeMs && context.renderedOptions.settleTimeMs > 0) {
      await delay(context.renderedOptions.settleTimeMs);
    }

    const slides = await collectRenderedSlideInfos(deckElement, slideSelector);
    const renderedContext: RenderedValidationContext = {
      page: runtime.page,
      deckSelector,
      slideSelector,
      slides,
      ownedPage,
      close: runtime.close,
    };
    context.rendered = renderedContext;
    return renderedContext;
  } catch (error) {
    if (ownedPage) {
      await runtime.close();
    }
    throw error;
  }
}

export async function disposeRenderedValidationContext(
  context: ValidationContext,
): Promise<void> {
  const renderedContext = context.rendered;
  context.rendered = null;
  await renderedContext?.close().catch(() => undefined);
}
