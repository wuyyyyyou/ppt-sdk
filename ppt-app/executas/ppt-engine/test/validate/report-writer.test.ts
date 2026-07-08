import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { writeValidationReport } from "../../src/validate/index.ts";

test("writeValidationReport persists a stable validation report payload", async () => {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rootDir = await mkdtemp(path.join(tempRoot, "presenton-ve-report-"));
  const outputPath = path.join(rootDir, "validation", "report.json");

  try {
    const result = await writeValidationReport({
      outputPath,
      manifestPath: "/tmp/deck/manifest.json",
      name: "demo-deck",
      report: {
        ok: false,
        diagnostics: [
          {
            ruleId: "DOM-003",
            severity: "error",
            phase: "rendered",
            message: "chart needs screenshot",
            suggestion: "add screenshot export",
            locations: [{
              slideId: "slide-1",
              selector: ".chart-card",
            }],
          },
        ],
        summary: {
          totalCount: 1,
          errorCount: 1,
          warningCount: 0,
          staticRuleCount: 0,
          renderedRuleCount: 1,
        },
        artifacts: {
          deckHtmlPath: "/tmp/out/deck.html",
        },
      },
    });

    assert.equal(result.outputPath, outputPath);
    assert.equal(result.report.manifestPath, "/tmp/deck/manifest.json");
    assert.equal(result.report.name, "demo-deck");
    assert.equal(result.report.summary.errorCount, 1);

    const persisted = JSON.parse(await readFile(outputPath, "utf8")) as {
      generatedAt?: string;
      name?: string;
      manifestPath?: string;
      summary?: { errorCount?: number };
    };
    assert.equal(typeof persisted.generatedAt, "string");
    assert.equal(persisted.name, "demo-deck");
    assert.equal(persisted.manifestPath, "/tmp/deck/manifest.json");
    assert.equal(persisted.summary?.errorCount, 1);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
