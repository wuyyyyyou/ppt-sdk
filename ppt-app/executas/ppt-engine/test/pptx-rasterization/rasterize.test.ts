import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PPTX_RASTERIZATION_MAX_SLIDES,
  convertSvgToPng,
  rasterizePptxToImages,
} from "../../src/pptx-rasterization/index.ts";

async function makeTempDir() {
  return mkdtemp(path.join(os.tmpdir(), "pptx-rasterization-test-"));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="white"/></svg>`;

test("convertSvgToPng writes a sharp PNG at the requested height", async () => {
  const dir = await makeTempDir();
  const outputPath = path.join(dir, "slide.png");

  try {
    const result = await convertSvgToPng({
      svg,
      outputPath,
      targetHeight: 1440,
    });

    assert.equal(result.width, 2560);
    assert.equal(result.height, 1440);
    assert.equal(result.sourceWidth, 1280);
    assert.equal(result.sourceHeight, 720);
    assert.match(await readFile(outputPath, "hex"), /^89504e470d0a1a0a/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages writes SVG, PNG, and rasterization manifest", async () => {
  const dir = await makeTempDir();
  const pptxPath = path.join(dir, "input.pptx");
  const outputDir = path.join(dir, "out");
  await writeFile(pptxPath, "fake pptx", "utf8");

  try {
    const result = await rasterizePptxToImages(
      {
        pptx_path: pptxPath,
        output_dir: outputDir,
      },
      {
        now: () => new Date("2026-07-08T00:00:00.000Z"),
        loadPptxSvgSlides: async () => [{ svg }],
        convertSvgToPng: async ({ outputPath, targetHeight }) => {
          await writeFile(outputPath, "fake png", "utf8");
          return {
            width: 1280,
            height: targetHeight,
            sourceWidth: 1280,
            sourceHeight: 720,
          };
        },
      },
    );

    assert.equal(result.slide_count, 1);
    assert.equal(result.target_height, 720);
    assert.equal(path.basename(result.slides[0]?.svg_path ?? ""), "page-001.svg");
    assert.equal(path.basename(result.slides[0]?.image_path ?? ""), "page-001.png");
    assert.equal(await readFile(path.join(outputDir, "page-001.svg"), "utf8"), svg);
    assert.equal(await readFile(path.join(outputDir, "page-001.png"), "utf8"), "fake png");

    const manifest = JSON.parse(
      await readFile(path.join(outputDir, "rasterization-manifest.json"), "utf8"),
    ) as {
      created_at: string;
      source_pptx_path: string;
      target_height: number;
      slide_count: number;
      slides: Array<{ page_index: number; page_number: number; width: number; height: number }>;
    };
    assert.equal(manifest.created_at, "2026-07-08T00:00:00.000Z");
    assert.equal(manifest.source_pptx_path, pptxPath);
    assert.equal(manifest.target_height, 720);
    assert.equal(manifest.slide_count, 1);
    assert.deepEqual(manifest.slides[0], {
      page_index: 0,
      page_number: 1,
      image_path: path.join(outputDir, "page-001.png"),
      svg_path: path.join(outputDir, "page-001.svg"),
      width: 1280,
      height: 720,
      source_width: 1280,
      source_height: 720,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages rejects unsupported file extensions before loading", async () => {
  const dir = await makeTempDir();
  const pptPath = path.join(dir, "legacy.ppt");
  await writeFile(pptPath, "fake ppt", "utf8");

  try {
    await assert.rejects(
      () => rasterizePptxToImages(
        {
          pptx_path: pptPath,
          output_dir: path.join(dir, "out"),
        },
        {
          loadPptxSvgSlides: async () => {
            throw new Error("should not load");
          },
        },
      ),
      /\.pptx files/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages enforces the max slide count", async () => {
  const dir = await makeTempDir();
  const pptxPath = path.join(dir, "input.pptx");
  await writeFile(pptxPath, "fake pptx", "utf8");

  try {
    await assert.rejects(
      () => rasterizePptxToImages(
        {
          pptx_path: pptxPath,
          output_dir: path.join(dir, "out"),
        },
        {
          loadPptxSvgSlides: async () =>
            Array.from({ length: PPTX_RASTERIZATION_MAX_SLIDES + 1 }, () => ({ svg })),
        },
      ),
      /exceeds the rasterization limit/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages refuses to overwrite generated files by default", async () => {
  const dir = await makeTempDir();
  const pptxPath = path.join(dir, "input.pptx");
  const outputDir = path.join(dir, "out");
  await writeFile(pptxPath, "fake pptx", "utf8");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "page-001.png"), "existing", "utf8");

  try {
    await assert.rejects(
      () => rasterizePptxToImages(
        {
          pptx_path: pptxPath,
          output_dir: outputDir,
        },
        {
          loadPptxSvgSlides: async () => [{ svg }],
        },
      ),
      /output already exists/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages refuses stale page files outside the current slide range", async () => {
  const dir = await makeTempDir();
  const pptxPath = path.join(dir, "input.pptx");
  const outputDir = path.join(dir, "out");
  await writeFile(pptxPath, "fake pptx", "utf8");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "page-999.svg"), "stale", "utf8");

  try {
    await assert.rejects(
      () => rasterizePptxToImages(
        {
          pptx_path: pptxPath,
          output_dir: outputDir,
        },
        {
          loadPptxSvgSlides: async () => [{ svg }],
        },
      ),
      /page-999\.svg/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rasterizePptxToImages wraps PNG conversion failures with page and stage", async () => {
  const dir = await makeTempDir();
  const pptxPath = path.join(dir, "input.pptx");
  await writeFile(pptxPath, "fake pptx", "utf8");

  try {
    await assert.rejects(
      () => rasterizePptxToImages(
        {
          pptx_path: pptxPath,
          output_dir: path.join(dir, "out"),
        },
        {
          loadPptxSvgSlides: async () => [{ svg }],
          convertSvgToPng: async () => {
            throw new Error("sharp failed");
          },
        },
      ),
      /render_png for page 1: sharp failed/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
