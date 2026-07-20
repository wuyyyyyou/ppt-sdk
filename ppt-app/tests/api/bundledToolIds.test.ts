import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolvePptBundledToolIds } from "../../src/api/bundledToolIds.ts";

const originalWindow = (globalThis as typeof globalThis & { window?: Window }).window;

function setToolIds(toolIds: Record<string, string> | undefined) {
  (globalThis as typeof globalThis & { window?: Window }).window = {
    __ANNA_TOOL_IDS__: toolIds,
  } as Window;
}

describe("Bundled tool ids", () => {
  afterEach(() => {
    (globalThis as typeof globalThis & { window?: Window }).window = originalWindow;
  });

  it("resolves the required PPT tool ids from the Anna sidecar", () => {
    setToolIds({
      "ppt-engine": "tool-engine",
      "anna-search": "tool-search",
    });

    assert.deepEqual(resolvePptBundledToolIds(), {
      pptEngine: "tool-engine",
      annaSearch: "tool-search",
    });
  });

  it("fails when the Anna tool id sidecar is missing", () => {
    setToolIds(undefined);

    assert.throws(
      () => resolvePptBundledToolIds(),
      /Missing Anna bundled tool id for "ppt-engine"/,
    );
  });

  it("fails when a required bundled handle is missing", () => {
    setToolIds({
      "ppt-engine": "tool-engine",
    });

    assert.throws(
      () => resolvePptBundledToolIds(),
      /Missing Anna bundled tool id for "anna-search"/,
    );
  });
});
