import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { PresentationRequirements, WorkspaceOutline } from "../api/types";
import type { AiOperationLogContext } from "./interactionLog";

export interface GenerateWorkspaceStyleGuideInput {
  brief: string;
  requirements: PresentationRequirements;
  outline: WorkspaceOutline;
  currentStyleGuide?: string;
  refinementRequest?: string;
  refinementReason?: string;
  logContext?: AiOperationLogContext;
}

export function buildWorkspaceStyleGuideLlmRequest(input: GenerateWorkspaceStyleGuideInput): AnnaLlmCompleteInput {
  const isRefinement = Boolean(input.refinementRequest?.trim());
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a senior presentation art director.",
            "Create one complete Markdown Workspace Style Guide for PPT pages implemented as TSX on a fixed 1280 by 720 canvas.",
            "The guide will be read by every Page Authoring Agent. Make it concrete and directly actionable while allowing appropriate page-level variation.",
            "Return only the final Markdown document. Do not use code fences, JSON, commentary, or an explanation envelope.",
            "Cover the shared visual concept, composition and whitespace, exact colors and usage rules, common system fonts, typography hierarchy, charts and data display, cards and lines, corners and shadows, image and illustration direction, allowed variation, and practices to avoid.",
            "Prefer common system fonts. A fallback font stack is not required.",
            "Do not invent factual presentation content. The Style Guide controls visual direction, not claims or evidence.",
            isRefinement
              ? "Revise the current Workspace Style Guide as the baseline. Apply the Deck Refinement Request, preserve every unrequested visual rule when possible, and return a complete replacement document rather than a patch."
              : "Create the initial Workspace Style Guide from the accepted deck authorities.",
            "Authority order: explicit Deck Refinement Request when present > Confirmed Presentation Requirements and Confirmed Outline > current Workspace Style Guide when present > original Brief.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            isRefinement ? "Create the complete replacement Workspace Style Guide for this Deck Refinement." : "Create the Workspace Style Guide for this Deck.",
            `Brief: ${input.brief.trim()}`,
            `Confirmed Presentation Requirements: ${JSON.stringify(input.requirements)}`,
            `Confirmed Outline: ${JSON.stringify(input.outline)}`,
            `Current Workspace Style Guide: ${input.currentStyleGuide?.trim() ?? ""}`,
            `Deck Refinement Request: ${input.refinementRequest?.trim() ?? ""}`,
            `Style Guide change reason: ${input.refinementReason?.trim() ?? ""}`,
          ].join("\n"),
        },
      },
    ],
  };
}
