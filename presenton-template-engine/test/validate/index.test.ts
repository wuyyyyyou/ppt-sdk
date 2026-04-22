import test from "node:test";
import assert from "node:assert/strict";

import {
  runDeckValidation,
  runRuleCollection,
  runRenderedRules,
  runStaticRules,
  summarizeDiagnostics,
  type StabilityRule,
} from "../../src/validate/index.ts";

test("summarizeDiagnostics tracks counts by phase and severity", () => {
  const summary = summarizeDiagnostics([
    {
      ruleId: "STATIC-001",
      severity: "error",
      phase: "static",
      message: "missing manifest",
      suggestion: "add manifest",
      locations: [{ filePath: "/tmp/manifest.json", jsonPath: "$.slides" }],
    },
    {
      ruleId: "DOM-001",
      severity: "warning",
      phase: "rendered",
      message: "nowrap missing",
      suggestion: "add nowrap",
      locations: [{ selector: ".title" }],
    },
  ]);

  assert.deepEqual(summary, {
    totalCount: 2,
    errorCount: 1,
    warningCount: 1,
    staticRuleCount: 1,
    renderedRuleCount: 1,
  });
});

test("runRuleCollection preserves deterministic diagnostic ordering", async () => {
  const firstRule: StabilityRule = {
    id: "Z-RULE",
    title: "z rule",
    phase: "static",
    severity: "warning",
    docs: [],
    appliesTo: ["manifest"],
    async run() {
      return [{
        ruleId: "Z-RULE",
        severity: "warning",
        phase: "static",
        message: "z",
        suggestion: "fix z",
        locations: [{ filePath: "/tmp/z.json", line: 5, column: 1 }],
      }];
    },
  };

  const secondRule: StabilityRule = {
    id: "A-RULE",
    title: "a rule",
    phase: "static",
    severity: "error",
    docs: [],
    appliesTo: ["manifest"],
    async run() {
      return [{
        ruleId: "A-RULE",
        severity: "error",
        phase: "static",
        message: "a",
        suggestion: "fix a",
        locations: [{ filePath: "/tmp/a.json", line: 1, column: 1 }],
      }];
    },
  };

  const diagnostics = await runRuleCollection(
    [firstRule, secondRule],
    { manifestPath: "/tmp/manifest.json" },
  );

  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.ruleId),
    ["A-RULE", "Z-RULE"],
  );
});

test("runDeckValidation combines static and rendered rules into one report", async () => {
  const staticRule: StabilityRule = {
    id: "STATIC-EMPTY",
    title: "static empty",
    phase: "static",
    severity: "error",
    docs: [],
    appliesTo: ["manifest"],
    async run() {
      return [{
        ruleId: "STATIC-EMPTY",
        severity: "error",
        phase: "static",
        message: "static failed",
        suggestion: "fix static",
        locations: [{ jsonPath: "$.slides" }],
      }];
    },
  };

  const renderedRule: StabilityRule = {
    id: "DOM-NOWRAP",
    title: "dom nowrap",
    phase: "rendered",
    severity: "warning",
    docs: [],
    appliesTo: ["dom"],
    async run() {
      return [{
        ruleId: "DOM-NOWRAP",
        severity: "warning",
        phase: "rendered",
        message: "rendered failed",
        suggestion: "fix dom",
        locations: [{ selector: ".chip" }],
      }];
    },
  };

  const report = await runDeckValidation(
    {
      manifestPath: "/tmp/manifest.json",
      includeRenderedChecks: true,
      renderedArtifacts: { deckHtmlPath: "/tmp/output/deck.html" },
    },
    {
      staticRules: [staticRule],
      renderedRules: [renderedRule],
    },
  );

  assert.equal(report.ok, false);
  assert.equal(report.summary.errorCount, 1);
  assert.equal(report.summary.warningCount, 1);
  assert.equal(report.summary.staticRuleCount, 1);
  assert.equal(report.summary.renderedRuleCount, 1);
  assert.equal(report.artifacts?.deckHtmlPath, "/tmp/output/deck.html");
  assert.deepEqual(
    report.diagnostics.map((diagnostic) => diagnostic.ruleId),
    ["DOM-NOWRAP", "STATIC-EMPTY"],
  );
});

test("runStaticRules and runRenderedRules default to empty registries", async () => {
  const context = { manifestPath: "/tmp/manifest.json", includeRenderedChecks: true };

  const staticDiagnostics = await runStaticRules(context);
  const renderedDiagnostics = await runRenderedRules(context);

  assert.deepEqual(staticDiagnostics, []);
  assert.deepEqual(renderedDiagnostics, []);
});
