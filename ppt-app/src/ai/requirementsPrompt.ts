import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import {
  buildRequirementsRepairPrompt,
  buildRequirementsSystemPrompt,
  buildRequirementsUserPrompt,
} from "./requirementsPromptMessages";

export function buildPresentationRequirementsRequest(brief: string, visualStylePreset?: { name: string; description: string } | null): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: { type: "text", text: buildRequirementsSystemPrompt(visualStylePreset) },
      },
      {
        role: "user",
        content: { type: "text", text: buildRequirementsUserPrompt(brief, visualStylePreset) },
      },
    ],
  };
}

export function buildPresentationRequirementsRepairRequest(
  previousRequest: AnnaLlmCompleteInput,
  rawResponse: string,
  validationErrors: string[],
  visualStylePreset?: { name: string; description: string } | null,
): AnnaLlmCompleteInput {
  return {
    ...previousRequest,
    messages: [
      ...previousRequest.messages,
      {
        role: "assistant",
        content: { type: "text", text: rawResponse },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildRequirementsRepairPrompt(validationErrors, visualStylePreset),
        },
      },
    ],
  };
}
