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
  buildEvidenceAwarePagePlanLlmRequest,
  buildResearchDiscoveryDecisionLlmRequest,
  parseEvidenceAwarePagePlanJson,
  parseResearchDiscoveryDecisionJson,
} from "./researchDiscoveryPrompt";
import {
  buildPageRefinementIntentReviewPrompt,
  normalizePageRefinementIntentReview,
} from "./pageRefinementIntentReview";
import {
  buildDeckRefinementIntentReviewLlmRequest,
  normalizeDeckRefinementIntentReview,
} from "./deckRefinementIntentReview";
import {
  OutlineValidationError,
  parseOutlineJson,
  validateGeneratedOutline,
} from "./outlineParser";
import {
  buildPresentationRequirementsRepairRequest,
  buildPresentationRequirementsRequest,
} from "./requirementsPrompt";
import {
  parsePresentationRequirementsCandidates,
  PresentationRequirementsValidationError,
} from "./requirementsParser";
import {
  buildStructuredJsonRepairPrompt,
  parseStructuredJson,
} from "./structuredJson";
import { CONTENT_GROUNDING_RULES } from "./groundingRules";
import type { AiOperationLogContext } from "./interactionLog";
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

export class AiPresentationRequirementsError extends Error {
  constructor(message: string, public readonly validationErrors: string[] = []) {
    super(message);
    this.name = "AiPresentationRequirementsError";
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
  input: AnnaLlmCompleteInput,
  logContext?: AiOperationLogContext
): Promise<unknown> {
  return completeLlmLogged(runtime, input, logContext);
}

async function completeLlmLogged(
  runtime: AnnaRuntime,
  input: AnnaLlmCompleteInput,
  logContext?: AiOperationLogContext
): Promise<unknown> {
  const handle = logContext?.logger
    ? await logContext.logger.startInteraction(logContext, { request: input })
    : null;

  try {
    const result =
      typeof runtime.call === "function"
        ? await runtime.call("llm", "complete", input, {
            timeoutMs: LLM_COMPLETE_TIMEOUT_MS,
          })
        : await runtime.llm.complete(input);
    await logContext?.logger?.finishInteraction(handle!, {
      status: "succeeded",
      response: result,
      output: extractCompletionText(result),
    });
    return result;
  } catch (error) {
    if (handle) {
      await logContext?.logger?.finishInteraction(handle, {
        status: "failed",
        error,
      });
    }
    throw error;
  }
}

async function completeJson<T>(
  runtime: AnnaRuntime,
  label: string,
  prompt: string,
  expectedShape: string,
  logContext?: AiOperationLogContext
): Promise<T> {
  return completeJsonRequest<T>(
    runtime,
    label,
    {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: prompt
          }
        }
      ]
    },
    expectedShape,
    logContext,
  );
}

async function completeJsonRequest<T>(
  runtime: AnnaRuntime,
  label: string,
  initialRequest: AnnaLlmCompleteInput,
  expectedShape: string,
  logContext?: AiOperationLogContext
): Promise<T> {
  let request: AnnaLlmCompleteInput = {
    ...initialRequest,
    messages: [
      ...initialRequest.messages
    ]
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await completeLlm(runtime, request, logContext);
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

async function completePresentationRequirementsWithRetry(
  runtime: AnnaRuntime,
  brief: string,
  logContext?: AiOperationLogContext,
) {
  let request = buildPresentationRequirementsRequest(brief);
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const rawResult = await completeLlm(runtime, request, logContext);
    const rawText = extractCompletionText(rawResult);
    try {
      return parsePresentationRequirementsCandidates(rawText);
    } catch (error) {
      lastErrors = error instanceof PresentationRequirementsValidationError
        ? error.errors
        : [error instanceof Error ? error.message : String(error)];
      if (attempt < 2) {
        request = buildPresentationRequirementsRepairRequest(request, rawText, lastErrors);
      }
    }
  }

  throw new AiPresentationRequirementsError(
    `Anna LLM returned invalid Presentation Requirements JSON: ${lastErrors.join("; ")}`,
    lastErrors,
  );
}

function buildThemeTokenPrompt(input: Parameters<AiClient["generateThemeToken"]>[0]) {
  const isRefinement = Boolean(input.refinementRequest?.trim());
  const userInput = {
    locale: input.locale,
    run_kind: isRefinement ? "deck-refinement" : "deck-generation",
    brief: input.prompt,
    context_rows: input.contextRows,
    refinement_request: input.refinementRequest ?? "",
    current_token: isRefinement ? input.currentToken ?? null : null,
    previous_invalid_response: input.previousResponse ?? null,
    validation_errors: input.validationErrors ?? [],
    template_theme_contract: {
      schema_path: input.themeContext.schema_path,
      default_token_path: input.themeContext.default_token_path,
      readme_path: input.themeContext.readme_path,
      schema: input.themeContext.schema,
      default_token: input.themeContext.default_token,
      readme: input.themeContext.readme,
    },
    selected_style_profile: input.selectedStyleProfile
      ? {
          display_name: input.selectedStyleProfile.displayName ?? "",
          profile_path: input.selectedStyleProfile.profilePath,
          markdown: input.selectedStyleProfile.content,
        }
      : null,
  };

  return [
    "Generate a complete Workspace Theme Token JSON object for the selected presentation Template.",
    "Return only the bare JSON object. Do not include markdown, code fences, comments, explanations, rationale, patches, or an envelope.",
    "The output must be a full replacement token that satisfies the provided JSON Schema.",
    "Use the template README and default token as the baseline. Preserve the template's intended visual system unless the user clearly asks for a different whole-deck style.",
    "Do not invent schema keys. Do not omit required keys. Do not use values outside enum/const/pattern requirements.",
    isRefinement
      ? "For Deck Refinement, use current_token as the baseline and apply only the requested whole-deck theme/style change."
      : "For initial Deck Generation, use the brief and context rows to infer theme intent.",
    "Contrast requirements are hard requirements.",
    "Style priority: template theme contract/schema/contrast requirements > explicit user or workspace style intent > Selected Style Profile > template default token baseline.",
    "When selected_style_profile is present, use it as visual style guidance only: colors, contrast, typography tone, hierarchy, spacing, layout rhythm, graphic language, and chart/image treatment.",
    "Selected Style Profile is not factual evidence. Do not use it for claims, numbers, dates, source names, chart data, or business conclusions.",
    "Before returning the token, self-check key foreground/background pairs for readable contrast.",
    "If the user asks for black backgrounds with white/orange text, do not set any token used as foreground on dark backgrounds to black or near-black.",
    "Do not use Uploaded Source Analysis, web research, component source code, or fixed theme IDs.",
    "",
    "Input JSON:",
    JSON.stringify(userInput, null, 2),
  ].join("\n");
}

async function completeOutlineWithRetry(
  runtime: AnnaRuntime,
  operation: "generateOutline" | "reviseOutline",
  initialRequest: AnnaLlmCompleteInput,
  validationSlideCount: number | null,
  logContext?: AiOperationLogContext
): Promise<OutlineGenerationResult> {
  const attempts: AiAttemptLog[] = [];
  let request = initialRequest;
  let lastValidationErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_OUTLINE_ATTEMPTS; attempt += 1) {
    try {
      const rawResult = await completeLlm(runtime, request, logContext);
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
    generatePresentationRequirements(input) {
      return completePresentationRequirementsWithRetry(
        runtime,
        input.brief,
        input.logContext,
      );
    },

    generateOutline(input) {
      return completeOutlineWithRetry(
        runtime,
        "generateOutline",
        buildGenerateOutlineLlmRequest(input),
        getExpectedSlideCount(input.setting, input.prompt, input.contextRows),
        input.logContext
      );
    },

    async detectOutputLanguage(input) {
      const result = await completeJson<unknown>(
        runtime,
        "output language",
        [
          "Decide the content language for a presentation.",
          "Return only one JSON object with exactly one property: output_language.",
          "Use the user's brief, optional context rows, current outline, and workspace setting.",
          "If workspace output_language is a concrete language and not auto, return that exact value.",
          "If workspace output_language is auto or missing, infer the best content language from the brief and outline.",
          "Do not rewrite the outline. Do not include markdown or explanation.",
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
          `Context: ${JSON.stringify(input.contextRows)}`,
          `Setting: ${JSON.stringify(input.setting ?? {})}`,
          `Outline title: ${input.title ?? ""}`,
          `Outline items: ${JSON.stringify(input.outline ?? [])}`,
        ].join("\n"),
        '{"output_language":"中文"}',
        input.logContext
      );
      const record =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : {};
      const outputLanguage =
        typeof record.output_language === "string"
          ? record.output_language.trim()
          : "";
      return { output_language: outputLanguage || "auto" };
    },

    async generateThemeToken(input) {
      const result = await completeJsonRequest<unknown>(
        runtime,
        "workspace theme token",
        {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: buildThemeTokenPrompt(input),
              },
            },
          ],
        },
        JSON.stringify(input.themeContext.default_token),
        input.logContext,
      );
      return result;
    },

    async generatePagePlan(input) {
      let request = buildGeneratePagePlanLlmRequest(input);
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const rawResult = await completeLlm(runtime, request, input.logContext);
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

    async generateAddedPagePlan(input) {
      const outline = {
        ...input.baseOutline,
        items: input.outlineItems,
      };
      let request = buildGeneratePagePlanLlmRequest({
        outline,
        planningContext: input.planningContext,
        locale: input.locale,
      });
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const rawResult = await completeLlm(runtime, request, input.logContext);
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

      throw new Error("Anna LLM returned invalid added-page plan JSON.");
    },

    async generateResearchDiscoveryDecision(input) {
      const request = buildResearchDiscoveryDecisionLlmRequest(input);
      const rawResult = await completeLlm(runtime, request, input.logContext);
      const rawText = extractCompletionText(rawResult);
      return parseResearchDiscoveryDecisionJson(rawText, input.phase);
    },

    async generateEvidenceAwarePagePlan(input) {
      const request = buildEvidenceAwarePagePlanLlmRequest(input);
      const rawResult = await completeLlm(runtime, request, input.logContext);
      const rawText = extractCompletionText(rawResult);
      return parseEvidenceAwarePagePlanJson(rawText, input.pagePlan, input.targetPageIds);
    },

    async reviewPageRefinementIntent(input) {
      const result = await completeJson<unknown>(
        runtime,
        "page refinement intent review",
        buildPageRefinementIntentReviewPrompt(input),
        '{"route":"proceed","blocking_reason":"","outline_change_required":false,"additional_research_required":false,"additional_web_query_intents":[],"additional_image_query_intents":[],"evidence_needs":[],"visual_needs":[],"reason":"..."}',
        input.logContext,
      );
      return normalizePageRefinementIntentReview(result);
    },

    async reviewDeckRefinementIntent(input) {
      const result = await completeJsonRequest<unknown>(
        runtime,
        "deck refinement intent review",
        buildDeckRefinementIntentReviewLlmRequest(input),
        '{"route":"proceed","blocking_reason":"","output_language_change":{"changed":false,"output_language":"","reason":""},"theme_change_required":false,"theme_change_reason":"","operations":[{"op":"keep","page_id":"page-01","reason":""}],"reason":"..."}',
        input.logContext,
      );
      return normalizeDeckRefinementIntentReview(result);
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
        '{"title":"...","outline":[{"title":"...","outline":"..."}],"slides":[{"title":"...","subtitle":"..."}]}',
        input.logContext
      );
    },

    reviseOutline(input) {
      return completeOutlineWithRetry(
        runtime,
        "reviseOutline",
        buildReviseOutlineLlmRequest(input),
        getExpectedSlideCountForRevision(input.setting, input.feedback, input.contextRows),
        input.logContext
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
        '[{"title":"...","subtitle":"..."}]',
        input.logContext
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
        '[{"title":"...","subtitle":"..."}]',
        input.logContext
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
        '{"title":"...","subtitle":"..."}',
        input.logContext
      );
    }
  };
}
