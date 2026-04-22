import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";

import {
  ALLOWED_LOCAL_EXTENSIONS,
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
} from "../../local-template/loader.js";
import type { DeckManifestInput, DeckManifestSlideInput } from "../../render/types.js";
import type {
  StabilityDiagnostic,
  StabilityDiagnosticLocation,
  StabilityRule,
  ValidationContext,
} from "../types.js";

interface ManifestState {
  manifestPath: string;
  manifestDir: string;
  manifest: DeckManifestInput | null;
  readError: string | null;
  parseError: string | null;
}

export interface LocalManifestSlideRef {
  slide: DeckManifestSlideInput;
  slideIndex: number;
  slideId: string;
  sourcePath: string;
  jsonPath: string;
}

const manifestStateCache = new Map<string, Promise<ManifestState>>();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPortablePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function createRuleDiagnostic(
  rule: StabilityRule,
  input: {
    message: string;
    suggestion: string;
    locations: StabilityDiagnosticLocation[];
    evidence?: Record<string, unknown>;
  },
): StabilityDiagnostic {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    phase: rule.phase,
    message: input.message,
    suggestion: input.suggestion,
    locations: input.locations,
    evidence: input.evidence,
  };
}

async function readManifestState(context: ValidationContext): Promise<ManifestState> {
  const manifestPath = path.resolve(context.manifestPath);
  const manifestDir = path.dirname(manifestPath);

  if (context.manifest) {
    return {
      manifestPath,
      manifestDir,
      manifest: context.manifest,
      readError: null,
      parseError: null,
    };
  }

  let manifestText: string;
  try {
    manifestText = await readFile(manifestPath, "utf8");
  } catch (error) {
    return {
      manifestPath,
      manifestDir,
      manifest: null,
      readError: error instanceof Error ? error.message : String(error),
      parseError: null,
    };
  }

  try {
    const rawValue = JSON.parse(manifestText) as unknown;
    return {
      manifestPath,
      manifestDir,
      manifest: isPlainRecord(rawValue) ? rawValue as DeckManifestInput : null,
      readError: null,
      parseError: isPlainRecord(rawValue) ? null : "Manifest root must be a JSON object",
    };
  } catch (error) {
    return {
      manifestPath,
      manifestDir,
      manifest: null,
      readError: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadManifestState(context: ValidationContext): Promise<ManifestState> {
  const manifestPath = path.resolve(context.manifestPath);

  const cached = manifestStateCache.get(manifestPath);
  if (cached) {
    return cached;
  }

  const nextStatePromise = readManifestState(context);
  manifestStateCache.set(manifestPath, nextStatePromise);
  return nextStatePromise;
}

export function collectLocalManifestSlides(
  manifest: DeckManifestInput | null,
): LocalManifestSlideRef[] {
  if (!manifest || !Array.isArray(manifest.slides)) {
    return [];
  }

  return manifest.slides.flatMap((slideValue, slideIndex) => {
    if (!slideValue || typeof slideValue !== "object") {
      return [];
    }

    const slide = slideValue as DeckManifestSlideInput;
    if (
      !slide.source ||
      typeof slide.source !== "object" ||
      slide.source.type !== "local" ||
      typeof slide.source.path !== "string" ||
      slide.source.path.length === 0
    ) {
      return [];
    }

    return [{
      slide,
      slideIndex,
      slideId: typeof slide.id === "string" ? slide.id : `index-${slideIndex}`,
      sourcePath: slide.source.path,
      jsonPath: `$.slides[${slideIndex}].source.path`,
    }];
  });
}

export async function validateLocalSourcePath(
  slideRef: LocalManifestSlideRef,
  manifestDir: string,
): Promise<{ absolutePath: string } | { error: string }> {
  try {
    const absolutePath = await resolveLocalModulePath(
      slideRef.sourcePath,
      manifestDir,
      `Slide "${slideRef.slideId}"`,
    );
    return { absolutePath };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function validateLocalModuleExports(
  absolutePath: string,
  manifestDir: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const moduleValue = await importLocalTemplateModule(absolutePath, manifestDir);
    assertLocalTemplateModule(moduleValue, absolutePath);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isSharedModulePath(sourcePath: string): boolean {
  const normalized = toPortablePath(sourcePath);
  return normalized.split("/").includes("shared");
}

export function describeAllowedLocalExtensions(): string {
  return Array.from(ALLOWED_LOCAL_EXTENSIONS).join(", ");
}

export async function groupJsonExists(manifestDir: string): Promise<boolean> {
  try {
    await access(path.join(manifestDir, "group.json"), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}
