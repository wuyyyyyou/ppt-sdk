import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : [target];
  }));
  return files.flat().filter((file) => /\.[cm]?[jt]sx?$/.test(file));
}

describe("sandbox modal boundary", () => {
  it("does not use browser-native modal APIs in the PPT App source", async () => {
    const root = path.resolve("src");
    const violations: string[] = [];
    for (const file of await sourceFiles(root)) {
      const source = await readFile(file, "utf8");
      if (/\b(?:window|globalThis|self)\.(?:confirm|alert|prompt)\s*\(/.test(source)) {
        violations.push(path.relative(root, file));
      }
    }
    assert.deepEqual(violations, []);
  });
});
