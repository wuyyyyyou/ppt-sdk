import { CONTENT_GROUNDING_RULES } from "./groundingRules";

export type PromptLanguage = "zh" | "en";

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
      `页数上下文：contextRows.slides = ${input.slideCountContext}。`,
      "页数优先级：必须完全按照用户简报里的页数意图来；只有当用户简报没有表达页数相关要求时，才参考 contextRows.slides；如果 contextRows.slides 为 auto 或缺失，则根据内容选择合理页数。",
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
    `Slide count context: contextRows.slides = ${input.slideCountContext}.`,
    "Slide count priority: follow the page-count intent in the user brief exactly; only consult contextRows.slides when the user brief does not express any page-count requirement; if contextRows.slides is auto or missing, choose a reasonable count based on the content.",
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
      `页数上下文：contextRows.slides = ${input.slideCountContext}。`,
      "页数优先级：必须完全按照最高优先级修改反馈里的页数意图来；只有当修改反馈没有表达页数相关要求时，才参考 contextRows.slides；如果 contextRows.slides 为 auto 或缺失，则根据当前大纲和反馈选择合理页数。",
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
