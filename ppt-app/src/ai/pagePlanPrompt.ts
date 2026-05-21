import type { PagePlan, TemplatePlanningContext, WorkspaceOutline } from "../api/types";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { Locale } from "../i18n/messages";

function readOutputLanguage(outline: WorkspaceOutline, locale: Locale) {
  const setting = outline.source?.setting ?? {};
  const outputLanguage = setting.output_language;
  const language = setting.language;

  if (typeof outputLanguage === "string" && outputLanguage.trim()) {
    return outputLanguage.trim();
  }

  if (typeof language === "string" && language.trim()) {
    return language.trim();
  }

  return locale === "zh" ? "中文" : "English";
}

export function buildGeneratePagePlanLlmRequest(input: {
  outline: WorkspaceOutline;
  planningContext: TemplatePlanningContext;
  locale: Locale;
}): AnnaLlmCompleteInput {
  const blueprints = input.planningContext.blueprints.map((blueprint) => ({
    id: blueprint.id,
    name: blueprint.name,
    blueprint_source: blueprint.blueprint_source,
    layout_family: blueprint.layout_family,
    content_intents: blueprint.content_intents,
    suitable_for: blueprint.suitable_for,
    avoid_for: blueprint.avoid_for,
  }));

  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a presentation page planning assistant.",
            "Return JSON only. No markdown, code fences, comments, or explanations.",
            "Choose one blueprint_id for every outline item from the provided blueprint list.",
            "Do not invent blueprint ids.",
            "The JSON must be parseable by JSON.parse.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Create a page plan for this deck.",
            `Output content language: ${readOutputLanguage(input.outline, input.locale)}`,
            `Template group: ${input.planningContext.template_group}`,
            `Template manifest path: ${input.planningContext.manifest_path}`,
            `Blueprints: ${JSON.stringify(blueprints)}`,
            `Outline: ${JSON.stringify(input.outline)}`,
            "Return exactly this JSON shape:",
            '{"version":1,"status":"planned","title":"...","source":{"outline_updated_at":null,"template_group":"...","template_manifest_path":"...","generated_by":"llm.complete"},"pages":[{"page_id":"page-01","index":0,"title":"...","outline":"...","blueprint_id":"...","blueprint_source":"./blueprints/Name.tsx","slide_path":"./slides/page-01-short-name.tsx","data_path":"./data/page-01-short-name.json","manifest_slide_id":"page-01-short-name","reason":"..."}],"updated_at":"..."}',
            "Rules:",
            "- pages length must equal outline.items length.",
            "- indexes must be zero-based and continuous.",
            "- page_id format should be page-01, page-02, ...",
            "- slide_path must be ./slides/page-XX-kebab.tsx.",
            "- data_path must be ./data/page-XX-kebab.json.",
            "- manifest_slide_id must be unique.",
            "- blueprint_source must match the selected blueprint exactly.",
            "- Use first page cover and last page closing only when they fit the outline; do not force them.",
          ].join("\n"),
        },
      },
    ],
    maxTokens: 2600,
  };
}

export function parsePagePlanJson(text: string): PagePlan {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    throw new Error("Anna LLM returned no page plan JSON.");
  }

  const parsed = JSON.parse(jsonText) as PagePlan;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pages)) {
    throw new Error("Anna LLM returned invalid page plan JSON.");
  }

  return parsed;
}
