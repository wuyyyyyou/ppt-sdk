import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, test } from "node:test";

const templateRoot = new URL("../../src/app/presentation-templates/", import.meta.url);

const runtimeValidationDisabledGroups = [
  "red-blue-comparison-v1",
  "red-blue-comparison-canvas",
  "chart-analytics-v1",
  "chart-analytics-canvas",
] as const;

async function listBlueprintFiles(groupId: string): Promise<URL[]> {
  const blueprintDir = new URL(`${groupId}/blueprints/`, templateRoot);
  const entries = await readdir(blueprintDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => new URL(entry.name, blueprintDir));
}

describe("template data validation policy", () => {
  for (const groupId of runtimeValidationDisabledGroups) {
    test(`${groupId} disables runtime schema hard validation`, async () => {
      const helper = await readFile(new URL(`${groupId}/utils/templateData.ts`, templateRoot), "utf8");

      assert.match(helper, /export const VALIDATE_TEMPLATE_DATA = false;/);

      const blueprintFiles = await listBlueprintFiles(groupId);
      assert.ok(blueprintFiles.length > 0);

      for (const fileUrl of blueprintFiles) {
        const source = await readFile(fileUrl, "utf8");
        assert.match(source, /from "\.\.\/utils\/templateData\.ts"/);
        assert.match(source, /readTemplateData\(Schema, data\)/);
        assert.doesNotMatch(source, /const parsed = Schema\.parse\(data \?\? \{\}\);/);
        assert.doesNotMatch(source, /const parsed = readData\(data\);/);
        assert.doesNotMatch(source, /=> Schema\.parse\(data \?\? \{\}\);/);
      }
    });
  }
});
