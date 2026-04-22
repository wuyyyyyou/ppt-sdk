import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const DEFAULT_VALIDATION_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=TranslateUI",
  "--disable-ipc-flooding-protection",
];

export function buildValidationSummaryEntry(input) {
  return {
    ok: input.report.ok,
    report_path: input.reportPath,
    total_count: input.report.summary.totalCount,
    error_count: input.report.summary.errorCount,
    warning_count: input.report.summary.warningCount,
    static_rule_count: input.report.summary.staticRuleCount,
    rendered_rule_count: input.report.summary.renderedRuleCount,
    artifact_paths: {
      deck_html_path: input.report.artifacts?.deckHtmlPath ?? null,
      rendered_report_path: input.report.artifacts?.renderedReportPath ?? null,
    },
  };
}

export function buildValidationFailureMessage(input) {
  const leadingDiagnostics = input.report.diagnostics
    .slice(0, 5)
    .map((diagnostic) => {
      const location = diagnostic.locations[0];
      const pointer = location?.selector
        ?? location?.filePath
        ?? location?.jsonPath
        ?? diagnostic.ruleId;
      return `- [${diagnostic.ruleId}] ${diagnostic.message} (${pointer})`;
    });

  return [
    `Validation stage failed with ${input.report.summary.errorCount} error(s) and ${input.report.summary.warningCount} warning(s).`,
    `Report: ${input.reportPath}`,
    ...leadingDiagnostics,
  ].join("\n");
}

async function loadEngineValidationModule(engineDir) {
  const moduleUrl = pathToFileURL(path.join(engineDir, "dist", "index.js")).href;
  return import(moduleUrl);
}

async function loadPuppeteerFromModel(modelDir) {
  const requireFromModel = createRequire(path.join(modelDir, "package.json"));
  return requireFromModel("puppeteer");
}

export async function createManagedValidationPage(input) {
  const puppeteer = await loadPuppeteerFromModel(input.modelDir);
  const browser = await puppeteer.launch({
    headless: true,
    args: DEFAULT_VALIDATION_BROWSER_ARGS,
    ...(input.launchOptions ?? {}),
  });
  const page = await browser.newPage();

  return {
    page,
    async close() {
      await page.close?.().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}

export async function runValidationStage(input, overrides = {}) {
  const engineModule = overrides.runDeckValidation && overrides.writeValidationReport
    ? null
    : overrides.engineModule ?? await loadEngineValidationModule(input.engineDir);
  const runDeckValidation = overrides.runDeckValidation ?? engineModule?.runDeckValidation;
  const writeValidationReport = overrides.writeValidationReport ?? engineModule?.writeValidationReport;
  if (typeof runDeckValidation !== "function") {
    throw new Error("Engine validation module is missing runDeckValidation.");
  }
  if (typeof writeValidationReport !== "function") {
    throw new Error("Engine validation module is missing writeValidationReport.");
  }

  const pageRuntime = overrides.pageRuntime ?? await createManagedValidationPage({
    modelDir: input.modelDir,
    launchOptions: input.launchOptions,
  });

  try {
    const report = await runDeckValidation({
      manifestPath: input.manifestPath,
      outputDir: input.outputDir,
      name: input.presentationName,
      includeRenderedChecks: input.includeRenderedChecks !== false,
      renderedArtifacts: {
        deckHtmlPath: input.deckOutputPath,
      },
      renderedOptions: {
        page: pageRuntime.page,
      },
    });

    const persisted = await writeValidationReport({
      report,
      outputPath: input.reportPath,
      manifestPath: input.manifestPath,
      name: input.presentationName,
    });
    const summary = buildValidationSummaryEntry({
      report,
      reportPath: persisted.outputPath,
    });

    if (!report.ok) {
      const error = new Error(buildValidationFailureMessage({
        report,
        reportPath: persisted.outputPath,
      }));
      error.validation = summary;
      throw error;
    }

    return {
      report,
      reportPath: persisted.outputPath,
      summary,
    };
  } finally {
    if (!overrides.pageRuntime) {
      await pageRuntime.close();
    }
  }
}
