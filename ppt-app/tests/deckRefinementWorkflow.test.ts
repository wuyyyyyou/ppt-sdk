import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Deck and Page Refinement public workflows do not read or reconcile Page Plan", async () => {
  const files = await Promise.all([
    readFile(new URL("../src/features/deck-generation/refinementFacade.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/deck-generation/deckRefinementRunner.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/deck-generation/pageRefinementRunner.ts", import.meta.url), "utf8"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /getPagePlan|recordPagePlan|PagePlan/);
  assert.match(source, /preparePageRefinement/);
  assert.match(source, /commitDeckRefinement/);
});

test("Refinement preparation does not project the previous completed page progress", async () => {
  const [deckSource, pageSource] = await Promise.all([
    readFile(new URL("../src/features/deck-generation/deckRefinementRunner.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/deck-generation/pageRefinementRunner.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /step: "page-refinement-prepare"[\s\S]*?}, null,/);
  assert.match(deckSource, /emit\(input, null, "deck-refinement-planning"/);
  assert.match(deckSource, /emit\(input, null, "deck-refinement-style-guide"/);
  assert.match(deckSource, /emit\(input, null, "deck-refinement-commit"/);
});
