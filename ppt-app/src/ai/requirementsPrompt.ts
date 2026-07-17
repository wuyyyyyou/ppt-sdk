import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import {
  buildRequirementsRepairPrompt,
  buildRequirementsSystemPrompt,
  buildRequirementsUserPrompt,
} from "./requirementsPromptMessages";

export function buildPresentationRequirementsRequest(brief: string): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: { type: "text", text: buildRequirementsSystemPrompt() },
      },
      {
        role: "user",
        content: { type: "text", text: buildRequirementsUserPrompt(brief) },
      },
    ],
  };
}

export function buildPresentationRequirementsRepairRequest(
  previousRequest: AnnaLlmCompleteInput,
  rawResponse: string,
  validationErrors: string[],
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
          text: buildRequirementsRepairPrompt(validationErrors),
        },
      },
    ],
  };
}
