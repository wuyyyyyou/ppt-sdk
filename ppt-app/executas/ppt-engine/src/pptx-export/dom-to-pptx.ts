import path from "node:path";
import { existsSync } from "node:fs";
import { appendFile, open, rm, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launchManagedBrowser } from "../runtime/browser-runtime.js";

const SLIDE_SELECTOR = '#presentation-slides-wrapper > [data-presenton-slide-shell="true"]';
const SLIDE_WIDTH_PX = 1280;
const SLIDE_HEIGHT_PX = 720;
const CHUNK_SIZE = 1024 * 1024;

export interface ConvertDeckHtmlToPptxInput {
  htmlPath: string;
  outputPath: string;
  title: string;
  expectedSlideCount?: number;
  timeoutMs?: number;
}

export interface ConvertDeckHtmlToPptxResult {
  outputPath: string;
  slideCount: number;
  sizeBytes: number;
  warningCount: number;
}

function runtimePath(fileName: string): string {
  // Source modules resolve through `src`; bundled engine code resolves from `dist/index.js`.
  const candidates = [
    new URL(`./vendor/dom-to-pptx/${fileName}`, import.meta.url),
    new URL(`../vendor/dom-to-pptx/${fileName}`, import.meta.url),
    new URL(`../../dist/vendor/dom-to-pptx/${fileName}`, import.meta.url),
  ];
  for (const candidate of candidates) {
    const filePath = fileURLToPath(candidate);
    if (existsSync(filePath)) return filePath;
  }
  return fileURLToPath(candidates[0]);
}

export function resolveDomToPptxRuntimePath(fileName = "dom-to-pptx.bundle.js"): string {
  return runtimePath(fileName);
}

export async function convertDeckHtmlToPptx(
  input: ConvertDeckHtmlToPptxInput,
): Promise<ConvertDeckHtmlToPptxResult> {
  const htmlPath = path.normalize(input.htmlPath);
  const outputPath = path.normalize(input.outputPath);
  const timeoutMs = input.timeoutMs ?? 10 * 60 * 1000;
  const htmlStat = await stat(htmlPath);
  if (!htmlStat.isFile()) throw new Error(`Deck HTML is not a file: ${htmlPath}`);

  const puppeteerModule = await import("puppeteer");
  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await launchManagedBrowser(puppeteer, { purpose: "PPTX export" }) as any;
  const temporaryPath = `${outputPath}.tmp`;
  const callbackName = `__presentonWritePptxChunk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let bytesWritten = 0;
  let warningCount = 0;

  await rm(temporaryPath, { force: true });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.setViewport({ width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX });
    page.on("console", (message: any) => {
      if (message.type() === "warning") warningCount += 1;
    });
    await page.exposeFunction(callbackName, async (base64: string) => {
      const chunk = Buffer.from(base64, "base64");
      bytesWritten += chunk.byteLength;
      await appendFile(temporaryPath, chunk);
    });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: timeoutMs });
    await page.evaluate("globalThis.__name = (target) => target");

    const validation = await page.evaluate(async ({ selector, width, height, expectedSlideCount }: any) => {
      const wrapperMatches = document.querySelectorAll("#presentation-slides-wrapper");
      if (wrapperMatches.length !== 1) {
        throw new Error(`Deck HTML must contain exactly one #presentation-slides-wrapper; found ${wrapperMatches.length}`);
      }
      const slides = Array.from(document.querySelectorAll(selector));
      if (slides.length === 0) throw new Error("Deck HTML contains no slide shells");
      if (expectedSlideCount != null && slides.length !== expectedSlideCount) {
        throw new Error(`Deck HTML contains ${slides.length} slides; expected ${expectedSlideCount}`);
      }
      for (const [index, slide] of slides.entries()) {
        const rect = slide.getBoundingClientRect();
        const style = getComputedStyle(slide);
        if (Math.round(rect.width) !== width || Math.round(rect.height) !== height) {
          throw new Error(`Slide ${index + 1} must measure ${width}x${height}; measured ${rect.width}x${rect.height}`);
        }
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
          throw new Error(`Slide ${index + 1} is not visible`);
        }
      }

      await Promise.race([
        document.fonts?.ready ?? Promise.resolve(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);

      const urls = new Map<string, number>();
      const addUrl = (value: string | null, pageNumber: number) => {
        if (!value) return;
        const matches = value.matchAll(/url\(["']?([^"')]+)["']?\)/g);
        for (const match of matches) urls.set(match[1], pageNumber);
      };
      for (const [index, slide] of slides.entries()) {
        const pageNumber = index + 1;
        for (const element of [slide, ...Array.from(slide.querySelectorAll("*"))]) {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (!rect.width || !rect.height || style.display === "none" || style.visibility === "hidden") continue;
          addUrl(style.backgroundImage, pageNumber);
          addUrl(getComputedStyle(element, "::before").backgroundImage, pageNumber);
          addUrl(getComputedStyle(element, "::after").backgroundImage, pageNumber);
          if (element instanceof HTMLImageElement) {
            if (!element.complete || element.naturalWidth <= 0 || element.naturalHeight <= 0) {
              throw new Error(`Slide ${pageNumber} contains an image that failed to load`);
            }
            urls.set(element.currentSrc || element.src, pageNumber);
          }
          if (element instanceof SVGImageElement) {
            const href = element.href?.baseVal || element.getAttribute("href");
            if (href) urls.set(href, pageNumber);
          }
        }
      }
      for (const [url, pageNumber] of urls) {
        try {
          const absoluteUrl = new URL(url, document.baseURI);
          if (absoluteUrl.protocol === "file:") {
            await new Promise<void>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve();
              image.onerror = () => reject(new Error("Image load failed"));
              image.src = absoluteUrl.href;
            });
          } else {
            const response = await fetch(absoluteUrl.href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await response.blob();
          }
        } catch {
          const safeUrl = url.split("?")[0];
          throw new Error(`Slide ${pageNumber} contains an unreadable image: ${safeUrl}`);
        }
      }
      return { slideCount: slides.length };
    }, {
      selector: SLIDE_SELECTOR,
      width: SLIDE_WIDTH_PX,
      height: SLIDE_HEIGHT_PX,
      expectedSlideCount: input.expectedSlideCount,
    });

    await page.addScriptTag({ path: runtimePath("dom-to-pptx.bundle.js") });
    const conversion = page.evaluate(async ({ selector, callback, chunkSize, title }: any) => {
      const converter = (window as any).domToPptx?.exportToPptx;
      if (typeof converter !== "function") throw new Error("dom-to-pptx browser runtime did not load");
      const slides = Array.from(document.querySelectorAll(selector));
      const blob = await converter(slides, {
        skipDownload: true,
        skipNormalize: false,
        autoEmbedFonts: false,
        svgAsVector: false,
        width: 13.333333,
        height: 7.5,
        title,
      });
      let total = 0;
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        await (window as any)[callback](btoa(binary));
        total += bytes.length;
      }
      return total;
    }, { selector: SLIDE_SELECTOR, callback: callbackName, chunkSize: CHUNK_SIZE, title: input.title });
    let conversionTimeout: ReturnType<typeof setTimeout> | undefined;
    const reportedBytes = await Promise.race([
      conversion,
      new Promise<never>((_, reject) => {
        conversionTimeout = setTimeout(
          () => reject(new Error(`PPTX conversion timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]).finally(() => {
      if (conversionTimeout) clearTimeout(conversionTimeout);
    });

    if (!reportedBytes || reportedBytes !== bytesWritten) {
      throw new Error(`PPTX transfer was incomplete: browser=${reportedBytes}, node=${bytesWritten}`);
    }
    const handle = await open(temporaryPath, "r");
    const headerBytes = Buffer.alloc(2);
    try {
      await handle.read(headerBytes, 0, 2, 0);
    } finally {
      await handle.close();
    }
    const header = headerBytes.toString("ascii");
    if (header !== "PK") throw new Error("Generated PPTX is not a ZIP file");

    return {
      outputPath: temporaryPath,
      slideCount: validation.slideCount,
      sizeBytes: bytesWritten,
      warningCount,
    };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
