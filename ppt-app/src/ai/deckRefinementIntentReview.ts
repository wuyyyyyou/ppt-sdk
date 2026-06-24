import type {
  DeckRefinementContextUpdates,
  DeckRefinementIntentReviewResult,
  DeckRefinementOutlineOperation,
  ReviewDeckRefinementIntentInput,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = cleanString(item);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function cleanContextUpdates(value: unknown): DeckRefinementContextUpdates {
  const record = asRecord(value);
  const updates: DeckRefinementContextUpdates = {};
  for (const key of [
    "audience",
    "goal",
    "style_notes",
    "theme_id",
    "visual_tone",
    "typography",
    "text_density",
  ] as const) {
    const text = cleanString(record[key]);
    if (text) updates[key] = text;
  }
  return updates;
}

function cleanOperation(value: unknown, index: number): DeckRefinementOutlineOperation {
  const record = asRecord(value);
  const op = cleanString(record.op);
  const pageId = cleanString(record.page_id);
  const reason = cleanString(record.reason);

  if (op === "keep") {
    if (!pageId) throw new Error(`operations[${index}].page_id is required for keep.`);
    return { op, page_id: pageId, reason: reason || "Keep existing Page Generation Unit." };
  }

  if (op === "update") {
    const title = cleanString(record.title);
    const outline = cleanString(record.outline);
    if (!pageId || !title || !outline) {
      throw new Error(`operations[${index}] update requires page_id, title, and outline.`);
    }
    return {
      op,
      page_id: pageId,
      title,
      outline,
      reason: reason || "Update this Page Generation Unit intent.",
      additional_research_required: record.additional_research_required === true,
      additional_web_query_intents: cleanStringArray(record.additional_web_query_intents).slice(0, 3),
      additional_image_query_intents: cleanStringArray(record.additional_image_query_intents).slice(0, 2),
      evidence_needs: cleanStringArray(record.evidence_needs).slice(0, 6),
      visual_needs: cleanStringArray(record.visual_needs).slice(0, 4),
    };
  }

  if (op === "add") {
    const title = cleanString(record.title);
    const outline = cleanString(record.outline);
    if (!title || !outline) {
      throw new Error(`operations[${index}] add requires title and outline.`);
    }
    return {
      op,
      title,
      outline,
      reason: reason || "Add a new Page Generation Unit.",
      additional_research_required: record.additional_research_required === true,
      additional_web_query_intents: cleanStringArray(record.additional_web_query_intents).slice(0, 3),
      additional_image_query_intents: cleanStringArray(record.additional_image_query_intents).slice(0, 2),
      evidence_needs: cleanStringArray(record.evidence_needs).slice(0, 6),
      visual_needs: cleanStringArray(record.visual_needs).slice(0, 4),
    };
  }

  if (op === "delete") {
    if (!pageId) throw new Error(`operations[${index}].page_id is required for delete.`);
    return { op, page_id: pageId, reason: reason || "Delete this Page Generation Unit from active artifacts." };
  }

  throw new Error(`operations[${index}].op must be keep, update, add, or delete.`);
}

export function normalizeDeckRefinementIntentReview(
  value: unknown,
): DeckRefinementIntentReviewResult {
  const record = asRecord(value);
  const route = cleanString(record.route);
  if (route !== "proceed" && route !== "unsupported" && route !== "no_op") {
    throw new Error('Deck Refinement Context Review must return route "proceed", "unsupported", or "no_op".');
  }

  const blockingReason = cleanString(record.blocking_reason);
  const reason = cleanString(record.reason);
  if (route === "unsupported") {
    return {
      route,
      blocking_reason: blockingReason || reason || "This Deck Refinement request is unsupported.",
      context_updates: {},
      output_language_change: { changed: false },
      global_change: false,
      operations: [],
      reason: reason || blockingReason || "Unsupported Deck Refinement request.",
    };
  }

  if (route === "no_op") {
    return {
      route,
      blocking_reason: undefined,
      context_updates: {},
      output_language_change: { changed: false },
      global_change: false,
      operations: [],
      reason: reason || "No Deck Refinement changes are needed.",
    };
  }

  const outputLanguageRecord = asRecord(record.output_language_change);
  const outputLanguageChanged = outputLanguageRecord.changed === true;
  const outputLanguage = cleanString(outputLanguageRecord.output_language);
  if (outputLanguageChanged && !outputLanguage) {
    throw new Error("output_language_change.output_language is required when changed is true.");
  }

  const operations = Array.isArray(record.operations)
    ? record.operations.map(cleanOperation)
    : [];
  if (operations.length === 0) {
    throw new Error("Deck Refinement proceed route requires operation-based outline reconciliation.");
  }

  return {
    route,
    blocking_reason: blockingReason || undefined,
    context_updates: cleanContextUpdates(record.context_updates),
    output_language_change: {
      changed: outputLanguageChanged,
      output_language: outputLanguageChanged ? outputLanguage : undefined,
      reason: cleanString(outputLanguageRecord.reason) || undefined,
    },
    global_change: record.global_change === true,
    global_change_reason: cleanString(record.global_change_reason) || undefined,
    operations,
    reason: reason || "Proceed with Deck Refinement.",
  };
}

export function buildDeckRefinementIntentReviewPrompt(
  input: ReviewDeckRefinementIntentInput,
): string {
  const currentPages = input.pagePlan.pages.map((page) => ({
    page_id: page.page_id,
    index: page.index,
    title: page.title,
    outline: page.outline,
    blueprint_id: page.blueprint_id,
  }));

  return [
    "You are Deck Refinement Context Review and operation-based outline reconciliation for an accepted PPT deck.",
    "Return only one JSON object. Do not edit files. Do not include markdown.",
    "",
    "Route rules:",
    '- Use route "unsupported" only for unsupported requests, especially changing selected Template/template group or unsafe template migration.',
    '- Use route "no_op" when the request does not require context, output language, outline, research, page, manifest, progress, or render changes.',
    '- Use route "proceed" when any deck-level artifact or Page Generation Unit should change.',
    "",
    "Output language rules:",
    "- Set output_language_change.changed=true only when the user explicitly asks to change generated content language.",
    "- Mentions of foreign terms, source language, market names, or translation examples are not enough by themselves.",
    "- When output_language_change.changed=true, every retained Page Generation Unit will be targeted.",
    "",
    "Context rules:",
    "- context_updates may include audience, goal, style_notes, theme_id, visual_tone, typography, and text_density only when explicitly requested.",
    "- Audience, goal, style, and theme changes are global_change=true and affect every Page Generation Unit.",
    "- Do not rewrite the original Brief.",
    "",
    "Outline operation rules:",
    "- operations must be operation-based and keyed by existing page_id for keep, update, and delete.",
    "- For retained pages use keep or update; do not change page_id, blueprint_id, blueprint_source, slide_path, data_path, or manifest_slide_id.",
    "- A plain revised outline array is forbidden.",
    "- Vague structure-improvement requests must preserve page count; use keep/update only.",
    "- Add/delete pages only when the user explicitly asks for page-count or page-structure changes.",
    "- Return operations in the final desired deck order. Include delete operations where removed pages previously belonged.",
    "- For keep, only page_id and reason are required.",
    "- For update, provide complete replacement title and outline for that page.",
    "- For add, provide title and outline. The system will allocate page_id and choose a blueprint only for new pages.",
    "- For delete, provide the existing page_id.",
    "",
    "Research rules:",
    "- Set per-operation additional_research_required and query intents only for added or changed-intent pages that need external facts, latest data, citations, cases, real visuals, or updated visual assets.",
    "- Output-language-only changes do not need research by default.",
    "",
    "Expected JSON shape:",
    JSON.stringify({
      route: "proceed",
      blocking_reason: "",
      context_updates: {
        audience: "",
        goal: "",
        style_notes: "",
        theme_id: "",
        visual_tone: "",
        typography: "",
        text_density: "",
      },
      output_language_change: {
        changed: false,
        output_language: "",
        reason: "",
      },
      global_change: false,
      global_change_reason: "",
      operations: [
        { op: "keep", page_id: "page-01", reason: "" },
        { op: "update", page_id: "page-02", title: "", outline: "", reason: "", additional_research_required: false, additional_web_query_intents: [], additional_image_query_intents: [], evidence_needs: [], visual_needs: [] },
        { op: "add", title: "", outline: "", reason: "", additional_research_required: false, additional_web_query_intents: [], additional_image_query_intents: [], evidence_needs: [], visual_needs: [] },
        { op: "delete", page_id: "page-03", reason: "" },
      ],
      reason: "",
    }, null, 2),
    "",
    `Locale: ${input.locale}`,
    `Deck Refinement Request: ${input.instruction}`,
    `Workspace setting JSON: ${JSON.stringify(input.setting ?? {})}`,
    `Confirmed Outline JSON: ${JSON.stringify(input.outline)}`,
    `Current Page Generation Units JSON: ${JSON.stringify(currentPages)}`,
    `Full Page Plan JSON: ${JSON.stringify(input.pagePlan)}`,
    `Available template blueprints JSON: ${JSON.stringify(input.planningContext.blueprints)}`,
  ].join("\n");
}
