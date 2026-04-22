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

export interface ValidationViewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface ValidationElementHandleLike {
  $?: (selector: string) => Promise<ValidationElementHandleLike | null>;
  $$: (selector: string) => Promise<ValidationElementHandleLike[]>;
  evaluate: <T>(
    pageFunction: (...args: any[]) => T,
    ...args: any[]
  ) => Promise<T>;
}

export interface ValidationPageLike {
  setViewport?: (viewport: ValidationViewport) => Promise<void>;
  setContent: (
    html: string,
    options?: { waitUntil?: string | string[]; timeout?: number },
  ) => Promise<void>;
  $: (selector: string) => Promise<ValidationElementHandleLike | null>;
  close?: () => Promise<void>;
}

export interface ValidationBrowserLike {
  newPage: () => Promise<ValidationPageLike>;
  close: () => Promise<void>;
}

export interface RenderedSlideInfo {
  slideIndex: number;
  slideId: string | null;
  layoutId: string | null;
  templateGroup: string | null;
  shellSelector: string;
  rootSelector: string | null;
  childElementCount: number;
  screenshotRegionCount: number;
}

export interface RenderedValidationRuntimeOptions {
  page?: ValidationPageLike | null;
  viewport?: ValidationViewport | null;
  contentWaitUntil?: string | string[];
  contentTimeoutMs?: number;
  renderReadyTimeoutMs?: number;
  settleTimeMs?: number;
  deckSelector?: string;
  slideSelector?: string;
  launchOptions?: Record<string, unknown>;
}

export interface RenderedValidationContext {
  page: ValidationPageLike;
  deckSelector: string;
  slideSelector: string;
  slides: RenderedSlideInfo[];
  ownedPage: boolean;
  close: () => Promise<void>;
}

export interface ValidationContext {
  cwd?: string | null;
  manifestPath: string;
  outputDir?: string | null;
  name?: string | null;
  includeRenderedChecks?: boolean;
  manifest?: DeckManifestInput | null;
  renderedArtifacts?: RenderedValidationArtifacts | null;
  renderedOptions?: RenderedValidationRuntimeOptions | null;
  rendered?: RenderedValidationContext | null;
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
