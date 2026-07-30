import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const HOOK = "src/features/deck-workspace/hooks/useDeckWorkspace.ts";
const MANIFEST = "manifest.json";
const PLUGIN = "executas/ppt-engine/example_plugin.js";

async function downloadAction(): Promise<string> {
  const hook = await readFile(path.resolve(HOOK), "utf8");
  const start = hook.indexOf("async function downloadCurrentWorkspaceDiagnosticBundle");
  assert.notEqual(start, -1);
  return hook.slice(start, hook.indexOf("\n  }", start));
}

describe("diagnostic bundle download route", () => {
  it("declares the capability required to download user-scoped objects", async () => {
    const manifest = JSON.parse(await readFile(path.resolve(MANIFEST), "utf8"));

    assert.ok(manifest.ui?.host_api?.files?.includes("download"));
    assert.ok(manifest.host_capabilities?.includes("aps.scope.user.read"));
  });

  it("asks the Host to save the ZIP before it falls back to the signed URL", async () => {
    const source = await downloadAction();

    const hostCall = source.indexOf("hostFileDownloadClient.download");
    const iframeCall = source.indexOf("startBrowserDownload(result.download_url");
    assert.notEqual(hostCall, -1);
    assert.notEqual(iframeCall, -1);
    assert.ok(hostCall < iframeCall);
    assert.match(source, /path: mirrorPath/);
    assert.match(source, /scope: mirrorScope/);
    assert.match(source, /filename: result\.filename/);
  });

  it("stops at the Host route on success instead of also keeping a link", async () => {
    const source = await downloadAction();

    assert.match(
      source,
      /outcome === "downloaded"\) \{[\s\S]*diagnosticBundleDownloadStarted,[\s\S]*return;/,
    );
    // The Host route must not leave a URL in state, or the next press would
    // retry the fallback transfer instead of rebuilding the bundle.
    const hostBranch = source.slice(source.indexOf('outcome === "downloaded"'), source.indexOf("startBrowserDownload"));
    assert.doesNotMatch(hostBranch, /href:/);
  });

  it("keeps working on a Host without files.download", async () => {
    const source = await downloadAction();

    assert.doesNotMatch(source, /outcome === "unsupported"[^\n]*throw/);
    assert.match(source, /diagnosticBundleDownloadStartedWithLink/);
  });

  it("rebuilds the bundle unless a still-valid fallback URL can be reused", async () => {
    const source = await downloadAction();

    const reuse = source.indexOf("hasActiveDownloadUrl(workspaceDiagnosticBundle)");
    const prepare = source.indexOf("backend.prepareWorkspaceDiagnosticBundle");
    assert.notEqual(reuse, -1);
    assert.notEqual(prepare, -1);
    assert.ok(reuse < prepare);
  });

  it("returns the object reference the Host needs from the engine tool", async () => {
    const plugin = await readFile(path.resolve(PLUGIN), "utf8");
    const wrapper = plugin.slice(
      plugin.indexOf("async function toolAppPrepareWorkspaceDiagnosticBundle("),
      plugin.indexOf("async function toolAppBeginGenerationRun("),
    );

    assert.match(wrapper, /mirror: \{[\s\S]*provider: "aps\.files"/);
    assert.match(wrapper, /scope: APS_FILES_DOWNLOAD_SCOPE/);
    assert.match(wrapper, /path: snapshot\.aps_path/);
    // The bundle stays ephemeral: the reference is returned, never persisted.
    assert.doesNotMatch(wrapper, /commitAppExportArtifactMirror/);
  });
});
