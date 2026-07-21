import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type {
  PresentationRequirementCandidate,
  PresentationRequirements,
} from "../api/types";
import type { OutlineDetail } from "../data/mockDeck";
import {
  buildGenerateOutlineUserPrompt,
  buildOutlineRepairPrompt,
  buildOutlineSystemPrompt,
  buildReviseOutlineUserPrompt,
} from "./outlinePromptMessages";

interface GenerateOutlinePromptInput {
  requirements: PresentationRequirements;
  uploadedSourceAnalysisContext?: unknown;
}

interface ReviseOutlinePromptInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  requirements: PresentationRequirements;
  uploadedSourceAnalysisContext?: unknown;
}

function semanticRequirementValue(
  requirements: PresentationRequirements,
  field: "audience" | "purpose" | "desired_outcome" | "visual_tone",
): Record<string, string> | null {
  const selection = requirements.selections[field];
  if (!selection) return null;
  const isCandidate = requirements.candidates[field].some(
    (candidate: PresentationRequirementCandidate) =>
      candidate.label === selection.label && candidate.description === selection.description,
  );
  return isCandidate
    ? { label: selection.label, description: selection.description }
    : { description: selection.description };
}

function buildConfirmedRequirementsInput(requirements: PresentationRequirements) {
  if (requirements.status !== "confirmed" || !requirements.source) {
    throw new Error("Confirmed Presentation Requirements are required for Outline Creation.");
  }
  return {
    brief: requirements.source.brief,
    requirements: {
      audience: semanticRequirementValue(requirements, "audience"),
      purpose: semanticRequirementValue(requirements, "purpose"),
      desired_outcome: semanticRequirementValue(requirements, "desired_outcome"),
      slide_count: requirements.selections.slide_count,
      output_language: requirements.selections.output_language,
      visual_tone: semanticRequirementValue(requirements, "visual_tone"),
      visual_style_preset: requirements.selections.visual_style_preset ?? null,
    },
  };
}

function buildGenerateUserPrompt(input: GenerateOutlinePromptInput): string {
  return buildGenerateOutlineUserPrompt({
    confirmedRequirementsJson: JSON.stringify(buildConfirmedRequirementsInput(input.requirements)),
    uploadedSourceAnalysisContextJson: JSON.stringify(input.uploadedSourceAnalysisContext ?? null),
  });
}

function buildReviseUserPrompt(input: ReviseOutlinePromptInput): string {
  return buildReviseOutlineUserPrompt({
    confirmedRequirementsJson: JSON.stringify(buildConfirmedRequirementsInput(input.requirements)),
    uploadedSourceAnalysisContextJson: JSON.stringify(input.uploadedSourceAnalysisContext ?? null),
    title: input.title,
    feedback: input.feedback,
    outlineJson: JSON.stringify(input.outline),
  });
}

export function buildGenerateOutlineLlmRequest(
  input: GenerateOutlinePromptInput
): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildGenerateUserPrompt(input),
        },
      },
    ],
  };
}

export function buildReviseOutlineLlmRequest(
  input: ReviseOutlinePromptInput
): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildReviseUserPrompt(input),
        },
      },
    ],
  };
}

export function buildOutlineRepairRequest(
  previousRequest: AnnaLlmCompleteInput,
  rawResponse: string,
  errors: string[]
): AnnaLlmCompleteInput {
  return {
    ...previousRequest,
    messages: [
      ...previousRequest.messages,
      {
        role: "assistant",
        content: {
          type: "text",
          text: rawResponse,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildOutlineRepairPrompt(errors),
        },
      },
    ],
  };
}
