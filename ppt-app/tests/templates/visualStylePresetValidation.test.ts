import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { validateVisualStylePresets } from "../../scripts/validate-visual-style-presets.mjs";

const validPreset = {
  id: "test-preset",
  version: 1,
  name: "Test preset",
  description: "Test description",
  user: "Industry Professionals",
  use_case: "use_case",
  industry: "Finance, Investment & Insurance",
  theme: "Test theme",
  color: "Test color",
  style_guide: "# Test",
  preview_images: [{ path: "images/preview.jpg", alt: "Preview" }],
};

async function createPresetRoot(preset: Record<string, unknown>, includeImage = true) {
  const root = await mkdtemp(join(tmpdir(), "visual-style-presets-"));
  const presetDir = join(root, "test-preset");
  await mkdir(join(presetDir, "images"), { recursive: true });
  await writeFile(join(presetDir, "preset.json"), JSON.stringify(preset));
  if (includeImage) await writeFile(join(presetDir, "images/preview.jpg"), "image");
  return root;
}

describe("visual style preset build validation", () => {
  it("accepts the repository presets", async () => {
    const result = await validateVisualStylePresets(resolve("src/features/templates/presets"));
    assert.equal(result.presetCount, 3);
  });

  it("rejects a missing metadata field", async () => {
    const { theme: _theme, ...preset } = validPreset;
    const root = await createPresetRoot(preset);
    await assert.rejects(() => validateVisualStylePresets(root), /missing required field "theme"/);
  });

  it("rejects a metadata field with the wrong type", async () => {
    const root = await createPresetRoot({ ...validPreset, color: ["blue"] });
    await assert.rejects(() => validateVisualStylePresets(root), /field "color" must be string/);
  });

  it("rejects a missing preview image", async () => {
    const root = await createPresetRoot(validPreset, false);
    await assert.rejects(() => validateVisualStylePresets(root), /path does not exist/);
  });
});
