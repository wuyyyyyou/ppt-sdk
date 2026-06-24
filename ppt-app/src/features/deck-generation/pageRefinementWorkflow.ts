import type { PageRefinementIntentReviewResult } from "../../ai/types";
import type {
  PagePlan,
  PagePlanItem,
  ResearchPlan,
  ResearchRequirement,
  ResearchStatus,
  WorkspaceOutline,
} from "../../api/types";

export function normalizeResearchQueryKey(query: string): string {
  return query
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function dedupeAppend(existing: string[], additions: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...existing, ...additions]) {
    const clean = item.trim();
    const key = normalizeResearchQueryKey(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

export function applyTargetOutlineRevision(input: {
  outline: WorkspaceOutline;
  pageIndex: number;
  revisedItem: { title: string; outline: string };
  now: string;
}): WorkspaceOutline {
  return {
    ...input.outline,
    status: "confirmed",
    items: input.outline.items.map((item, index) =>
      index === input.pageIndex
        ? {
            title: input.revisedItem.title,
            outline: input.revisedItem.outline,
          }
        : item,
    ),
    updated_at: input.now,
  };
}

export function reviseTargetPagePlanEntry(input: {
  pagePlan: PagePlan;
  targetPage: PagePlanItem;
  activeOutline: WorkspaceOutline;
  now: string;
}): PagePlan {
  const outlineItem = input.activeOutline.items[input.targetPage.index];
  return {
    ...input.pagePlan,
    title: input.activeOutline.title || input.pagePlan.title,
    source: {
      ...input.pagePlan.source,
      outline_updated_at: input.activeOutline.updated_at,
    },
    pages: input.pagePlan.pages.map((page) => {
      if (page.page_id !== input.targetPage.page_id) return page;
      return {
        ...page,
        title: outlineItem?.title || page.title,
        outline: outlineItem?.outline || page.outline,
      };
    }),
    updated_at: input.now,
  };
}

export function mergeTargetResearchRequirement(input: {
  researchPlan: ResearchPlan;
  targetPage: PagePlanItem;
  review: PageRefinementIntentReviewResult;
  pagePlanUpdatedAt: string;
  now: string;
}): ResearchPlan {
  const additions = input.review;
  const pages = input.researchPlan.pages.map((requirement) => {
    if (requirement.page_id !== input.targetPage.page_id) return requirement;
    const queryIntents = dedupeAppend(
      requirement.query_intents,
      additions.additional_web_query_intents,
      6,
    );
    const imageQueryIntents = dedupeAppend(
      requirement.image_query_intents,
      additions.additional_image_query_intents,
      4,
    );
    const evidenceNeeds = dedupeAppend(requirement.evidence_needs, additions.evidence_needs, 10);
    const visualNeeds = dedupeAppend(requirement.visual_needs, additions.visual_needs, 8);
    return {
      ...requirement,
      title: input.targetPage.title,
      web_research_needed: requirement.web_research_needed || queryIntents.length > 0,
      image_research_needed: requirement.image_research_needed || imageQueryIntents.length > 0,
      query_intents: queryIntents,
      image_query_intents: imageQueryIntents,
      evidence_needs: evidenceNeeds,
      visual_needs: visualNeeds,
      reason: [requirement.reason, additions.reason].filter(Boolean).join("\n"),
    };
  });

  return {
    ...input.researchPlan,
    title: input.researchPlan.title,
    source: {
      ...input.researchPlan.source,
      page_plan_updated_at: input.pagePlanUpdatedAt,
    },
    pages,
    updated_at: input.now,
  };
}

export function computeResearchQueryDelta(input: {
  status: ResearchStatus;
  pageId: string;
  requirement: ResearchRequirement;
}): { webQueries: string[]; imageQueries: string[] } {
  const pageLedger = input.status.collection_ledger?.pages.find(
    (page) => page.page_id === input.pageId,
  );
  const collectedWeb = new Set((pageLedger?.web_queries ?? []).map((item) => item.key));
  const collectedImages = new Set((pageLedger?.image_queries ?? []).map((item) => item.key));
  return {
    webQueries: input.requirement.web_research_needed
      ? input.requirement.query_intents
          .filter((query) => !collectedWeb.has(normalizeResearchQueryKey(query)))
          .slice(0, 3)
      : [],
    imageQueries: input.requirement.image_research_needed
      ? input.requirement.image_query_intents
          .filter((query) => !collectedImages.has(normalizeResearchQueryKey(query)))
          .slice(0, 2)
      : [],
  };
}

export function recordResearchCollectionLedger(input: {
  status: ResearchStatus;
  pageId: string;
  webCollections: Array<{ query: string; raw_index_path?: string }>;
  imageCollections: Array<{ query: string; raw_index_path?: string }>;
  now: string;
}): ResearchStatus {
  const existingLedger = input.status.collection_ledger ?? { version: 1 as const, pages: [] };
  const existingPage = existingLedger.pages.find((page) => page.page_id === input.pageId) ?? {
    page_id: input.pageId,
    web_queries: [],
    image_queries: [],
  };
  const upsertEntries = (
    existing: typeof existingPage.web_queries,
    additions: Array<{ query: string; raw_index_path?: string }>,
  ) => {
    const byKey = new Map(existing.map((item) => [item.key, item]));
    for (const addition of additions) {
      const query = addition.query.trim();
      if (!query) continue;
      const key = normalizeResearchQueryKey(query);
      byKey.set(key, {
        key,
        query,
        collected_at: input.now,
        raw_index_path: addition.raw_index_path,
      });
    }
    return Array.from(byKey.values());
  };
  const nextPage = {
    page_id: input.pageId,
    web_queries: upsertEntries(existingPage.web_queries, input.webCollections),
    image_queries: upsertEntries(existingPage.image_queries, input.imageCollections),
  };
  return {
    ...input.status,
    collection_ledger: {
      version: 1,
      pages: existingLedger.pages.some((page) => page.page_id === input.pageId)
        ? existingLedger.pages.map((page) => page.page_id === input.pageId ? nextPage : page)
        : [...existingLedger.pages, nextPage],
    },
    updated_at: input.now,
  };
}
