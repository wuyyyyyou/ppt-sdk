export type ResearchCurationKind = "web" | "visual";

export const RESEARCH_CURATION_ATTEMPT_LIMIT = 5;

export function researchCurationLabel(kind: ResearchCurationKind): string {
  return kind === "web" ? "Web" : "Visual";
}

export function formatResearchCurationRunError(input: {
  kind: ResearchCurationKind;
  error: unknown;
}): string {
  const label = researchCurationLabel(input.kind);
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  return `${label} Research Curation failed: ${message}`;
}

export function formatResearchCurationRetryActivity(input: {
  kind: ResearchCurationKind;
  nextAttempt: number;
  attemptLimit?: number;
}): string {
  const label = researchCurationLabel(input.kind);
  return `${label} Research Curation retry ${input.nextAttempt}/${input.attemptLimit ?? RESEARCH_CURATION_ATTEMPT_LIMIT}`;
}

export function formatResearchCurationExhaustedGap(input: {
  kind: ResearchCurationKind;
  attemptLimit?: number;
  lastFailure: string;
}): string {
  const label = researchCurationLabel(input.kind);
  return `${label} Research Curation failed after ${input.attemptLimit ?? RESEARCH_CURATION_ATTEMPT_LIMIT} attempts. Last error: ${input.lastFailure}`;
}

