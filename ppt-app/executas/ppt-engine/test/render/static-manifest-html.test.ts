import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildDeckHtmlFromManifest,
  buildDeckHtmlPagesFromManifest,
  buildDeckPageScreenshotFromManifest,
} from "../../src/render/build-deck-from-manifest.tsx";

const PAGE_ID = "page-11111111-1111-4111-8111-111111111111";

test("single-page manifest rendering persists static DOM and Tailwind CSS", async () => {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceDir = await mkdtemp(path.join(tempRoot, "static-manifest-html-"));
  const htmlOutputDir = path.join(workspaceDir, "html");
  const screenshotOutputDir = path.join(workspaceDir, "screenshots");
  const manifestPath = path.join(workspaceDir, "manifest.json");
  const slidePath = path.join(workspaceDir, "slides", `${PAGE_ID}.tsx`);

  try {
    await mkdir(path.dirname(slidePath), { recursive: true });
    await writeFile(
      slidePath,
      `export default function Page() {
  return (
    <div
      id="static-target"
      className="flex items-center justify-center bg-red-500"
      style={{ width: "1280px", height: "720px" }}
    >
      Static manifest HTML
    </div>
  );
}
`,
      "utf8",
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Static HTML Test",
        slides: [{ id: PAGE_ID, source: `./slides/${PAGE_ID}.tsx` }],
      }, null, 2)}\n`,
      "utf8",
    );

    const result = await buildDeckPageScreenshotFromManifest({
      manifestPath,
      outputDir: screenshotOutputDir,
      htmlOutputDir,
      page: 1,
    });
    const html = await readFile(result.htmlPath, "utf8");

    assert.match(html, /<div[^>]+id="static-target"/);
    assert.match(html, /Static manifest HTML/);
    assert.doesNotMatch(html, /__PRESENTON_RENDER_CONTEXT__/);
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
    assert.doesNotMatch(html, /react-dom|createRoot\(/);
    assert.match(html, /\.flex\s*\{[^}]*display:\s*flex/);
    assert.match(html, /\.bg-red-500\s*\{/);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("full manifest rendering persists static page and Deck HTML", async () => {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceDir = await mkdtemp(path.join(tempRoot, "static-manifest-deck-"));
  const outputDir = path.join(workspaceDir, "output");
  const manifestPath = path.join(workspaceDir, "manifest.json");
  const slidePath = path.join(workspaceDir, "slides", `${PAGE_ID}.tsx`);

  try {
    await mkdir(path.dirname(slidePath), { recursive: true });
    await writeFile(
      slidePath,
      `export default function Page() {
  return <div id="deck-static-target" className="flex bg-blue-500">Static Deck HTML</div>;
}
`,
      "utf8",
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Static Deck Test",
        slides: [{ id: PAGE_ID, source: `./slides/${PAGE_ID}.tsx` }],
      }, null, 2)}\n`,
      "utf8",
    );

    const result = await buildDeckHtmlFromManifest({
      manifestPath,
      outputDir,
      name: "static-deck-test",
    });
    const pagesOnlyResult = await buildDeckHtmlPagesFromManifest({
      manifestPath,
      outputDir: path.join(workspaceDir, "pages-only"),
      name: "static-pages-only-test",
    });
    const htmlFiles = (await readdir(outputDir)).filter((file) => file.endsWith(".html"));
    const pageFileName = htmlFiles.find((file) => file !== result.deckFileName);
    assert.ok(pageFileName);
    const pageHtml = await readFile(path.join(outputDir, pageFileName), "utf8");
    const pagesOnlyHtml = await readFile(pagesOnlyResult.slides[0]!.outputPath, "utf8");

    assert.match(result.deckHtml, /<div[^>]+id="deck-static-target"/);
    assert.match(pageHtml, /<div[^>]+id="deck-static-target"/);
    assert.match(pagesOnlyHtml, /<div[^>]+id="deck-static-target"/);
    assert.doesNotMatch(result.deckHtml, /__PRESENTON_RENDER_CONTEXTS__/);
    assert.doesNotMatch(pageHtml, /__PRESENTON_RENDER_CONTEXT__/);
    assert.doesNotMatch(pagesOnlyHtml, /__PRESENTON_RENDER_CONTEXT__|react-dom/);
    assert.doesNotMatch(result.deckHtml, /cdn\.tailwindcss\.com|react-dom/);
    assert.match(result.deckHtml, /data-presenton-static-script="viewer"/);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("static manifest HTML preserves file links and materializes runtime-only graphics", async () => {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceDir = await mkdtemp(path.join(tempRoot, "static-manifest-assets-"));
  const htmlOutputDir = path.join(workspaceDir, "html");
  const screenshotOutputDir = path.join(workspaceDir, "screenshots");
  const manifestPath = path.join(workspaceDir, "manifest.json");
  const slidePath = path.join(workspaceDir, "slides", `${PAGE_ID}.tsx`);
  const imagePath = path.join(workspaceDir, "local-image.svg");

  try {
    await mkdir(path.dirname(slidePath), { recursive: true });
    await writeFile(
      imagePath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
      "utf8",
    );
    const imageUrl = pathToFileURL(imagePath).href;
    await writeFile(
      slidePath,
      `import React, { useEffect, useRef } from "react";
export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) {
      context.fillStyle = "#2563eb";
      context.fillRect(0, 0, 20, 20);
    }
  }, []);
  return (
    <div style={{ width: "1280px", height: "720px" }}>
      <img id="local-image" src=${JSON.stringify(imageUrl)} />
      <canvas id="canvas-target" ref={canvasRef} width={20} height={20} />
      <iframe src="https://example.com" />
      <div dangerouslySetInnerHTML={{ __html: "<script>window.__unsafe = true</script>" }} />
    </div>
  );
}
`,
      "utf8",
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Static Asset Test",
        slides: [{ id: PAGE_ID, source: `./slides/${PAGE_ID}.tsx` }],
      }, null, 2)}\n`,
      "utf8",
    );

    const result = await buildDeckPageScreenshotFromManifest({
      manifestPath,
      outputDir: screenshotOutputDir,
      htmlOutputDir,
      page: 1,
    });
    const html = await readFile(result.htmlPath, "utf8");

    assert.match(html, new RegExp(`id="local-image"[^>]+src="${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(html, /<img[^>]+id="canvas-target"[^>]+src="data:image\/png;base64,/);
    assert.doesNotMatch(html, /<canvas|<iframe|window\.__unsafe/);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("static Deck HTML preserves Recharts SVG", async () => {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceDir = await mkdtemp(path.join(tempRoot, "static-manifest-recharts-"));
  const outputDir = path.join(workspaceDir, "output");
  const manifestPath = path.join(workspaceDir, "manifest.json");
  const slidePath = path.join(workspaceDir, "slides", `${PAGE_ID}.tsx`);

  try {
    await mkdir(path.dirname(slidePath), { recursive: true });
    await writeFile(
      slidePath,
      `import React from "react";
import { Line, LineChart } from "recharts";
export default function Page() {
  return (
    <div style={{ width: "1280px", height: "720px", padding: "80px" }}>
      <div data-pptx-export="screenshot" data-chart-like="true">
        <LineChart width={600} height={320} data={[{ x: "A", y: 10 }, { x: "B", y: 20 }]}>
          <Line type="monotone" dataKey="y" stroke="#2563eb" isAnimationActive={false} />
        </LineChart>
      </div>
    </div>
  );
}
`,
      "utf8",
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "Static Recharts Test",
        slides: [{ id: PAGE_ID, source: `./slides/${PAGE_ID}.tsx` }],
      }, null, 2)}\n`,
      "utf8",
    );

    const result = await buildDeckHtmlFromManifest({
      manifestPath,
      outputDir,
      name: "static-recharts-test",
    });
    assert.match(result.deckHtml, /<svg[^>]+recharts-surface/);
    assert.doesNotMatch(result.deckHtml, /__PRESENTON_RENDER_CONTEXTS__|react-dom/);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});
