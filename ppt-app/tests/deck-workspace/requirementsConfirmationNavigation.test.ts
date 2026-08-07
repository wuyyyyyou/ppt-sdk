import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("requirements confirmation navigation", () => {
  it("shows Outline creation before confirmation waits and returns on a pre-commit failure", async () => {
    const source = await readFile(
      path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
      "utf8",
    );
    const start = source.indexOf("async function confirmPresentationRequirements");
    const end = source.indexOf("async function retryPresentationRequirements", start);
    const body = source.slice(start, end);
    const outlineStageIndex = body.indexOf('setStage("outline")');
    const firstAwaitIndex = body.indexOf("await ");

    assert.ok(outlineStageIndex >= 0, "confirmation must enter the Outline stage");
    assert.ok(
      outlineStageIndex < firstAwaitIndex,
      "the Outline loading surface must appear before confirmation performs async work",
    );
    assert.match(
      body,
      /else \{[\s\S]*?setPage\("main"\);[\s\S]*?setStage\("requirements"\);[\s\S]*?setRequirementsStatus\("error"\);/,
    );
  });
});
