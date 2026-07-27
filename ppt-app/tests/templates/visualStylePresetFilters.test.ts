import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VisualStylePreset } from "../../src/api/types.ts";
import {
  filterVisualStylePresets,
  matchesVisualStylePresetFilters,
  sortVisualStylePresetsByScore,
} from "../../src/features/templates/visualStylePresetFilters.ts";

const preset = {
  id: "test",
  version: 1,
  ppt_number: 999,
  theme: "light",
  color: ["blue", "black"],
  name: "Test",
  description: "Test preset",
  user: "Industry Professionals",
  use_case: "use_case",
  industry: "Finance, Investment & Insurance",
  style_guide: "# Test",
  preview_images: [],
} satisfies VisualStylePreset;

describe("visual style preset filters", () => {
  it("matches when every selected field equals the preset", () => {
    assert.equal(matchesVisualStylePresetFilters(preset, {
      user: "Industry Professionals",
      use_case: "use_case",
      industry: "Finance, Investment & Insurance",
      theme: "light",
      color: "blue",
    }), true);
  });

  it("treats empty filter values as all and rejects any mismatched selected field", () => {
    assert.equal(matchesVisualStylePresetFilters(preset, {
      user: "",
      use_case: "",
      industry: "",
      theme: "dark",
      color: "",
    }), false);
  });

  it("sorts scored presets descending, leaves ties stable, and puts presets without a score last", () => {
    const presets = [
      { ...preset, id: "score-80", score: 80 },
      { ...preset, id: "score-90-first", score: 90 },
      { ...preset, id: "unscored" },
      { ...preset, id: "score-90-second", score: 90 },
    ];

    assert.deepEqual(
      sortVisualStylePresetsByScore(presets).map(({ id }) => id),
      ["score-90-first", "score-90-second", "score-80", "unscored"],
    );
    assert.deepEqual(presets.map(({ id }) => id), [
      "score-80",
      "score-90-first",
      "unscored",
      "score-90-second",
    ]);
  });

  it("keeps filtered presets sorted by descending score", () => {
    const presets = [
      { ...preset, id: "other-user", user: "Other", score: 99 },
      { ...preset, id: "matching-low", score: 75 },
      { ...preset, id: "matching-high", score: 92 },
    ];

    assert.deepEqual(
      filterVisualStylePresets(presets, {
        user: "Industry Professionals",
        use_case: "",
        industry: "",
        theme: "",
        color: "",
      }).map(({ id }) => id),
      ["matching-high", "matching-low"],
    );
  });
});
