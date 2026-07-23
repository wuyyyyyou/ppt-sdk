import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("deferred Workspace creation", () => {
  it("preserves the Presentation Requirements workflow while creating the first Workspace", async () => {
    const source = await readFile(
      path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
      "utf8",
    );
    const generationStart = source.indexOf("async function generatePresentationRequirements");
    const generationEnd = source.indexOf("async function selectVisualStylePreset", generationStart);
    const generationSource = source.slice(generationStart, generationEnd);
    const creationStart = source.indexOf("function applyCreatedWorkspace");
    const creationEnd = source.indexOf("useEffect(() =>", creationStart);
    const creationSource = source.slice(creationStart, creationEnd);

    assert.match(
      generationSource,
      /ensureCurrentWorkspace\(\{ preserveWorkflowState: true \}\)/,
    );
    assert.match(
      creationSource,
      /if \(!preserveWorkflowState\) setStage\("brief"\)/,
    );
    assert.match(
      creationSource,
      /if \(!preserveWorkflowState\) \{\s*setPresentationRequirements\(workspace\.requirements\);\s*setRequirementsStatus\("idle"\);/,
    );
  });
});
