import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type {
  PresentationRequirements,
  VisualStylePresetColor,
} from "../api/types";
import type { VisualStylePresetSelectionCandidate } from "./types";

export function buildVisualStylePresetColorRequest(input: {
  brief: string;
  requirements: PresentationRequirements;
  colors: VisualStylePresetColor[];
}): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a senior presentation art director selecting a reusable Visual Style Preset.",
            "Choose exactly one broad color family from the allowed list for this presentation.",
            "Use the Brief and the derived Presentation Requirements as context.",
            "The color family is only a catalog filter, not an exact palette or a requirement to use that literal color everywhere.",
            "Return JSON only with this exact shape: {\"color\":\"blue\"}.",
            "The color value must be copied exactly from the allowed list.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Select the most suitable Visual Style Preset color family.",
            `<brief>\n${input.brief.trim()}\n</brief>`,
            `<presentation_requirements>\n${JSON.stringify(summarizeRequirements(input.requirements), null, 2)}\n</presentation_requirements>`,
            `<allowed_colors>\n${JSON.stringify(input.colors)}\n</allowed_colors>`,
            "Return JSON only.",
          ].join("\n\n"),
        },
      },
    ],
  };
}

export function buildVisualStylePresetRequest(input: {
  brief: string;
  requirements: PresentationRequirements;
  color: VisualStylePresetColor;
  candidates: VisualStylePresetSelectionCandidate[];
}): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a senior presentation art director selecting one existing Visual Style Preset.",
            "Choose exactly one candidate whose complete style_guide best fits the Brief and derived Presentation Requirements.",
            "The candidate style_guides are existing visual guidance documents. Do not rewrite them and do not invent a new style.",
            "Preview images are intentionally not provided and must not be requested.",
            "Return JSON only with this exact shape: {\"preset_id\":\"candidate-id\"}.",
            "The preset_id must be copied exactly from one of the supplied candidates.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Select the best existing Visual Style Preset candidate.",
            `<brief>\n${input.brief.trim()}\n</brief>`,
            `<presentation_requirements>\n${JSON.stringify(summarizeRequirements(input.requirements), null, 2)}\n</presentation_requirements>`,
            `<selected_color>\n${input.color}\n</selected_color>`,
            `<candidates>\n${JSON.stringify(input.candidates, null, 2)}\n</candidates>`,
            "Return JSON only.",
          ].join("\n\n"),
        },
      },
    ],
  };
}

function summarizeRequirements(requirements: PresentationRequirements) {
  return {
    audience: requirements.selections.audience,
    purpose: requirements.selections.purpose,
    desired_outcome: requirements.selections.desired_outcome,
    slide_count: requirements.selections.slide_count,
    output_language: requirements.selections.output_language,
  };
}

export function parseVisualStylePresetColorResponse(
  value: unknown,
  colors: readonly VisualStylePresetColor[],
): VisualStylePresetColor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The response must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Object.prototype.hasOwnProperty.call(record, "color")) {
    throw new Error("The response must contain exactly the color field.");
  }
  if (typeof record.color !== "string" || !colors.includes(record.color as VisualStylePresetColor)) {
    throw new Error(`color must be one of: ${colors.join(", ")}.`);
  }
  return record.color as VisualStylePresetColor;
}

export function parseVisualStylePresetResponse(
  value: unknown,
  candidates: readonly VisualStylePresetSelectionCandidate[],
): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The response must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Object.prototype.hasOwnProperty.call(record, "preset_id")) {
    throw new Error("The response must contain exactly the preset_id field.");
  }
  const presetId = typeof record.preset_id === "string" ? record.preset_id.trim() : "";
  if (!presetId || !candidates.some((candidate) => candidate.id === presetId)) {
    throw new Error("preset_id must match one of the supplied candidates.");
  }
  return presetId;
}
