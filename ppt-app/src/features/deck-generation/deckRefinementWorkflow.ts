import type {
  DeckRefinementIntentReviewResult,
  DeckRefinementOutlineOperation,
  PageRefinementIntentReviewResult,
} from "../../ai/types";
import type {
  PagePlan,
  PagePlanItem,
  WorkspaceOutline,
  WorkspaceSettings,
} from "../../api/types";

function cleanSegment(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "page";
}

function makeAddedPageSlug(pageId: string, title: string): string {
  const titleSegment = cleanSegment(title);
  const base = titleSegment === "page" ? pageId : `${pageId}-${titleSegment}`;
  return cleanSegment(base).slice(0, 80) || pageId;
}

function nextUniquePageId(existingIds: Set<string>): string {
  for (let index = existingIds.size + 1; index < existingIds.size + 1000; index += 1) {
    const id = `page-${String(index).padStart(2, "0")}`;
    if (!existingIds.has(id)) return id;
  }
  return `page-${Date.now().toString(36)}`;
}

function makeUniquePath(base: string, extension: string, used: Set<string>, prefix: string): string {
  let candidate = `./${prefix}/${base}${extension}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `./${prefix}/${base}-${suffix}${extension}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function getOperationResearchReview(op: DeckRefinementOutlineOperation): PageRefinementIntentReviewResult | null {
  if (op.op !== "update" && op.op !== "add") return null;
  const web = op.additional_web_query_intents ?? [];
  const images = op.additional_image_query_intents ?? [];
  const evidenceNeeds = op.evidence_needs ?? [];
  const visualNeeds = op.visual_needs ?? [];
  const needsResearch =
    op.additional_research_required === true ||
    web.length > 0 ||
    images.length > 0 ||
    evidenceNeeds.length > 0 ||
    visualNeeds.length > 0;
  if (!needsResearch) return null;
  return {
    route: "proceed",
    outline_change_required: false,
    additional_research_required: true,
    additional_web_query_intents: web,
    additional_image_query_intents: images,
    evidence_needs: evidenceNeeds,
    visual_needs: visualNeeds,
    reason: op.reason,
  };
}

export interface DeckRefinementReconciliationResult {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  targetPageIds: string[];
  deletedPageIds: string[];
  addedPageIds: string[];
  pageRefinementRequests: Record<string, string>;
  researchReviews: Record<string, PageRefinementIntentReviewResult>;
  renderRequired: boolean;
}

export function alignDeckRefinementPagePlanToOutline(input: {
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
}): PagePlan {
  return {
    ...input.pagePlan,
    source: {
      ...input.pagePlan.source,
      outline_updated_at: input.outline.updated_at,
    },
  };
}

export function reconcileDeckRefinement(input: {
  instruction: string;
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  review: DeckRefinementIntentReviewResult;
  addedPagePlan?: PagePlan | null;
  now: string;
}): DeckRefinementReconciliationResult {
  if (input.review.route !== "proceed") {
    throw new Error("Only proceed Deck Refinement reviews can be reconciled.");
  }

  const pagesById = new Map(input.pagePlan.pages.map((page) => [page.page_id, page]));
  const existingIds = new Set(pagesById.keys());
  const usedIds = new Set(existingIds);
  const usedSlidePaths = new Set(input.pagePlan.pages.map((page) => page.slide_path));
  const usedDataPaths = new Set(input.pagePlan.pages.map((page) => page.data_path));
  const usedManifestIds = new Set(input.pagePlan.pages.map((page) => page.manifest_slide_id));
  const finalPages: PagePlanItem[] = [];
  const deletedPageIds: string[] = [];
  const addedPageIds: string[] = [];
  const operationReasonByPageId = new Map<string, string>();
  const researchReviews: Record<string, PageRefinementIntentReviewResult> = {};
  let addPlanIndex = 0;

  for (const op of input.review.operations) {
    if (op.op === "keep" || op.op === "update" || op.op === "delete") {
      if (!pagesById.has(op.page_id)) {
        throw new Error(`Deck Refinement operation references unknown page_id "${op.page_id}".`);
      }
    }

    if (op.op === "delete") {
      deletedPageIds.push(op.page_id);
      operationReasonByPageId.set(op.page_id, op.reason);
      continue;
    }

    if (op.op === "keep") {
      const page = pagesById.get(op.page_id)!;
      finalPages.push({ ...page });
      operationReasonByPageId.set(page.page_id, op.reason);
      continue;
    }

    if (op.op === "update") {
      const page = pagesById.get(op.page_id)!;
      finalPages.push({
        ...page,
        title: op.title,
        outline: op.outline,
      });
      operationReasonByPageId.set(page.page_id, op.reason);
      const researchReview = getOperationResearchReview(op);
      if (researchReview) researchReviews[page.page_id] = researchReview;
      continue;
    }

    const plannedAdd = input.addedPagePlan?.pages[addPlanIndex];
    addPlanIndex += 1;
    if (!plannedAdd) {
      throw new Error("Deck Refinement add operation requires added-page Page Plan data.");
    }
    const pageId = nextUniquePageId(usedIds);
    usedIds.add(pageId);
    const slug = makeAddedPageSlug(pageId, op.title);
    const slidePath = makeUniquePath(slug, ".tsx", usedSlidePaths, "slides");
    const dataPath = makeUniquePath(slug, ".json", usedDataPaths, "data");
    let manifestSlideId = slug;
    let suffix = 2;
    while (usedManifestIds.has(manifestSlideId)) {
      manifestSlideId = `${slug}-${suffix}`;
      suffix += 1;
    }
    usedManifestIds.add(manifestSlideId);
    const newPage: PagePlanItem = {
      ...plannedAdd,
      page_id: pageId,
      index: finalPages.length,
      title: op.title,
      outline: op.outline,
      slide_path: slidePath,
      data_path: dataPath,
      manifest_slide_id: manifestSlideId,
      reason: plannedAdd.reason || op.reason,
    };
    finalPages.push(newPage);
    addedPageIds.push(pageId);
    operationReasonByPageId.set(pageId, op.reason);
    const researchReview = getOperationResearchReview(op);
    if (researchReview) researchReviews[pageId] = researchReview;
  }

  for (const page of input.pagePlan.pages) {
    if (!input.review.operations.some((op) => op.op !== "add" && op.page_id === page.page_id)) {
      throw new Error(`Deck Refinement operations must include keep, update, or delete for existing page_id "${page.page_id}".`);
    }
  }

  const reindexedPages = finalPages.map((page, index) => ({ ...page, index }));
  const outputLanguage = input.review.output_language_change.changed
    ? input.review.output_language_change.output_language || input.outline.output_language
    : input.outline.output_language;
  const nextOutline: WorkspaceOutline = {
    ...input.outline,
    status: "confirmed",
    output_language: outputLanguage,
    source: {
      ...input.outline.source,
      setting: {
        ...input.outline.source.setting,
        ...(input.review.output_language_change.changed ? { output_language: outputLanguage } : {}),
      },
    },
    items: reindexedPages.map((page) => ({
      title: page.title,
      outline: page.outline,
    })),
    updated_at: input.now,
  };

  const targetPageIds = new Set<string>();
  const targetAll = input.review.output_language_change.changed;
  if (targetAll) {
    for (const page of reindexedPages) targetPageIds.add(page.page_id);
  }
  for (const op of input.review.operations) {
    if (op.op === "update") targetPageIds.add(op.page_id);
  }
  for (const pageId of addedPageIds) targetPageIds.add(pageId);

  const pageRefinementRequests: Record<string, string> = {};
  for (const page of reindexedPages) {
    if (!targetPageIds.has(page.page_id)) continue;
    const reasons = [
      input.review.output_language_change.changed
        ? `Output language changed to ${outputLanguage}.`
        : "",
      operationReasonByPageId.get(page.page_id) || "",
    ].filter(Boolean);
    pageRefinementRequests[page.page_id] = [
      "Deck Refinement Request:",
      input.instruction,
      "",
      "Page-level refinement reason:",
      reasons.join("\n") || input.review.reason,
      "",
      "Apply this as a whole-deck refinement while preserving useful existing page work.",
    ].join("\n");
  }

  return {
    outline: nextOutline,
    pagePlan: {
      ...input.pagePlan,
      status: "planned",
      title: nextOutline.title || input.pagePlan.title,
      source: {
        ...input.pagePlan.source,
        outline_updated_at: nextOutline.updated_at,
      },
      pages: reindexedPages,
      updated_at: input.now,
    },
    targetPageIds: Array.from(targetPageIds),
    deletedPageIds,
    addedPageIds,
    pageRefinementRequests,
    researchReviews,
    renderRequired:
      targetPageIds.size > 0 ||
      deletedPageIds.length > 0 ||
      input.review.output_language_change.changed ||
      input.review.theme_change_required,
  };
}

export function applyDeckRefinementSettingUpdates(input: {
  setting: WorkspaceSettings | Record<string, unknown>;
  review: DeckRefinementIntentReviewResult;
  now: string;
}): WorkspaceSettings {
  const next = {
    ...input.setting,
  } as WorkspaceSettings;
  if (input.review.output_language_change.changed && input.review.output_language_change.output_language) {
    next.output_language = input.review.output_language_change.output_language;
  }
  next.updated_at = input.now;
  return next;
}
