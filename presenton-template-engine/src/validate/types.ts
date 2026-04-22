import type { BuildDeckHtmlFromManifestResult, DeckManifestInput } from "../render/types.js";

export type ValidationPhase = "static" | "rendered";

export type ValidationSeverity = "error" | "warning";

export type ValidationAppliesTo = "manifest" | "group" | "tsx" | "dom";

export interface StabilityDiagnosticLocation {
  filePath?: string;
  line?: number;
  column?: number;
  jsonPath?: string;
  slideId?: string;
  layoutId?: string;
  selector?: string;
}

export interface StabilityDiagnostic {
  ruleId: string;
  severity: ValidationSeverity;
  phase: ValidationPhase;
  message: string;
  suggestion: string;
  locations: StabilityDiagnosticLocation[];
  evidence?: Record<string, unknown>;
}

export interface StabilityDiagnosticCounts {
  totalCount: number;
  errorCount: number;
  warningCount: number;
  staticRuleCount: number;
  renderedRuleCount: number;
}

export interface RenderedValidationArtifacts {
  deckHtmlPath?: string | null;
  deckBuildResult?: BuildDeckHtmlFromManifestResult | null;
  renderedReportPath?: string | null;
}

export interface ValidationContext {
  cwd?: string | null;
  manifestPath: string;
  outputDir?: string | null;
  name?: string | null;
  includeRenderedChecks?: boolean;
  manifest?: DeckManifestInput | null;
  renderedArtifacts?: RenderedValidationArtifacts | null;
}

export interface StabilityRule {
  id: string;
  title: string;
  phase: ValidationPhase;
  severity: ValidationSeverity;
  docs: string[];
  appliesTo: ValidationAppliesTo[];
  run(context: ValidationContext): Promise<StabilityDiagnostic[]>;
}

export interface ValidationReport {
  ok: boolean;
  diagnostics: StabilityDiagnostic[];
  summary: StabilityDiagnosticCounts;
  artifacts?: RenderedValidationArtifacts;
}

export interface RunRuleCollectionOptions {
  rules?: StabilityRule[];
}

export interface RunDeckValidationOptions {
  staticRules?: StabilityRule[];
  renderedRules?: StabilityRule[];
}
