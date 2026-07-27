import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { validateVisualStylePresets } from "../../scripts/validate-visual-style-presets.mjs";

const validPreset = {
  id: "test-preset",
  version: 1,
  ppt_number: 999,
  score: 90,
  theme: "light",
  color: ["blue"],
  name: "Test preset",
  description: "Test description",
  user: "Industry Professionals",
  use_case: "use_case",
  industry: "Finance, Investment & Insurance",
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
    const root = resolve("src/features/templates/presets");
    const result = await validateVisualStylePresets(root);
    const entries = await readdir(root, { withFileTypes: true });
    const expected = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      try {
        await access(join(root, entry.name, "preset.json"));
        return 1;
      } catch {
        return 0;
      }
    }));
    assert.equal(result.presetCount, expected.reduce((total, count) => total + count, 0));
  });

  it("rejects a missing metadata field", async () => {
    const { theme: _theme, ...preset } = validPreset;
    const root = await createPresetRoot(preset);
    await assert.rejects(() => validateVisualStylePresets(root), /missing required field "theme"/);
  });

  it("rejects a metadata field with the wrong type", async () => {
    const root = await createPresetRoot({ ...validPreset, color: "blue" });
    await assert.rejects(() => validateVisualStylePresets(root), /field "color" must be array/);
  });

  it("rejects a non-numeric score", async () => {
    const root = await createPresetRoot({ ...validPreset, score: "90" });
    await assert.rejects(() => validateVisualStylePresets(root), /field "score" must be a finite number/);
  });

  it("ignores numbered directories that have not received preset.json yet", async () => {
    const root = await createPresetRoot(validPreset);
    await mkdir(join(root, "100-pending-template", "images"), { recursive: true });
    const result = await validateVisualStylePresets(root);
    assert.equal(result.presetCount, 1);
  });

  it("rejects a missing preview image", async () => {
    const root = await createPresetRoot(validPreset, false);
    await assert.rejects(() => validateVisualStylePresets(root), /path does not exist/);
  });
});
