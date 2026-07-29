import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const HOOK = "src/features/deck-workspace/hooks/useDeckWorkspace.ts";
const ADAPTER = "src/api/annaPptBackend.ts";
const ENGINE_MANIFEST = "executas/ppt-engine/manifest.json";

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(relativePath), "utf8");
}

describe("generation page preview route", () => {
  it("reads page images from the Shadow Workspace while a run is in flight", async () => {
    const hook = await readSource(HOOK);

    assert.match(
      hook,
      /generationPreviewWorkspaceDir =\s*\n?\s*activeGenerationRun\?\.shadowWorkspaceDir \?\? currentWorkspace\?\.workspace_dir \?\? "";/,
    );
    assert.match(hook, /backend\.getWorkspacePageImage\(\{\s*\n\s*workspace_dir: workspaceDir,\s*\n\s*page_id: source\.pageId,/);
  });

  it("keeps preview requests bounded and drops results from a stale session", async () => {
    const hook = await readSource(HOOK);

    assert.match(hook, /mapWithConcurrencyLimit\(\s*\n\s*pending,\s*\n\s*GENERATION_PAGE_PREVIEW_CONCURRENCY,/);
    assert.match(hook, /if \(generationPagePreviewSessionRef\.current !== session\) return;/);
    // A page that re-rendered while the request was queued belongs to the newer
    // reconciliation, otherwise the stale image would win.
    assert.match(hook, /screenshotPath !== source\.screenshotPath/);
  });

  it("clears previews whenever the run or Workspace is reset", async () => {
    const hook = await readSource(HOOK);
    const resets = hook.match(/resetGenerationPagePreviews\(\);/g) ?? [];

    assert.ok(resets.length >= 3, `expected the reset paths to clear previews, saw ${resets.length}`);
    assert.match(
      hook,
      /function resetGenerationPagePreviews\(\) \{[\s\S]*generationPagePreviewSessionRef\.current \+= 1;[\s\S]*setPinnedGenerationPreviewPageId\(null\);/,
    );
  });

  it("routes the frontend call to the engine tool that derives one page image", async () => {
    const adapter = await readSource(ADAPTER);
    const manifest = JSON.parse(await readSource(ENGINE_MANIFEST)) as {
      tools: Array<{ name: string; parameters: Array<{ name: string; required?: boolean }> }>;
    };

    assert.match(adapter, /getWorkspacePageImage: \(input\) =>[\s\S]*"app_get_workspace_page_image"/);
    const tool = manifest.tools.find((entry) => entry.name === "app_get_workspace_page_image");
    assert.ok(tool, "the engine manifest must declare app_get_workspace_page_image");
    assert.deepEqual(
      tool.parameters.map((parameter) => [parameter.name, parameter.required === true]),
      [["workspace_dir", true], ["page_id", true], ["width", false]],
    );
  });
});
