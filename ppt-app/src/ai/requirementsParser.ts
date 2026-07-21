import type {
  PresentationRequirementCandidate,
  PresentationRequirementsCandidates,
} from "../api/types";
import { parseStructuredJson } from "./structuredJson";

const FIELDS = [
  "audience",
  "purpose",
  "desired_outcome",
  "slide_count",
  "output_language",
  "visual_tone",
] as const;

const SEMANTIC_FIELDS = [
  "audience",
  "purpose",
  "desired_outcome",
  "visual_tone",
] as const;

export class PresentationRequirementsValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "PresentationRequirementsValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  errors: string[],
) {
  const actual = Object.keys(value);
  for (const key of expected) {
    if (!actual.includes(key)) errors.push(`${path} is missing ${key}.`);
  }
  for (const key of actual) {
    if (!expected.includes(key)) errors.push(`${path} contains unexpected field ${key}.`);
  }
}

function validateCandidateArray(value: unknown, path: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return [];
  }
  if (value.length < 1 || value.length > 4) {
    errors.push(`${path} must contain 1 to 4 candidates.`);
  }
  return value;
}

function validateNonEmptyString(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    errors.push(`${path} must be a non-empty string without surrounding whitespace.`);
    return false;
  }
  return true;
}

function validateSemanticCandidates(
  value: unknown,
  path: string,
  errors: string[],
): PresentationRequirementCandidate[] {
  const candidates = validateCandidateArray(value, path, errors);
  const result: PresentationRequirementCandidate[] = [];
  const seen = new Set<string>();

  candidates.forEach((candidate, index) => {
    const candidatePath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${candidatePath} must be an object.`);
      return;
    }
    validateExactKeys(candidate, ["label", "description"], candidatePath, errors);
    const label = candidate.label;
    const description = candidate.description;
    const labelOk = validateNonEmptyString(label, `${candidatePath}.label`, errors);
    const descriptionOk = validateNonEmptyString(
      description,
      `${candidatePath}.description`,
      errors,
    );
    if (!labelOk || !descriptionOk) return;
    const key = `${label}\u0000${description}`;
    if (seen.has(key)) {
      errors.push(`${path} contains a duplicate candidate.`);
      return;
    }
    seen.add(key);
    result.push({ label, description });
  });

  return result;
}

export function parsePresentationRequirementsCandidates(
  text: string,
  options: { visualStylePresetSelected?: boolean } = {},
): PresentationRequirementsCandidates {
  let value: unknown;
  try {
    value = parseStructuredJson<unknown>(text);
  } catch (error) {
    throw new PresentationRequirementsValidationError([
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const errors: string[] = [];
  if (!isRecord(value)) {
    throw new PresentationRequirementsValidationError(["The response must be a JSON object."]);
  }
  const fields = options.visualStylePresetSelected ? FIELDS.filter((field) => field !== "visual_tone") : FIELDS;
  validateExactKeys(value, fields, "response", errors);

  const semantic = Object.fromEntries(
    SEMANTIC_FIELDS.filter((field) => !options.visualStylePresetSelected || field !== "visual_tone").map((field) => [
      field,
      validateSemanticCandidates(value[field], field, errors),
    ]),
  ) as Pick<PresentationRequirementsCandidates, (typeof SEMANTIC_FIELDS)[number]>;

  const slideCountValues = validateCandidateArray(value.slide_count, "slide_count", errors);
  const slideCountSeen = new Set<number>();
  const slide_count: number[] = [];
  slideCountValues.forEach((candidate, index) => {
    if (!Number.isInteger(candidate) || (candidate as number) <= 0) {
      errors.push(`slide_count[${index}] must be a positive integer.`);
      return;
    }
    const count = candidate as number;
    if (slideCountSeen.has(count)) {
      errors.push("slide_count contains a duplicate candidate.");
      return;
    }
    slideCountSeen.add(count);
    slide_count.push(count);
  });

  const languageValues = validateCandidateArray(
    value.output_language,
    "output_language",
    errors,
  );
  const languageSeen = new Set<string>();
  const output_language: string[] = [];
  languageValues.forEach((candidate, index) => {
    if (!validateNonEmptyString(candidate, `output_language[${index}]`, errors)) return;
    const normalized = candidate.toLowerCase();
    if (normalized === "auto") {
      errors.push(`output_language[${index}] must be a concrete language.`);
      return;
    }
    if (languageSeen.has(candidate)) {
      errors.push("output_language contains a duplicate candidate.");
      return;
    }
    languageSeen.add(candidate);
    output_language.push(candidate);
  });

  if (errors.length > 0) throw new PresentationRequirementsValidationError(errors);

  return {
    audience: semantic.audience,
    purpose: semantic.purpose,
    desired_outcome: semantic.desired_outcome,
    slide_count,
    output_language,
    visual_tone: semantic.visual_tone ?? [],
  };
}
