import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const HOOK = "src/features/deck-workspace/hooks/useDeckWorkspace.ts";

async function downloadAction(): Promise<string> {
  const hook = await readFile(path.resolve(HOOK), "utf8");
  const start = hook.indexOf("async function downloadCurrentExportArtifact");
  assert.notEqual(start, -1);
  return hook.slice(start, hook.indexOf("\n  }", start));
}

describe("export download route", () => {
  it("asks the Host to save the file before it ever mints a signed URL", async () => {
    const source = await downloadAction();

    const hostCall = source.indexOf("hostFileDownloadClient.download");
    const signedUrlCall = source.indexOf("backend.getExportArtifactDownloadUrl");
    assert.notEqual(hostCall, -1);
    assert.notEqual(signedUrlCall, -1);
    assert.ok(hostCall < signedUrlCall);
    // The Host resolves the object by path, which is what keeps the presigned
    // URL out of this App (ADR-0025).
    assert.match(source, /path: artifact\.mirrorPath/);
    assert.match(source, /scope: artifact\.mirrorScope/);
  });

  it("stops at the Host route on success instead of also preparing a link", async () => {
    const source = await downloadAction();

    assert.match(
      source,
      /outcome === "downloaded"\) \{\s*\n[^\n]*downloadStarted \}\);\s*\n\s*return;/,
    );
  });

  it("falls back to the signed URL when this Host has no files.download", async () => {
    const source = await downloadAction();

    // `unsupported` must not raise: an older Host has to keep working.
    assert.doesNotMatch(source, /outcome === "unsupported"[^\n]*throw/);
    assert.match(source, /startBrowserDownload\(result\.download_url, document\)/);
    assert.match(source, /downloadStartedWithLink/);
  });

  it("republishes when the mirror location is unknown, so the Host has a path", async () => {
    const source = await downloadAction();

    assert.match(source, /artifact\.mirrorStatus !== "ready" \|\| !artifact\.mirrorPath/);
  });

  it("declares the files.download host API in the App manifest", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("manifest.json"), "utf8")) as {
      ui: { host_api: { files?: string[] } };
    };

    assert.deepEqual(manifest.ui.host_api.files, ["download"]);
  });
});
