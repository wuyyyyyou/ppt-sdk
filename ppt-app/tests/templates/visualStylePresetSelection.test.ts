import assert from "node:assert/strict";
import test from "node:test";
import type { VisualStylePreset } from "../../src/api/types";
import { toVisualStylePresetSelection } from "../../src/features/templates/visualStylePresetSelection";

test("projects a catalog preset to the persisted four-field selection contract", () => {
  const preset: VisualStylePreset = {
    id: "editorial-consumer-fundraising",
    version: 1,
    ppt_number: 8,
    theme: "light",
    color: ["beige", "brown", "black"],
    name: "Editorial Consumer Brand Pitch",
    description: "Warm editorial direction.",
    user: "Founders & Business Owners",
    use_case: "Fundraising & Investment",
    industry: "Retail, E-commerce & Consumer",
    style_guide: "# Style guide",
    preview_images: [{ url: "/preview.png", alt: "Preview" }],
  };

  assert.deepEqual(toVisualStylePresetSelection(preset), {
    id: "editorial-consumer-fundraising",
    version: 1,
    name: "Editorial Consumer Brand Pitch",
    description: "Warm editorial direction.",
  });
});

test("keeps an absent catalog preset absent", () => {
  assert.equal(toVisualStylePresetSelection(null), null);
});
