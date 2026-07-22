import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VisualStylePreset } from "../../src/api/types.ts";
import { matchesVisualStylePresetFilters } from "../../src/features/templates/visualStylePresetFilters.ts";

const preset = {
  id: "test",
  version: 1,
  name: "Test",
  description: "Test preset",
  user: "Industry Professionals",
  use_case: "use_case",
  industry: "Finance, Investment & Insurance",
  theme: "Executive & Data-Driven",
  color: "Navy Blue",
  style_guide: "# Test",
  preview_images: [],
} satisfies VisualStylePreset;

describe("visual style preset filters", () => {
  it("matches when every selected field equals the preset", () => {
    assert.equal(matchesVisualStylePresetFilters(preset, {
      user: "Industry Professionals",
      use_case: "use_case",
      industry: "Finance, Investment & Insurance",
      theme: "Executive & Data-Driven",
      color: "Navy Blue",
    }), true);
  });

  it("treats empty filter values as all and rejects any mismatched selected field", () => {
    assert.equal(matchesVisualStylePresetFilters(preset, {
      user: "",
      use_case: "",
      industry: "",
      theme: "Futuristic & Technology",
      color: "",
    }), false);
  });
});
