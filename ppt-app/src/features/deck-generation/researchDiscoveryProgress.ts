import type {
  ResearchCurationRejectedMaterial,
  ResearchDiscoveryDecision,
  ResearchDiscoveryEvidencePool,
  ResearchDiscoveryQuerySummary,
  ResearchEvidenceFact,
  ImageFetchResult,
  VisualResearchCurationDraft,
  VisualResearchEvidence,
  WebFetchResult,
  WebResearchCurationDraft,
} from "../../api/types";
import type {
  DeckGenerationRuntime,
  DeckGenerationStream,
  ResearchDiscoveryProgress,
  ResearchDiscoveryProgressPhase,
  ResearchDiscoveryProgressPhaseRecord,
  ResearchDiscoveryProgressQuery,
  ResearchDiscoveryProgressSource,
  ResearchDiscoveryProgressState,
  ResearchDiscoveryProgressSummary,
  ResearchDiscoveryProgressVisualAsset,
} from "./types";

const PHASES: ResearchDiscoveryProgressPhase[] = [
  "web-decision",
  "web-collection",
  "web-curation",
  "visual-decision",
  "visual-collection",
  "visual-curation",
  "evidence-page-planning",
];
const MAX_PHASE_ITEMS = 24;

export function createEmptyResearchDiscoveryProgress(
  now = new Date().toISOString(),
): ResearchDiscoveryProgress {
  return {
    status: "pending",
    records: PHASES.map((phase) => ({
      phase,
      state: "pending",
      updatedAt: now,
    })),
    summary: {
      facts: 0,
      derivedInsights: 0,
      visualAssets: 0,
      gaps: 0,
      rejectedMaterial: 0,
    },
    updatedAt: now,
  };
}

export function startResearchDiscoveryProgress(
  current?: ResearchDiscoveryProgress,
  now = new Date().toISOString(),
): ResearchDiscoveryProgress {
  return current ?? createEmptyResearchDiscoveryProgress(now);
}

export function updateResearchDiscoveryPhase(
  current: ResearchDiscoveryProgress | undefined,
  patch: Omit<Partial<ResearchDiscoveryProgressPhaseRecord>, "phase"> & {
    phase: ResearchDiscoveryProgressPhase;
    state: ResearchDiscoveryProgressState;
  },
  now = new Date().toISOString(),
): ResearchDiscoveryProgress {
  const base = startResearchDiscoveryProgress(current, now);
  const records = base.records.map((record) =>
    record.phase === patch.phase
      ? (() => {
          const gaps = mergeStrings(record.gaps, patch.gaps);
          const state = patch.state === "completed" && gaps && gaps.length > 0
            ? "warning"
            : patch.state;
          return {
            ...record,
            ...patch,
            state,
            queries: mergeQueries(record.queries, patch.queries),
            sources: mergeSources(record.sources, patch.sources),
            visualAssets: mergeVisualAssets(record.visualAssets, patch.visualAssets),
            activities: patch.activities ?? record.activities,
            lines: patch.lines ?? record.lines,
            gaps,
            rejectedReasons: mergeStrings(record.rejectedReasons, patch.rejectedReasons),
            counts: mergeCounts(record.counts, patch.counts),
            updatedAt: now,
          };
        })()
      : record,
  );
  return {
    ...base,
    status: progressStatus(records),
    records,
    updatedAt: now,
  };
}

export function applyResearchDiscoveryPoolSummary(
  current: ResearchDiscoveryProgress | undefined,
  pool: ResearchDiscoveryEvidencePool,
  now = new Date().toISOString(),
): ResearchDiscoveryProgress {
  const summary = summarizeResearchDiscoveryPool(pool);
  const base = startResearchDiscoveryProgress(current, now);
  return {
    ...base,
    status: summary.gaps > 0 ? "warning" : "completed",
    summary,
    updatedAt: now,
  };
}

export function summarizeResearchDiscoveryPool(
  pool: Pick<
    ResearchDiscoveryEvidencePool,
    "facts" | "derived_insights" | "visual_assets" | "gaps" | "rejected_material"
  >,
): ResearchDiscoveryProgressSummary {
  return {
    facts: pool.facts.length,
    derivedInsights: pool.derived_insights.length,
    visualAssets: pool.visual_assets.length,
    gaps: pool.gaps.length,
    rejectedMaterial: pool.rejected_material.length,
  };
}

export function updateResearchDiscoveryCurationStream(
  current: ResearchDiscoveryProgress | undefined,
  phase: "web" | "visual",
  stream?: DeckGenerationStream | null,
  now = new Date().toISOString(),
): ResearchDiscoveryProgress {
  if (!stream) return startResearchDiscoveryProgress(current, now);
  return updateResearchDiscoveryPhase(current, {
    phase: phase === "web" ? "web-curation" : "visual-curation",
    state: stream.status === "error" ? "failed" : stream.status === "completed" ? "completed" : "active",
    activities: [...stream.activities],
    lines: [...stream.lines],
  }, now);
}

export function setRuntimeResearchDiscoveryProgress(
  runtime: DeckGenerationRuntime,
  progress: ResearchDiscoveryProgress,
) {
  runtime.researchDiscoveryProgress = progress;
}

export function summarizeDecision(
  decision: ResearchDiscoveryDecision,
): Pick<ResearchDiscoveryProgressPhaseRecord, "rationale" | "gaps" | "counts"> {
  return {
    rationale: trimForUi(decision.rationale, 320),
    gaps: cleanStrings(decision.gaps).slice(0, 6),
    counts: {
      gaps: decision.gaps.length,
    },
  };
}

export function summarizeQueries(
  summaries: ResearchDiscoveryQuerySummary[],
): ResearchDiscoveryProgressQuery[] {
  return summaries.map((summary) => ({
    kind: summary.kind,
    query: trimForUi(summary.query, 180),
    status: summary.status,
    resultCount: summary.result_count,
    fetchCount: summary.kind === "web" ? summary.fetch_count : undefined,
    downloadCount: summary.kind === "visual" ? summary.fetch_count : undefined,
    message: summary.message ? trimForUi(summary.message, 240) : undefined,
  }));
}

export function summarizeWebFetchResult(input: {
  query: string;
  resultCount?: number;
  fetched?: WebFetchResult | null;
  fallbackSources?: ResearchEvidenceFact[];
}): ResearchDiscoveryProgressQuery {
  const records = successfulFetchRecords(input.fetched);
  const fetchCount = records.length;
  const failedCount = failedFetchRecords(input.fetched).length;
  const sources = summarizeSources(
    records.flatMap((record) => {
      const title = readOptionalString(record.title) ?? readOptionalString(record.source_title);
      const url = readOptionalString(record.url) ?? readOptionalString(record.source_url);
      return title || url ? [{ title, url }] : [];
    }),
  );
  const fallbackSources = sources.length > 0
    ? sources
    : summarizeFactSources(input.fallbackSources ?? []);
  const failureMessage = failedCount > 0
    ? `${failedCount} fetch ${failedCount === 1 ? "failed" : "failures"} omitted.`
    : undefined;
  return {
    kind: "web",
    query: trimForUi(input.query, 180),
    status: fetchCount > 0 ? "collected" : "gap",
    resultCount: input.resultCount,
    fetchCount,
    message: fetchCount > 0
      ? failureMessage
      : "No web sources were fetched successfully.",
    sources: fetchCount > 0 ? fallbackSources : undefined,
  };
}

export function summarizeImageFetchResult(input: {
  query: string;
  resultCount?: number;
  fetched?: ImageFetchResult | null;
}): ResearchDiscoveryProgressQuery {
  const downloadCount = successfulFetchRecords(input.fetched).length;
  const failedCount = failedFetchRecords(input.fetched).length;
  return {
    kind: "visual",
    query: trimForUi(input.query, 180),
    status: downloadCount > 0 ? "collected" : "gap",
    resultCount: input.resultCount,
    downloadCount,
    message: downloadCount > 0
      ? failedCount > 0
        ? `${failedCount} image download ${failedCount === 1 ? "failed" : "failures"} omitted.`
        : undefined
      : "No images were downloaded successfully.",
  };
}

export function summarizeWebFetchCount(result: WebFetchResult | null | undefined, fallback: number) {
  if (Array.isArray(result?.results)) return successfulFetchRecords(result).length;
  if (typeof result?.count === "number") return result.count;
  return fallback;
}

export function summarizeImageFetchCount(result: ImageFetchResult | null | undefined, fallback: number) {
  if (Array.isArray(result?.results)) return successfulFetchRecords(result).length;
  if (typeof result?.count === "number") return result.count;
  return fallback;
}

export function summarizeWebDraft(
  draft: WebResearchCurationDraft | null | undefined,
): Pick<ResearchDiscoveryProgressPhaseRecord, "sources" | "gaps" | "rejectedReasons" | "counts"> {
  const facts = draft?.facts ?? [];
  const rejected = draft?.rejected_material ?? [];
  return {
    sources: summarizeFactSources(facts),
    gaps: cleanStrings(draft?.gaps ?? []).slice(0, 8),
    rejectedReasons: summarizeRejectedMaterial(rejected),
    counts: {
      facts: facts.length,
      derivedInsights: draft?.derived_insights.length ?? 0,
      gaps: draft?.gaps.length ?? 0,
      rejectedMaterial: rejected.length,
    },
  };
}

export function summarizeVisualDraft(
  draft: VisualResearchCurationDraft | null | undefined,
): Pick<ResearchDiscoveryProgressPhaseRecord, "visualAssets" | "gaps" | "rejectedReasons" | "counts"> {
  const assets = draft?.visual_assets ?? [];
  const rejected = draft?.rejected_material ?? [];
  return {
    visualAssets: summarizeVisualAssets(assets),
    gaps: cleanStrings(draft?.gaps ?? []).slice(0, 8),
    rejectedReasons: summarizeRejectedMaterial(rejected),
    counts: {
      visualAssets: assets.length,
      gaps: draft?.gaps.length ?? 0,
      rejectedMaterial: rejected.length,
    },
  };
}

export function summarizeVisualAssets(
  assets: VisualResearchEvidence[],
): ResearchDiscoveryProgressVisualAsset[] {
  return assets.slice(0, 8).map((asset) => ({
    id: trimForUi(asset.id, 80),
    filePath: asset.file_path,
    imageUrl: asset.image_url,
    thumbnailUrl: asset.image_url,
    pageUrl: asset.page_url,
    reason: trimForUi(asset.reason, 220),
    visualSummary: trimForUi(asset.visual_summary, 260),
  }));
}

export function summarizeFactSources(facts: ResearchEvidenceFact[]) {
  return summarizeSources(facts.map((fact) => ({
    title: fact.source_title,
    url: fact.source_url,
  })));
}

function summarizeSources(
  sources: ResearchDiscoveryProgressSource[],
): ResearchDiscoveryProgressSource[] {
  const seen = new Set<string>();
  const result: ResearchDiscoveryProgressSource[] = [];
  for (const source of sources) {
    const title = source.title ? trimForUi(source.title, 160) : undefined;
    const url = source.url ? trimForUi(source.url, 260) : undefined;
    if (!title && !url) continue;
    const key = `${title ?? ""}\n${url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ title, url });
    if (result.length >= 8) break;
  }
  return result;
}

function successfulFetchRecords(result: WebFetchResult | ImageFetchResult | null | undefined) {
  return Array.isArray(result?.results)
    ? result.results.filter((record) =>
        Boolean(record) &&
        typeof record === "object" &&
        typeof record.file_path === "string" &&
        record.file_path.trim().length > 0 &&
        !record.error
      )
    : [];
}

function failedFetchRecords(result: WebFetchResult | ImageFetchResult | null | undefined) {
  return Array.isArray(result?.results)
    ? result.results.filter((record) =>
        Boolean(record) &&
        typeof record === "object" &&
        Boolean(record.error)
      )
    : [];
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function summarizeRejectedMaterial(
  rejected: ResearchCurationRejectedMaterial[],
): string[] {
  return cleanStrings(rejected.map((item) =>
    item.source
      ? `${trimForUi(item.source, 90)}: ${trimForUi(item.reason, 180)}`
      : trimForUi(item.reason, 220)
  )).slice(0, 6);
}

function progressStatus(records: ResearchDiscoveryProgressPhaseRecord[]): ResearchDiscoveryProgressState {
  if (records.some((record) => record.state === "failed")) return "failed";
  if (records.some((record) => record.state === "active")) return "active";
  const hasWarning = records.some((record) => record.state === "warning");
  const hasStarted = records.some((record) => record.state === "completed" || record.state === "warning");
  const allTerminal = records.every((record) => record.state === "completed" || record.state === "warning");
  if (hasWarning) return "warning";
  if (hasStarted) return allTerminal ? "completed" : "active";
  return "pending";
}

function mergeQueries(
  existing: ResearchDiscoveryProgressQuery[] | undefined,
  incoming: ResearchDiscoveryProgressQuery[] | undefined,
): ResearchDiscoveryProgressQuery[] | undefined {
  if (!incoming) return existing;
  const merged = [...(existing ?? []), ...incoming];
  return merged.slice(Math.max(0, merged.length - MAX_PHASE_ITEMS));
}

function mergeSources(
  existing: ResearchDiscoveryProgressSource[] | undefined,
  incoming: ResearchDiscoveryProgressSource[] | undefined,
): ResearchDiscoveryProgressSource[] | undefined {
  return mergeUnique(existing, incoming, (source) => `${source.title ?? ""}\n${source.url ?? ""}`);
}

function mergeVisualAssets(
  existing: ResearchDiscoveryProgressVisualAsset[] | undefined,
  incoming: ResearchDiscoveryProgressVisualAsset[] | undefined,
): ResearchDiscoveryProgressVisualAsset[] | undefined {
  return mergeUnique(
    existing,
    incoming,
    (asset) => `${asset.id}\n${asset.filePath ?? ""}\n${asset.imageUrl ?? ""}\n${asset.pageUrl ?? ""}`,
  );
}

function mergeStrings(
  existing: string[] | undefined,
  incoming: string[] | undefined,
): string[] | undefined {
  if (!incoming) return existing;
  return mergeUnique(existing, incoming, (value) => value);
}

function mergeUnique<T>(
  existing: T[] | undefined,
  incoming: T[] | undefined,
  keyFor: (value: T) => string,
): T[] | undefined {
  if (!incoming) return existing;
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of [...(existing ?? []), ...incoming]) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(Math.max(0, merged.length - MAX_PHASE_ITEMS));
}

function mergeCounts(
  existing: Partial<ResearchDiscoveryProgressSummary> | undefined,
  incoming: Partial<ResearchDiscoveryProgressSummary> | undefined,
): Partial<ResearchDiscoveryProgressSummary> | undefined {
  if (!incoming) return existing;
  const result: Partial<ResearchDiscoveryProgressSummary> = { ...(existing ?? {}) };
  for (const key of ["facts", "derivedInsights", "visualAssets", "gaps", "rejectedMaterial"] as const) {
    if (typeof incoming[key] !== "number") continue;
    result[key] = (result[key] ?? 0) + incoming[key];
  }
  return result;
}

function cleanStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = trimForUi(value, 320);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function trimForUi(value: string, limit: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trim()}...`;
}
