import type {
  PageRefinementIntentReviewResult,
  ReviewPageRefinementIntentInput,
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

export function normalizePageRefinementIntentReview(
  value: unknown,
): PageRefinementIntentReviewResult {
  const record = asRecord(value);
  const route = cleanString(record.route);
  if (route !== "proceed" && route !== "unsupported") {
    throw new Error('Page Refinement Intent Review must return route "proceed" or "unsupported".');
  }

  const targetOutlineRecord = asRecord(record.target_outline_item);
  const targetOutlineTitle = cleanString(targetOutlineRecord.title);
  const targetOutline = cleanString(targetOutlineRecord.outline);
  const blockingReason = cleanString(record.blocking_reason);
  const reason = cleanString(record.reason);

  if (route === "unsupported") {
    return {
      route,
      blocking_reason: blockingReason || reason || "This request cannot be handled as current-page refinement.",
      outline_change_required: false,
      additional_research_required: false,
      additional_web_query_intents: [],
      additional_image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      reason: reason || blockingReason || "Unsupported current-page refinement request.",
    };
  }

  const outlineChangeRequired = record.outline_change_required === true;
  if (outlineChangeRequired && (!targetOutlineTitle || !targetOutline)) {
    throw new Error("Page Refinement Intent Review requires target_outline_item.title and outline when outline_change_required is true.");
  }

  return {
    route,
    blocking_reason: blockingReason || undefined,
    outline_change_required: outlineChangeRequired,
    target_outline_item: outlineChangeRequired
      ? { title: targetOutlineTitle, outline: targetOutline }
      : undefined,
    additional_research_required:
      record.additional_research_required === true ||
      cleanStringArray(record.additional_web_query_intents).length > 0 ||
      cleanStringArray(record.additional_image_query_intents).length > 0,
    additional_web_query_intents: cleanStringArray(record.additional_web_query_intents).slice(0, 3),
    additional_image_query_intents: cleanStringArray(record.additional_image_query_intents).slice(0, 2),
    evidence_needs: cleanStringArray(record.evidence_needs).slice(0, 6),
    visual_needs: cleanStringArray(record.visual_needs).slice(0, 4),
    reason: reason || "Proceed with current-page refinement.",
  };
}

export function buildPageRefinementIntentReviewPrompt(
  input: ReviewPageRefinementIntentInput,
): string {
  const targetOutlineItem = input.outline.items[input.targetPage.index] ?? null;
  const pageEvidence = input.researchEvidence?.pages.find(
    (page) => page.page_id === input.targetPage.page_id,
  ) ?? null;
  return [
    "You are Page Refinement Intent Review for current-page PPT refinement.",
    "Return only one JSON object. Do not edit files. Do not include markdown.",
    "",
    "Route rules:",
    '- Use route "proceed" only when the request can be handled by refining the current target page.',
    '- Use route "unsupported" when the request requires adding pages, deleting pages, reordering pages, changing deck title, changing output language, changing template selection, or editing non-target pages.',
    '- First version route values are exactly "proceed" and "unsupported".',
    "",
    "Target-page mutation rules:",
    "- If the request cannot be satisfied under the current target page outline, set outline_change_required=true and provide target_outline_item with the complete new target page title and outline.",
    "- Never change page count, page order, deck title, output language, template group, or other outline items.",
    "- Do not return page-plan revisions, blueprint changes, slide paths, data paths, manifest ids, or a second copy of the outline.",
    "- The system will copy target_outline_item into both the Confirmed Outline and the target Page Plan entry when outline_change_required=true.",
    "",
    "Research rules:",
    "- Set additional_research_required=true only when the request or revised target-page intent requires external facts, current information, source-backed data, named cases, citations, or real visual assets that are not already available in current evidence.",
    "- If target_outline_item introduces new concrete facts, numbers, dates, names, cases, citations, or real visual needs that are not present in the existing target Research Evidence or explicitly stated in the Page Refinement Request, set additional_research_required=true and add the needed query intents.",
    "- Do not request research merely to make the page richer.",
    "- Add only new query intents needed for this refinement.",
    "",
    "Expected JSON shape:",
    JSON.stringify({
      route: "proceed",
      blocking_reason: "",
      outline_change_required: false,
      target_outline_item: {
        title: "",
        outline: "",
      },
      additional_research_required: false,
      additional_web_query_intents: [],
      additional_image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      reason: "",
    }, null, 2),
    "",
    `Locale: ${input.locale}`,
    `Page Refinement Request: ${input.instruction}`,
    `Full Confirmed Outline JSON: ${JSON.stringify(input.outline)}`,
    `Target outline item JSON: ${JSON.stringify(targetOutlineItem)}`,
    `Full Page Plan JSON: ${JSON.stringify(input.pagePlan)}`,
    `Target Page Plan entry JSON: ${JSON.stringify(input.targetPage)}`,
    `Available template blueprints JSON: ${JSON.stringify(input.planningContext.blueprints)}`,
    `Existing target Research Evidence summary JSON: ${JSON.stringify(pageEvidence)}`,
  ].join("\n");
}
