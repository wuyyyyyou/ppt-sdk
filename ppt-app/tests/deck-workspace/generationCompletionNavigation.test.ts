import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("generation completion navigation", () => {
  it("activates the completed Deck from the completion result after Workspace sync", async () => {
    const source = await readFile(
      path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
      "utf8",
    );
    const start = source.indexOf("async function applyDeckGenerationCompletion");
    const end = source.indexOf("async function createOutlineFromConfirmedRequirements", start);
    const completionSource = source.slice(start, end);
    const completedStart = completionSource.indexOf("setGenerationUnresumable(false)");
    const completedSource = completionSource.slice(completedStart);

    assert.match(
      completedSource,
      /applyWorkspace\(refreshedWorkspace, \{ reviewRenderResult: rendered \}\);[\s\S]*?applyRenderedDeck\(rendered, completion\.result\.outline\.items\);[\s\S]*?setPage\("main"\);/,
    );
    assert.match(
      completedSource,
      /applyRenderedDeck\(rendered, completion\.result\.outline\.items\);[\s\S]*?setReviewRender\(\{\s*status: "ready",\s*result: rendered,/,
    );
  });
});
