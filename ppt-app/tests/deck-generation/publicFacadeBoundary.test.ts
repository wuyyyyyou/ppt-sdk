import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const deckGenerationDir = path.join(repoRoot, "src/features/deck-generation");

describe("Deck Generation Public Facade boundary", () => {
  it("prevents internal deck-generation modules from importing the public facade", async () => {
    const filenames = await readdir(deckGenerationDir);
    const offenders: string[] = [];
    const publicFacadeImportPattern =
      /\bfrom\s+["'](?:\.\/index(?:\.ts)?|\.)(?:["'])|\bimport\s*\(\s*["'](?:\.\/index(?:\.ts)?|\.)(?:["'])\s*\)/;

    for (const filename of filenames) {
      if (!filename.endsWith(".ts") || filename === "index.ts") continue;
      const filePath = path.join(deckGenerationDir, filename);
      const source = await readFile(filePath, "utf8");
      if (publicFacadeImportPattern.test(source)) {
        offenders.push(filename);
      }
    }

    assert.deepEqual(offenders, []);
  });
});
