import { CONTENT_GROUNDING_RULES } from "./groundingRules";

interface GenerateOutlinePromptMessageInput {
  confirmedRequirementsJson: string;
  uploadedSourceAnalysisContextJson: string;
}

interface ReviseOutlinePromptMessageInput {
  confirmedRequirementsJson: string;
  uploadedSourceAnalysisContextJson: string;
  title?: string;
  feedback: string;
  outlineJson: string;
}

const OUTLINE_JSON_SHAPE =
  '{"title":"...","items":[{"title":"...","core_message":"...","required_content":["...","..."]}]}';

const OUTLINE_OUTPUT_REQUIREMENTS = [
  "- Return one valid JSON object only.",
  "- title must be the presentation title.",
  "- items must be the page outline array.",
  "- Every page item must contain only title, core_message, and required_content.",
  "- title and core_message must each be one non-empty line.",
  "- required_content must be a non-empty array of non-empty single-line content requirements; do not include Markdown bullet prefixes.",
  "- Use the confirmed output_language for all generated title, core_message, and required_content text.",
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
    "Each item must contain only title, core_message, and required_content.",
    "core_message is the single idea the audience should remember from that page.",
    "required_content is a JSON array of concrete content requirements that the page must cover.",
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
    `Confirmed Presentation Requirements input: ${input.confirmedRequirementsJson}`,
    "Treat confirmed selections as authoritative over conflicting wording in the source brief.",
    "Use the confirmed slide_count as the initial planning intent, but choose the page count that produces the strongest coherent outline.",
    `Uploaded Source Analysis context: ${input.uploadedSourceAnalysisContextJson}`,
    "Uploaded Source Analysis rules:",
    "- If this context is not null, treat it as high-priority user-provided source material for outline strategy.",
    "- Use uploaded-source facts and source summaries before external assumptions.",
    "- Respect gaps and continuation decisions; do not invent facts to fill gaps.",
    "- Do not mention raw uploaded file paths in the outline.",
    "Output requirements:",
    ...OUTLINE_OUTPUT_REQUIREMENTS,
  ].join("\n");
}

export function buildReviseOutlineUserPrompt(
  input: ReviseOutlinePromptMessageInput
): string {
  return [
    "Revise the existing presentation outline according to the feedback.",
    "Use the feedback, current outline, and Confirmed Presentation Requirements together; resolve any tension as a senior presentation strategist.",
    "Preservation rule: keep the current presentation title, slide count, page order, and every outline item unchanged unless the feedback explicitly asks to change them.",
    "Only edit the specific pages, fields, structure, or page count requested by the feedback; copy all unrelated values from the current outline.",
    `Confirmed Presentation Requirements input: ${input.confirmedRequirementsJson}`,
    `Uploaded Source Analysis context: ${input.uploadedSourceAnalysisContextJson}`,
    `Current presentation title: ${input.title || ""}`,
    `Highest-priority feedback: ${input.feedback}`,
    `Current outline items: ${input.outlineJson}`,
    "Uploaded Source Analysis rules:",
    "- If this context is not null, keep revised outline grounded in the current uploaded-source facts and source summaries.",
    "- Respect gaps and continuation decisions; do not invent facts to fill gaps.",
    "- Do not mention raw uploaded file paths in the outline.",
    "Output requirements:",
    "- Return one valid JSON object only.",
    "- title must be the presentation title.",
    "- items must be the revised page outline array.",
    "- Every page item must contain only title, core_message, and required_content.",
    "- title and core_message must each be one non-empty line.",
    "- required_content must be a non-empty array of non-empty single-line content requirements without Markdown bullet prefixes.",
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
