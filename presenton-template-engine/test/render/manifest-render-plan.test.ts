import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { prepareManifestRenderPlan } from "../../src/render/manifest-render-plan.ts";

const LOCAL_SLIDE = `import React from "react";
import * as z from "zod";

export const Schema = z.object({
  title: z.string().default("Local title"),
});

export const layoutId = "local-fixture";
export const layoutName = "Local Fixture";
export const layoutDescription = "Local fixture slide for render plan tests.";

export default function LocalFixtureSlide({ data }) {
  const parsed = Schema.parse(data ?? {});
  return <div data-manifest-slide-id="local-fixture">{parsed.title}</div>;
}
`;

async function withFixture(
  fn: (input: { manifestPath: string; outputDir: string; deckDir: string }) => Promise<void>,
) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rootDir = await mkdtemp(path.join(tempRoot, "presenton-render-plan-"));
  const deckDir = path.join(rootDir, "deck");
  const outputDir = path.join(rootDir, "out");

  try {
    await mkdir(path.join(deckDir, "slides"), { recursive: true });
    await writeFile(path.join(deckDir, "group.json"), `${JSON.stringify({
      group_id: "render-plan-group",
      group_name: "Render Plan Group",
      group_description: "Render plan fixture group",
      ordered: false,
      default: false,
    }, null, 2)}\n`, "utf8");
    await fn({
      manifestPath: path.join(deckDir, "manifest.json"),
      outputDir,
      deckDir,
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("prepareManifestRenderPlan resolves builtin slides", async () => {
  await withFixture(async ({ manifestPath, outputDir }) => {
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Builtin Deck",
        slides: [
          {
            id: "cover",
            title: "Cover",
            source: {
              type: "builtin",
              template_group: "red-finance-v3",
              layout_id: "cover-statement",
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const plan = await prepareManifestRenderPlan({
      manifestPath,
      outputDir,
    });

    assert.equal(plan.title, "Builtin Deck");
    assert.equal(plan.singlePageIndex, null);
    assert.equal(plan.slides.length, 1);
    assert.equal(plan.slides[0]?.layoutId, "red-finance-v3:cover-statement");
    assert.match(plan.slides[0]?.html ?? "", /presentation-slides-wrapper/);
  });
});

test("prepareManifestRenderPlan resolves local slides, data paths, and theme normalization", async () => {
  await withFixture(async ({ manifestPath, outputDir, deckDir }) => {
    await writeFile(path.join(deckDir, "slides", "LocalSlide.tsx"), LOCAL_SLIDE, "utf8");
    await writeFile(path.join(deckDir, "data.json"), `${JSON.stringify({
      title: "Data path title",
    }, null, 2)}\n`, "utf8");

    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Local Deck",
        slides: [
          {
            id: "local-1",
            title: "Local Slide",
            source: {
              type: "local",
              path: "./slides/LocalSlide.tsx",
            },
            data_path: "./data.json",
            theme: {
              data: {
                colors: {
                  background: "#f8f1e4",
                },
                fonts: {
                  textFont: {
                    name: "Inter",
                    url: "https://example.com/inter.woff2",
                  },
                },
              },
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const plan = await prepareManifestRenderPlan({
      manifestPath,
      outputDir,
    });

    assert.equal(plan.slides.length, 1);
    assert.equal(plan.slides[0]?.slideId, "local-1");
    assert.equal(plan.slides[0]?.context.theme.colors.background, "#f8f1e4");
    assert.equal(plan.slides[0]?.context.theme.fontName, "Inter");
    assert.equal(plan.slides[0]?.context.theme.fontUrl, "https://example.com/inter.woff2");
    assert.deepEqual(plan.slides[0]?.context.slideData, {
      title: "Data path title",
    });
    assert.ok(plan.deckRuntimeBundle);
    assert.match(plan.slides[0]?.html ?? "", /__PRESENTON_RENDER_CONTEXT__/);
  });
});

test("prepareManifestRenderPlan keeps full plan in single-page mode", async () => {
  await withFixture(async ({ manifestPath, outputDir, deckDir }) => {
    await writeFile(path.join(deckDir, "slides", "LocalSlide.tsx"), LOCAL_SLIDE, "utf8");
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Single Page Deck",
        slides: [
          {
            id: "page-1",
            source: { type: "local", path: "./slides/LocalSlide.tsx" },
          },
          {
            id: "page-2",
            source: { type: "local", path: "./slides/LocalSlide.tsx" },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const plan = await prepareManifestRenderPlan({
      manifestPath,
      outputDir,
      singlePage: true,
      page: 2,
    });

    assert.equal(plan.singlePageIndex, 1);
    assert.equal(plan.slides.length, 2);
    assert.equal(plan.slides[1]?.slideId, "page-2");
  });
});

test("prepareManifestRenderPlan rejects illegal manifests", async () => {
  await withFixture(async ({ manifestPath, outputDir }) => {
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Broken Deck",
        slides: [
          {
            id: "dup",
            source: { type: "local", path: "./slides/Missing.tsx" },
          },
          {
            id: "dup",
            source: { type: "local", path: "./slides/Missing.tsx" },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    await assert.rejects(
      () => prepareManifestRenderPlan({
        manifestPath,
        outputDir,
      }),
      (error: Error) => {
        assert.match(error.message, /Duplicate manifest slide id "dup"/);
        return true;
      },
    );
  });
});
