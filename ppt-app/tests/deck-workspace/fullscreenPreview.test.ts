import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  openFullscreenPreview,
  startFullscreenPresentation,
} from "../../src/features/deck-workspace/fullscreenPreview.ts";

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

  it("runs the supplied fallback when fullscreen is unavailable", async () => {
    let fallbackCalls = 0;
    await openFullscreenPreview(null, () => { fallbackCalls += 1; });
    assert.equal(fallbackCalls, 1);
  });
});

describe("startFullscreenPresentation", () => {
  it("enters presentation mode and requests browser fullscreen", async () => {
    const calls: string[] = [];
    const element = {
      requestFullscreen: async () => { calls.push("fullscreen"); },
    } as unknown as HTMLElement;

    await startFullscreenPresentation(element, () => { calls.push("present"); });

    assert.deepEqual(calls, ["present", "fullscreen"]);
  });

  it("still enters presentation mode when fullscreen is unavailable", async () => {
    let presentCalls = 0;

    await startFullscreenPresentation(null, () => { presentCalls += 1; });

    assert.equal(presentCalls, 1);
  });
});
