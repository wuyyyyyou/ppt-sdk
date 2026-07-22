import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ensureSinglePageSlideShell,
  embedWorkspaceLocalImageResources,
  extractSlideShell,
  manualPageRevisionPaths,
  publishManualPageRevision,
  readManualPageRevision,
  replaceSinglePageSlideShell,
  replaceSlideShellAtIndex,
  sanitizeManualPageHtml,
} from "../src/manual-page-revisions/index.js";

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function pageHtml(content: string): string {
  return `<!doctype html><html><head><style>.x{color:red}</style></head><body><div id="presentation-slides-wrapper">${content}</div></body></html>`;
}

test("wraps a single-page render in exactly one slide shell", () => {
  const html = ensureSinglePageSlideShell(pageHtml("<div class=\"x\">hello</div>"));
  const extracted = extractSlideShell(html);
  assert.match(extracted.shell, /data-presenton-slide-shell="true"/);
  assert.match(extracted.shell, />hello</);
});

test("embeds Workspace-local file images for the iframe editing context", async () => {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "manual-page-embed-"));
  try {
    const imagePath = path.join(workspaceDir, "image.png");
    await writeFile(imagePath, Buffer.from(PNG_1X1, "base64"));
    const source = pageHtml(`<img src="${new URL(`file://${imagePath}`).href}">`);
    const result = await embedWorkspaceLocalImageResources(workspaceDir, source);
    assert.match(result, /src="data:image\/png;base64,/);
    assert.doesNotMatch(result, /file:\/\//);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("replaces only the single page shell", () => {
  const base = ensureSinglePageSlideShell(pageHtml("<div>old</div>"));
  const replacement = '<div data-presenton-slide-shell="true"><div>new</div></div>';
  const result = replaceSinglePageSlideShell(base, replacement);
  assert.match(result, /<style>\.x\{color:red\}<\/style>/);
  assert.doesNotMatch(result, />old</);
  assert.match(result, />new</);
});

test("replaces a requested deck shell without changing other pages", () => {
  const deck = '<div id="presentation-slides-wrapper"><div data-presenton-slide-shell="true"><p>one</p></div><div data-presenton-slide-shell="true"><template data-pptx-notes>keep this note</template><p>two</p></div></div>';
  const result = replaceSlideShellAtIndex(deck, 1, '<div data-presenton-slide-shell="true"><p>changed</p></div>');
  assert.match(result, />one</);
  assert.doesNotMatch(result, />two</);
  assert.match(result, />changed</);
  assert.match(result, /<template data-pptx-notes>keep this note<\/template>/);
});

test("keeps replacement speaker notes when the manual shell already carries them", () => {
  const deck = '<div data-presenton-slide-shell="true"><template data-pptx-notes>old note</template><p>old</p></div>';
  const replacement = '<div data-presenton-slide-shell="true"><template data-pptx-notes>manual note</template><p>changed</p></div>';
  const result = replaceSlideShellAtIndex(deck, 0, replacement);
  assert.match(result, /manual note/);
  assert.doesNotMatch(result, /old note/);
});

test("sanitizes active content and extracts image data URLs for Agent HTML", async () => {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "manual-page-test-"));
  try {
    const source = pageHtml(`<script>alert(1)</script><div><img onload="alert(1)" src="data:image/png;base64,${PNG_1X1}"></div>`);
    const result = await sanitizeManualPageHtml(workspaceDir, "page-test", source);
    assert.doesNotMatch(result.currentHtml, /<script/i);
    assert.doesNotMatch(result.currentHtml, /onload=/i);
    assert.match(result.currentHtml, /data:image\/png;base64/);
    assert.match(result.agentHtml, /file:\/\//);
    const paths = manualPageRevisionPaths(workspaceDir, "page-test");
    const assets = await readdir(paths.assetsDirectory);
    assert.equal(assets.length, 1);
    assert.ok((await readFile(path.join(paths.assetsDirectory, assets[0]!))).length > 0);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("publishes monotonically and rejects a stale base revision", async () => {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "manual-page-publish-"));
  try {
    const paths = manualPageRevisionPaths(workspaceDir, "page-test");
    await writeFile(path.join(workspaceDir, "shot.png"), Buffer.from(PNG_1X1, "base64"));
    const html = ensureSinglePageSlideShell(pageHtml("<div>current</div>"));
    const first = await publishManualPageRevision({
      workspaceDir,
      pageId: "page-test",
      baseRevision: 0,
      baseHtml: html,
      currentHtml: html,
      agentHtml: html,
      screenshotPath: path.join(workspaceDir, "shot.png"),
      sourceBytes: Buffer.from("source"),
    });
    assert.equal(first.revision, 1);
    assert.equal((await readManualPageRevision(workspaceDir, "page-test"))?.revision, 1);
    await assert.rejects(() => publishManualPageRevision({
      workspaceDir,
      pageId: "page-test",
      baseRevision: 0,
      baseHtml: html,
      currentHtml: html,
      agentHtml: html,
      screenshotPath: paths.screenshot,
      sourceBytes: Buffer.from("source"),
    }), /conflict/i);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});

test("allows only one of two concurrent saves from the same base revision", async () => {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "manual-page-concurrent-"));
  try {
    const html = ensureSinglePageSlideShell(pageHtml("<div>current</div>"));
    const publish = async (name: string) => {
      const screenshotPath = path.join(workspaceDir, `${name}.png`);
      await writeFile(screenshotPath, Buffer.from(PNG_1X1, "base64"));
      return publishManualPageRevision({
        workspaceDir,
        pageId: "page-test",
        baseRevision: 0,
        baseHtml: html,
        currentHtml: html.replace("current", name),
        agentHtml: html.replace("current", name),
        screenshotPath,
        sourceBytes: Buffer.from("source"),
      });
    };
    const results = await Promise.allSettled([publish("first"), publish("second")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.match(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason), /conflict/i);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
});
