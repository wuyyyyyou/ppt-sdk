import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("single-page rendering uses one queued browser task and reopens the persisted HTML", async () => {
  const browserArtifacts = await readFile(
    new URL("../../src/render/browser-artifacts.ts", import.meta.url),
    "utf8",
  );
  const buildDeck = await readFile(
    new URL("../../src/render/build-deck-from-manifest.tsx", import.meta.url),
    "utf8",
  );
  const combined = browserArtifacts.slice(
    browserArtifacts.indexOf("export async function staticizeAndWriteSlideScreenshots("),
    browserArtifacts.indexOf("export async function staticizeHtmlDocuments("),
  );
  const singlePage = buildDeck.slice(
    buildDeck.indexOf("export async function buildDeckPageScreenshotFromManifest("),
    buildDeck.indexOf("export async function buildDeckHtmlFromManifest("),
  );

  assert.equal(combined.match(/withQueuedManagedPage\(/g)?.length, 1);
  assert.equal(combined.match(/page\.goto\(slideUrl/g)?.length, 2);
  assert.ok(combined.indexOf("writeFile(slide.htmlPath") < combined.lastIndexOf("page.goto(slideUrl"));
  assert.ok(combined.lastIndexOf("page.goto(slideUrl") < combined.indexOf("slideElement.screenshot"));
  assert.match(singlePage, /staticizeAndWriteSlideScreenshots\(\[\{ htmlPath, outputPath: screenshotPath \}\]\)/);
  assert.doesNotMatch(singlePage, /staticizeHtmlDocuments|writeSlideScreenshots/);
});
