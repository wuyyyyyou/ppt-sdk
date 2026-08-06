import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openFullscreenPreview } from "../../src/features/deck-workspace/fullscreenPreview.ts";

describe("openFullscreenPreview", () => {
  it("uses the browser fullscreen API for the slide stage", async () => {
    let fullscreenCalls = 0;
    let fallbackCalls = 0;
    const element = {
      requestFullscreen: async () => { fullscreenCalls += 1; },
    } as unknown as HTMLElement;

    await openFullscreenPreview(element, () => { fallbackCalls += 1; });

    assert.equal(fullscreenCalls, 1);
    assert.equal(fallbackCalls, 0);
  });

  it("falls back to the review page when fullscreen is unavailable", async () => {
    let fallbackCalls = 0;
    await openFullscreenPreview(null, () => { fallbackCalls += 1; });
    assert.equal(fallbackCalls, 1);
  });
});
