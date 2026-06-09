import type { AnnaLlmCompleteInput, AnnaRuntime } from "../runtime/annaRuntime";
import {
  buildGenerateOutlineLlmRequest,
  buildOutlineRepairRequest,
  buildReviseOutlineLlmRequest,
  getExpectedSlideCount,
  getExpectedSlideCountForRevision,
} from "./outlinePrompt";
import {
  buildGeneratePagePlanLlmRequest,
  buildPagePlanRepairPrompt,
  parsePagePlanJson,
} from "./pagePlanPrompt";
import {
  OutlineValidationError,
  parseOutlineJson,
  validateGeneratedOutline,
} from "./outlineParser";
import {
  buildStructuredJsonRepairPrompt,
  parseStructuredJson,
} from "./structuredJson";
import {
  buildThemeCatalogForPrompt,
  THEME_PRESET_IDS,
} from "../features/deck-workspace/themePresets";
import { CONTENT_GROUNDING_RULES } from "./groundingRules";
import type {
  AiAttemptLog,
  AiClient,
  ContextSuggestionResult,
  GeneratedDeck,
  OutlineGenerationResult,
} from "./types";

interface AnnaCompletionContent {
  type?: string;
  text?: string;
}

interface AnnaCompletionResult {
  content?: AnnaCompletionContent | AnnaCompletionContent[] | string;
  text?: string;
  message?: {
    content?: AnnaCompletionContent | AnnaCompletionContent[] | string;
  };
}

const MAX_OUTLINE_ATTEMPTS = 3;
const LLM_COMPLETE_TIMEOUT_MS = 120_000;

export class AiOutlineGenerationError extends Error {
  constructor(
    message: string,
    public readonly attempts: AiAttemptLog[]
  ) {
    super(message);
    this.name = "AiOutlineGenerationError";
  }
}

function extractCompletionText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  const completion = result as AnnaCompletionResult | null;
  if (typeof completion?.text === "string") {
    return completion.text;
  }

  return (
    extractContentText(completion?.content) ||
    extractContentText(completion?.message?.content)
  );
}

function extractContentText(
  content: AnnaCompletionResult["content"] | undefined
): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractContentText(item)).join("");
  }

  return content?.type === "text" && typeof content.text === "string"
    ? content.text
    : "";
}

function parseJsonResult<T>(text: string, label: string): T {
  try {
    return parseStructuredJson<T>(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Anna LLM returned invalid JSON for ${label}: ${message}`);
  }
}

function completeLlm(
  runtime: AnnaRuntime,
  input: AnnaLlmCompleteInput
): Promise<unknown> {
  if (typeof runtime.call === "function") {
    return runtime.call("llm", "complete", input, {
      timeoutMs: LLM_COMPLETE_TIMEOUT_MS,
    });
  }

  return runtime.llm.complete(input);
}

async function completeJson<T>(
  runtime: AnnaRuntime,
  label: string,
  prompt: string,
  expectedShape: string
): Promise<T> {
  let request: AnnaLlmCompleteInput = {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: prompt
        }
      }
    ]
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await completeLlm(runtime, request);
    const rawText = extractCompletionText(result);

    try {
      return parseJsonResult<T>(rawText, label);
    } catch (error) {
      if (attempt >= 2) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      request = {
        ...request,
        messages: [
          ...request.messages,
          {
            role: "assistant",
            content: {
              type: "text",
              text: rawText
            }
          },
          {
            role: "user",
            content: {
              type: "text",
              text: buildStructuredJsonRepairPrompt(rawText, expectedShape, message)
            }
          }
        ]
      };
    }
  }

  throw new Error(`Anna LLM returned invalid JSON for ${label}.`);
}

function normalizeStringArray(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of rawValues) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    values.push(trimmed);
    if (values.length >= 4) break;
  }

  return values;
}

function normalizeSlideCountValue(value: unknown): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return "auto";
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === normalized
    ? String(parsed)
    : "auto";
}

function normalizeContextSuggestions(value: unknown): ContextSuggestionResult {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    audience: normalizeStringArray(record.audience),
    goal: normalizeStringArray(record.goal),
    style: normalizeStringArray(record.style),
    theme: normalizeStringArray(record.theme).filter((themeId) =>
      THEME_PRESET_IDS.includes(themeId),
    ),
    slides: normalizeSlideCountValue(record.slides),
  };
}

async function completeOutlineWithRetry(
  runtime: AnnaRuntime,
  operation: "generateOutline" | "reviseOutline",
  initialRequest: AnnaLlmCompleteInput,
  validationSlideCount: number | null
): Promise<OutlineGenerationResult> {
  const attempts: AiAttemptLog[] = [];
  let request = initialRequest;
  let lastValidationErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_OUTLINE_ATTEMPTS; attempt += 1) {
    try {
      const rawResult = await completeLlm(runtime, request);
      const rawText = extractCompletionText(rawResult);

      try {
        const parsed = parseOutlineJson(rawText);
        const outline = validateGeneratedOutline(parsed, validationSlideCount);
        attempts.push({
          operation,
          attempt,
          status: "success",
          llmRequest: request,
          llmRawResponse: rawResult,
          validation: {
            ok: true,
            errors: [],
          },
        });
        return { outline, attempts };
      } catch (error) {
        const errors =
          error instanceof OutlineValidationError
            ? error.errors
            : [error instanceof Error ? error.message : String(error)];
        lastValidationErrors = errors;
        attempts.push({
          operation,
          attempt,
          status: attempt < MAX_OUTLINE_ATTEMPTS ? "retry" : "error",
          llmRequest: request,
          llmRawResponse: rawResult,
          validation: {
            ok: false,
            errors,
          },
        });

        if (attempt < MAX_OUTLINE_ATTEMPTS) {
          request = buildOutlineRepairRequest(request, rawText, errors);
          continue;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({
        operation,
        attempt,
        status: "error",
        llmRequest: request,
        error: {
          message,
        },
      });

      throw new AiOutlineGenerationError(
        `Anna LLM request failed: ${message}`,
        attempts
      );
    }
  }

  throw new AiOutlineGenerationError(
    lastValidationErrors.length > 0
      ? `Anna LLM returned invalid outline JSON: ${lastValidationErrors.join("; ")}`
      : "Anna LLM failed to generate outline JSON.",
    attempts
  );
}

export function createAnnaAiClient(runtime: AnnaRuntime): AiClient {
  return {
    generateOutline(input) {
      return completeOutlineWithRetry(
        runtime,
        "generateOutline",
        buildGenerateOutlineLlmRequest(input),
        getExpectedSlideCount(input.setting, input.prompt, input.contextRows)
      );
    },

    async suggestContext(input) {
      const result = await completeJson<unknown>(
        runtime,
        "optional context suggestions",
        [
          "Infer optional context fields for a presentation from the user's prompt.",
          "Return only a JSON object with exactly these properties: audience, goal, style, theme, slides.",
          "audience, goal, style, and theme must be arrays of concise strings.",
          "slides must be a string: use a positive integer such as \"8\" when a concrete page count is reasonable, or \"auto\" when the count should be left open.",
          "For theme, choose only theme_id values from theme_catalog. Do not invent theme IDs.",
          "Prefer fewer options. If the prompt clearly determines a field, return a one-item array for that field.",
          "If an array field is ambiguous, return 2-3 plausible options. Do not return more than 4 items for any array field.",
          "Do not include markdown or explanation.",
          `theme_catalog: ${JSON.stringify(buildThemeCatalogForPrompt())}`,
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
        ].join("\n"),
        '{"audience":["..."],"goal":["..."],"style":["..."],"theme":["theme_id"],"slides":"auto"}'
      );

      return normalizeContextSuggestions(result);
    },

    async generatePagePlan(input) {
      let request = buildGeneratePagePlanLlmRequest(input);
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const rawResult = await completeLlm(runtime, request);
        const rawText = extractCompletionText(rawResult);

        try {
          return parsePagePlanJson(rawText);
        } catch (error) {
          if (attempt >= 2) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String(error);
          request = {
            ...request,
            messages: [
              ...request.messages,
              {
                role: "assistant",
                content: {
                  type: "text",
                  text: rawText
                }
              },
              {
                role: "user",
                content: {
                  type: "text",
                  text: buildPagePlanRepairPrompt([message])
                }
              }
            ]
          };
        }
      }

      throw new Error("Anna LLM returned invalid page plan JSON.");
    },

    async generateDeck(input) {
      return completeJson<GeneratedDeck>(
        runtime,
        "deck",
        [
          "Return a JSON object with title, outline, and slides fields.",
          "outline items must have title and outline.",
          "slides must have title and subtitle.",
          CONTENT_GROUNDING_RULES,
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
          `Context: ${JSON.stringify(input.contextRows)}`,
          `Setting: ${JSON.stringify(input.setting ?? {})}`
        ].join("\n"),
        '{"title":"...","outline":[{"title":"...","outline":"..."}],"slides":[{"title":"...","subtitle":"..."}]}'
      );
    },

    reviseOutline(input) {
      return completeOutlineWithRetry(
        runtime,
        "reviseOutline",
        buildReviseOutlineLlmRequest(input),
        getExpectedSlideCountForRevision(input.setting, input.feedback, input.contextRows)
      );
    },

    generateSlidesFromOutline(input) {
      return completeJson(
        runtime,
        "slides",
        [
          "Create slide summaries from this outline.",
          "Return only a JSON array. Each item must have title and subtitle.",
          CONTENT_GROUNDING_RULES,
          `Locale: ${input.locale}`,
          `Outline: ${JSON.stringify(input.outline)}`
        ].join("\n"),
        '[{"title":"...","subtitle":"..."}]'
      );
    },

    refineDeck(input) {
      return completeJson(
        runtime,
        "refined deck",
        [
          "Refine this deck. Return only a JSON array of slides.",
          "Each slide must have title and subtitle.",
          CONTENT_GROUNDING_RULES,
          "Do not add new factual claims during refinement unless they are already present in the provided slides.",
          `Locale: ${input.locale}`,
          `Slides: ${JSON.stringify(input.slides)}`
        ].join("\n"),
        '[{"title":"...","subtitle":"..."}]'
      );
    },

    refineSlide(input) {
      return completeJson(
        runtime,
        "refined slide",
        [
          "Refine this single slide. Return only a JSON object with title and subtitle.",
          CONTENT_GROUNDING_RULES,
          "Do not add new factual claims during refinement unless they are already present in the provided slide.",
          `Locale: ${input.locale}`,
          `Slide number: ${input.slideIndex + 1}`,
          `Slide: ${JSON.stringify(input.slide)}`
        ].join("\n"),
        '{"title":"...","subtitle":"..."}'
      );
    }
  };
}
