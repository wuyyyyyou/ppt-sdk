import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSinglePagePreviewBaseFileName } from "../../src/render/build-deck-from-manifest.tsx";
import { prepareManifestRenderPlan } from "../../src/render/manifest-render-plan.ts";

const PAGE_1 = "page-11111111-1111-4111-8111-111111111111";
const PAGE_2 = "page-22222222-2222-4222-8222-222222222222";

const PAGE_SOURCE = `import React from "react";
export default function Page() {
  return <div style={{ width: "1280px", height: "720px" }}>TSX content</div>;
}
`;

const BROKEN_PAGE_SOURCE = `import React from "react";
export function Page() {
  return <div>Missing default export</div>;
}
`;

test("buildSinglePagePreviewBaseFileName includes stable slide id", () => {
  assert.equal(
    buildSinglePagePreviewBaseFileName({
      pageNumber: 5,
      deckBaseName: "ppt-page-preview",
      slideId: PAGE_1,
      layoutId: PAGE_1,
    }),
    `05-ppt-page-preview-${PAGE_1}-${PAGE_1}`,
  );
});

async function withFixture(
  fn: (input: { manifestPath: string; outputDir: string; deckDir: string }) => Promise<void>,
) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const deckDir = await mkdtemp(path.join(tempRoot, "page-source-render-plan-"));
  const outputDir = path.join(deckDir, "out");
  try {
    await mkdir(path.join(deckDir, "slides"), { recursive: true });
    await fn({ manifestPath: path.join(deckDir, "manifest.json"), outputDir, deckDir });
  } finally {
    await rm(deckDir, { recursive: true, force: true });
  }
}

async function writeManifest(
  manifestPath: string,
  slides: Array<Record<string, unknown>>,
) {
  await writeFile(
    manifestPath,
    `${JSON.stringify({ title: "Authoring Deck", slides }, null, 2)}\n`,
    "utf8",
  );
}

test("prepareManifestRenderPlan renders default-export-only Page Sources", async () => {
  await withFixture(async ({ manifestPath, outputDir, deckDir }) => {
    await writeFile(path.join(deckDir, "slides", `${PAGE_1}.tsx`), PAGE_SOURCE, "utf8");
    await writeManifest(manifestPath, [{ id: PAGE_1, source: `./slides/${PAGE_1}.tsx` }]);

    const plan = await prepareManifestRenderPlan({ manifestPath, outputDir });

    assert.equal(plan.title, "Authoring Deck");
    assert.equal(plan.slides.length, 1);
    assert.equal(plan.slides[0]?.slideId, PAGE_1);
    assert.equal(plan.slides[0]?.layoutId, PAGE_1);
    assert.deepEqual(plan.slides[0]?.context.slideData, {});
    assert.deepEqual(plan.slides[0]?.context.theme.colors, {});
    assert.match(plan.slides[0]?.html ?? "", /__PRESENTON_RENDER_CONTEXT__/);
    assert.match(plan.slides[0]?.html ?? "", /TSX content/);
    assert.ok(plan.deckRuntimeBundle);
  });
});

test("prepareManifestRenderPlan rejects legacy and extra manifest fields", async () => {
  await withFixture(async ({ manifestPath, outputDir }) => {
    await writeManifest(manifestPath, [{
      id: PAGE_1,
      source: { type: "local", path: `./slides/${PAGE_1}.tsx` },
      data_path: "./data/page.json",
    }]);
    await assert.rejects(
      () => prepareManifestRenderPlan({ manifestPath, outputDir }),
      /unsupported field "data_path"/,
    );
  });
});

test("prepareManifestRenderPlan requires deterministic Page Source paths", async () => {
  await withFixture(async ({ manifestPath, outputDir }) => {
    await writeManifest(manifestPath, [{ id: PAGE_1, source: "./slides/custom.tsx" }]);
    await assert.rejects(
      () => prepareManifestRenderPlan({ manifestPath, outputDir }),
      new RegExp(`source.*slides/${PAGE_1}\\.tsx`),
    );
  });
});

test("single-page mode compiles only the selected Page Source", async () => {
  await withFixture(async ({ manifestPath, outputDir, deckDir }) => {
    await writeFile(path.join(deckDir, "slides", `${PAGE_1}.tsx`), BROKEN_PAGE_SOURCE, "utf8");
    await writeFile(path.join(deckDir, "slides", `${PAGE_2}.tsx`), PAGE_SOURCE, "utf8");
    await writeManifest(manifestPath, [
      { id: PAGE_1, source: `./slides/${PAGE_1}.tsx` },
      { id: PAGE_2, source: `./slides/${PAGE_2}.tsx` },
    ]);

    const plan = await prepareManifestRenderPlan({
      manifestPath,
      outputDir,
      singlePage: true,
      page: 2,
    });
    assert.equal(plan.slides.length, 1);
    assert.equal(plan.slides[0]?.slideId, PAGE_2);
    assert.equal(plan.slides[0]?.pageNumber, 2);
  });
});

test("full-deck mode validates every Page Source default export", async () => {
  await withFixture(async ({ manifestPath, outputDir, deckDir }) => {
    await writeFile(path.join(deckDir, "slides", `${PAGE_1}.tsx`), BROKEN_PAGE_SOURCE, "utf8");
    await writeFile(path.join(deckDir, "slides", `${PAGE_2}.tsx`), PAGE_SOURCE, "utf8");
    await writeManifest(manifestPath, [
      { id: PAGE_1, source: `./slides/${PAGE_1}.tsx` },
      { id: PAGE_2, source: `./slides/${PAGE_2}.tsx` },
    ]);
    await assert.rejects(
      () => prepareManifestRenderPlan({ manifestPath, outputDir }),
      /must default export a React component/,
    );
  });
});
