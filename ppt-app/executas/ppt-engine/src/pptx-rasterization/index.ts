import { createRequire } from "node:module";
import path from "node:path";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { PptxRenderer } from "pptx-svg";

export const DEFAULT_RASTERIZATION_TARGET_HEIGHT = 720;
export const PPTX_RASTERIZATION_MAX_SLIDES = 80;
export const RASTERIZATION_MANIFEST_FILE_NAME = "rasterization-manifest.json";
export const SVG_RASTERIZATION_BASE_DENSITY = 72;
export const SVG_RASTERIZATION_MAX_DENSITY = 288;
export const SVG_RASTERIZATION_SUPERSAMPLE = 2;

export interface RasterizePptxToImagesInput {
  pptx_path: string;
  output_dir: string;
  target_height?: number;
  overwrite?: boolean;
}

export interface RasterizedSlideImage {
  page_index: number;
  page_number: number;
  image_path: string;
  svg_path: string;
  width: number;
  height: number;
  source_width?: number;
  source_height?: number;
}

export interface RasterizePptxToImagesResult {
  pptx_path: string;
  output_dir: string;
  rasterization_manifest_path: string;
  slide_count: number;
  target_height: number;
  slides: RasterizedSlideImage[];
}

interface LoadedSvgSlide {
  svg: string;
}

interface SvgToPngResult {
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface RasterizePptxToImagesDeps {
  now?: () => Date;
  loadPptxSvgSlides?: (pptxPath: string) => Promise<LoadedSvgSlide[]>;
  convertSvgToPng?: (input: {
    svg: string;
    outputPath: string;
    targetHeight: number;
  }) => Promise<SvgToPngResult>;
}

function assertAbsolutePath(value: string, name: string) {
  if (!path.isAbsolute(value)) {
    throw new Error(`"${name}" must be an absolute path`);
  }
}

function readTargetHeight(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_RASTERIZATION_TARGET_HEIGHT;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('"target_height" must be a positive integer');
  }
  return value;
}

function assertPptxPath(pptxPath: string) {
  if (path.extname(pptxPath).toLowerCase() !== ".pptx") {
    throw new Error("PPTX rasterization only supports .pptx files in the first version.");
  }
}

function outputFileBase(pageIndex: number): string {
  return `page-${String(pageIndex + 1).padStart(3, "0")}`;
}

function chooseSvgRasterizationDensity(sourceHeight: number | undefined, targetHeight: number): number {
  if (sourceHeight === undefined || sourceHeight <= 0) {
    return SVG_RASTERIZATION_MAX_DENSITY;
  }

  const targetScale = targetHeight / sourceHeight;
  const desiredDensity = Math.ceil(
    SVG_RASTERIZATION_BASE_DENSITY * targetScale * SVG_RASTERIZATION_SUPERSAMPLE,
  );
  return Math.min(
    SVG_RASTERIZATION_MAX_DENSITY,
    Math.max(SVG_RASTERIZATION_BASE_DENSITY, desiredDensity),
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function assertNoGeneratedOutputCollisions(
  outputDir: string,
  slideCount: number,
  overwrite: boolean,
) {
  if (overwrite) {
    return;
  }

  const generatedPaths = new Set([
    path.join(outputDir, RASTERIZATION_MANIFEST_FILE_NAME),
    ...Array.from({ length: slideCount }, (_, index) => [
      path.join(outputDir, `${outputFileBase(index)}.svg`),
      path.join(outputDir, `${outputFileBase(index)}.png`),
    ]).flat(),
  ]);

  const generatedFileNamePattern = /^page-\d+\.(png|svg)$/;
  for (const entry of await readdir(outputDir)) {
    if (generatedFileNamePattern.test(entry)) {
      generatedPaths.add(path.join(outputDir, entry));
    }
  }

  const existingPaths: string[] = [];
  for (const filePath of generatedPaths) {
    if (await pathExists(filePath)) {
      existingPaths.push(filePath);
    }
  }

  if (existingPaths.length > 0) {
    throw new Error(
      `PPTX rasterization output already exists. Pass overwrite=true to replace generated files: ${existingPaths.join(", ")}`,
    );
  }
}

function wrapSlideError(pageIndex: number, stage: "render_svg" | "render_png", error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`PPTX rasterization failed at ${stage} for page ${pageIndex + 1}: ${message}`);
}

function nodeBufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function readPptxSvgWasmBytes(): Promise<Buffer> {
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("pptx-svg/wasm");
  return readFile(wasmPath);
}

export async function loadPptxSvgSlides(pptxPath: string): Promise<LoadedSvgSlide[]> {
  const renderer = new PptxRenderer({ logLevel: "error" });
  await renderer.init(await readPptxSvgWasmBytes());

  const pptxBytes = await readFile(pptxPath);
  const loadResult = await renderer.loadPptx(nodeBufferToArrayBuffer(pptxBytes));
  const slideCount = typeof loadResult?.slideCount === "number"
    ? loadResult.slideCount
    : renderer.getSlideCount();

  const slides: LoadedSvgSlide[] = [];
  for (let pageIndex = 0; pageIndex < slideCount; pageIndex += 1) {
    try {
      slides.push({ svg: renderer.renderSlideSvg(pageIndex) });
    } catch (error) {
      throw wrapSlideError(pageIndex, "render_svg", error);
    }
  }
  return slides;
}

export async function convertSvgToPng(input: {
  svg: string;
  outputPath: string;
  targetHeight: number;
}): Promise<SvgToPngResult> {
  const svgBuffer = Buffer.from(input.svg, "utf8");
  const metadata = await sharp(svgBuffer).metadata();
  const density = chooseSvgRasterizationDensity(metadata.height, input.targetHeight);
  const info = await sharp(svgBuffer, { density })
    .resize({ height: input.targetHeight })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(input.outputPath);

  return {
    width: info.width,
    height: info.height,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
  };
}

export async function rasterizePptxToImages(
  input: RasterizePptxToImagesInput,
  deps: RasterizePptxToImagesDeps = {},
): Promise<RasterizePptxToImagesResult> {
  assertAbsolutePath(input.pptx_path, "pptx_path");
  assertAbsolutePath(input.output_dir, "output_dir");
  assertPptxPath(input.pptx_path);

  const pptxPath = path.normalize(input.pptx_path);
  const outputDir = path.normalize(input.output_dir);
  const targetHeight = readTargetHeight(input.target_height);
  const overwrite = input.overwrite === true;
  const loadSlides = deps.loadPptxSvgSlides ?? loadPptxSvgSlides;
  const svgToPng = deps.convertSvgToPng ?? convertSvgToPng;
  const now = deps.now ?? (() => new Date());

  const loadedSlides = await loadSlides(pptxPath);
  if (loadedSlides.length > PPTX_RASTERIZATION_MAX_SLIDES) {
    throw new Error(
      `PPTX slide count ${loadedSlides.length} exceeds the rasterization limit of ${PPTX_RASTERIZATION_MAX_SLIDES} slides.`,
    );
  }

  await mkdir(outputDir, { recursive: true });
  await assertNoGeneratedOutputCollisions(outputDir, loadedSlides.length, overwrite);

  const slides: RasterizedSlideImage[] = [];
  for (const [pageIndex, slide] of loadedSlides.entries()) {
    const base = outputFileBase(pageIndex);
    const svgPath = path.join(outputDir, `${base}.svg`);
    const imagePath = path.join(outputDir, `${base}.png`);

    try {
      await writeFile(svgPath, slide.svg, "utf8");
    } catch (error) {
      throw wrapSlideError(pageIndex, "render_svg", error);
    }

    let pngResult: SvgToPngResult;
    try {
      pngResult = await svgToPng({
        svg: slide.svg,
        outputPath: imagePath,
        targetHeight,
      });
    } catch (error) {
      throw wrapSlideError(pageIndex, "render_png", error);
    }

    slides.push({
      page_index: pageIndex,
      page_number: pageIndex + 1,
      image_path: imagePath,
      svg_path: svgPath,
      width: pngResult.width,
      height: pngResult.height,
      ...(pngResult.sourceWidth === undefined ? {} : { source_width: pngResult.sourceWidth }),
      ...(pngResult.sourceHeight === undefined ? {} : { source_height: pngResult.sourceHeight }),
    });
  }

  const manifestPath = path.join(outputDir, RASTERIZATION_MANIFEST_FILE_NAME);
  const result: RasterizePptxToImagesResult = {
    pptx_path: pptxPath,
    output_dir: outputDir,
    rasterization_manifest_path: manifestPath,
    slide_count: slides.length,
    target_height: targetHeight,
    slides,
  };

  const manifest = {
    version: 1,
    created_at: now().toISOString(),
    source_pptx_path: pptxPath,
    output_dir: outputDir,
    target_height: targetHeight,
    max_slide_count: PPTX_RASTERIZATION_MAX_SLIDES,
    slide_count: slides.length,
    slides,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return result;
}
