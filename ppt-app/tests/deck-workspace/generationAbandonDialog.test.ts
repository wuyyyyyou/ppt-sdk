import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { messages } from "../../src/i18n/messages.ts";

async function readHook() {
  return readFile(
    path.resolve("src/features/deck-workspace/hooks/useDeckWorkspace.ts"),
    "utf8",
  );
}

function sliceFunction(source: string, name: string) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, name);
  return source.slice(start, source.indexOf("\n  }", start));
}

describe("generation abandonment dialog", () => {
  it("asks for confirmation for the whole in-flight window, not just a registered run", async () => {
    const body = sliceFunction(await readHook(), "cancelGenerateDeck");

    // A run is only registered once `beginGenerationRun` returns. Gating on the
    // run alone let the first seconds of a generation be walked away from
    // without any confirmation.
    assert.match(body, /if \(!backend \|\| !isGenerationInFlight\(\)\) return;/);
    assert.match(body, /const confirmed = await requestConfirmation\(/);
    assert.ok(
      body.indexOf("const confirmed = await requestConfirmation(") <
        body.indexOf("abandonGenerationRun"),
      "the dialog has to come before any backend work",
    );
  });

  it("discards a run that arrives after the user already abandoned", async () => {
    const body = sliceFunction(await readHook(), "prepareShadowGenerationRun");
    const afterBegin = body.slice(body.indexOf("beginGenerationRun"));

    assert.match(afterBegin, /if \(cancelCreateDeckRef\.current\)/);
    assert.ok(
      afterBegin.indexOf("cancelCreateDeckRef.current") < afterBegin.indexOf("onStarted?."),
      "the run must be discarded before it is adopted into the UI",
    );
  });

  it("asks before leaving requirements analysis or Outline creation behind", async () => {
    const hook = await readHook();

    for (const entry of ["goHomeFromHeader", "navigateFromHeader"]) {
      const body = sliceFunction(hook, entry);
      assert.match(body, /preparationInFlight\(loading\) && !await abandonPreparation\(\)/, entry);
    }

    const abandon = sliceFunction(hook, "abandonPreparation");
    assert.match(abandon, /requestConfirmation\(/);
    assert.match(abandon, /requirementsOperationRef\.current \+= 1/);
    assert.match(abandon, /outlineOperationRef\.current \+= 1/);
  });

  it("drops a late Outline landing instead of dragging the user back", async () => {
    const hook = await readHook();

    for (const entry of ["createOutlineFromConfirmedRequirements", "applyOutlineFeedback"]) {
      const body = sliceFunction(hook, entry);

      assert.match(body, /const operation = outlineOperationRef\.current \+ 1;/, entry);
      assert.match(body, /if \(outlineOperationRef\.current !== operation\) return;/, entry);
      assert.match(
        body,
        /if \(outlineOperationRef\.current === operation\) setLoading\("none"\);/,
        entry,
      );
    }
  });

  it("words the dialog for leaving when it comes from the home entry", () => {
    for (const locale of ["en", "zh"] as const) {
      const home = messages[locale].generating.abandon.home;

      for (const value of [
        home.generationTitle,
        home.refinementTitle,
        home.generationBody,
        home.refinementBody,
        home.confirm,
      ]) {
        assert.ok(value.trim().length > 0, `${locale} home copy`);
      }
      assert.notEqual(home.generationTitle, messages[locale].generating.abandon.generationTitle);
    }

    // The landing is My Works, so the copy has to say so rather than promise the home page.
    assert.match(messages.zh.generating.abandon.home.generationBody, /我的作品/);
    assert.match(messages.en.generating.abandon.home.generationBody, /My Works/);
  });
});
