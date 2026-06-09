import { CONTENT_GROUNDING_RULES } from "./groundingRules";

export type PromptLanguage = "zh" | "en";

interface GenerateOutlinePromptMessageInput {
  expectedSlideCount: number | null;
  locale: string;
  settingSummaryJson: string;
  prompt: string;
  contextRowsJson: string;
}

interface ReviseOutlinePromptMessageInput {
  expectedSlideCount: number | null;
  locale: string;
  settingSummaryJson: string;
  contextRowsJson: string;
  title?: string;
  feedback: string;
  outlineJson: string;
}

export function buildOutlineSystemPrompt(language: PromptLanguage): string {
  if (language === "zh") {
    return [
      "你是一名资深演示文稿策划专家。",
      "请生成可以被 JSON.parse 直接解析的结构化演示大纲。",
      "只返回 JSON。不要输出 Markdown、代码块、注释、解释或任何额外文字。",
      'JSON 结构必须严格为：{"title":"...","items":[{"title":"...","outline":"..."}]}。',
      "每个 items 元素代表一页幻灯片/页面。",
      "每个页面元素只能包含 title 和 outline 两个字段。",
      "outline 必须是一段简洁的自然语言说明，不要使用数组，也不要写成 bullet list。",
      "除非用户明确要求，不要添加封面页、目录页、附录页或感谢页。",
      CONTENT_GROUNDING_RULES,
    ].join("\n");
  }

  return [
    "You are a senior presentation strategist.",
    "Generate structured presentation outlines that can be parsed by JSON.parse.",
    "Return JSON only. Do not include markdown, code fences, comments, explanations, or extra text.",
    'The JSON shape must be exactly: {"title":"...","items":[{"title":"...","outline":"..."}]}.',
    "Each item represents one slide/page.",
    "Each item must contain only title and outline.",
    "outline must be one concise natural-language paragraph, not an array and not a bullet list.",
    "Do not add cover, agenda, appendix, or thank-you slides unless the user explicitly requests them.",
    CONTENT_GROUNDING_RULES,
  ].join("\n");
}

export function buildGenerateOutlineUserPrompt(
  language: PromptLanguage,
  input: GenerateOutlinePromptMessageInput
): string {
  if (language === "zh") {
    return [
      "请根据用户简报创建一份演示文稿大纲。",
      input.expectedSlideCount === null
        ? "页数要求：如果用户简报明确要求页数，必须遵循；否则根据内容选择合理页数，范围为 3 到 15 页。"
        : `页数要求：items 中必须严格返回 ${input.expectedSlideCount} 页。`,
      `界面语言：${input.locale}`,
      `相关工作区配置：${input.settingSummaryJson}`,
      `用户简报：${input.prompt}`,
      `补充上下文行：${input.contextRowsJson}`,
      "输出要求：",
      "- 只返回一个合法 JSON 对象。",
      "- title 必须是演示文稿标题。",
      "- items 必须是每一页的大纲数组。",
      "- 每个页面 item 都必须包含 title 和 outline。",
      "- title 和 outline 的内容语言必须遵循工作区配置中的 output_language / language。",
    ].join("\n");
  }

  return [
    "Create a presentation outline from the user brief.",
    input.expectedSlideCount === null
      ? "Slide count: if the user brief explicitly asks for a count, follow it; otherwise choose a reasonable count between 3 and 15 pages."
      : `Slide count: return exactly ${input.expectedSlideCount} pages in items.`,
    `Locale: ${input.locale}`,
    `Relevant workspace setting: ${input.settingSummaryJson}`,
    `User brief: ${input.prompt}`,
    `Additional context rows: ${input.contextRowsJson}`,
    "Output requirements:",
    "- Return one valid JSON object only.",
    "- title must be the presentation title.",
    "- items must be the page outline array.",
    "- Every page item must have title and outline.",
    "- The title and outline content language must follow output_language / language in the workspace setting.",
  ].join("\n");
}

export function buildReviseOutlineUserPrompt(
  language: PromptLanguage,
  input: ReviseOutlinePromptMessageInput
): string {
  if (language === "zh") {
    return [
      "请根据反馈修改现有演示文稿大纲。",
      "优先级规则：修改反馈只覆盖它明确提到的部分；反馈未提及的部分必须严格遵循低优先级工作区配置和可选上下文行，不要自行覆盖或忽略。",
      input.expectedSlideCount === null
        ? "页数要求：如果修改反馈明确要求页数，必须遵循；否则严格参考可选上下文行里的页数；仍未指定时保持合理页数，范围为 3 到 15 页。"
        : `页数要求：items 中必须严格返回 ${input.expectedSlideCount} 页。`,
      `界面语言：${input.locale}`,
      `低优先级工作区配置：${input.settingSummaryJson}`,
      `可选上下文行：${input.contextRowsJson}`,
      `当前演示文稿标题：${input.title || ""}`,
      `最高优先级修改反馈：${input.feedback}`,
      `当前大纲 items：${input.outlineJson}`,
      "输出要求：",
      "- 只返回一个合法 JSON 对象。",
      "- title 必须是演示文稿标题。",
      "- items 必须是修改后的每一页大纲数组。",
      "- 每个页面 item 都必须包含 title 和 outline。",
      "- 如果修改反馈指定了语言、页数、内容取舍或结构，必须优先遵循修改反馈。",
      "- 修改反馈没有指定的受众、目标、风格、内容来源、语言和页数，必须严格遵循工作区配置和可选上下文行。",
      "- 只有当修改反馈没有指定语言时，title 和 outline 的内容语言才遵循工作区配置中的 output_language / language。",
    ].join("\n");
  }

  return [
    "Revise the existing presentation outline according to the feedback.",
    "Priority rule: feedback overrides only the parts it explicitly mentions; for anything not mentioned, strictly follow the lower-priority workspace settings and optional context rows.",
    input.expectedSlideCount === null
      ? "Slide count: if the feedback explicitly asks for a count, follow it; otherwise strictly consult the optional context slide-count row; if still unspecified, keep a reasonable count between 3 and 15 pages."
      : `Slide count: return exactly ${input.expectedSlideCount} pages in items.`,
    `Locale: ${input.locale}`,
    `Lower-priority workspace setting: ${input.settingSummaryJson}`,
    `Optional context rows: ${input.contextRowsJson}`,
    `Current presentation title: ${input.title || ""}`,
    `Highest-priority feedback: ${input.feedback}`,
    `Current outline items: ${input.outlineJson}`,
    "Output requirements:",
    "- Return one valid JSON object only.",
    "- title must be the presentation title.",
    "- items must be the revised page outline array.",
    "- Every page item must have title and outline.",
    "- If the feedback specifies language, slide count, content inclusion/exclusion, or structure, follow the feedback first.",
    "- For audience, goal, style, content source, language, and slide count not specified in the feedback, strictly follow workspace settings and optional context rows.",
    "- Only when the feedback does not specify language should title and outline language follow output_language / language in the workspace setting.",
  ].join("\n");
}

export function buildOutlineRepairPrompt(
  language: PromptLanguage,
  errors: string[]
): string {
  if (language === "zh") {
    return [
      "上一次回复无效。",
      "校验错误：",
      ...errors.map((error) => `- ${error}`),
      "请只返回修正后的 JSON 对象。不要输出 Markdown 或任何解释。",
    ].join("\n");
  }

  return [
    "The previous response was invalid.",
    "Validation errors:",
    ...errors.map((error) => `- ${error}`),
    "Return a corrected JSON object only. Do not include markdown or any explanation.",
  ].join("\n");
}
