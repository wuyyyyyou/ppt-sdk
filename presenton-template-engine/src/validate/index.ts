import { RENDERED_RULES } from "./rendered/index.js";
import { STATIC_RULES } from "./static/index.js";
import type {
  RunDeckValidationOptions,
  RunRuleCollectionOptions,
  StabilityDiagnostic,
  StabilityDiagnosticCounts,
  StabilityRule,
  ValidationContext,
  ValidationReport,
} from "./types.js";

function compareLocationValues(left?: number | string, right?: number | string): number {
  if (left === right) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function compareDiagnostics(left: StabilityDiagnostic, right: StabilityDiagnostic): number {
  const ruleCompare = left.ruleId.localeCompare(right.ruleId);
  if (ruleCompare !== 0) {
    return ruleCompare;
  }

  const phaseCompare = left.phase.localeCompare(right.phase);
  if (phaseCompare !== 0) {
    return phaseCompare;
  }

  const leftLocation = left.locations[0];
  const rightLocation = right.locations[0];
  const fileCompare = compareLocationValues(leftLocation?.filePath, rightLocation?.filePath);
  if (fileCompare !== 0) {
    return fileCompare;
  }

  const lineCompare = compareLocationValues(leftLocation?.line, rightLocation?.line);
  if (lineCompare !== 0) {
    return lineCompare;
  }

  const columnCompare = compareLocationValues(leftLocation?.column, rightLocation?.column);
  if (columnCompare !== 0) {
    return columnCompare;
  }

  return left.message.localeCompare(right.message);
}

export function summarizeDiagnostics(
  diagnostics: StabilityDiagnostic[],
): StabilityDiagnosticCounts {
  const summary: StabilityDiagnosticCounts = {
    totalCount: diagnostics.length,
    errorCount: 0,
    warningCount: 0,
    staticRuleCount: 0,
    renderedRuleCount: 0,
  };

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      summary.errorCount += 1;
    } else {
      summary.warningCount += 1;
    }

    if (diagnostic.phase === "static") {
      summary.staticRuleCount += 1;
    } else {
      summary.renderedRuleCount += 1;
    }
  }

  return summary;
}

export async function runRuleCollection(
  rules: StabilityRule[],
  context: ValidationContext,
): Promise<StabilityDiagnostic[]> {
  const diagnostics: StabilityDiagnostic[] = [];

  for (const rule of rules) {
    const ruleDiagnostics = await rule.run(context);
    diagnostics.push(...ruleDiagnostics);
  }

  return diagnostics.sort(compareDiagnostics);
}

export async function runStaticRules(
  context: ValidationContext,
  options: RunRuleCollectionOptions = {},
): Promise<StabilityDiagnostic[]> {
  return runRuleCollection(options.rules ?? STATIC_RULES, context);
}

export async function runRenderedRules(
  context: ValidationContext,
  options: RunRuleCollectionOptions = {},
): Promise<StabilityDiagnostic[]> {
  return runRuleCollection(options.rules ?? RENDERED_RULES, context);
}

export async function runDeckValidation(
  context: ValidationContext,
  options: RunDeckValidationOptions = {},
): Promise<ValidationReport> {
  const staticDiagnostics = await runStaticRules(context, {
    rules: options.staticRules,
  });

  const renderedDiagnostics = context.includeRenderedChecks
    ? await runRenderedRules(context, {
      rules: options.renderedRules,
    })
    : [];

  const diagnostics = [...staticDiagnostics, ...renderedDiagnostics].sort(compareDiagnostics);
  const summary = summarizeDiagnostics(diagnostics);

  return {
    ok: summary.errorCount === 0,
    diagnostics,
    summary,
    artifacts: context.renderedArtifacts ?? undefined,
  };
}

export type {
  RenderedValidationArtifacts,
  RunDeckValidationOptions,
  RunRuleCollectionOptions,
  StabilityDiagnostic,
  StabilityDiagnosticCounts,
  StabilityDiagnosticLocation,
  StabilityRule,
  ValidationAppliesTo,
  ValidationContext,
  ValidationPhase,
  ValidationReport,
  ValidationSeverity,
} from "./types.js";
export { RENDERED_RULES } from "./rendered/index.js";
export { STATIC_RULES } from "./static/index.js";
