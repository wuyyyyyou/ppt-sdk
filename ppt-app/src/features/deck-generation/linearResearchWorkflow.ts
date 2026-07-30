import type { AnnaAgentImageAttachment } from "../../runtime/annaRuntime";
import { isAgentRunCancelledError } from "../../agent/agentClient";
import type {
  ResearchDiscoveryProgress,
  ResearchDiscoveryProgressPhaseRecord,
  SharedResearchContextResult,
  SharedResearchImageBatch,
  SharedResearchImageCandidate,
  SharedResearchProgressOperation,
  SharedResearchStageState,
} from "../../api/types";
import type { ResearchSearchResultForSelection } from "../../ai/researchAiClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import {
  createResearchWebOperationId,
  type ResearchImageFetchResponse,
  type ResearchImageSearchResult,
  type ResearchWebCallContext,
  type ResearchWebFetchPage,
} from "../../api/researchWebClient";
import { emitRuntime } from "./progressProjection";
import { getAttemptLimits, getResearchImageSessionConcurrency, getResearchSearchControlSettings } from "./settings";
import { throwIfCancelled } from "./runtimeSupport";
import type { DeckGenerationRuntime } from "./types";
import { beginPerformanceSpan } from "../../performance/performanceRecorder";

type StageKey =
  | "web_decision"
  | "web_research"
  | "image_decision"
  | "image_research"
  | "image_search"
  | "image_deduplication"
  | "image_analysis"
  | "image_import";

type ImageWorkState = "waiting" | "running" | "completed" | "warning";

async function measureResearchOperation<T>(
  runtime: DeckGenerationRuntime,
  operationName: string,
  task: () => Promise<T>,
  attributes: Record<string, string | number | boolean | null> = {},
  layer = "workflow",
): Promise<T> {
  const span = beginPerformanceSpan({
    operationName,
    workspaceId: runtime.workspace.workspace_id,
    attributes: { layer, ...attributes },
  });
  try {
    const result = await task();
    span?.finish("ok");
    return result;
  } catch (error) {
    span?.finish(isAgentRunCancelledError(error) || runtime.isCancelled() ? "interrupted" : "error");
    throw error;
  }
}

interface ImageSearchOccurrence extends ResearchImageSearchResult {
  occurrence_id: string;
  query: string;
  query_index: number;
  result_index: number;
}

interface ImageDeduplicationGroup {
  dedup_key: string;
  candidate_id: string;
  representative_occurrence_id: string;
  occurrence_ids: string[];
  matched_query_indexes: number[];
}

interface ImageAnalysisBatchCheckpoint {
  batch_id: string;
  candidate_ids: string[];
  status: "pending" | "running" | "completed" | "failed";
  attempt: number;
  interaction_ids: string[];
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface QueryCheckpoint<T> {
  query: string;
  status: "running" | "completed" | "warning";
  result?: T;
  error?: string;
}

interface LinearResearchCheckpoint {
  schema_version: 2;
  status: SharedResearchStageState;
  stages: Record<StageKey, SharedResearchStageState>;
  web?: {
    decision?: { needs_search: boolean; queries: string[]; rationale?: string };
    searches?: Array<QueryCheckpoint<ResearchSearchResultForSelection[]>>;
    fetch_result_ids?: string[];
    fetched_pages?: ResearchWebFetchPage[];
    gaps?: string[];
    diagnostic_errors?: string[];
    prepared_batch?: string;
    written?: boolean;
  };
  image?: {
    decision?: { needs_search: boolean; queries: string[]; rationale?: string };
    searches?: Array<QueryCheckpoint<ImageSearchOccurrence[]>>;
    search_status?: ImageWorkState;
    deduplication?: {
      status: ImageWorkState;
      strategy: {
        version: 1;
        key: "normalized_image_url";
        remove_fragment: true;
        remove_default_port: true;
        sort_query_parameters: true;
        removed_tracking_parameters: string[];
      };
      statistics: {
        raw_occurrences: number;
        unique_urls: number;
        duplicate_occurrences: number;
        duplicate_groups: number;
      };
      groups: ImageDeduplicationGroup[];
      completed_at?: string;
    };
    candidates?: SharedResearchImageCandidate[];
    analysis_status?: ImageWorkState;
    analysis_batches?: ImageAnalysisBatchCheckpoint[];
    import_status?: ImageWorkState;
    content_deduplication?: {
      status: ImageWorkState;
      statistics: {
        imported_candidates: number;
        unique_content: number;
        duplicate_content_candidates: number;
      };
      groups: Array<{
        sha256: string;
        representative_candidate_id: string;
        candidate_ids: string[];
      }>;
      completed_at?: string;
    };
    gaps?: string[];
    diagnostic_errors?: string[];
    prepared_batch?: SharedResearchImageBatch;
    written?: boolean;
  };
  updated_at?: string;
}

const STAGE_ORDER: StageKey[] = [
  "web_decision",
  "web_research",
  "image_decision",
  "image_research",
  "image_search",
  "image_deduplication",
  "image_analysis",
  "image_import",
];

function readCheckpoint(value: Record<string, unknown>): LinearResearchCheckpoint {
  const compatible = value.schema_version === 2;
  const stagesRecord = compatible && value.stages && typeof value.stages === "object" && !Array.isArray(value.stages)
    ? value.stages as Record<string, unknown>
    : {};
  const state = (key: StageKey): SharedResearchStageState => {
    const value = stagesRecord[key];
    return value === "running" || value === "completed" || value === "skipped" || value === "warning"
      ? value
      : "waiting";
  };
  return {
    schema_version: 2,
    status: compatible && (value.status === "running" || value.status === "completed" || value.status === "skipped" || value.status === "warning")
      ? value.status
      : "waiting",
    stages: Object.fromEntries(STAGE_ORDER.map((key) => [key, state(key)])) as Record<StageKey, SharedResearchStageState>,
    ...(compatible && value.web && typeof value.web === "object" && !Array.isArray(value.web) ? { web: value.web as LinearResearchCheckpoint["web"] } : {}),
    ...(compatible && value.image && typeof value.image === "object" && !Array.isArray(value.image) ? { image: value.image as LinearResearchCheckpoint["image"] } : {}),
  };
}

const IMAGE_ANALYSIS_BATCH_SIZE = 6;
const IMAGE_IMPORT_CONCURRENCY = 2;
const IMAGE_DEDUP_TRACKING_PARAMETERS = [
  "utm_*",
  "fbclid",
  "gclid",
];

function isImageDedupTrackingParameter(parameter: string) {
  const normalized = parameter.toLowerCase();
  return normalized.startsWith("utm_") || normalized === "fbclid" || normalized === "gclid";
}

function stableShortHash(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function normalizeImageUrlForDedup(rawUrl: string) {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    const sorted = [...url.searchParams.entries()]
      .filter(([key]) => !isImageDedupTrackingParameter(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const keyOrder = leftKey.localeCompare(rightKey);
        return keyOrder !== 0 ? keyOrder : leftValue.localeCompare(rightValue);
      });
    url.search = "";
    for (const [key, value] of sorted) url.searchParams.append(key, value);
    return url.toString();
  } catch {
    return trimmed;
  }
}

function createImageCandidateId(dedupKey: string) {
  return `image-${stableShortHash(dedupKey)}`;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function progressState(state: SharedResearchStageState): ResearchDiscoveryProgressPhaseRecord["state"] {
  return state;
}

function uiProgress(checkpoint: LinearResearchCheckpoint): ResearchDiscoveryProgress {
  const mapping: Array<{ key: StageKey; phase: ResearchDiscoveryProgressPhaseRecord["phase"] }> = [
    { key: "web_decision", phase: "web-decision" },
    { key: "web_research", phase: "web-collection" },
    { key: "image_decision", phase: "visual-decision" },
    { key: "image_research", phase: "visual-collection" },
  ];
  return {
    status: progressState(checkpoint.status),
    records: mapping.map(({ key, phase }) => ({ phase, state: progressState(checkpoint.stages[key]) })),
    summary: { facts: 0, derivedInsights: 0, visualAssets: 0, gaps: 0, rejectedMaterial: 0 },
    updatedAt: new Date().toISOString(),
  };
}

function stageMessage(runtime: DeckGenerationRuntime, stage: StageKey) {
  const zh = runtime.locale === "zh";
  const messages: Record<StageKey, string> = {
    web_decision: zh ? "正在判断是否需要网页资料" : "Deciding whether web research is needed",
    web_research: zh ? "正在搜索并整理网页资料" : "Searching and organizing web research",
    image_decision: zh ? "正在判断是否需要图片素材" : "Deciding whether image research is needed",
    image_research: zh ? "正在搜索并筛选图片素材" : "Searching and selecting image material",
    image_search: zh ? "正在搜索图片候选" : "Searching for image candidates",
    image_deduplication: zh ? "正在合并重复图片" : "Deduplicating image candidates",
    image_analysis: zh ? "正在判断图片可用性" : "Assessing image candidates",
    image_import: zh ? "正在保存可用图片" : "Saving selected images",
  };
  return messages[stage];
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function changedByKey(
  previous: unknown,
  next: unknown,
  key: string,
) {
  const previousByKey = new Map((Array.isArray(previous) ? previous : []).map((item) => {
    const record = plainRecord(item);
    return [String(record[key] ?? ""), record] as const;
  }));
  return (Array.isArray(next) ? next : []).map(plainRecord).filter((item) => {
    const identity = String(item[key] ?? "");
    return identity && !sameValue(previousByKey.get(identity), item);
  });
}

export function chunkSharedResearchProgressOperations(
  workspaceDir: string,
  operations: SharedResearchProgressOperation[],
  maxBytes = 32 * 1024,
) {
  const batches: SharedResearchProgressOperation[][] = [];
  let current: SharedResearchProgressOperation[] = [];
  for (const operation of operations) {
    const candidate = [...current, operation];
    const bytes = new TextEncoder().encode(JSON.stringify({ workspace_dir: workspaceDir, operations: candidate })).byteLength;
    if (bytes <= maxBytes) {
      current = candidate;
      continue;
    }
    if (current.length === 0) throw new Error(`Single shared research progress operation exceeds ${maxBytes} bytes`);
    batches.push(current);
    current = [operation];
    const singleBytes = new TextEncoder().encode(JSON.stringify({ workspace_dir: workspaceDir, operations: current })).byteLength;
    if (singleBytes > maxBytes) throw new Error(`Single shared research progress operation exceeds ${maxBytes} bytes`);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function buildSharedResearchProgressOperations(
  previous: LinearResearchCheckpoint,
  next: LinearResearchCheckpoint,
): SharedResearchProgressOperation[] {
  const operations: SharedResearchProgressOperation[] = [];
  const previousWeb = previous.web ?? {};
  const nextWeb = next.web ?? {};
  const previousImage = previous.image ?? {};
  const nextImage = next.image ?? {};

  if (!sameValue(previousWeb.decision, nextWeb.decision) && nextWeb.decision) {
    operations.push({ op: "set_web_decision", decision: structuredClone(nextWeb.decision) as unknown as Record<string, unknown> });
  }
  for (const search of changedByKey(previousWeb.searches, nextWeb.searches, "query")) {
    operations.push({ op: "upsert_web_search", query: String(search.query), search });
  }
  if (!sameValue(previousWeb.fetch_result_ids, nextWeb.fetch_result_ids) && nextWeb.fetch_result_ids) {
    operations.push({ op: "set_web_fetch_result_ids", result_ids: [...nextWeb.fetch_result_ids] });
  }
  for (const page of changedByKey(previousWeb.fetched_pages, nextWeb.fetched_pages, "url")) {
    operations.push({ op: "upsert_web_fetched_page", url: String(page.url), page });
  }
  if (!sameValue(previousWeb.prepared_batch, nextWeb.prepared_batch) && nextWeb.prepared_batch) {
    operations.push({ op: "set_web_prepared_batch", markdown: nextWeb.prepared_batch });
  }
  if (!sameValue(previousWeb.gaps, nextWeb.gaps) || !sameValue(previousWeb.diagnostic_errors, nextWeb.diagnostic_errors)) {
    operations.push({ op: "set_web_diagnostics", gaps: [...(nextWeb.gaps ?? [])], diagnostic_errors: [...(nextWeb.diagnostic_errors ?? [])] });
  }

  if (!sameValue(previousImage.decision, nextImage.decision) && nextImage.decision) {
    operations.push({ op: "set_image_decision", decision: structuredClone(nextImage.decision) as unknown as Record<string, unknown> });
  }
  for (const search of changedByKey(previousImage.searches, nextImage.searches, "query")) {
    operations.push({ op: "upsert_image_search", query: String(search.query), search });
  }
  for (const field of ["search_status", "analysis_status", "import_status"] as const) {
    const value = nextImage[field];
    if (value && value !== previousImage[field]) operations.push({ op: "set_image_work_status", field, state: value });
  }

  const previousCandidates = new Map((previousImage.candidates ?? []).map((candidate) => [candidate.candidate_id, candidate]));
  const analysisCandidateIds = new Set<string>();
  if (nextImage.deduplication && !sameValue(previousImage.deduplication, nextImage.deduplication)) {
    for (const group of nextImage.deduplication.groups ?? []) {
      const candidate = (nextImage.candidates ?? []).find((item) => item.candidate_id === group.candidate_id);
      const previousGroup = previousImage.deduplication?.groups?.find((item) => item.candidate_id === group.candidate_id);
      if (candidate && (!sameValue(previousGroup, group) || !previousCandidates.has(candidate.candidate_id))) {
        operations.push({
          op: "upsert_image_deduplication_entry",
          candidate_id: candidate.candidate_id,
          group: structuredClone(group) as unknown as Record<string, unknown>,
          candidate: structuredClone(candidate) as unknown as Record<string, unknown>,
        });
      }
    }
    if (nextImage.deduplication.status === "completed") {
      operations.push({
        op: "set_image_deduplication_summary",
        strategy: structuredClone(nextImage.deduplication.strategy) as unknown as Record<string, unknown>,
        statistics: structuredClone(nextImage.deduplication.statistics) as unknown as Record<string, unknown>,
      });
    }
  }
  for (const batch of changedByKey(previousImage.analysis_batches, nextImage.analysis_batches, "batch_id")) {
    const candidateIds = new Set(Array.isArray(batch.candidate_ids) ? batch.candidate_ids.map(String) : []);
    const candidates = (nextImage.candidates ?? [])
      .filter((candidate) => candidateIds.has(candidate.candidate_id))
      .filter((candidate) => !sameValue(previousCandidates.get(candidate.candidate_id), candidate))
      .map((candidate) => ({ candidate_id: candidate.candidate_id, candidate: structuredClone(candidate) as unknown as Record<string, unknown> }));
    for (const candidate of candidates) analysisCandidateIds.add(candidate.candidate_id);
    operations.push({ op: "upsert_image_analysis_batch", batch_id: String(batch.batch_id), batch, candidates });
  }
  for (const candidate of nextImage.candidates ?? []) {
    const previousCandidate = previousCandidates.get(candidate.candidate_id);
    if (previousCandidate && !sameValue(previousCandidate, candidate) && !analysisCandidateIds.has(candidate.candidate_id)) {
      operations.push({ op: "upsert_image_candidate", candidate_id: candidate.candidate_id, candidate: structuredClone(candidate) as unknown as Record<string, unknown> });
    }
  }
  if (!sameValue(previousImage.gaps, nextImage.gaps) || !sameValue(previousImage.diagnostic_errors, nextImage.diagnostic_errors)) {
    operations.push({ op: "set_image_diagnostics", gaps: [...(nextImage.gaps ?? [])], diagnostic_errors: [...(nextImage.diagnostic_errors ?? [])] });
  }
  if (!sameValue(previousImage.content_deduplication, nextImage.content_deduplication) && nextImage.content_deduplication) {
    operations.push({ op: "set_image_content_deduplication", value: structuredClone(nextImage.content_deduplication) as unknown as Record<string, unknown> });
  }
  if (!sameValue(previousImage.prepared_batch, nextImage.prepared_batch) && nextImage.prepared_batch) {
    operations.push({
      op: "finalize_image_research",
      title: nextImage.prepared_batch.title,
      status: nextImage.prepared_batch.status,
      queries: structuredClone(nextImage.prepared_batch.queries) as unknown as Array<Record<string, unknown>>,
      gaps: [...nextImage.prepared_batch.gaps],
      statistics: structuredClone(nextImage.prepared_batch.statistics ?? {}) as unknown as Record<string, unknown>,
    });
  }

  for (const stage of STAGE_ORDER) {
    if (previous.stages[stage] !== next.stages[stage]) operations.push({ op: "set_stage", stage, state: next.stages[stage] });
  }
  if (previous.status !== next.status && next.status !== "running" && next.status !== "waiting") {
    operations.push({ op: "finalize_shared_research" });
  }
  return operations;
}

async function setStage(
  runtime: DeckGenerationRuntime,
  checkpoint: LinearResearchCheckpoint,
  stage: StageKey,
  state: SharedResearchStageState,
  persist: () => Promise<void>,
) {
  checkpoint.status = state === "running" ? "running" : checkpoint.status;
  checkpoint.stages[stage] = state;
  runtime.researchDiscoveryProgress = uiProgress(checkpoint);
  await Promise.all([
    persist(),
    runtime.backend.recordPageProgress({
      workspace_dir: runtime.workspace.workspace_dir,
      patch: { research_discovery: runtime.researchDiscoveryProgress },
    }).then(runtime.setProgress),
  ]);
  emitRuntime(runtime, {
    step: "prepare",
    message: stageMessage(runtime, stage),
    currentPageIndex: null,
    totalPages: runtime.confirmedOutline.items.length,
  }, runtime.getProgress(), undefined, getAttemptLimits(runtime));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function appendUnique(list: string[] | undefined, value: string) {
  return [...new Set([...(list ?? []), value])];
}

function researchLogContext(runtime: DeckGenerationRuntime, operation: string, kind?: string): AiOperationLogContext | undefined {
  if (!runtime.aiLogger) return undefined;
  return {
    logger: runtime.aiLogger,
    workspace_dir: runtime.workspace.workspace_dir,
    domain: "research",
    operation,
    operation_id: runtime.aiLogger.createOperationId("research", operation),
    ...(kind ? { kind } : {}),
    provider: "anna",
    runtime_mode: "anna",
  };
}

async function logResearchError(runtime: DeckGenerationRuntime, operation: string, error: unknown, detail: Record<string, unknown> = {}) {
  await runtime.backend.appendWorkspaceLog({
    workspace_dir: runtime.workspace.workspace_dir,
    channel: "ai-research",
    entry: { event: "research.warning", operation, error: errorMessage(error), ...detail, at: new Date().toISOString() },
  }).catch(() => undefined);
}

function batchTitle(runtime: DeckGenerationRuntime) {
  if (runtime.refinementRunKind === "page-refinement") {
    const pageId = Object.keys(runtime.pageRefinementReasons ?? {})[0];
    const page = runtime.confirmedOutline.items.find((item) => item.page_id === pageId);
    return runtime.locale === "zh" ? `优化“${page?.title || "当前页"}”页面` : `Refine “${page?.title || "current page"}”`;
  }
  if (runtime.refinementRunKind === "deck-refinement") return runtime.locale === "zh" ? "整套优化" : "Deck refinement";
  return runtime.locale === "zh" ? "首次生成" : "Initial generation";
}

function researchContext(runtime: DeckGenerationRuntime, context: SharedResearchContextResult, logContext?: AiOperationLogContext) {
  return {
    brief: runtime.workspace.requirements.source?.brief ?? "",
    refinementRequest: runtime.refinementRequest,
    outline: runtime.confirmedOutline,
    styleGuide: "",
    webSummary: context.web_summary,
    imageCatalog: context.image_catalog,
    locale: runtime.locale,
    ...(logContext ? { logContext } : {}),
  };
}

function buildWebBatch(locale: DeckGenerationRuntime["locale"], title: string, status: "completed" | "skipped" | "warning", body: string) {
  const statusLabel = locale === "zh"
    ? ({ completed: "已完成", skipped: "已跳过", warning: "有缺口" } as const)[status]
    : status;
  return [
    locale === "zh" ? `## 研究批次：${title}` : `## Research batch: ${title}`,
    "",
    locale === "zh" ? `状态：${statusLabel}` : `Status: ${statusLabel}`,
    "",
    body.trim(),
  ].filter(Boolean).join("\n");
}

function dedupeExactUrls(ids: string[], results: ResearchSearchResultForSelection[]) {
  const byId = new Map(results.map((result) => [result.result_id, result]));
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const id of ids) {
    const url = byId.get(id)?.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= 10) break;
  }
  return urls;
}

function webStatisticsMarkdown(runtime: DeckGenerationRuntime, web: NonNullable<LinearResearchCheckpoint["web"]>) {
  const searches = web.searches ?? [];
  const resultCount = searches.reduce((total, item) => total + (item.result?.length ?? 0), 0);
  const fetchedPages = web.fetched_pages ?? [];
  const fetchedSuccess = fetchedPages.filter((page) => page.ok).length;
  const fetchedFailed = fetchedPages.length - fetchedSuccess;
  const gapCount = web.gaps?.length ?? 0;
  return runtime.locale === "zh"
    ? [
        "### 搜索统计",
        "",
        `- 查询：${web.decision?.queries.length ?? 0}`,
        `- 搜索结果：${resultCount}`,
        `- 选中抓取：${web.fetch_result_ids?.length ?? 0}`,
        `- 抓取成功：${fetchedSuccess}`,
        `- 抓取失败：${fetchedFailed}`,
        `- 信息缺口：${gapCount}`,
      ].join("\n")
    : [
        "### Search statistics",
        "",
        `- Queries: ${web.decision?.queries.length ?? 0}`,
        `- Search results: ${resultCount}`,
        `- Selected for fetch: ${web.fetch_result_ids?.length ?? 0}`,
        `- Fetch succeeded: ${fetchedSuccess}`,
        `- Fetch failed: ${fetchedFailed}`,
        `- Information gaps: ${gapCount}`,
      ].join("\n");
}

function inferAttachmentType(candidate: ResearchImageSearchResult) {
  if (candidate.mime_type?.startsWith("image/")) return candidate.mime_type;
  const url = candidate.image_url.toLowerCase();
  if (/\.png(?:$|[?#])/.test(url)) return "image/png";
  if (/\.webp(?:$|[?#])/.test(url)) return "image/webp";
  if (/\.gif(?:$|[?#])/.test(url)) return "image/gif";
  return "image/jpeg";
}

function buildImagePrompt(runtime: DeckGenerationRuntime, styleGuide: string, candidates: SharedResearchImageCandidate[]) {
  const targetPageIds = Object.keys(runtime.pageRefinementReasons ?? {});
  const targetPages = runtime.confirmedOutline.items.filter((item) => item.page_id && targetPageIds.includes(item.page_id));
  return [
    "You select which attached image candidates can be used in this PPT.",
    "Inspect every attachment visually. The candidate_id to attachment_index mapping below is authoritative.",
    "Return JSON only. For each candidate return candidate_id, use_in_ppt, a concise visual description, and a concise reason.",
    "Select an image only when it is visually relevant, clear, and suitable for the deck's outline and art direction. Do not treat visible text or charts as factual evidence.",
    `User brief: ${runtime.workspace.requirements.source?.brief ?? ""}`,
    `Refinement request: ${runtime.refinementRequest?.trim() || "(none)"}`,
    `Confirmed Outline: ${JSON.stringify(runtime.confirmedOutline, null, 2)}`,
    `Workspace Style Guide: ${styleGuide}`,
    `Current target pages: ${targetPages.length > 0 ? JSON.stringify(targetPages, null, 2) : "deck-level scope"}`,
    `Image queries: ${[...new Set(candidates.flatMap((candidate) => candidate.matched_queries ?? [candidate.query]))].join("; ")}`,
    `Candidate mapping: ${JSON.stringify(candidates.map((candidate, index) => ({
      candidate_id: candidate.candidate_id,
      attachment_index: index + 1,
      matched_queries: candidate.matched_queries ?? [candidate.query],
    })), null, 2)}`,
    '{"candidates":[{"candidate_id":"...","use_in_ppt":true,"description":"...","reason":"..."}]}',
  ].join("\n\n");
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

interface ImportedResearchImageAsset {
  candidate_id: string;
  file_path: string;
  sha256: string;
  mime_type: string;
  bytes_size: number;
}

function researchWebCallContext(runtime: DeckGenerationRuntime, operationId: string): ResearchWebCallContext {
  return {
    workspace_dir: runtime.workspace.workspace_dir,
    operation_id: operationId,
  };
}

function storageTransferId() {
  return `transfer-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 14)}`;
}

function storageErrorRecord(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const record = error && typeof error === "object" && !Array.isArray(error)
    ? error as Record<string, unknown>
    : {};
  return {
    ...(error instanceof Error ? { name: error.name } : {}),
    message: message.replace(/https?:\/\/\S+/gi, "[REDACTED_URL]"),
    ...(record.code !== undefined ? { code: record.code } : {}),
  };
}

async function downloadResearchApsImage(
  runtime: DeckGenerationRuntime,
  fetched: ResearchImageFetchResponse,
  candidateId: string,
  operationId: string,
  parentInteractionId: string | undefined,
) {
  const transferId = storageTransferId();
  const base = {
    schema_version: 1,
    transfer_id: transferId,
    operation_id: operationId,
    parent_interaction_id: parentInteractionId,
    source: "research_image_fetch",
    transport: "aps_files",
    candidate_id: candidateId,
    aps_path: fetched.path,
  };
  const log = async (entry: Record<string, unknown>) => {
    try {
      await runtime.backend.appendWorkspaceLog({
        workspace_dir: runtime.workspace.workspace_dir,
        channel: "storage-transport",
        entry,
      });
    } catch (error) {
      console.warn("[research-image-aps-log] Failed to append storage transfer log", {
        operation_id: operationId,
        parent_interaction_id: parentInteractionId,
        transfer_id: transferId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await log({
    event: "storage.transfer.started",
    ...base,
    phase: "started",
    status: "started",
  });
  try {
    const response = await fetch(fetched.get_url);
    if (!response.ok) throw new Error(`Failed to read fetched APS image: HTTP ${response.status}`);
    const blob = await response.blob();
    await log({
      event: "storage.transfer.finished",
      ...base,
      phase: "finished",
      status: "succeeded",
      http_status: response.status,
      mime_type: fetched.mime_type || blob.type,
      size_bytes: blob.size,
    });
    return blob;
  } catch (error) {
    await log({
      event: "storage.transfer.failed",
      ...base,
      phase: "download",
      status: "failed",
      error: storageErrorRecord(error),
    });
    throw error;
  }
}

async function importSelectedImage(
  runtime: DeckGenerationRuntime,
  candidate: SharedResearchImageCandidate,
  importsBySha256: Map<string, Promise<ImportedResearchImageAsset>>,
  researchWebOperationId: string,
) {
  if (!runtime.hostUploadClient) throw new Error("Host Upload is required to import research images");
  const imageFetchContext = researchWebCallContext(runtime, researchWebOperationId);
  const fetched = await runtime.researchWebClient.imageFetch(
    { url: candidate.image_url, max_bytes: 20 * 1024 * 1024, purpose: "ppt-research" },
    imageFetchContext,
  );
  let importPromise = importsBySha256.get(fetched.sha256);
  const reusedExistingContent = Boolean(importPromise);
  if (!importPromise) {
    importPromise = (async () => {
      const blob = await measureResearchOperation(
        runtime,
        "research.image.download",
        () => downloadResearchApsImage(
          runtime,
          fetched,
          candidate.candidate_id,
          researchWebOperationId,
          imageFetchContext.interaction_id,
        ),
        { candidate_id: candidate.candidate_id, size_bytes: fetched.bytes_size },
        "research-image-transfer",
      );
      const mimeType = fetched.mime_type || blob.type;
      const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : mimeType === "image/gif" ? ".gif" : ".jpg";
      const file = new File([blob], `${candidate.candidate_id}${extension}`, { type: mimeType });
      return measureResearchOperation(runtime, "research.image.import", async () => {
        const hostUpload = await runtime.hostUploadClient!.uploadFile(file, {
          purpose: "image_reference",
          filename: file.name,
          mimeType,
          metadata: {
            workspace_dir: runtime.workspace.workspace_dir,
            source: "research_image_fetch",
            operation_id: researchWebOperationId,
            parent_interaction_id: imageFetchContext.interaction_id,
          },
        });
        return runtime.backend.importSharedResearchImageHostUpload({
          workspace_dir: runtime.workspace.workspace_dir,
          candidate_id: candidate.candidate_id,
          mime_type: mimeType,
          size_bytes: hostUpload.size_bytes,
          sha256: fetched.sha256,
          host_upload: hostUpload,
        });
      }, { candidate_id: candidate.candidate_id, size_bytes: file.size }, "research-image-transfer");
    })();
    importsBySha256.set(fetched.sha256, importPromise);
  }
  let imported: ImportedResearchImageAsset;
  try {
    imported = await importPromise;
  } catch (error) {
    if (importsBySha256.get(fetched.sha256) === importPromise) importsBySha256.delete(fetched.sha256);
    throw error;
  }
  Object.assign(candidate, {
    file_path: imported.file_path,
    download_status: "imported" as const,
    sha256: imported.sha256,
    mime_type: imported.mime_type,
    bytes_size: imported.bytes_size,
    aps_path: fetched.path,
    final_url: fetched.final_url,
    ...(reusedExistingContent && imported.candidate_id !== candidate.candidate_id ? { content_duplicate_of: imported.candidate_id } : {}),
  });
}

export async function runLinearSharedResearch(runtime: DeckGenerationRuntime, input: { resume: boolean }) {
  const researchWebOperationId = createResearchWebOperationId();
  let context = await runtime.backend.prepareSharedResearchWorkspace({
    workspace_dir: runtime.workspace.workspace_dir,
    reset_progress: !input.resume,
  });
  const checkpoint = readCheckpoint(context.progress);
  const styleGuide = await runtime.backend.getWorkspaceStyleGuide({ workspace_dir: runtime.workspace.workspace_dir });
  const decisionContext = (operation?: string) => ({
    ...researchContext(runtime, context, operation ? researchLogContext(runtime, operation) : undefined),
    styleGuide: styleGuide.content,
  });
  let persistedCheckpoint = structuredClone(checkpoint);
  let persistQueue = Promise.resolve();
  const persist = () => {
    const snapshot = structuredClone(checkpoint);
    persistQueue = persistQueue.then(async () => {
      const operations = buildSharedResearchProgressOperations(persistedCheckpoint, snapshot);
      for (const batch of chunkSharedResearchProgressOperations(runtime.workspace.workspace_dir, operations)) {
        await runtime.backend.patchSharedResearchProgress({ workspace_dir: runtime.workspace.workspace_dir, operations: batch });
      }
      persistedCheckpoint = structuredClone(snapshot);
    });
    return persistQueue;
  };
  const controls = getResearchSearchControlSettings(runtime);

  if (checkpoint.stages.web_decision === "waiting" || checkpoint.stages.web_decision === "running") {
    await setStage(runtime, checkpoint, "web_decision", "running", persist);
    try {
      checkpoint.web ??= {};
      checkpoint.web.decision = await measureResearchOperation(
        runtime,
        "research.web.decision",
        () => controls.disableWebResearch
          ? Promise.resolve({ needs_search: false, queries: [], rationale: "Web research is disabled by the user setting." })
          : runtime.researchAiClient.decideWebResearch(decisionContext("web_research_decision")),
        { disabled: controls.disableWebResearch },
      );
      await setStage(runtime, checkpoint, "web_decision", checkpoint.web.decision.needs_search ? "completed" : "skipped", persist);
    } catch (error) {
      checkpoint.web = {
        decision: {
          needs_search: false,
          queries: [],
          rationale: runtime.locale === "zh" ? "本轮无法完成网页资料需求判断。" : "Web research need could not be determined for this run.",
        },
        gaps: [runtime.locale === "zh" ? "本轮无法判断是否需要新增网页资料。" : "The need for new web research could not be determined."],
        diagnostic_errors: [errorMessage(error)],
      };
      await logResearchError(runtime, "web-decision", error);
      await setStage(runtime, checkpoint, "web_decision", "warning", persist);
    }
  }
  throwIfCancelled(runtime);

  if (!checkpoint.web?.written) {
    await setStage(runtime, checkpoint, "web_research", "running", persist);
    const decision = checkpoint.web?.decision ?? { needs_search: false, queries: [] };
    const title = batchTitle(runtime);
    if (!decision.needs_search) {
      const body = decision.rationale || (runtime.locale === "zh" ? "本轮无需新增网页资料。" : "No new web research is needed for this run.");
      checkpoint.web ??= {};
      checkpoint.web.prepared_batch = buildWebBatch(runtime.locale, title, checkpoint.web.gaps?.length ? "warning" : "skipped", body);
    } else if (decision.queries.length === 0) {
      checkpoint.web ??= {};
      checkpoint.web.gaps = ["Web research was requested, but no usable query was returned."];
      checkpoint.web.prepared_batch = buildWebBatch(runtime.locale, title, "warning", runtime.locale === "zh"
        ? "### 信息缺口\n\n- 需要网页资料，但模型没有返回可用的搜索词。"
        : "### Information gaps\n\n- Web research was needed, but the model returned no usable query.");
    } else {
      checkpoint.web ??= {};
      checkpoint.web.searches ??= [];
      const existingQueries = new Set(checkpoint.web.searches.map((item) => item.query));
      const pendingQueries = decision.queries.filter((query) => !existingQueries.has(query));
      await measureResearchOperation(runtime, "research.web.search", () => Promise.all(pendingQueries.map(async (query) => {
          try {
            const response = await runtime.researchWebClient.search(
              { query, max_results: 6 },
              researchWebCallContext(runtime, researchWebOperationId),
            );
            const queryIndex = decision.queries.indexOf(query);
            const results = response.results.map((result, resultIndex) => ({ ...result, result_id: `web-q${queryIndex + 1}-r${resultIndex + 1}` }));
            checkpoint.web!.searches!.push({ query, status: results.length > 0 ? "completed" : "warning", result: results, ...(results.length === 0 ? { error: "No results" } : {}) });
          } catch (error) {
            checkpoint.web!.searches!.push({ query, status: "warning", error: errorMessage(error) });
            checkpoint.web!.diagnostic_errors = appendUnique(checkpoint.web!.diagnostic_errors, `${query}: ${errorMessage(error)}`);
            await logResearchError(runtime, "web-search", error, { query });
          }
          await persist();
        })).then(() => undefined), { query_count: pendingQueries.length });
      const allResults = checkpoint.web.searches.flatMap((item) => item.result ?? []);
      const gaps = checkpoint.web.searches.flatMap((item) => item.error
        ? [runtime.locale === "zh" ? `搜索词“${item.query}”未获得可用结果。` : `No usable result was collected for query “${item.query}”.`]
        : []);
      checkpoint.web.gaps = gaps;
      if (allResults.length === 0) {
        checkpoint.web.prepared_batch = buildWebBatch(runtime.locale, title, "warning", runtime.locale === "zh"
          ? "### 信息缺口\n\n- 本轮未获得可用的网页搜索结果，页面生成不得据此补造具体事实。"
          : "### Information gaps\n\n- This run found no usable web search results. Page generation must not invent specific facts to fill the gap.");
      } else {
        if (!checkpoint.web.fetch_result_ids) {
          try {
            const selected = await measureResearchOperation(
              runtime,
              "research.web.fetch_selection",
              () => runtime.researchAiClient.selectWebFetchResults({ ...decisionContext("web_fetch_selection"), results: allResults }),
              { result_count: allResults.length },
            );
            const knownIds = new Set(allResults.map((item) => item.result_id));
            checkpoint.web.fetch_result_ids = [...new Set(selected.filter((id) => knownIds.has(id)))].slice(0, 10);
          } catch (error) {
            checkpoint.web.fetch_result_ids = [];
            gaps.push(runtime.locale === "zh" ? "未能选择需要进一步抓取的网页；仍将使用搜索摘要继续整理。" : "Web pages could not be selected for fetching; search snippets will still be summarized.");
            checkpoint.web.diagnostic_errors = appendUnique(checkpoint.web.diagnostic_errors, `Fetch selection: ${errorMessage(error)}`);
            await logResearchError(runtime, "web-fetch-selection", error);
          }
          await persist();
        }
        if (!checkpoint.web.fetched_pages) {
          const urls = dedupeExactUrls(checkpoint.web.fetch_result_ids, allResults);
          if (urls.length > 0) {
            try {
              const fetchedPages = await measureResearchOperation(runtime, "research.web.fetch", async () => {
                const pages: ResearchWebFetchPage[] = [];
                for (const url of urls) {
                  const fetched = await runtime.researchWebClient.fetch(
                    { urls: [url], max_chars: 8000 },
                    researchWebCallContext(runtime, researchWebOperationId),
                  );
                  pages.push(...fetched.pages);
                }
                return pages;
              }, { url_count: urls.length });
              checkpoint.web.fetched_pages = fetchedPages;
              const failedPages = fetchedPages.filter((page) => !page.ok);
              if (failedPages.length > 0) {
                gaps.push(runtime.locale === "zh" ? `${failedPages.length} 个选中网页未能读取正文。` : `${failedPages.length} selected web page(s) could not be read.`);
                checkpoint.web.diagnostic_errors = appendUnique(
                  checkpoint.web.diagnostic_errors,
                  failedPages.map((page) => `${page.url}: ${page.error || "Fetch failed"}`).join("\n"),
                );
              }
            } catch (error) {
              checkpoint.web.fetched_pages = [];
              gaps.push(runtime.locale === "zh" ? "本轮选中的网页正文未能完成抓取。" : "Selected web page content could not be fetched for this run.");
              checkpoint.web.diagnostic_errors = appendUnique(checkpoint.web.diagnostic_errors, errorMessage(error));
              await logResearchError(runtime, "web-fetch", error, { urls });
            }
          } else checkpoint.web.fetched_pages = [];
          checkpoint.web.gaps = gaps;
          await persist();
        }
        if (!checkpoint.web.prepared_batch) {
          try {
            const fetchedPages = checkpoint.web.fetched_pages.filter((page) => page.ok);
            const webGaps = checkpoint.web.gaps ?? [];
            const summary = await measureResearchOperation(
              runtime,
              "research.web.synthesis",
              () => runtime.researchAiClient.summarizeWebResearch({
                ...decisionContext("web_research_summary"),
                searchResults: allResults,
                fetchedPages,
                gaps: webGaps,
              }),
              { result_count: allResults.length, page_count: fetchedPages.length },
            );
            checkpoint.web.prepared_batch = buildWebBatch(runtime.locale, title, (checkpoint.web.gaps?.length ?? 0) > 0 ? "warning" : "completed", summary);
          } catch (error) {
            gaps.push(runtime.locale === "zh" ? "本轮网页资料未能整理为可用研究总结。" : "Web material could not be organized into a usable research summary for this run.");
            checkpoint.web.gaps = gaps;
            checkpoint.web.diagnostic_errors = appendUnique(checkpoint.web.diagnostic_errors, `Web summarization: ${errorMessage(error)}`);
            await logResearchError(runtime, "web-summarization", error);
            checkpoint.web.prepared_batch = buildWebBatch(runtime.locale, title, "warning", runtime.locale === "zh"
              ? "### 信息缺口\n\n- 本轮网页资料未能整理为可供页面创作使用的研究总结。"
              : "### Information gaps\n\n- Web material could not be organized into a research summary usable by page authoring.");
          }
        }
      }
    }
    const statisticsHeading = runtime.locale === "zh" ? "### 搜索统计" : "### Search statistics";
    if (!checkpoint.web.prepared_batch?.includes(statisticsHeading)) {
      checkpoint.web.prepared_batch = `${checkpoint.web.prepared_batch ?? ""}\n\n${webStatisticsMarkdown(runtime, checkpoint.web)}`.trim();
    }
    await persist();
    await measureResearchOperation(
      runtime,
      "research.web.publish",
      () => runtime.backend.publishPreparedWebResearchBatch({ workspace_dir: runtime.workspace.workspace_dir }).then(() => undefined),
    );
    checkpoint.web.written = true;
    persistedCheckpoint.web ??= {};
    persistedCheckpoint.web.written = true;
    await setStage(runtime, checkpoint, "web_research", checkpoint.web.gaps?.length ? "warning" : decision.needs_search ? "completed" : "skipped", persist);
  }
  context = await runtime.backend.getSharedResearchContext({ workspace_dir: runtime.workspace.workspace_dir });
  throwIfCancelled(runtime);

  if (checkpoint.stages.image_decision === "waiting" || checkpoint.stages.image_decision === "running") {
    await setStage(runtime, checkpoint, "image_decision", "running", persist);
    try {
      checkpoint.image ??= {};
      checkpoint.image.decision = await measureResearchOperation(
        runtime,
        "research.image.decision",
        () => controls.disableImageResearch
          ? Promise.resolve({ needs_search: false, queries: [], rationale: "Image research is disabled by the user setting." })
          : runtime.researchAiClient.decideImageResearch(decisionContext("image_research_decision")),
        { disabled: controls.disableImageResearch },
      );
      await setStage(runtime, checkpoint, "image_decision", checkpoint.image.decision.needs_search ? "completed" : "skipped", persist);
    } catch (error) {
      checkpoint.image = {
        decision: {
          needs_search: false,
          queries: [],
          rationale: runtime.locale === "zh" ? "本轮无法完成图片资料需求判断。" : "Image research need could not be determined for this run.",
        },
        gaps: [runtime.locale === "zh" ? "本轮无法判断是否需要新增图片资料。" : "The need for new image research could not be determined."],
        diagnostic_errors: [errorMessage(error)],
      };
      await logResearchError(runtime, "image-decision", error);
      await setStage(runtime, checkpoint, "image_decision", "warning", persist);
    }
  }
  throwIfCancelled(runtime);

  if (!checkpoint.image?.written) {
    await setStage(runtime, checkpoint, "image_research", "running", persist);
    checkpoint.image ??= {};
    const decision = checkpoint.image.decision ?? { needs_search: false, queries: [] };
    const queries: SharedResearchImageBatch["queries"] = [];
    const gaps: string[] = [...(checkpoint.image.gaps ?? [])];
    let candidates: SharedResearchImageCandidate[] = checkpoint.image.candidates ?? [];
    if (decision.needs_search && decision.queries.length > 0) {
      checkpoint.stages.image_search = "running";
      checkpoint.image.search_status = checkpoint.image.search_status === "completed" ? "completed" : "running";
      checkpoint.image.searches ??= [];
      const previousSearches = checkpoint.image.searches;
      const searchesByQuery: Array<QueryCheckpoint<ImageSearchOccurrence[]>> = decision.queries.map((query, queryIndex) => {
        const previous = previousSearches[queryIndex];
        return previous?.query === query ? previous : { query, status: "running" };
      });
      checkpoint.image.searches = searchesByQuery;
      await persist();
      await measureResearchOperation(runtime, "research.image.search", () => Promise.all(decision.queries.map(async (query, queryIndex) => {
          const existing = searchesByQuery[queryIndex];
          if (existing && existing.status !== "running") return;
          try {
            const response = await runtime.researchWebClient.imageSearch(
              { query, max_results: 6, min_width: 800, min_height: 600, aspect: "any" },
              researchWebCallContext(runtime, researchWebOperationId),
            );
            const results: ImageSearchOccurrence[] = response.results.slice(0, 6).map((item, resultIndex) => ({
              occurrence_id: `image-q${queryIndex + 1}-r${resultIndex + 1}`,
              query,
              query_index: queryIndex,
              result_index: resultIndex,
              ...item,
            }));
            searchesByQuery[queryIndex] = { query, status: results.length > 0 ? "completed" : "warning", result: results, ...(results.length === 0 ? { error: "No image results" } : {}) };
          } catch (error) {
            checkpoint.image!.diagnostic_errors = appendUnique(checkpoint.image!.diagnostic_errors, `${query}: ${errorMessage(error)}`);
            await logResearchError(runtime, "image-search", error, { query });
            searchesByQuery[queryIndex] = { query, status: "warning", error: errorMessage(error) };
          }
          checkpoint.image!.searches = searchesByQuery;
          await persist();
        })).then(() => undefined), { query_count: decision.queries.length });
      checkpoint.image.search_status = "completed";
      checkpoint.stages.image_search = checkpoint.image.searches.some((search) => search.status === "warning") ? "warning" : "completed";
      await persist();

      if (!checkpoint.image.deduplication || checkpoint.image.deduplication.status !== "completed") {
        checkpoint.stages.image_deduplication = "running";
        checkpoint.image.deduplication = {
          status: "running",
          strategy: {
            version: 1,
            key: "normalized_image_url",
            remove_fragment: true,
            remove_default_port: true,
            sort_query_parameters: true,
            removed_tracking_parameters: [...IMAGE_DEDUP_TRACKING_PARAMETERS],
          },
          statistics: { raw_occurrences: 0, unique_urls: 0, duplicate_occurrences: 0, duplicate_groups: 0 },
          groups: [],
        };
        await persist();
        const groupsByKey = new Map<string, ImageDeduplicationGroup>();
        const candidatesByKey = new Map<string, SharedResearchImageCandidate>();
        for (const search of checkpoint.image.searches) {
          for (const occurrence of search.result ?? []) {
            const dedupKey = normalizeImageUrlForDedup(occurrence.image_url);
            const persistedDedupKey = `urlhash:${stableShortHash(dedupKey)}`;
            let group = groupsByKey.get(dedupKey);
            let candidate = candidatesByKey.get(dedupKey);
            if (!group || !candidate) {
              candidate = {
                candidate_id: createImageCandidateId(dedupKey),
                query: occurrence.query,
                dedup_key: persistedDedupKey,
                representative_occurrence_id: occurrence.occurrence_id,
                matched_occurrence_ids: [occurrence.occurrence_id],
                matched_queries: [occurrence.query],
                image_url: occurrence.image_url,
                thumbnail_url: occurrence.thumbnail_url,
                source_url: occurrence.source_url,
                title: occurrence.title,
                width: occurrence.width,
                height: occurrence.height,
                ...(occurrence.mime_type ? { mime_type: occurrence.mime_type } : {}),
                use_in_ppt: false,
                description: "Not returned by image analysis.",
                reason: "Not returned by image analysis; defaulted to use_in_ppt: false.",
                analysis_status: "pending",
                download_status: "pending",
              };
              candidatesByKey.set(dedupKey, candidate);
              group = { dedup_key: persistedDedupKey, candidate_id: candidate.candidate_id, representative_occurrence_id: occurrence.occurrence_id, occurrence_ids: [occurrence.occurrence_id], matched_query_indexes: [occurrence.query_index] };
              groupsByKey.set(dedupKey, group);
            } else {
              group.occurrence_ids.push(occurrence.occurrence_id);
              if (!group.matched_query_indexes.includes(occurrence.query_index)) group.matched_query_indexes.push(occurrence.query_index);
              candidate.matched_occurrence_ids = [...(candidate.matched_occurrence_ids ?? []), occurrence.occurrence_id];
              candidate.matched_queries = [...new Set([...(candidate.matched_queries ?? []), occurrence.query])];
            }
          }
        }
        const allGroups = [...groupsByKey.values()];
        const rawOccurrences = checkpoint.image.searches.reduce((sum, search) => sum + (search.result?.length ?? 0), 0);
        checkpoint.image.deduplication = {
          ...checkpoint.image.deduplication,
          status: "completed",
          statistics: {
            raw_occurrences: rawOccurrences,
            unique_urls: allGroups.length,
            duplicate_occurrences: rawOccurrences - allGroups.length,
            duplicate_groups: allGroups.filter((group) => group.occurrence_ids.length > 1).length,
          },
          groups: allGroups,
          completed_at: new Date().toISOString(),
        };
        checkpoint.image.candidates = [...candidatesByKey.values()];
        candidates = checkpoint.image.candidates;
        checkpoint.stages.image_deduplication = "completed";
        await persist();
      } else {
        candidates = checkpoint.image.candidates ?? [];
        checkpoint.stages.image_deduplication = "completed";
      }

      checkpoint.image.analysis_batches ??= chunkItems(candidates, IMAGE_ANALYSIS_BATCH_SIZE).map((batch, index) => ({
        batch_id: `image-analysis-batch-${index + 1}`,
        candidate_ids: batch.map((candidate) => candidate.candidate_id),
        status: "pending",
        attempt: 0,
        interaction_ids: [],
      }));
      checkpoint.image.analysis_status = "running";
      checkpoint.stages.image_analysis = "running";
      checkpoint.image.import_status = "running";
      checkpoint.stages.image_import = "running";
      await persist();
      const importLimiter = createConcurrencyLimiter(IMAGE_IMPORT_CONCURRENCY);
      const importsBySha256 = new Map<string, Promise<ImportedResearchImageAsset>>();
      for (const candidate of candidates) {
        if (candidate.download_status !== "imported" || !candidate.sha256 || !candidate.file_path || !candidate.mime_type || !candidate.bytes_size) continue;
        importsBySha256.set(candidate.sha256, Promise.resolve({
          candidate_id: candidate.content_duplicate_of ?? candidate.candidate_id,
          file_path: candidate.file_path,
          sha256: candidate.sha256,
          mime_type: candidate.mime_type,
          bytes_size: candidate.bytes_size,
        }));
      }
      const scheduledImportIds = new Set<string>();
      const importTasks: Promise<void>[] = [];
      const scheduleImport = (candidate: SharedResearchImageCandidate) => {
        if (!candidate.use_in_ppt || candidate.download_status !== "pending" || scheduledImportIds.has(candidate.candidate_id)) return;
        scheduledImportIds.add(candidate.candidate_id);
        importTasks.push(importLimiter(async () => {
          try {
            await importSelectedImage(runtime, candidate, importsBySha256, researchWebOperationId);
          } catch (error) {
            candidate.download_status = "failed";
            candidate.error = errorMessage(error);
            checkpoint.image!.gaps = appendUnique(
              checkpoint.image!.gaps,
              runtime.locale === "zh" ? `候选图片 ${candidate.candidate_id} 未能保存为本地素材。` : `Image candidate ${candidate.candidate_id} could not be saved as a local asset.`,
            );
            checkpoint.image!.diagnostic_errors = appendUnique(checkpoint.image!.diagnostic_errors, `${candidate.candidate_id}: ${candidate.error}`);
            await logResearchError(runtime, "image-import", error, { candidate_id: candidate.candidate_id });
          }
          await persist();
        }));
      };
      candidates.forEach((candidate) => {
        if (candidate.analysis_status === "completed") scheduleImport(candidate);
      });
      await measureResearchOperation(runtime, "research.image.analysis", () => mapWithConcurrency(checkpoint.image!.analysis_batches!, getResearchImageSessionConcurrency(runtime), async (batch) => {
        if (batch.status === "completed") return;
        batch.status = "running";
        batch.attempt += 1;
        batch.started_at = new Date().toISOString();
        const batchCandidates = candidates.filter((candidate) => batch.candidate_ids.includes(candidate.candidate_id));
        batchCandidates.forEach((candidate) => { candidate.analysis_status = "running"; });
        await persist();
        const logContext = researchLogContext(runtime, "image_candidate_analysis", batchCandidates.flatMap((candidate) => candidate.matched_queries ?? [candidate.query]).join("; "));
        try {
          const attachments: AnnaAgentImageAttachment[] = batchCandidates.map((candidate) => ({
            type: inferAttachmentType({ image_url: candidate.image_url, source_url: candidate.source_url, mime_type: candidate.mime_type }),
            url: candidate.image_url || candidate.thumbnail_url || "",
            filename: candidate.candidate_id,
            detail: "auto",
          }));
          const analysis = await runtime.agentClient.runImageResearchPrompt(buildImagePrompt(runtime, styleGuide.content, batchCandidates), {
            attachments,
            signal: runtime.cancelSignal,
            isCancelled: runtime.isCancelled,
            logContext,
          });
          batch.interaction_ids = [...(logContext?.interaction_ids ?? [])];
          const expectedIds = new Set(batchCandidates.map((candidate) => candidate.candidate_id));
          const returnedIds = analysis.candidates.map((item) => item.candidate_id);
          const duplicateIds = returnedIds.filter((candidateId, index) => returnedIds.indexOf(candidateId) !== index);
          const unknownIds = returnedIds.filter((candidateId) => !expectedIds.has(candidateId));
          const missingIds = [...expectedIds].filter((candidateId) => !returnedIds.includes(candidateId));
          if (duplicateIds.length > 0 || unknownIds.length > 0 || missingIds.length > 0) {
            throw new Error(`Invalid image analysis candidate mapping: duplicate=${duplicateIds.join(",") || "none"}; unknown=${unknownIds.join(",") || "none"}; missing=${missingIds.join(",") || "none"}`);
          }
          const byId = new Map(analysis.candidates.map((item) => [item.candidate_id, item]));
          for (const candidate of batchCandidates) {
            const decision = byId.get(candidate.candidate_id);
            if (!decision) continue;
            Object.assign(candidate, decision, { analysis_status: "completed" as const });
          }
          batch.status = "completed";
          batch.completed_at = new Date().toISOString();
          batchCandidates.forEach(scheduleImport);
        } catch (error) {
          batch.interaction_ids = [...new Set([...(batch.interaction_ids ?? []), ...(logContext?.interaction_ids ?? [])])];
          if (isAgentRunCancelledError(error) || runtime.isCancelled()) throw error;
          batch.status = "failed";
          batch.error = errorMessage(error);
          batch.completed_at = new Date().toISOString();
          for (const candidate of batchCandidates) {
            candidate.analysis_status = "failed";
            candidate.use_in_ppt = false;
          }
          const matchedQueries = [...new Set(batchCandidates.flatMap((candidate) => candidate.matched_queries ?? [candidate.query]))];
          for (const query of matchedQueries) {
            checkpoint.image!.gaps = appendUnique(checkpoint.image!.gaps, runtime.locale === "zh"
              ? `图片搜索词“${query}”的候选未能完成视觉判断。`
              : `Image candidates for query “${query}” could not be visually assessed.`);
          }
          checkpoint.image!.diagnostic_errors = appendUnique(checkpoint.image!.diagnostic_errors, `${batch.batch_id}: ${errorMessage(error)}`);
          await logResearchError(runtime, "image-analysis", error, { batch_id: batch.batch_id, candidate_ids: batch.candidate_ids });
        }
        await persist();
      }), { batch_count: checkpoint.image.analysis_batches.length });
      checkpoint.image.analysis_status = checkpoint.image.analysis_batches.every((batch) => batch.status === "completed") ? "completed" : "warning";
      checkpoint.stages.image_analysis = checkpoint.image.analysis_status;
      candidates.forEach(scheduleImport);
      await Promise.all(importTasks);
      checkpoint.image.import_status = candidates.some((candidate) => candidate.download_status === "failed") ? "warning" : "completed";
      checkpoint.stages.image_import = checkpoint.image.import_status;
      const contentGroupsBySha = new Map<string, { sha256: string; representative_candidate_id: string; candidate_ids: string[] }>();
      for (const candidate of candidates.filter((item) => item.download_status === "imported" && item.sha256)) {
        const sha256 = candidate.sha256 as string;
        const existing = contentGroupsBySha.get(sha256);
        if (existing) existing.candidate_ids.push(candidate.candidate_id);
        else contentGroupsBySha.set(sha256, {
          sha256,
          representative_candidate_id: candidate.content_duplicate_of ?? candidate.candidate_id,
          candidate_ids: [candidate.candidate_id],
        });
      }
      const contentGroups = [...contentGroupsBySha.values()];
      const importedCandidates = contentGroups.reduce((total, group) => total + group.candidate_ids.length, 0);
      checkpoint.image.content_deduplication = {
        status: "completed",
        statistics: {
          imported_candidates: importedCandidates,
          unique_content: contentGroups.length,
          duplicate_content_candidates: importedCandidates - contentGroups.length,
        },
        groups: contentGroups,
        completed_at: new Date().toISOString(),
      };
      await persist();
      throwIfCancelled(runtime);
      gaps.push(...(checkpoint.image.gaps ?? []));
      for (const search of checkpoint.image.searches) {
        queries.push({
          query: search.query,
          status: search.status === "completed" ? "completed" : "warning",
          candidate_count: new Set((search.result ?? []).map((occurrence) => normalizeImageUrlForDedup(occurrence.image_url))).size,
          ...(search.error ? { message: runtime.locale === "zh" ? "未获得可用图片候选。" : "No usable image candidates were returned." } : {}),
        });
        if (search.error) gaps.push(runtime.locale === "zh" ? `图片搜索词“${search.query}”未获得可用候选。` : `No usable image candidates were collected for query “${search.query}”.`);
      }
    } else if (decision.needs_search) {
      gaps.push("Image research was requested, but no usable query was returned.");
      checkpoint.stages.image_search = "warning";
      checkpoint.stages.image_deduplication = "skipped";
      checkpoint.stages.image_analysis = "skipped";
      checkpoint.stages.image_import = "skipped";
    } else {
      checkpoint.stages.image_search = "skipped";
      checkpoint.stages.image_deduplication = "skipped";
      checkpoint.stages.image_analysis = "skipped";
      checkpoint.stages.image_import = "skipped";
    }
    const status: SharedResearchStageState = !decision.needs_search ? "skipped" : gaps.length > 0 || candidates.length === 0 ? "warning" : "completed";
    const uniqueGaps = [...new Set(gaps)];
    const formalCandidates = candidates.map((candidate) => {
      const { error: _diagnosticError, ...formalCandidate } = candidate;
      return formalCandidate;
    });
    checkpoint.image.prepared_batch = {
      title: batchTitle(runtime),
      status,
      queries,
      candidates: formalCandidates,
      gaps: uniqueGaps,
      statistics: {
        queries: queries.length,
        candidates: candidates.length,
        raw_candidates: checkpoint.image.deduplication?.statistics.raw_occurrences ?? candidates.length,
        unique_url_candidates: candidates.length,
        duplicate_url_occurrences: checkpoint.image.deduplication?.statistics.duplicate_occurrences ?? 0,
        selected: candidates.filter((candidate) => candidate.use_in_ppt).length,
        imported: candidates.filter((candidate) => candidate.download_status === "imported").length,
        unique_content_imported: checkpoint.image.content_deduplication?.statistics.unique_content ?? 0,
        failed: candidates.filter((candidate) => candidate.download_status === "failed").length,
        gaps: uniqueGaps.length,
      },
    };
    await persist();
    await measureResearchOperation(
      runtime,
      "research.image.publish",
      () => runtime.backend.publishPreparedImageResearchBatch({ workspace_dir: runtime.workspace.workspace_dir }).then(() => undefined),
    );
    checkpoint.image.written = true;
    persistedCheckpoint.image ??= {};
    persistedCheckpoint.image.written = true;
    const stageStates = Object.values(checkpoint.stages);
    const noNewResearch = checkpoint.web?.decision?.needs_search !== true && checkpoint.image?.decision?.needs_search !== true;
    checkpoint.status = status === "warning" || stageStates.includes("warning")
      ? "warning"
      : noNewResearch
        ? "skipped"
        : "completed";
    await setStage(runtime, checkpoint, "image_research", status, persist);
  }
}
