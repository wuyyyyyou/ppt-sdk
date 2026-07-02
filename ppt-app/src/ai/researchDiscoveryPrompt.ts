import type {
  PageContentPlan,
  PagePlan,
  ResearchDiscoveryDecision,
  ResearchDiscoveryEvidencePool,
  WorkspaceOutline,
} from "../api/types";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { Locale } from "../i18n/messages";
import { parseStructuredJson } from "./structuredJson";
import { readOutlineOutputLanguage } from "./outputLanguage";

function compactDiscoveryPool(pool: ResearchDiscoveryEvidencePool) {
  return {
    status: pool.status,
    facts: pool.facts.map((fact) => ({
      id: fact.id,
      claim: fact.claim,
      source_title: fact.source_title,
      source_url: fact.source_url,
      confidence: fact.confidence,
    })),
    derived_insights: pool.derived_insights,
    visual_assets: pool.visual_assets.map((asset) => ({
      id: asset.id,
      reason: asset.reason,
      visual_summary: asset.visual_summary,
      image_url: asset.image_url,
      page_url: asset.page_url,
    })),
    gaps: pool.gaps,
    source_summaries: pool.source_summaries,
    completed_queries: pool.iterations.flatMap((iteration) =>
      iteration.query_summaries
        .filter((summary) => summary.status === "collected")
        .map((summary) => ({ kind: summary.kind, query: summary.query })),
    ),
  };
}

export function buildResearchDiscoveryDecisionLlmRequest(input: {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  phase: "web" | "visual";
  iteration: number;
  iterationLimit: number;
  targetPageIds?: string[];
  discoveryPool: ResearchDiscoveryEvidencePool;
  uploadedSourceAnalysisContext?: unknown;
  researchStatus?: unknown;
  locale: Locale;
}): AnnaLlmCompleteInput {
  const targetPageIds = new Set(input.targetPageIds ?? []);
  const scopedPages = targetPageIds.size > 0
    ? input.pagePlan.pages.filter((page) => targetPageIds.has(page.page_id))
    : input.pagePlan.pages;
  const phaseRule = input.phase === "web"
    ? "Decide whether source-backed web research is still needed for facts, current information, data, citations, named cases, or other real-world claims."
    : "Decide only whether image research is still needed for real visual assets. Use curated web facts and insights only as context for image queries; do not decide whether factual evidence is sufficient.";
  const stopRule = input.phase === "web"
    ? "If existing curated web evidence is sufficient for factual grounding, return action stop."
    : "If existing curated visual assets are sufficient for page imagery needs, return action stop.";
  const searchRule = input.phase === "web"
    ? "If more source-backed web material is needed, return action search with concise queries."
    : "If more image material is needed, return action search with concise image queries.";
  const phaseSpecificRules = input.phase === "web"
    ? [
        "- Decide only web evidence needs in this phase.",
        "- Use evidence_needs for missing factual/source-backed material.",
        "- visual_needs may mention later image needs, but do not use them to keep web research running.",
      ]
    : [
        "- Decide only image asset needs in this phase.",
        "- Completion means no more image asset collection is needed; it does not mean web/factual research is complete.",
        "- The rationale, visual_needs, and gaps must discuss visual assets only.",
        "- evidence_needs must be []. Do not report missing facts, data, citations, or source-backed claims here.",
      ];
  const jsonShape = JSON.stringify({
    action: "stop",
    phase: input.phase,
    queries: [],
    rationale: "...",
    evidence_needs: [],
    visual_needs: [],
    gaps: [],
  });
  const poolLabel = input.phase === "web"
    ? "Existing curated Discovery Evidence Pool summary"
    : "Existing curated Discovery Evidence Pool summary (facts are context only; make the decision from visual_assets and visual gaps)";

  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are a Research Discovery decision assistant for PPT generation.",
            "Return JSON only. No markdown, code fences, comments, or explanations.",
            "Do not search. Decide only whether the app should search next and which concise query intents to run.",
            "Do not request research merely to enrich a page.",
            phaseRule,
            stopRule,
            searchRule,
            "Never ask visual discovery to create factual evidence.",
            "The JSON must be parseable by JSON.parse.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Output content language: ${readOutlineOutputLanguage(input.outline)}`,
            `Locale: ${input.locale}`,
            `Phase: ${input.phase}`,
            `Iteration: ${input.iteration} of ${input.iterationLimit}`,
            `Target page ids: ${JSON.stringify(input.targetPageIds ?? [])}`,
            `Outline: ${JSON.stringify(input.outline)}`,
            `Scoped Page Plan pages: ${JSON.stringify(scopedPages)}`,
            `${poolLabel}: ${JSON.stringify(compactDiscoveryPool(input.discoveryPool))}`,
            `Uploaded Source Analysis prior context: ${JSON.stringify(input.uploadedSourceAnalysisContext ?? null)}`,
            `Research status / ledger summary: ${JSON.stringify(input.researchStatus ?? null)}`,
            "Return exactly this JSON shape:",
            jsonShape,
            "Rules:",
            "- action must be stop or search.",
            `- phase must be ${input.phase}.`,
            "- queries must contain 0-4 concise natural-language query intents.",
            "- Do not repeat completed queries listed in the pool summary.",
            "- Uploaded-source facts are user-provided prior context and outrank external web facts unless the task explicitly asks for public/current/benchmark validation.",
            "- If uploaded-source facts or visual candidates already satisfy the scoped pages, return action stop.",
            "- Search only for unresolved uploaded-source gaps, current external facts, public benchmarks, extra visual assets, or conflict investigation.",
            "- Record conflicts between uploaded-source facts and web facts as gaps or evidence_needs; do not silently overwrite uploaded-source facts.",
            "- Put geography, date, entity names, and specificity in query text when needed.",
            "- If the iteration limit is near and important evidence is still missing, return stop with gaps instead of low-value broad queries.",
            ...phaseSpecificRules,
          ].join("\n"),
        },
      },
    ],
  };
}

export function parseResearchDiscoveryDecisionJson(text: string, phase: "web" | "visual"): ResearchDiscoveryDecision {
  const parsed = parseStructuredJson<ResearchDiscoveryDecision>(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Anna LLM returned invalid Research Discovery decision JSON.");
  }
  const action = parsed.action === "search" ? "search" : "stop";
  return {
    action,
    phase,
    queries: action === "search"
      ? (Array.isArray(parsed.queries) ? parsed.queries.filter((query): query is string => typeof query === "string" && query.trim().length > 0).slice(0, 4) : [])
      : [],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    evidence_needs: phase === "web" && Array.isArray(parsed.evidence_needs)
      ? parsed.evidence_needs.filter((item): item is string => typeof item === "string")
      : [],
    visual_needs: Array.isArray(parsed.visual_needs) ? parsed.visual_needs.filter((item): item is string => typeof item === "string") : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((item): item is string => typeof item === "string") : [],
  };
}

function normalizeContentPlan(value: unknown): PageContentPlan {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const strings = (raw: unknown) => Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    main_message: typeof record.main_message === "string" ? record.main_message : "",
    content_points: strings(record.content_points),
    evidence_fact_ids: strings(record.evidence_fact_ids),
    derived_insight_ids: strings(record.derived_insight_ids),
    visual_asset_ids: strings(record.visual_asset_ids),
    uploaded_source_fact_ids: strings(record.uploaded_source_fact_ids),
    uploaded_source_visual_asset_ids: strings(record.uploaded_source_visual_asset_ids),
    gaps: strings(record.gaps),
    authoring_notes: strings(record.authoring_notes),
  };
}

export function buildEvidenceAwarePagePlanLlmRequest(input: {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  discoveryPool: ResearchDiscoveryEvidencePool;
  uploadedSourceAnalysisContext?: unknown;
  targetPageIds?: string[];
  locale: Locale;
}): AnnaLlmCompleteInput {
  const targetPageIds = new Set(input.targetPageIds ?? []);
  const scopedPages = targetPageIds.size > 0
    ? input.pagePlan.pages.filter((page) => targetPageIds.has(page.page_id))
    : input.pagePlan.pages;
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: [
            "You are an Evidence-Aware Page Planning assistant.",
            "Return JSON only. No markdown, code fences, comments, or explanations.",
            "Update only Page Plan content_plan fields for target pages.",
            "Do not modify Confirmed Outline.",
            "Do not change page identity, page order, titles, outlines, blueprint ids, file paths, or manifest ids.",
            "content_plan must reference evidence and visual assets by ID. Do not copy full evidence records.",
            "Uploaded-source facts and visual candidates must use uploaded_source_fact_ids and uploaded_source_visual_asset_ids, not discovery pool IDs.",
            "If evidence is missing, record gaps and authoring notes instead of inventing facts.",
            "Do not add pages or overload a page solely to cover every uploaded-source fact.",
          ].join("\n"),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Output content language: ${readOutlineOutputLanguage(input.outline)}`,
            `Locale: ${input.locale}`,
            `Target page ids: ${JSON.stringify(input.targetPageIds ?? [])}`,
            `Current Page Plan: ${JSON.stringify(input.pagePlan)}`,
            `Target pages: ${JSON.stringify(scopedPages)}`,
            `Research Discovery Evidence Pool summary: ${JSON.stringify(compactDiscoveryPool(input.discoveryPool))}`,
            `Uploaded Source Analysis planning context: ${JSON.stringify(input.uploadedSourceAnalysisContext ?? null)}`,
            "Return the full Page Plan JSON with the same pages and identity fields, adding or updating content_plan on target pages only.",
            "content_plan shape:",
            '{"main_message":"...","content_points":["..."],"evidence_fact_ids":["fact-1"],"derived_insight_ids":["insight-1"],"visual_asset_ids":["image-1"],"uploaded_source_fact_ids":["uploaded-fact-1"],"uploaded_source_visual_asset_ids":["uploaded-visual-1"],"gaps":["..."],"authoring_notes":["..."]}',
            "Prioritize relevant uploaded-source facts and usable/must_use visual candidates when they fit the page purpose and readability.",
            "Leave unused uploaded-source facts unassigned and note important omissions in gaps or authoring_notes.",
          ].join("\n"),
        },
      },
    ],
  };
}

export function parseEvidenceAwarePagePlanJson(text: string, existingPagePlan: PagePlan, targetPageIds?: string[]): PagePlan {
  const parsed = parseStructuredJson<PagePlan>(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pages)) {
    throw new Error("Anna LLM returned invalid Evidence-Aware Page Plan JSON.");
  }
  const targetIds = new Set(targetPageIds ?? existingPagePlan.pages.map((page) => page.page_id));
  const parsedById = new Map(parsed.pages.map((page) => [page.page_id, page]));
  return {
    ...existingPagePlan,
    pages: existingPagePlan.pages.map((page) => {
      const candidate = parsedById.get(page.page_id);
      if (!targetIds.has(page.page_id) || !candidate?.content_plan) return page;
      return {
        ...page,
        content_plan: normalizeContentPlan(candidate.content_plan),
      };
    }),
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : new Date().toISOString(),
  };
}
