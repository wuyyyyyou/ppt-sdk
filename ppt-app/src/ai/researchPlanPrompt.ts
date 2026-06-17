import type { PagePlan, ResearchPlan, WorkspaceOutline } from "../api/types";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { Locale } from "../i18n/messages";
import { parseStructuredJson } from "./structuredJson";
import { readOutlineOutputLanguage } from "./outputLanguage";

export function buildGenerateResearchPlanLlmRequest(input: {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  locale: Locale;
}): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a presentation research planning assistant.",
            "Return JSON only. No markdown, code fences, comments, or explanations.",
            "Decide which pages need external Research Evidence before authoring.",
            "Research Planning plans evidence needs only. Do not modify the Outline or Page Plan.",
            "Do not enable research just to make a page richer.",
            "Enable web research only when a page needs real-world facts, current information, source-backed data, citations, rankings, market/company/regulatory claims, or named cases.",
            "Enable image research only when a page needs non-template visual assets such as real photos, product images, logos, people, places, or specific scene imagery.",
            "Search query language should follow the Brief and output language. Put geography in query text when needed. Do not plan provider region parameters.",
            "Use time-sensitive query intent only when the Brief or page intent asks for latest, recent, current, this year, or date-specific information.",
            "If evidence is missing later, Page Generation will continue with generalized or TBD content.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Create a Research Plan for this deck.",
            `Output content language: ${readOutlineOutputLanguage(input.outline)}`,
            `Locale: ${input.locale}`,
            `Outline: ${JSON.stringify(input.outline)}`,
            `Page Plan: ${JSON.stringify(input.pagePlan)}`,
            "Return exactly this JSON shape:",
            '{"version":1,"status":"planned","title":"...","source":{"outline_updated_at":null,"page_plan_updated_at":null,"template_group":"...","generated_by":"llm.complete"},"pages":[{"page_id":"page-01","index":0,"title":"...","web_research_needed":false,"image_research_needed":false,"query_intents":[],"image_query_intents":[],"evidence_needs":[],"visual_needs":[],"gap_strategy":"Generalize unsupported concrete details or mark data slots as TBD / 待补充.","reason":"..."}],"shared":{"web_research_needed":false,"image_research_needed":false,"query_intents":[]},"updated_at":"..."}',
            "Rules:",
            "- pages length must equal Page Plan pages length.",
            "- Each page_id, index, and title must match the Page Plan exactly.",
            "- web_research_needed and image_research_needed are independent booleans.",
            "- query_intents and image_query_intents must be concise natural-language search intents, not long prompts.",
            "- Prefer 0-3 query_intents and 0-2 image_query_intents per page.",
            "- If neither web nor image research is needed, all intent arrays may be empty.",
          ].join("\n"),
        },
      },
    ],
  };
}

export function parseResearchPlanJson(text: string): ResearchPlan {
  const parsed = parseStructuredJson<ResearchPlan>(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pages)) {
    throw new Error("Anna LLM returned invalid research plan JSON.");
  }
  return parsed;
}

export function validateResearchPlanAlignment(input: {
  researchPlan: ResearchPlan;
  pagePlan: PagePlan;
}): string[] {
  const errors: string[] = [];
  const { researchPlan, pagePlan } = input;
  const seen = new Set<string>();

  if (researchPlan.pages.length !== pagePlan.pages.length) {
    errors.push("Research Plan pages length must equal Page Plan pages length.");
  }

  researchPlan.pages.forEach((requirement, index) => {
    const plannedPage = pagePlan.pages[index];
    if (seen.has(requirement.page_id)) {
      errors.push(`Duplicate Research Plan page_id: ${requirement.page_id}`);
    }
    seen.add(requirement.page_id);

    if (!plannedPage) {
      errors.push(`Research Plan has extra page at index ${index}: ${requirement.page_id}`);
      return;
    }

    if (requirement.page_id !== plannedPage.page_id) {
      errors.push(`Research Plan page_id mismatch at index ${index}: ${requirement.page_id} !== ${plannedPage.page_id}`);
    }
    if (requirement.index !== plannedPage.index) {
      errors.push(`Research Plan index mismatch for ${plannedPage.page_id}: ${requirement.index} !== ${plannedPage.index}`);
    }
    if (requirement.title !== plannedPage.title) {
      errors.push(`Research Plan title mismatch for ${plannedPage.page_id}: ${requirement.title} !== ${plannedPage.title}`);
    }
    if (typeof requirement.web_research_needed !== "boolean") {
      errors.push(`Research Plan web_research_needed must be boolean for ${plannedPage.page_id}.`);
    }
    if (typeof requirement.image_research_needed !== "boolean") {
      errors.push(`Research Plan image_research_needed must be boolean for ${plannedPage.page_id}.`);
    }
  });

  for (const page of pagePlan.pages) {
    if (!seen.has(page.page_id)) {
      errors.push(`Research Plan is missing page_id: ${page.page_id}`);
    }
  }

  return errors;
}

export function assertResearchPlanAligned(input: {
  researchPlan: ResearchPlan;
  pagePlan: PagePlan;
}): ResearchPlan {
  const errors = validateResearchPlanAlignment(input);
  if (errors.length > 0) {
    throw new Error(`Invalid Research Plan alignment:\n${errors.join("\n")}`);
  }
  return input.researchPlan;
}
