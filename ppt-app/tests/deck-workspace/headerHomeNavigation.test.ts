import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("header brand entry", () => {
  it("asks before walking away from a run, from whichever page it is clicked", async () => {
    const app = await readFile(path.resolve("src/app/App.tsx"), "utf8");

    const onHome = app.match(/onHome=\{[^\n]*/)?.[0] ?? "";

    // A stage check here would only cover the generation page, leaving a
    // refinement run to be dropped without a confirmation from anywhere else.
    assert.match(onHome, /\(\) => void actions\.goHomeFromHeader\(\)/);
    assert.doesNotMatch(onHome, /state\.stage/);
  });

  it("routes the brand entry through the Generation Abandonment confirmation", async () => {
    const hook = await readFile(
      path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
      "utf8",
    );
    const start = hook.indexOf("async function goHomeFromHeader");
    const source = hook.slice(start, hook.indexOf("\n  }", start));

    assert.notEqual(start, -1);
    // The whole in-flight window, not just a registered run: the first seconds
    // of a generation have no run yet and used to skip the confirmation.
    assert.match(source, /isGenerationInFlight\(\)/);
    assert.match(source, /cancelGenerateDeck\(\{ landOnMyWork: true, copy: "home" \}\)/);
    assert.match(source, /startNewPresentation\(\)/);
  });
});
