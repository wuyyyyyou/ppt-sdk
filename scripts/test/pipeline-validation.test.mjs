import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationFailureMessage,
  buildValidationSummaryEntry,
  runValidationStage,
} from "../lib/pipeline-validation.mjs";

function createReport(overrides = {}) {
  return {
    ok: true,
    diagnostics: [],
    summary: {
      totalCount: 0,
      errorCount: 0,
      warningCount: 0,
      staticRuleCount: 0,
      renderedRuleCount: 0,
    },
    artifacts: {
      deckHtmlPath: "/tmp/out/deck.html",
      renderedReportPath: null,
    },
    ...overrides,
  };
}

test("buildValidationSummaryEntry returns stable pipeline summary fields", () => {
  const summary = buildValidationSummaryEntry({
    reportPath: "/tmp/out/validation-report.json",
    report: createReport({
      ok: false,
      summary: {
        totalCount: 3,
        errorCount: 1,
        warningCount: 2,
        staticRuleCount: 1,
        renderedRuleCount: 2,
      },
    }),
  });

  assert.deepEqual(summary, {
    ok: false,
    report_path: "/tmp/out/validation-report.json",
    total_count: 3,
    error_count: 1,
    warning_count: 2,
    static_rule_count: 1,
    rendered_rule_count: 2,
    artifact_paths: {
      deck_html_path: "/tmp/out/deck.html",
      rendered_report_path: null,
    },
  });
});

test("buildValidationFailureMessage includes report path and leading diagnostics", () => {
  const message = buildValidationFailureMessage({
    reportPath: "/tmp/out/validation-report.json",
    report: createReport({
      ok: false,
      diagnostics: [{
        ruleId: "DOM-003",
        severity: "error",
        phase: "rendered",
        message: "chart needs screenshot",
        suggestion: "add screenshot",
        locations: [{ selector: ".chart-card" }],
      }],
      summary: {
        totalCount: 1,
        errorCount: 1,
        warningCount: 0,
        staticRuleCount: 0,
        renderedRuleCount: 1,
      },
    }),
  });

  assert.match(message, /Validation stage failed with 1 error/);
  assert.match(message, /validation-report\.json/);
  assert.match(message, /\[DOM-003\]/);
});

test("runValidationStage wires deck path, page injection, and persisted report on success", async () => {
  const calls = {
    runDeckValidation: null,
    writeValidationReport: null,
  };
  const pageRuntime = {
    page: { tag: "mock-page" },
    async close() {},
  };

  const result = await runValidationStage({
    engineDir: "/tmp/engine",
    modelDir: "/tmp/model",
    manifestPath: "/tmp/deck/manifest.json",
    deckOutputPath: "/tmp/out/deck.html",
    outputDir: "/tmp/out",
    reportPath: "/tmp/out/validation-report.json",
    presentationName: "demo",
  }, {
    pageRuntime,
    runDeckValidation: async (input) => {
      calls.runDeckValidation = input;
      return createReport();
    },
    writeValidationReport: async (input) => {
      calls.writeValidationReport = input;
      return {
        outputPath: input.outputPath,
        report: {
          ...input.report,
          generatedAt: "2026-04-22T00:00:00.000Z",
        },
      };
    },
  });

  assert.equal(calls.runDeckValidation.renderedArtifacts.deckHtmlPath, "/tmp/out/deck.html");
  assert.equal(calls.runDeckValidation.renderedOptions.page, pageRuntime.page);
  assert.equal(calls.writeValidationReport.outputPath, "/tmp/out/validation-report.json");
  assert.equal(result.summary.ok, true);
});

test("runValidationStage stops the pipeline when validation report contains errors", async () => {
  await assert.rejects(
    () => runValidationStage({
      engineDir: "/tmp/engine",
      modelDir: "/tmp/model",
      manifestPath: "/tmp/deck/manifest.json",
      deckOutputPath: "/tmp/out/deck.html",
      outputDir: "/tmp/out",
      reportPath: "/tmp/out/validation-report.json",
      presentationName: "demo",
    }, {
      pageRuntime: {
        page: { tag: "mock-page" },
        async close() {},
      },
      runDeckValidation: async () => createReport({
        ok: false,
        diagnostics: [{
          ruleId: "STATIC-005",
          severity: "error",
          phase: "static",
          message: "schema missing",
          suggestion: "add schema",
          locations: [{ filePath: "/tmp/deck/slides/Slide.tsx" }],
        }],
        summary: {
          totalCount: 1,
          errorCount: 1,
          warningCount: 0,
          staticRuleCount: 1,
          renderedRuleCount: 0,
        },
      }),
      writeValidationReport: async (input) => ({
        outputPath: input.outputPath,
        report: {
          ...input.report,
          generatedAt: "2026-04-22T00:00:00.000Z",
        },
      }),
    }),
    /Validation stage failed with 1 error/,
  );
});
