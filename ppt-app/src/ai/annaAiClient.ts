import type { AnnaRuntime } from "../runtime/annaRuntime";
import type { AiClient, GeneratedDeck } from "./types";

interface AnnaCompletionContent {
  type?: string;
  text?: string;
}

interface AnnaCompletionResult {
  content?: AnnaCompletionContent;
}

function extractCompletionText(result: unknown): string {
  const content = (result as AnnaCompletionResult | null)?.content;
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

async function completeJson<T>(
  runtime: AnnaRuntime,
  label: string,
  prompt: string,
  maxTokens = 1400
): Promise<T> {
  const result = await runtime.llm.complete({
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

export function createAnnaAiClient(runtime: AnnaRuntime): AiClient {
  return {
    generateOutline(input) {
      return completeJson(
        runtime,
        "outline",
        [
          "Return a JSON array of presentation outline items.",
          "Each item must have title, summary, and bullets fields.",
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
          `Context: ${JSON.stringify(input.contextRows)}`
        ].join("\n")
      );
    },

    async generateDeck(input) {
      return completeJson<GeneratedDeck>(
        runtime,
        "deck",
        [
          "Return a JSON object with title, outline, and slides fields.",
          "outline items must have title, summary, bullets.",
          "slides must have title and subtitle.",
          `Locale: ${input.locale}`,
          `Prompt: ${input.prompt}`,
          `Context: ${JSON.stringify(input.contextRows)}`
        ].join("\n"),
        2200
      );
    },

    reviseOutline(input) {
      return completeJson(
        runtime,
        "revised outline",
        [
          "Revise this presentation outline according to the feedback.",
          "Return only a JSON array of outline items with title, summary, bullets.",
          `Locale: ${input.locale}`,
          `Feedback: ${input.feedback}`,
          `Outline: ${JSON.stringify(input.outline)}`
        ].join("\n")
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
