import type { AnnaLlmCompleteInput, AnnaRuntime } from "../runtime/annaRuntime";
import {
  buildGenerateOutlineLlmRequest,
  buildOutlineRepairRequest,
  buildReviseOutlineLlmRequest,
  getExpectedSlideCount,
} from "./outlinePrompt";
import {
  buildGeneratePagePlanLlmRequest,
  parsePagePlanJson,
} from "./pagePlanPrompt";
import {
  OutlineValidationError,
  parseOutlineJson,
  validateGeneratedOutline,
} from "./outlineParser";
import type {
  AiAttemptLog,
  AiClient,
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
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Anna LLM returned invalid JSON for ${label}.`);
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
  maxTokens = 1400
): Promise<T> {
  const result = await completeLlm(runtime, {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: prompt
        }
      }
    ],
    maxTokens
  });

  return parseJsonResult<T>(extractCompletionText(result), label);
}

async function completeOutlineWithRetry(
  runtime: AnnaRuntime,
  operation: "generateOutline" | "reviseOutline",
  initialRequest: AnnaLlmCompleteInput,
  expectedSlideCount: number | null
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
        const outline = validateGeneratedOutline(parsed, expectedSlideCount);
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
        getExpectedSlideCount(input.setting, input.prompt)
      );
    },

    async generatePagePlan(input) {
      const rawResult = await completeLlm(
        runtime,
        buildGeneratePagePlanLlmRequest(input)
      );
      return parsePagePlanJson(extractCompletionText(rawResult));
    },

    async generateDeck(input) {
      return completeJson<GeneratedDeck>(
        runtime,
        "deck",
        [
          "Return a JSON object with title, outline, and slides fields.",
          "outline items must have title and outline.",
          "slides must have title and subtitle.",
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
          `Context: ${JSON.stringify(input.contextRows)}`,
          `Setting: ${JSON.stringify(input.setting ?? {})}`
        ].join("\n"),
        2200
      );
    },

    reviseOutline(input) {
      return completeOutlineWithRetry(
        runtime,
        "reviseOutline",
        buildReviseOutlineLlmRequest(input),
        getExpectedSlideCount(input.setting, input.feedback)
      );
    },

    generateSlidesFromOutline(input) {
      return completeJson(
        runtime,
        "slides",
        [
          "Create slide summaries from this outline.",
          "Return only a JSON array. Each item must have title and subtitle.",
          `Locale: ${input.locale}`,
          `Outline: ${JSON.stringify(input.outline)}`
        ].join("\n")
      );
    },

    refineDeck(input) {
      return completeJson(
        runtime,
        "refined deck",
        [
          "Refine this deck. Return only a JSON array of slides.",
          "Each slide must have title and subtitle.",
          `Locale: ${input.locale}`,
          `Slides: ${JSON.stringify(input.slides)}`
        ].join("\n")
      );
    },

    refineSlide(input) {
      return completeJson(
        runtime,
        "refined slide",
        [
          "Refine this single slide. Return only a JSON object with title and subtitle.",
          `Locale: ${input.locale}`,
          `Slide number: ${input.slideIndex + 1}`,
          `Slide: ${JSON.stringify(input.slide)}`
        ].join("\n")
      );
    }
  };
}
