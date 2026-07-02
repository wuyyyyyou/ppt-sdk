import { isAgentRunCancelledError } from "../../agent/agentClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import type {
  PagePlan,
  PagePlanItem,
  ResearchDiscoveryDecision,
  ResearchDiscoveryEvidencePool,
  ResearchDiscoveryIterationRecord,
  ResearchDiscoveryQuerySummary,
  ResearchEvidenceFact,
  ResearchEvidenceIndex,
  ResearchEvidencePage,
  ResearchRequirement,
  WebFetchResult,
  ImageFetchResult,
  VisualResearchCurationDraft,
  VisualResearchEvidence,
  WebResearchCurationDraft,
} from "../../api/types";
import { generationText } from "./messages";
import { emitRuntime as emitRuntimeProgress } from "./progressProjection";
import {
  buildVisualResearchCurationPrompt,
  buildWebResearchCurationPrompt,
  createResearchCurationRunId,
  appendResearchLogSafe,
  normalizeResearchEvidenceIndex,
  runResearchDraftAgent,
} from "./researchWorkflow";
import {
  createVisualResearchCurationGapDraft,
  createWebResearchCurationGapDraft,
} from "./researchCurationDrafts";
import {
  applyResearchDiscoveryPoolSummary,
  createEmptyResearchDiscoveryProgress,
  setRuntimeResearchDiscoveryProgress,
  summarizeDecision,
  summarizeImageFetchCount,
  summarizeImageFetchResult,
  summarizeQueries,
  summarizeResearchDiscoveryPool,
  summarizeVisualDraft,
  summarizeWebDraft,
  summarizeWebFetchCount,
  summarizeWebFetchResult,
  updateResearchDiscoveryPhase,
} from "./researchDiscoveryProgress";
import { normalizeResearchQueryKey } from "./pageRefinementArtifacts";
import { recordDeckRecovery, throwIfCancelled } from "./runtimeSupport";
import { getAttemptLimits } from "./settings";
import type { DeckGenerationRuntime, ResearchDiscoveryProgressQuery } from "./types";
import { createAgentFileToolPathContext } from "./agentFileToolPaths";

const RESEARCH_DISCOVERY_ITERATION_LIMIT = 5;
const WEB_RESEARCH_FETCH_MAX_CHARS = 20000;

function sanitizeDiscoveryDraftIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "scope";
}

function stableDiscoveryScopeHash(values: string[]): string {
  let hash = 2166136261;
  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 31;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 8);
}

function sortedSanitizedDraftIdParts(values?: string[]): string[] {
  return (values ?? [])
    .map(sanitizeDiscoveryDraftIdPart)
    .filter(Boolean)
    .sort();
}

function sameDraftIdPartSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildDiscoveryDraftScope(input: {
  targetPageIds?: string[];
  allPageIds?: string[];
}): string {
  const targetPageIds = sortedSanitizedDraftIdParts(input.targetPageIds);
  if (targetPageIds.length === 0) {
    return "deck";
  }
  const allPageIds = sortedSanitizedDraftIdParts(input.allPageIds);
  if (allPageIds.length > 0 && sameDraftIdPartSet(targetPageIds, allPageIds)) {
    return "deck";
  }
  if (targetPageIds.length === 1) {
    return targetPageIds[0] ?? "scope";
  }
  return `pages-${targetPageIds.length}-${stableDiscoveryScopeHash(targetPageIds)}`;
}

function buildDiscoveryRunToken(curationRunId: string): string {
  const sanitized = sanitizeDiscoveryDraftIdPart(curationRunId);
  const parts = sanitized.split("-").filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join("-");
  }
  return sanitized;
}

export function buildDiscoveryDraftId(input: {
  phase: "web" | "visual";
  iteration: number;
  curationRunId: string;
  targetPageIds?: string[];
  allPageIds?: string[];
}): string {
  return [
    "discovery",
    buildDiscoveryDraftScope({
      targetPageIds: input.targetPageIds,
      allPageIds: input.allPageIds,
    }),
    input.phase,
    String(input.iteration),
    buildDiscoveryRunToken(input.curationRunId),
  ].join("-");
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readFacts(value: unknown): ResearchEvidenceFact[] {
  return Array.isArray(value) ? value.filter((item): item is ResearchEvidenceFact =>
    Boolean(item) &&
    typeof item === "object" &&
    typeof (item as ResearchEvidenceFact).id === "string" &&
    typeof (item as ResearchEvidenceFact).claim === "string",
  ) : [];
}

function readVisualAssets(value: unknown): VisualResearchEvidence[] {
  return Array.isArray(value) ? value.filter((item): item is VisualResearchEvidence =>
    Boolean(item) &&
    typeof item === "object" &&
    typeof (item as VisualResearchEvidence).id === "string" &&
    typeof (item as VisualResearchEvidence).file_path === "string",
  ) : [];
}

export function createEmptyResearchDiscoveryEvidencePool(now = new Date().toISOString()): ResearchDiscoveryEvidencePool {
  return {
    version: 1,
    status: "empty",
    facts: [],
    derived_insights: [],
    visual_assets: [],
    gaps: [],
    rejected_material: [],
    source_summaries: [],
    iterations: [],
    updated_at: now,
  };
}

export function normalizeResearchDiscoveryEvidencePool(value: unknown): ResearchDiscoveryEvidencePool {
  const record = readRecord(value);
  if (Object.keys(record).length === 0) return createEmptyResearchDiscoveryEvidencePool();
  const status = record.status === "curated" || record.status === "partial" || record.status === "gap"
    ? record.status
    : "empty";
  return {
    version: 1,
    status,
    facts: readFacts(record.facts),
    derived_insights: Array.isArray(record.derived_insights)
      ? record.derived_insights
          .map((item) => {
            const insight = readRecord(item);
            return {
              id: readString(insight.id),
              insight: readString(insight.insight),
              supporting_fact_ids: readStringArray(insight.supporting_fact_ids),
            };
          })
          .filter((item) => item.id && item.insight)
      : [],
    visual_assets: readVisualAssets(record.visual_assets),
    gaps: readStringArray(record.gaps),
    rejected_material: Array.isArray(record.rejected_material)
      ? record.rejected_material
          .map((item) => {
            const rejected = readRecord(item);
            return {
              ...(readString(rejected.source) ? { source: readString(rejected.source) } : {}),
              reason: readString(rejected.reason),
            };
          })
          .filter((item) => item.reason.trim().length > 0)
      : [],
    source_summaries: Array.isArray(record.source_summaries)
      ? record.source_summaries
          .map((item) => {
            const source = readRecord(item);
            return {
              id: readString(source.id),
              kind: source.kind === "visual" ? "visual" as const : "web" as const,
              summary: readString(source.summary),
              ...(typeof source.source_count === "number" ? { source_count: source.source_count } : {}),
              updated_at: readString(source.updated_at) || new Date().toISOString(),
            };
          })
          .filter((item) => item.id && item.summary)
      : [],
    iterations: Array.isArray(record.iterations)
      ? record.iterations.filter((item): item is ResearchDiscoveryIterationRecord =>
          Boolean(item) && typeof item === "object" && typeof (item as ResearchDiscoveryIterationRecord).id === "string",
        )
      : [],
    updated_at: readString(record.updated_at) || new Date().toISOString(),
  };
}

function poolStatus(pool: ResearchDiscoveryEvidencePool): ResearchDiscoveryEvidencePool["status"] {
  if (pool.facts.length === 0 && pool.derived_insights.length === 0 && pool.visual_assets.length === 0) {
    return pool.gaps.length > 0 ? "gap" : "empty";
  }
  return pool.gaps.length > 0 ? "partial" : "curated";
}

function factDedupeKey(fact: ResearchEvidenceFact) {
  return [
    fact.claim,
    fact.source_url || fact.source_file || fact.source_title || fact.source_type,
  ].map((part) => normalizeResearchQueryKey(part ?? "")).join(":");
}

function uniqueId(base: string, used: Set<string>, prefix: string) {
  const cleanBase = base.trim() || `${prefix}-${used.size + 1}`;
  if (!used.has(cleanBase)) return cleanBase;
  let index = used.size + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function mergeDraftIntoPool(input: {
  pool: ResearchDiscoveryEvidencePool;
  phase: "web" | "visual";
  iteration: number;
  decision: ResearchDiscoveryDecision;
  querySummaries: ResearchDiscoveryQuerySummary[];
  draftPageId: string;
  curationRunId: string;
  webDraft?: WebResearchCurationDraft | null;
  visualDraft?: VisualResearchCurationDraft | null;
  gaps: string[];
  now: string;
}): ResearchDiscoveryEvidencePool {
  const factIds = new Set(input.pool.facts.map((fact) => fact.id));
  const factsByKey = new Map(input.pool.facts.map((fact) => [factDedupeKey(fact), fact.id]));
  const draftFactIdMap = new Map<string, string>();
  const facts = [...input.pool.facts];
  for (const fact of input.webDraft?.facts ?? []) {
    const key = factDedupeKey(fact);
    const existingId = factsByKey.get(key);
    if (existingId) {
      draftFactIdMap.set(fact.id, existingId);
      continue;
    }
    const id = uniqueId(fact.id, factIds, "fact");
    factIds.add(id);
    factsByKey.set(key, id);
    draftFactIdMap.set(fact.id, id);
    facts.push(id === fact.id ? fact : { ...fact, id });
  }

  const validFactIds = new Set(facts.map((fact) => fact.id));
  const insightIds = new Set(input.pool.derived_insights.map((insight) => insight.id));
  const insightKeys = new Set(input.pool.derived_insights.map((insight) => normalizeResearchQueryKey(insight.insight)));
  const derivedInsights = [...input.pool.derived_insights];
  const rejectedMaterial = [...input.pool.rejected_material];
  for (const insight of input.webDraft?.derived_insights ?? []) {
    const supportingFactIds = insight.supporting_fact_ids
      .map((id) => draftFactIdMap.get(id) ?? id)
      .filter((id, index, list) => validFactIds.has(id) && list.indexOf(id) === index);
    if (supportingFactIds.length === 0) {
      rejectedMaterial.push({
        source: insight.id,
        reason: `Derived insight was dropped because it has no valid supporting facts: ${insight.insight}`,
      });
      continue;
    }
    const key = normalizeResearchQueryKey(insight.insight);
    if (insightKeys.has(key)) continue;
    const id = uniqueId(insight.id, insightIds, "insight");
    insightIds.add(id);
    insightKeys.add(key);
    derivedInsights.push({
      id,
      insight: insight.insight,
      supporting_fact_ids: supportingFactIds,
    });
  }

  const visualIds = new Set(input.pool.visual_assets.map((asset) => asset.id));
  const visualKeys = new Set(input.pool.visual_assets.map((asset) =>
    normalizeResearchQueryKey(asset.sha256 || asset.file_path || asset.image_url || asset.page_url || asset.id),
  ));
  const visualAssets = [...input.pool.visual_assets];
  for (const asset of input.visualDraft?.visual_assets ?? []) {
    const key = normalizeResearchQueryKey(asset.sha256 || asset.file_path || asset.image_url || asset.page_url || asset.id);
    if (visualKeys.has(key)) continue;
    const id = uniqueId(asset.id, visualIds, "image");
    visualIds.add(id);
    visualKeys.add(key);
    visualAssets.push(id === asset.id ? asset : { ...asset, id });
  }

  const gaps = dedupeStrings([
    ...input.pool.gaps,
    ...input.decision.gaps,
    ...input.gaps,
    ...(input.webDraft?.gaps ?? []),
    ...(input.visualDraft?.gaps ?? []),
  ]);
  const nextRejected = [
    ...rejectedMaterial,
    ...(input.webDraft?.rejected_material ?? []),
    ...(input.visualDraft?.rejected_material ?? []),
  ];
  const nextPool: ResearchDiscoveryEvidencePool = {
    ...input.pool,
    facts,
    derived_insights: derivedInsights,
    visual_assets: visualAssets,
    gaps,
    rejected_material: nextRejected,
    source_summaries: [
      ...input.pool.source_summaries,
      ...(input.webDraft?.source_summary ? [{
        id: `${input.draftPageId}-web-summary`,
        kind: "web" as const,
        summary: input.webDraft.source_summary,
        source_count: input.querySummaries.filter((summary) => summary.kind === "web" && summary.status === "collected").length,
        updated_at: input.now,
      }] : []),
      ...(input.visualDraft?.visual_summary ? [{
        id: `${input.draftPageId}-visual-summary`,
        kind: "visual" as const,
        summary: input.visualDraft.visual_summary,
        source_count: input.querySummaries.filter((summary) => summary.kind === "visual" && summary.status === "collected").length,
        updated_at: input.now,
      }] : []),
    ],
    iterations: [
      ...input.pool.iterations,
      {
        id: `research-discovery-${input.phase}-${input.iteration}-${Date.now().toString(36)}`,
        phase: input.phase,
        iteration: input.iteration,
        status: gaps.length > input.pool.gaps.length ? "gap" : "completed",
        decision: input.decision,
        query_summaries: input.querySummaries,
        draft_page_id: input.draftPageId,
        curation_run_id: input.curationRunId,
        gaps: dedupeStrings([...input.decision.gaps, ...input.gaps, ...(input.webDraft?.gaps ?? []), ...(input.visualDraft?.gaps ?? [])]),
        merged_counts: {
          facts: facts.length,
          derived_insights: derivedInsights.length,
          visual_assets: visualAssets.length,
          gaps: gaps.length,
          rejected_material: nextRejected.length,
        },
        completed_at: input.now,
      },
    ],
    updated_at: input.now,
  };
  return {
    ...nextPool,
    status: poolStatus(nextPool),
  };
}

function makeDiscoveryBatchPage(input: {
  pagePlan: PagePlan;
  phase: "web" | "visual";
  iteration: number;
  targetPageIds?: string[];
}): PagePlanItem {
  const targetIds = new Set(input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id));
  const targetPages = input.pagePlan.pages.filter((page) => targetIds.has(page.page_id));
  return {
    page_id: `discovery-${input.phase}-${input.iteration}`,
    index: 0,
    title: `Deck-level ${input.phase} Research Discovery batch ${input.iteration}`,
    outline: targetPages
      .map((page) => `Page ${page.index + 1} (${page.page_id}) ${page.title}: ${page.outline}`)
      .join("\n"),
    blueprint_id: "research-discovery",
    blueprint_source: "./blueprints/research-discovery.tsx",
    slide_path: "./slides/research-discovery.tsx",
    data_path: "./data/research-discovery.json",
    manifest_slide_id: `research-discovery-${input.phase}-${input.iteration}`,
    reason: "Temporary curation batch page used only for Research Discovery.",
  };
}

function makeRequirement(input: {
  page: PagePlanItem;
  phase: "web" | "visual";
  decision: ResearchDiscoveryDecision;
}): ResearchRequirement {
  return {
    page_id: input.page.page_id,
    index: input.page.index,
    title: input.page.title,
    web_research_needed: input.phase === "web",
    image_research_needed: input.phase === "visual",
    query_intents: input.phase === "web" ? input.decision.queries : [],
    image_query_intents: input.phase === "visual" ? input.decision.queries : [],
    evidence_needs: input.decision.evidence_needs,
    visual_needs: input.decision.visual_needs,
    gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
    reason: input.decision.rationale,
  };
}

function completedQueryKeys(pool: ResearchDiscoveryEvidencePool, phase: "web" | "visual") {
  return new Set(
    pool.iterations.flatMap((iteration) =>
      iteration.phase === phase
        ? iteration.query_summaries
            .filter((summary) => summary.status === "collected" || summary.status === "skipped_duplicate")
            .map((summary) => normalizeResearchQueryKey(summary.query))
        : [],
    ),
  );
}

async function collectQueries(input: {
  runtime: DeckGenerationRuntime;
  paths: { raw_web_dir: string; raw_images_dir: string };
  phase: "web" | "visual";
  queries: string[];
  pool: ResearchDiscoveryEvidencePool;
}): Promise<{
  rawIndexPaths: string[];
  summaries: ResearchDiscoveryQuerySummary[];
  progressQueries: ResearchDiscoveryProgressQuery[];
  gaps: string[];
}> {
  const rawIndexPaths: string[] = [];
  const summaries: ResearchDiscoveryQuerySummary[] = [];
  const progressQueries: ResearchDiscoveryProgressQuery[] = [];
  const gaps: string[] = [];
  const completed = completedQueryKeys(input.pool, input.phase);
  for (const query of input.queries) {
    throwIfCancelled(input.runtime);
    const key = normalizeResearchQueryKey(query);
    if (completed.has(key)) {
      summaries.push({ kind: input.phase, query, status: "skipped_duplicate" });
      progressQueries.push({ kind: input.phase, query, status: "skipped_duplicate" });
      continue;
    }
    try {
      if (input.phase === "web") {
        const search = await input.runtime.backend.webSearch({
          query,
          max_results: 6,
          safesearch: "moderate",
        });
        const urls = search.results.map((item) => item.url).filter(Boolean).slice(0, 5);
        if (urls.length === 0) {
          const message = `No web search results for: ${query}`;
          gaps.push(message);
          summaries.push({ kind: "web", query, status: "gap", result_count: 0, message });
          progressQueries.push({
            kind: "web",
            query,
            status: "gap",
            resultCount: 0,
            fetchCount: 0,
            message,
          });
          continue;
        }
        const fetched = await input.runtime.backend.webFetch({
          urls,
          output_dir: input.paths.raw_web_dir,
          format: "text_markdown",
          max_chars: WEB_RESEARCH_FETCH_MAX_CHARS,
        });
        const fetchCount = summarizeWebFetchCount(fetched as WebFetchResult, 0);
        if (fetched.index_path && fetchCount > 0) {
          rawIndexPaths.push(fetched.index_path);
          summaries.push({
            kind: "web",
            query,
            status: "collected",
            raw_index_path: fetched.index_path,
            result_count: search.count,
            fetch_count: fetchCount,
          });
          progressQueries.push(summarizeWebFetchResult({
            query,
            resultCount: search.count,
            fetched,
          }));
        } else {
          const message = fetched.index_path
            ? `No web sources were fetched successfully for: ${query}`
            : `Web fetch did not return an index path for: ${query}`;
          gaps.push(message);
          summaries.push({
            kind: "web",
            query,
            status: "gap",
            result_count: search.count,
            fetch_count: fetchCount,
            message,
          });
          progressQueries.push({
            ...summarizeWebFetchResult({
              query,
              resultCount: search.count,
              fetched,
            }),
            status: "gap",
            message,
          });
        }
      } else {
        const search = await input.runtime.backend.imageSearch({
          query,
          max_results: 8,
          safesearch: "moderate",
        });
        const urls = search.results
          .filter((item) => !item.width || !item.height || (item.width >= 480 && item.height >= 270))
          .map((item) => item.image_url)
          .filter(Boolean)
          .slice(0, 4);
        if (urls.length === 0) {
          const message = `No image search results for: ${query}`;
          gaps.push(message);
          summaries.push({ kind: "visual", query, status: "gap", result_count: 0, message });
          progressQueries.push({
            kind: "visual",
            query,
            status: "gap",
            resultCount: 0,
            downloadCount: 0,
            message,
          });
          continue;
        }
        const fetched = await input.runtime.backend.imageFetch({
          urls,
          output_dir: input.paths.raw_images_dir,
        });
        const downloadCount = summarizeImageFetchCount(fetched as ImageFetchResult, 0);
        if (fetched.index_path && downloadCount > 0) {
          rawIndexPaths.push(fetched.index_path);
          summaries.push({
            kind: "visual",
            query,
            status: "collected",
            raw_index_path: fetched.index_path,
            result_count: search.count,
            fetch_count: downloadCount,
          });
          progressQueries.push(summarizeImageFetchResult({
            query,
            resultCount: search.count,
            fetched,
          }));
        } else {
          const message = fetched.index_path
            ? `No images were downloaded successfully for: ${query}`
            : `Image fetch did not return an index path for: ${query}`;
          gaps.push(message);
          summaries.push({
            kind: "visual",
            query,
            status: "gap",
            result_count: search.count,
            fetch_count: downloadCount,
            message,
          });
          progressQueries.push({
            ...summarizeImageFetchResult({
              query,
              resultCount: search.count,
              fetched,
            }),
            status: "gap",
            message,
          });
        }
      }
    } catch (error) {
      if (isAgentRunCancelledError(error)) throw error;
      const message = `${input.phase === "web" ? "Web" : "Image"} research failed for "${query}": ${error instanceof Error ? error.message : String(error)}`;
      gaps.push(message);
      summaries.push({ kind: input.phase, query, status: "error", message });
      progressQueries.push({ kind: input.phase, query, status: "error", message });
    }
  }
  return { rawIndexPaths, summaries, progressQueries, gaps };
}

function buildDiscoveryLogContext(input: {
  runtime: DeckGenerationRuntime;
  operation: string;
  phase?: "web" | "visual";
}): AiOperationLogContext | undefined {
  return input.runtime.aiLogger
    ? {
        logger: input.runtime.aiLogger,
        workspace_dir: input.runtime.workspace.workspace_dir,
        domain: "research",
        operation: input.operation,
        operation_id: input.runtime.aiLogger.createOperationId("research", input.operation),
        kind: input.phase,
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
}

function emitResearchProgress(input: {
  runtime: DeckGenerationRuntime;
  pagePlan: PagePlan;
  message: string;
  step: "research-discovery" | "research-collection" | "research-curation" | "evidence-page-planning";
  stream?: import("./types").DeckGenerationStream | null;
}) {
  emitRuntimeProgress(
    input.runtime,
    {
      step: input.step,
      message: input.message,
      currentPageIndex: null,
      totalPages: input.pagePlan.pages.length,
    },
    input.runtime.getProgress(),
    input.stream,
    getAttemptLimits(input.runtime),
  );
}

async function updateDiscoveryProgress(input: {
  runtime: DeckGenerationRuntime;
  pagePlan: PagePlan;
  message: string;
  step: "research-discovery" | "research-collection" | "research-curation" | "evidence-page-planning";
  update: () => NonNullable<DeckGenerationRuntime["researchDiscoveryProgress"]>;
  stream?: import("./types").DeckGenerationStream | null;
}) {
  setRuntimeResearchDiscoveryProgress(input.runtime, input.update());
  const progress = await recordDeckRecovery(input.runtime, {
    status: "running",
    run_kind: input.runtime.refinementRunKind ?? (input.runtime.pageRefinementRequests ? "page-refinement" : "deck-generation"),
    step: input.step,
    target_page_ids: input.pagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
    research_discovery: input.runtime.researchDiscoveryProgress,
  });
  input.runtime.setProgress(progress);
  emitResearchProgress({
    runtime: input.runtime,
    pagePlan: input.pagePlan,
    message: input.message,
    step: input.step,
    stream: input.stream,
  });
}

async function runDiscoveryPhase(input: {
  runtime: DeckGenerationRuntime;
  pagePlan: PagePlan;
  phase: "web" | "visual";
  targetPageIds?: string[];
  pool: ResearchDiscoveryEvidencePool;
  paths: { raw_web_dir: string; raw_images_dir: string; evidence_drafts_dir: string };
}): Promise<ResearchDiscoveryEvidencePool> {
  const text = generationText(input.runtime.locale);
  let pool = input.pool;
  let stopped = false;
  for (let iteration = 1; iteration <= RESEARCH_DISCOVERY_ITERATION_LIMIT; iteration += 1) {
    throwIfCancelled(input.runtime);
    const decisionPhase = input.phase === "web" ? "web-decision" : "visual-decision";
    const collectionPhase = input.phase === "web" ? "web-collection" : "visual-collection";
    const curationPhase = input.phase === "web" ? "web-curation" : "visual-curation";
    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-discovery",
      message: input.phase === "web" ? text.webResearchDiscovery : text.visualResearchDiscovery,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: decisionPhase,
        state: "active",
        iteration,
      }),
    });
    let decision: ResearchDiscoveryDecision;
    try {
      decision = await input.runtime.aiClient.generateResearchDiscoveryDecision({
        outline: input.runtime.confirmedOutline,
        pagePlan: input.pagePlan,
        phase: input.phase,
        iteration,
        iterationLimit: RESEARCH_DISCOVERY_ITERATION_LIMIT,
        targetPageIds: input.targetPageIds,
        discoveryPool: pool,
        researchStatus: await input.runtime.backend.getResearchStatus({
          workspace_dir: input.runtime.workspace.workspace_dir,
        }).catch(() => null),
        locale: input.runtime.locale,
        logContext: buildDiscoveryLogContext({
          runtime: input.runtime,
          operation: `research_discovery_${input.phase}_decision`,
          phase: input.phase,
        }),
      });
    } catch (error) {
      if (isAgentRunCancelledError(error)) throw error;
      decision = {
        action: "stop",
        phase: input.phase,
        queries: [],
        rationale: "Research Discovery decision failed; continuing with a gap.",
        evidence_needs: [],
        visual_needs: [],
        gaps: [`Research Discovery decision failed for ${input.phase}: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
    await appendResearchLogSafe(input.runtime, {
      event: `ai.research.discovery.${input.phase}.decision`,
      schema_version: 1,
      iteration,
      decision,
      target_page_ids: input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id),
      updated_at: new Date().toISOString(),
    });
    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-discovery",
      message: input.phase === "web" ? text.webResearchDiscovery : text.visualResearchDiscovery,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: decisionPhase,
        state: decision.gaps.length > 0 ? "warning" : "completed",
        iteration,
        ...summarizeDecision(decision),
      }),
    });
    if (decision.action === "stop" || decision.queries.length === 0) {
      stopped = true;
      if (decision.gaps.length > 0) {
        pool = {
          ...pool,
          gaps: dedupeStrings([...pool.gaps, ...decision.gaps]),
          updated_at: new Date().toISOString(),
        };
        pool.status = poolStatus(pool);
      }
      await updateDiscoveryProgress({
        runtime: input.runtime,
        pagePlan: input.pagePlan,
        step: "research-collection",
        message: input.phase === "web" ? text.collectingWebSources : text.collectingVisualSources,
        update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
          phase: collectionPhase,
          state: "completed",
          iteration,
          activities: [
            input.phase === "web"
              ? "无需网页搜索，已跳过搜索与抓取。"
              : "无需图片搜索，已跳过图片素材收集。",
          ],
        }),
      });
      await updateDiscoveryProgress({
        runtime: input.runtime,
        pagePlan: input.pagePlan,
        step: "research-curation",
        message: input.phase === "web" ? text.curatingDiscoveryFacts : text.curatingDiscoveryImages,
        update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
          phase: curationPhase,
          state: "completed",
          iteration,
          activities: [
            input.phase === "web"
              ? "无需筛选网页事实证据。"
              : "无需筛选图片素材。",
          ],
        }),
      });
      break;
    }

    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-collection",
      message: input.phase === "web" ? text.collectingWebSources : text.collectingVisualSources,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: collectionPhase,
        state: "active",
        iteration,
      }),
    });
    const collection = await collectQueries({
      runtime: input.runtime,
      paths: input.paths,
      phase: input.phase,
      queries: decision.queries,
      pool,
    });
    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-collection",
      message: input.phase === "web" ? text.collectingWebSources : text.collectingVisualSources,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: collectionPhase,
        state: collection.gaps.length > 0 ? "warning" : "completed",
        iteration,
        queries: collection.progressQueries.length > 0
          ? collection.progressQueries
          : summarizeQueries(collection.summaries),
        gaps: collection.gaps,
        counts: {
          gaps: collection.gaps.length,
        },
      }),
    });
    const batchPage = makeDiscoveryBatchPage({
      pagePlan: input.pagePlan,
      phase: input.phase,
      iteration,
      targetPageIds: input.targetPageIds,
    });
    const requirement = makeRequirement({
      page: batchPage,
      phase: input.phase,
      decision,
    });
    const curationRunId = createResearchCurationRunId(batchPage, input.phase === "web" ? "web" : "visual");
    const draftId = buildDiscoveryDraftId({
      phase: input.phase,
      iteration,
      curationRunId,
      targetPageIds: input.targetPageIds,
      allPageIds: input.pagePlan.pages.map((page) => page.page_id),
    });
    const draftType = input.phase === "web" ? "web" : "visual";
    const draftPath = `${input.paths.evidence_drafts_dir}/${draftId}-${draftType}.json`;

    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-curation",
      message: input.phase === "web" ? text.curatingDiscoveryFacts : text.curatingDiscoveryImages,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: curationPhase,
        state: "active",
        iteration,
      }),
    });
    let webDraft: WebResearchCurationDraft | null = null;
    let visualDraft: VisualResearchCurationDraft | null = null;
    if (collection.rawIndexPaths.length > 0) {
      const draft = await runResearchDraftAgent({
        flowInput: input.runtime,
        pagePlan: {
          ...input.pagePlan,
          pages: [batchPage],
        },
        page: batchPage,
        kind: input.phase === "web" ? "web" : "visual",
        curationRunId,
        buildPrompt: (previousGateFailure) => input.phase === "web"
          ? buildWebResearchCurationPrompt({
              workspaceRoot: input.runtime.workspace.workspace_root,
              workspaceDir: input.runtime.workspace.workspace_dir,
              page: batchPage,
              requirement,
              rawWebIndexPaths: collection.rawIndexPaths,
              draftPath,
              curationRunId,
              previousGateFailure,
            })
          : buildVisualResearchCurationPrompt({
              workspaceRoot: input.runtime.workspace.workspace_root,
              workspaceDir: input.runtime.workspace.workspace_dir,
              page: batchPage,
              requirement,
              rawImageIndexPaths: collection.rawIndexPaths,
              draftPath,
              curationRunId,
              previousGateFailure,
            }),
        draftPath,
        draftId,
        agentPathContext: createAgentFileToolPathContext({
          workspaceRoot: input.runtime.workspace.workspace_root,
          workspaceDir: input.runtime.workspace.workspace_dir,
        }),
        currentGaps: collection.gaps,
      });
      if (input.phase === "web") {
        webDraft = draft as WebResearchCurationDraft | null;
      } else {
        visualDraft = draft as VisualResearchCurationDraft | null;
      }
    } else if (input.phase === "web") {
      webDraft = createWebResearchCurationGapDraft({
        pageId: batchPage.page_id,
        curationRunId,
        gaps: collection.gaps.length > 0 ? collection.gaps : ["No raw web material was collected for this discovery iteration."],
      });
      await input.runtime.backend.recordResearchCurationDraft({
        workspace_dir: input.runtime.workspace.workspace_dir,
        page_id: batchPage.page_id,
        draft_type: "web",
        draft_id: draftId,
        draft: webDraft,
      });
    } else {
      visualDraft = createVisualResearchCurationGapDraft({
        pageId: batchPage.page_id,
        curationRunId,
        gaps: collection.gaps.length > 0 ? collection.gaps : ["No raw image material was collected for this discovery iteration."],
      });
      await input.runtime.backend.recordResearchCurationDraft({
        workspace_dir: input.runtime.workspace.workspace_dir,
        page_id: batchPage.page_id,
        draft_type: "visual",
        draft_id: draftId,
        draft: visualDraft,
      });
    }

    if (visualDraft && visualDraft.visual_assets.length > 0) {
      try {
        const finalized = await input.runtime.backend.finalizeResearchVisualAssets({
          workspace_dir: input.runtime.workspace.workspace_dir,
          page_id: batchPage.page_id,
          visual_assets: visualDraft.visual_assets,
          raw_image_index_paths: collection.rawIndexPaths,
        });
        visualDraft = {
          ...visualDraft,
          visual_assets: finalized.visual_assets,
          gaps: [...visualDraft.gaps, ...finalized.gaps],
          rejected_material: [...visualDraft.rejected_material, ...finalized.rejected_material],
        };
      } catch (error) {
        visualDraft = {
          ...visualDraft,
          visual_assets: [],
          gaps: [
            ...visualDraft.gaps,
            `Visual research assets could not be finalized: ${error instanceof Error ? error.message : String(error)}`,
          ],
        };
      }
    }

    const curationSummary = input.phase === "web"
      ? summarizeWebDraft(webDraft)
      : summarizeVisualDraft(visualDraft);
    await updateDiscoveryProgress({
      runtime: input.runtime,
      pagePlan: input.pagePlan,
      step: "research-curation",
      message: input.phase === "web" ? text.curatingDiscoveryFacts : text.curatingDiscoveryImages,
      update: () => updateResearchDiscoveryPhase(input.runtime.researchDiscoveryProgress, {
        phase: curationPhase,
        state: (curationSummary.gaps?.length ?? 0) > 0 ? "warning" : "completed",
        iteration,
        ...curationSummary,
      }),
    });

    const now = new Date().toISOString();
    pool = mergeDraftIntoPool({
      pool,
      phase: input.phase,
      iteration,
      decision,
      querySummaries: collection.summaries,
      draftPageId: batchPage.page_id,
      curationRunId,
      webDraft,
      visualDraft,
      gaps: collection.gaps,
      now,
    });
    const currentEvidence = normalizeResearchEvidenceIndex(
      await input.runtime.backend.getResearchEvidence({
        workspace_dir: input.runtime.workspace.workspace_dir,
      }),
    );
    await input.runtime.backend.recordResearchEvidence({
      workspace_dir: input.runtime.workspace.workspace_dir,
      evidence: {
        ...currentEvidence,
        discovery_pool: pool,
        updated_at: now,
      },
    });
    setRuntimeResearchDiscoveryProgress(
      input.runtime,
      applyResearchDiscoveryPoolSummary(input.runtime.researchDiscoveryProgress, pool, now),
    );
  }
  if (!stopped) {
    pool = {
      ...pool,
      status: "gap",
      gaps: dedupeStrings([
        ...pool.gaps,
        `${input.phase === "web" ? "Web" : "Visual"} Research Discovery reached the iteration limit (${RESEARCH_DISCOVERY_ITERATION_LIMIT}).`,
      ]),
      updated_at: new Date().toISOString(),
    };
    setRuntimeResearchDiscoveryProgress(
      input.runtime,
      applyResearchDiscoveryPoolSummary(input.runtime.researchDiscoveryProgress, pool),
    );
  }
  return pool;
}

function buildPageEvidenceMarkdown(pageEvidence: ResearchEvidencePage, page: PagePlanItem): string {
  const lines = [
    `# Research Evidence: ${page.title}`,
    "",
    `Page: ${page.page_id}`,
    `Status: ${pageEvidence.status}`,
    "",
    "## Content Plan",
    page.content_plan?.main_message ? `Main message: ${page.content_plan.main_message}` : "Main message: None",
    "",
    "## Facts",
    ...(pageEvidence.facts.length > 0
      ? pageEvidence.facts.flatMap((fact) => {
          const source = fact.source_title || fact.source_url || fact.source_file || fact.source_type;
          return [
            `- ${fact.id}: ${fact.claim}${source ? ` (Source: ${source})` : ""}`,
            ...(fact.excerpt ? [`  Excerpt: ${fact.excerpt}`] : []),
          ];
        })
      : ["- None"]),
    "",
    "## Derived Insights",
    ...(pageEvidence.derived_insights.length > 0
      ? pageEvidence.derived_insights.map((insight) => `- ${insight.id}: ${insight.insight} (Supports: ${insight.supporting_fact_ids.join(", ") || "none"})`)
      : ["- None"]),
    "",
    "## Visual Assets",
    ...(pageEvidence.visual_assets.length > 0
      ? pageEvidence.visual_assets.flatMap((asset) => [
          `- ${asset.id}: ${asset.file_path}`,
          `  Reason: ${asset.reason}`,
          `  Visual summary: ${asset.visual_summary}`,
        ])
      : ["- None"]),
    "",
    "## Gaps",
    ...(pageEvidence.gaps.length > 0 ? pageEvidence.gaps.map((gap) => `- ${gap}`) : ["- None"]),
    "",
    "## Rejected Material",
    ...(pageEvidence.rejected_material.length > 0
      ? pageEvidence.rejected_material.map((item) => `- ${item.source ? `${item.source}: ` : ""}${item.reason}`)
      : ["- None"]),
  ];
  return `${lines.join("\n")}\n`;
}

function materializePageEvidence(input: {
  page: PagePlanItem;
  pool: ResearchDiscoveryEvidencePool;
  evidenceMarkdownPath: string;
  now: string;
}): { pageEvidence: ResearchEvidencePage; markdown: string } {
  const contentPlan = input.page.content_plan;
  const factById = new Map(input.pool.facts.map((fact) => [fact.id, fact]));
  const insightById = new Map(input.pool.derived_insights.map((insight) => [insight.id, insight]));
  const visualById = new Map(input.pool.visual_assets.map((asset) => [asset.id, asset]));
  const gaps: string[] = [...(contentPlan?.gaps ?? [])];
  const facts = (contentPlan?.evidence_fact_ids ?? []).flatMap((id) => {
    const fact = factById.get(id);
    if (!fact) {
      gaps.push(`Missing assigned Research Evidence fact id: ${id}`);
      return [];
    }
    return [fact];
  });
  const factIds = new Set(facts.map((fact) => fact.id));
  const derivedInsights = (contentPlan?.derived_insight_ids ?? []).flatMap((id) => {
    const insight = insightById.get(id);
    if (!insight) {
      gaps.push(`Missing assigned Research Evidence insight id: ${id}`);
      return [];
    }
    const validSupportingFacts = insight.supporting_fact_ids.filter((factId) => factIds.has(factId));
    if (validSupportingFacts.length === 0) {
      gaps.push(`Assigned insight ${id} has no assigned supporting facts on this page.`);
      return [];
    }
    return [{ ...insight, supporting_fact_ids: validSupportingFacts }];
  });
  const visualAssets = (contentPlan?.visual_asset_ids ?? []).flatMap((id) => {
    const asset = visualById.get(id);
    if (!asset) {
      gaps.push(`Missing assigned Visual Research Evidence asset id: ${id}`);
      return [];
    }
    return [asset];
  });
  const hasEvidence = facts.length > 0 || derivedInsights.length > 0 || visualAssets.length > 0;
  const pageEvidence: ResearchEvidencePage = {
    page_id: input.page.page_id,
    status: hasEvidence ? "curated" : gaps.length > 0 ? "gap" : "skipped",
    facts,
    visual_assets: visualAssets,
    derived_insights: derivedInsights,
    gaps: dedupeStrings(gaps),
    rejected_material: [],
    markdown_path: input.evidenceMarkdownPath,
    updated_at: input.now,
  };
  return {
    pageEvidence,
    markdown: buildPageEvidenceMarkdown(pageEvidence, input.page),
  };
}

export async function runResearchDiscoveryForPagePlan(input: {
  runtime: DeckGenerationRuntime;
  pagePlan: PagePlan;
  targetPageIds?: string[];
}): Promise<PagePlan> {
  const { runtime } = input;
  const text = generationText(runtime.locale);
  const paths = await runtime.backend.prepareResearchWorkspace({
    workspace_dir: runtime.workspace.workspace_dir,
  });
  throwIfCancelled(runtime);
  await recordDeckRecovery(runtime, {
    status: "running",
    run_kind: runtime.refinementRunKind ?? (runtime.pageRefinementRequests ? "page-refinement" : "deck-generation"),
    step: "research-discovery",
    target_page_ids: input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
  });
  setRuntimeResearchDiscoveryProgress(runtime, createEmptyResearchDiscoveryProgress());
  emitResearchProgress({
    runtime,
    pagePlan: input.pagePlan,
    step: "research-discovery",
    message: text.webResearchDiscovery,
  });

  const existingEvidence = normalizeResearchEvidenceIndex(
    await runtime.backend.getResearchEvidence({
      workspace_dir: runtime.workspace.workspace_dir,
    }),
  );
  let pool = normalizeResearchDiscoveryEvidencePool(existingEvidence.discovery_pool);
  pool = await runDiscoveryPhase({
    runtime,
    pagePlan: input.pagePlan,
    phase: "web",
    targetPageIds: input.targetPageIds,
    pool,
    paths,
  });
  pool = await runDiscoveryPhase({
    runtime,
    pagePlan: input.pagePlan,
    phase: "visual",
    targetPageIds: input.targetPageIds,
    pool,
    paths,
  });

  await updateDiscoveryProgress({
    runtime,
    pagePlan: input.pagePlan,
    step: "evidence-page-planning",
    message: text.evidencePagePlanning,
    update: () => updateResearchDiscoveryPhase(runtime.researchDiscoveryProgress, {
      phase: "evidence-page-planning",
      state: "active",
    }),
  });
  let plannedPagePlan: PagePlan;
  try {
    plannedPagePlan = await runtime.aiClient.generateEvidenceAwarePagePlan({
      outline: runtime.confirmedOutline,
      pagePlan: input.pagePlan,
      discoveryPool: pool,
      targetPageIds: input.targetPageIds,
      locale: runtime.locale,
      logContext: buildDiscoveryLogContext({
        runtime,
        operation: "evidence_aware_page_plan",
      }),
    });
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    const targetIds = new Set(input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id));
    plannedPagePlan = {
      ...input.pagePlan,
      pages: input.pagePlan.pages.map((page) => targetIds.has(page.page_id)
        ? {
            ...page,
            content_plan: {
              main_message: page.outline || page.title,
              content_points: [page.outline || page.title],
              evidence_fact_ids: [],
              derived_insight_ids: [],
              visual_asset_ids: [],
              gaps: [`Evidence-Aware Page Planning failed: ${error instanceof Error ? error.message : String(error)}`],
              authoring_notes: ["No evidence was assigned because evidence-aware planning failed."],
            },
          }
        : page),
      updated_at: new Date().toISOString(),
    };
  }
  await updateDiscoveryProgress({
    runtime,
    pagePlan: input.pagePlan,
    step: "evidence-page-planning",
    message: text.evidencePagePlanning,
    update: () => updateResearchDiscoveryPhase(runtime.researchDiscoveryProgress, {
      phase: "evidence-page-planning",
      state: pool.gaps.length > 0 ? "warning" : "completed",
      gaps: pool.gaps.slice(0, 8),
      counts: summarizeResearchDiscoveryPool(pool),
    }),
  });
  plannedPagePlan = await runtime.backend.recordPagePlan({
    workspace_dir: runtime.workspace.workspace_dir,
    page_plan: plannedPagePlan,
  });
  throwIfCancelled(runtime);

  const targetIds = new Set(input.targetPageIds ?? plannedPagePlan.pages.map((page) => page.page_id));
  for (const page of plannedPagePlan.pages.filter((page) => targetIds.has(page.page_id))) {
    const evidenceMarkdownPath = `${paths.evidence_pages_dir}/${page.page_id}.md`;
    const materialized = materializePageEvidence({
      page,
      pool,
      evidenceMarkdownPath,
      now: new Date().toISOString(),
    });
    await runtime.backend.recordResearchEvidencePageMarkdown({
      workspace_dir: runtime.workspace.workspace_dir,
      page_id: page.page_id,
      markdown: materialized.markdown,
    });
    await runtime.backend.recordResearchEvidencePage({
      workspace_dir: runtime.workspace.workspace_dir,
      page_evidence: materialized.pageEvidence,
    });
    await runtime.backend.recordResearchStatusPage({
      workspace_dir: runtime.workspace.workspace_dir,
      page_status: {
        page_id: page.page_id,
        status: materialized.pageEvidence.status,
        message: materialized.pageEvidence.gaps.join("\n"),
        evidence_path: evidenceMarkdownPath,
      },
    });
  }
  const currentEvidence = normalizeResearchEvidenceIndex(
    await runtime.backend.getResearchEvidence({
      workspace_dir: runtime.workspace.workspace_dir,
    }),
  );
  await runtime.backend.recordResearchEvidence({
    workspace_dir: runtime.workspace.workspace_dir,
    evidence: {
      ...currentEvidence,
      discovery_pool: pool,
      updated_at: new Date().toISOString(),
    },
  });
  const latestResearchStatus = await runtime.backend.getResearchStatus({
    workspace_dir: runtime.workspace.workspace_dir,
  }).catch(() => null);
  await runtime.backend.recordResearchStatus({
    workspace_dir: runtime.workspace.workspace_dir,
    status: {
      ...(latestResearchStatus ?? {}),
      version: 1,
      status: pool.status === "gap" || pool.status === "partial" ? "gap" : "ready",
      pages: latestResearchStatus?.pages ?? [],
      updated_at: new Date().toISOString(),
    },
  });
  await appendResearchLogSafe(runtime, {
    event: "ai.research.discovery.materialization.finished",
    schema_version: 1,
    target_page_ids: Array.from(targetIds),
    pool_status: pool.status,
    pool_counts: {
      facts: pool.facts.length,
      derived_insights: pool.derived_insights.length,
      visual_assets: pool.visual_assets.length,
      gaps: pool.gaps.length,
    },
    updated_at: new Date().toISOString(),
  });
  return plannedPagePlan;
}
