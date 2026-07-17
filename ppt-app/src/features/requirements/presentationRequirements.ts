import type {
  PresentationRequirementCandidate,
  PresentationRequirements,
  PresentationRequirementsCandidates,
  PresentationRequirementsSelections,
} from "../../api/types";
import type { ContextRow } from "../deck-workspace/types";

export function createEmptyRequirementsSelections(): PresentationRequirementsSelections {
  return {
    audience: null,
    purpose: null,
    desired_outcome: null,
    slide_count: null,
    output_language: null,
    visual_tone: null,
  };
}

export function createEmptyPresentationRequirements(): PresentationRequirements {
  return {
    version: 1,
    status: "empty",
    source: null,
    candidates: {
      audience: [], purpose: [], desired_outcome: [], slide_count: [], output_language: [], visual_tone: [],
    },
    selections: createEmptyRequirementsSelections(),
    updated_at: null,
    confirmed_at: null,
  };
}

export function createRequirementsDraft(
  brief: string,
  candidates: PresentationRequirementsCandidates,
): PresentationRequirements {
  return {
    version: 1,
    status: "draft",
    source: { brief },
    candidates,
    selections: {
      audience: candidates.audience[0] ?? null,
      purpose: candidates.purpose[0] ?? null,
      desired_outcome: candidates.desired_outcome[0] ?? null,
      slide_count: candidates.slide_count[0] ?? null,
      output_language: candidates.output_language[0] ?? null,
      visual_tone: candidates.visual_tone[0] ?? null,
    },
    updated_at: new Date().toISOString(),
    confirmed_at: null,
  };
}

export function createManualRequirementsDraft(brief: string): PresentationRequirements {
  return createRequirementsDraft(brief, {
    audience: [],
    purpose: [],
    desired_outcome: [],
    slide_count: [],
    output_language: [],
    visual_tone: [],
  });
}

export function requirementsAreComplete(requirements: PresentationRequirements) {
  return Object.values(requirements.selections).every((value) => value !== null) &&
    requirements.selections.output_language?.trim().toLowerCase() !== "auto";
}

export function confirmedRequirementsAllowOutline(
  requirements: Pick<PresentationRequirements, "status"> | null | undefined,
) {
  return requirements?.status === "confirmed";
}

export function requirementsOwnedRecoveryStage(
  requirements: Pick<PresentationRequirements, "status">,
): "brief" | "requirements" | null {
  if (requirements.status === "empty") return "brief";
  if (requirements.status === "draft") return "requirements";
  return null;
}

function semanticValue(candidate: PresentationRequirementCandidate) {
  return `${candidate.label}: ${candidate.description}`;
}

export function projectRequirementsToLegacyInputs(requirements: PresentationRequirements): {
  contextRows: ContextRow[];
  outputLanguage: string;
} {
  const selections = requirements.selections;
  if (!requirementsAreComplete(requirements)) {
    throw new Error("Presentation Requirements must be complete before projection.");
  }

  return {
    contextRows: [
      { id: "audience", label: "Audience", value: semanticValue(selections.audience!) },
      { id: "purpose", label: "Purpose", value: semanticValue(selections.purpose!) },
      {
        id: "desired_outcome",
        label: "Desired outcome",
        value: semanticValue(selections.desired_outcome!),
      },
      { id: "slides", label: "Slides", value: String(selections.slide_count) },
      {
        id: "visual_tone",
        label: "Visual tone",
        value: semanticValue(selections.visual_tone!),
      },
    ],
    outputLanguage: selections.output_language!,
  };
}
