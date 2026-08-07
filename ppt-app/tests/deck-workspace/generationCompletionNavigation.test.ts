import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("generation completion navigation", () => {
  it("activates the completed Deck from the committed Workspace before optional preview assembly", async () => {
    const source = await readFile(
      path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
      "utf8",
    );
    const start = source.indexOf("async function applyDeckGenerationCompletion");
    const end = source.indexOf("async function createOutlineFromConfirmedRequirements", start);
    const completionSource = source.slice(start, end);
    const completedStart = completionSource.indexOf("setGenerationUnresumable(false)");
    const completedSource = completionSource.slice(completedStart);
    const applyWorkspaceIndex = completedSource.indexOf("applyWorkspace(workspace");
    const assembleIndex = completedSource.indexOf("assembleMeasuredReviewRender");

    assert.doesNotMatch(completedSource, /backend\.openWorkspace/);
    assert.ok(applyWorkspaceIndex >= 0, "the committed Workspace must be applied");
    assert.ok(
      assembleIndex < 0 || applyWorkspaceIndex < assembleIndex,
      "optional preview assembly must not block applying the completed Deck",
    );
    assert.match(
      completedSource,
      /applyWorkspace\(workspace, \{ reviewRenderResult: completion\.result\.rendered \}\);[\s\S]*?applyRenderedDeck\(completion\.result\.rendered, completion\.result\.outline\.items\);[\s\S]*?setPage\("main"\);/,
    );
    assert.match(
      completedSource,
      /applyRenderedDeck\(completion\.result\.rendered, completion\.result\.outline\.items\);[\s\S]*?setReviewRender\(\{\s*status: "ready",\s*result: completion\.result\.rendered,/,
    );
  });
});
