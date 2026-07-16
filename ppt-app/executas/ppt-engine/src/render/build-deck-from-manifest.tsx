import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { buildStandaloneDeckHtml } from "./build-deck.js";
import {
  staticizeHtmlDocuments,
  writeSlideScreenshots,
} from "./browser-artifacts.js";
import { sanitizeFileNamePart } from "./file-names.js";
import { prepareManifestRenderPlan } from "./manifest-render-plan.js";
import type {
  BuildDeckHtmlPagesAndScreenshotsFromManifestResult,
  BuildDeckHtmlPagesFromManifestResult,
  BuildDeckPageScreenshotFromManifestInput,
  BuildDeckPageScreenshotFromManifestResult,
  BuildDeckHtmlFromManifestFileOutput,
  BuildDeckHtmlFromManifestInput,
  BuildDeckHtmlFromManifestResult,
} from "./types.js";

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
  await staticizeHtmlDocuments(
    slidesToWrite.map((slide) => ({ htmlPath: slide.outputPath, kind: "page" })),
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

  await staticizeHtmlDocuments(
    screenshotSlides.map((slide) => ({ htmlPath: slide.htmlPath, kind: "page" })),
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
  await staticizeHtmlDocuments([{ htmlPath, kind: "page" }]);
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
  let deckHtml = prepared.singlePageIndex === null
    ? buildStandaloneDeckHtml({
      title,
      slides: prepared.slides,
      runtimeBundle: prepared.deckRuntimeBundle,
      tailwindRuntimeBundle: prepared.tailwindRuntimeBundle,
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
  await staticizeHtmlDocuments([
    ...(prepared.singlePageIndex === null
      ? [{ htmlPath: deckOutputPath, kind: "deck" as const }]
      : []),
    ...screenshotSlides.map((slide) => ({
      htmlPath: slide.htmlPath,
      kind: "page" as const,
    })),
  ]);
  if (prepared.singlePageIndex === null) {
    deckHtml = await readFile(deckOutputPath, "utf8");
  }
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
