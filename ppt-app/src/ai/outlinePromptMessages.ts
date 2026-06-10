import { CONTENT_GROUNDING_RULES } from "./groundingRules";

interface GenerateOutlinePromptMessageInput {
  slideCountContext: string;
  locale: string;
  settingSummaryJson: string;
  prompt: string;
  contextRowsJson: string;
}

interface ReviseOutlinePromptMessageInput {
  slideCountContext: string;
  locale: string;
  settingSummaryJson: string;
  contextRowsJson: string;
  title?: string;
  feedback: string;
  outlineJson: string;
}

const OUTLINE_JSON_SHAPE =
  '{"title":"...","output_language":"...","items":[{"title":"...","outline":"..."}]}';

const OUTLINE_OUTPUT_REQUIREMENTS = [
  "- Return one valid JSON object only.",
  "- title must be the presentation title.",
  "- output_language must be the final content language; if workspace output_language is auto or missing, infer it from the user brief and additional context.",
  "- items must be the page outline array.",
  "- Every page item must have title and outline.",
  "- If workspace output_language is not auto, title and outline content language must follow that value.",
] as const;

const OUTLINE_STORYLINE_RULES = [
  "Build the outline as a coherent deck-level storyline, not a loose list of independent topics.",
  "Use the audience, goal, and central thesis implied by the brief and context.",
  "Choose a logical narrative arc appropriate to the content type; do not force a fixed structure.",
  "Give the deck an appropriate opening-body-closing movement: the opening should orient the audience to the deck-level topic, context, goal, and central thesis before diving into detailed examples or item-by-item descriptions; the body should develop the key points; the closing should synthesize the takeaway, recommendation, or next action.",
  "When the requested page count is small, fold opening and closing functions into the available pages instead of adding extra pages.",
  "For short decks, the first page should combine orientation with the first substantive point instead of becoming a generic cover or a narrow detail page.",
  "Each page must have one clear purpose and must advance the storyline.",
  "Prefer message-driven page titles that communicate the page's main point, not generic section labels.",
  "Ensure adjacent pages have a clear progression, such as context -> problem -> insight -> approach -> value -> next action when appropriate.",
  "Avoid redundant pages, filler pages, and unsupported claims.",
  "Keep the outline proportional to the available information and the user's page-count intent.",
] as const;

export function buildOutlineSystemPrompt(): string {
  return [
    "You are a senior presentation strategist.",
    "Generate structured presentation outlines that can be parsed by JSON.parse.",
    "Return JSON only. Do not include markdown, code fences, comments, explanations, or extra text.",
    `The JSON shape must be exactly: ${OUTLINE_JSON_SHAPE}.`,
    "Each item represents one slide/page.",
    "Each item must contain only title and outline.",
    "outline must be one concise natural-language paragraph, not an array and not a bullet list.",
    "The outline must satisfy these storyline quality rules:",
    ...OUTLINE_STORYLINE_RULES,
    "Do not add cover, agenda, appendix, or thank-you slides unless the user explicitly requests them.",
    CONTENT_GROUNDING_RULES,
  ].join("\n");
}

export function buildGenerateOutlineUserPrompt(
  input: GenerateOutlinePromptMessageInput
): string {
  return [
    "Create a presentation outline from the user brief.",
    `Slide count context: contextRows.slides = ${input.slideCountContext}.`,
    "Slide count priority: follow the page-count intent in the user brief exactly; only consult contextRows.slides when the user brief does not express any page-count requirement; if contextRows.slides is auto or missing, choose a reasonable count based on the content.",
    `Locale: ${input.locale}`,
    `Relevant workspace setting: ${input.settingSummaryJson}`,
    `User brief: ${input.prompt}`,
    `Additional context rows: ${input.contextRowsJson}`,
    "Output requirements:",
    ...OUTLINE_OUTPUT_REQUIREMENTS,
  ].join("\n");
}

export function buildReviseOutlineUserPrompt(
  input: ReviseOutlinePromptMessageInput
): string {
  return [
    "Revise the existing presentation outline according to the feedback.",
    "Priority rule: feedback overrides only the parts it explicitly mentions; for anything not mentioned, strictly follow the lower-priority workspace settings and optional context rows.",
    `Slide count context: contextRows.slides = ${input.slideCountContext}.`,
    "Slide count priority: follow the page-count intent in the highest-priority feedback exactly; only consult contextRows.slides when the feedback does not express any page-count requirement; if contextRows.slides is auto or missing, choose a reasonable count based on the current outline and feedback.",
    `Locale: ${input.locale}`,
    `Lower-priority workspace setting: ${input.settingSummaryJson}`,
    `Optional context rows: ${input.contextRowsJson}`,
    `Current presentation title: ${input.title || ""}`,
    `Highest-priority feedback: ${input.feedback}`,
    `Current outline items: ${input.outlineJson}`,
    "Output requirements:",
    "- Return one valid JSON object only.",
    "- title must be the presentation title.",
    "- output_language must be the final content language; if feedback specifies language, use that language; otherwise keep or infer workspace output_language.",
    "- items must be the revised page outline array.",
    "- Every page item must have title and outline.",
    "- If the feedback specifies language, slide count, content inclusion/exclusion, or structure, follow the feedback first.",
    "- For audience, goal, style, content source, language, and slide count not specified in the feedback, strictly follow workspace settings and optional context rows.",
    "- If workspace output_language is auto or missing, infer the content language from the user brief, current outline, and optional context rows.",
  ].join("\n");
}

export function buildOutlineRepairPrompt(
  errors: string[]
): string {
  return [
    "The previous response was invalid.",
    "Validation errors:",
    ...errors.map((error) => `- ${error}`),
    "Return a corrected JSON object only. Do not include markdown or any explanation.",
  ].join("\n");
}
