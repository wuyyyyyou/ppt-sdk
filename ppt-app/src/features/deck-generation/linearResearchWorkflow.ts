import type { AnnaAgentImageAttachment } from "../../runtime/annaRuntime";
import { isAgentRunCancelledError } from "../../agent/agentClient";
import type {
  ResearchDiscoveryProgress,
  ResearchDiscoveryProgressPhaseRecord,
  SharedResearchContextResult,
  SharedResearchImageBatch,
  SharedResearchImageCandidate,
  SharedResearchStageState,
} from "../../api/types";
import type { ResearchSearchResultForSelection } from "../../ai/researchAiClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { ResearchImageSearchResult, ResearchWebFetchPage } from "../../api/researchWebClient";
import { emitRuntime } from "./progressProjection";
import { getAttemptLimits, getResearchImageSessionConcurrency, getResearchSearchControlSettings } from "./settings";
import { throwIfCancelled } from "./runtimeSupport";
import type { DeckGenerationRuntime } from "./types";

type StageKey = "web_decision" | "web_research" | "image_decision" | "image_research";

interface QueryCheckpoint<T> {
  query: string;
  status: "completed" | "warning";
  result?: T;
  error?: string;
}

interface LinearResearchCheckpoint {
  schema_version: 1;
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
    searches?: Array<QueryCheckpoint<SharedResearchImageCandidate[]>>;
    analyzed_query_indexes?: number[];
    gaps?: string[];
    diagnostic_errors?: string[];
    prepared_batch?: SharedResearchImageBatch;
    written?: boolean;
  };
  updated_at?: string;
}

const STAGE_ORDER: StageKey[] = ["web_decision", "web_research", "image_decision", "image_research"];

function readCheckpoint(value: Record<string, unknown>): LinearResearchCheckpoint {
  const stagesRecord = value.stages && typeof value.stages === "object" && !Array.isArray(value.stages)
    ? value.stages as Record<string, unknown>
    : {};
  const state = (key: StageKey): SharedResearchStageState => {
    const value = stagesRecord[key];
    return value === "running" || value === "completed" || value === "skipped" || value === "warning"
      ? value
      : "waiting";
  };
  return {
    schema_version: 1,
    status: value.status === "running" || value.status === "completed" || value.status === "skipped" || value.status === "warning"
      ? value.status
      : "waiting",
    stages: Object.fromEntries(STAGE_ORDER.map((key) => [key, state(key)])) as Record<StageKey, SharedResearchStageState>,
    ...(value.web && typeof value.web === "object" && !Array.isArray(value.web) ? { web: value.web as LinearResearchCheckpoint["web"] } : {}),
    ...(value.image && typeof value.image === "object" && !Array.isArray(value.image) ? { image: value.image as LinearResearchCheckpoint["image"] } : {}),
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
  };
  return messages[stage];
}

async function setStage(runtime: DeckGenerationRuntime, checkpoint: LinearResearchCheckpoint, stage: StageKey, state: SharedResearchStageState) {
  checkpoint.status = state === "running" ? "running" : checkpoint.status;
  checkpoint.stages[stage] = state;
  runtime.researchDiscoveryProgress = uiProgress(checkpoint);
  await Promise.all([
    runtime.backend.recordSharedResearchProgress({ workspace_dir: runtime.workspace.workspace_dir, progress: checkpoint as unknown as Record<string, unknown> }),
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

function buildImagePrompt(runtime: DeckGenerationRuntime, styleGuide: string, query: string, candidates: SharedResearchImageCandidate[]) {
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
    `Image query: ${query}`,
    `Candidate mapping: ${JSON.stringify(candidates.map((candidate, index) => ({ candidate_id: candidate.candidate_id, attachment_index: index + 1 })), null, 2)}`,
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

async function importSelectedImage(runtime: DeckGenerationRuntime, candidate: SharedResearchImageCandidate) {
  if (!runtime.hostUploadClient) throw new Error("Host Upload is required to import research images");
  const fetched = await runtime.researchWebClient.imageFetch({ url: candidate.image_url, max_bytes: 20 * 1024 * 1024, purpose: "ppt-research" });
  const response = await fetch(fetched.get_url);
  if (!response.ok) throw new Error(`Failed to read fetched APS image: HTTP ${response.status}`);
  const blob = await response.blob();
  const mimeType = fetched.mime_type || blob.type;
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : mimeType === "image/gif" ? ".gif" : ".jpg";
  const file = new File([blob], `${candidate.candidate_id}${extension}`, { type: mimeType });
  const hostUpload = await runtime.hostUploadClient.uploadFile(file, {
    purpose: "image_reference",
    filename: file.name,
    mimeType,
    metadata: { workspace_dir: runtime.workspace.workspace_dir, source: "research_image_fetch" },
  });
  const imported = await runtime.backend.importSharedResearchImageHostUpload({
    workspace_dir: runtime.workspace.workspace_dir,
    candidate_id: candidate.candidate_id,
    mime_type: mimeType,
    size_bytes: hostUpload.size_bytes,
    sha256: fetched.sha256,
    host_upload: hostUpload,
  });
  Object.assign(candidate, {
    file_path: imported.file_path,
    download_status: "imported" as const,
    sha256: imported.sha256,
    mime_type: imported.mime_type,
    bytes_size: imported.bytes_size,
    aps_path: fetched.path,
    final_url: fetched.final_url,
  });
}

export async function runLinearSharedResearch(runtime: DeckGenerationRuntime, input: { resume: boolean }) {
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
  let persistQueue = Promise.resolve();
  const persist = () => {
    const snapshot = structuredClone(checkpoint) as unknown as Record<string, unknown>;
    persistQueue = persistQueue.then(() => runtime.backend.recordSharedResearchProgress({ workspace_dir: runtime.workspace.workspace_dir, progress: snapshot })).then(() => undefined);
    return persistQueue;
  };
  const controls = getResearchSearchControlSettings(runtime);

  if (checkpoint.stages.web_decision === "waiting" || checkpoint.stages.web_decision === "running") {
    await setStage(runtime, checkpoint, "web_decision", "running");
    try {
      checkpoint.web ??= {};
      checkpoint.web.decision = controls.disableWebResearch
        ? { needs_search: false, queries: [], rationale: "Web research is disabled by the user setting." }
        : await runtime.researchAiClient.decideWebResearch(decisionContext("web_research_decision"));
      await setStage(runtime, checkpoint, "web_decision", checkpoint.web.decision.needs_search ? "completed" : "skipped");
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
      await setStage(runtime, checkpoint, "web_decision", "warning");
    }
  }
  throwIfCancelled(runtime);

  if (!checkpoint.web?.written) {
    await setStage(runtime, checkpoint, "web_research", "running");
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
      await Promise.all(decision.queries.filter((query) => !existingQueries.has(query)).map(async (query) => {
        try {
          const response = await runtime.researchWebClient.search({ query, max_results: 6 });
          const queryIndex = decision.queries.indexOf(query);
          const results = response.results.map((result, resultIndex) => ({ ...result, result_id: `web-q${queryIndex + 1}-r${resultIndex + 1}` }));
          checkpoint.web!.searches!.push({ query, status: results.length > 0 ? "completed" : "warning", result: results, ...(results.length === 0 ? { error: "No results" } : {}) });
        } catch (error) {
          checkpoint.web!.searches!.push({ query, status: "warning", error: errorMessage(error) });
          checkpoint.web!.diagnostic_errors = appendUnique(checkpoint.web!.diagnostic_errors, `${query}: ${errorMessage(error)}`);
          await logResearchError(runtime, "web-search", error, { query });
        }
        await persist();
      }));
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
            const selected = await runtime.researchAiClient.selectWebFetchResults({ ...decisionContext("web_fetch_selection"), results: allResults });
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
              const fetched = await runtime.researchWebClient.fetch({ urls, max_chars: 8000 });
              checkpoint.web.fetched_pages = fetched.pages;
              const failedPages = fetched.pages.filter((page) => !page.ok);
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
            const summary = await runtime.researchAiClient.summarizeWebResearch({
              ...decisionContext("web_research_summary"),
              searchResults: allResults,
              fetchedPages: checkpoint.web.fetched_pages.filter((page) => page.ok),
              gaps: checkpoint.web.gaps ?? [],
            });
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
    await runtime.backend.appendWebResearchBatch({ workspace_dir: runtime.workspace.workspace_dir, markdown: checkpoint.web.prepared_batch ?? "" });
    checkpoint.web.written = true;
    await setStage(runtime, checkpoint, "web_research", checkpoint.web.gaps?.length ? "warning" : decision.needs_search ? "completed" : "skipped");
  }
  context = await runtime.backend.getSharedResearchContext({ workspace_dir: runtime.workspace.workspace_dir });
  throwIfCancelled(runtime);

  if (checkpoint.stages.image_decision === "waiting" || checkpoint.stages.image_decision === "running") {
    await setStage(runtime, checkpoint, "image_decision", "running");
    try {
      checkpoint.image ??= {};
      checkpoint.image.decision = controls.disableImageResearch
        ? { needs_search: false, queries: [], rationale: "Image research is disabled by the user setting." }
        : await runtime.researchAiClient.decideImageResearch(decisionContext("image_research_decision"));
      await setStage(runtime, checkpoint, "image_decision", checkpoint.image.decision.needs_search ? "completed" : "skipped");
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
      await setStage(runtime, checkpoint, "image_decision", "warning");
    }
  }
  throwIfCancelled(runtime);

  if (!checkpoint.image?.written) {
    await setStage(runtime, checkpoint, "image_research", "running");
    checkpoint.image ??= {};
    const decision = checkpoint.image.decision ?? { needs_search: false, queries: [] };
    const queries: SharedResearchImageBatch["queries"] = [];
    const gaps: string[] = [...(checkpoint.image.gaps ?? [])];
    let candidates: SharedResearchImageCandidate[] = [];
    if (decision.needs_search && decision.queries.length > 0) {
      checkpoint.image.searches ??= [];
      const existingQueries = new Set(checkpoint.image.searches.map((item) => item.query));
      await Promise.all(decision.queries.filter((query) => !existingQueries.has(query)).map(async (query) => {
        try {
          const response = await runtime.researchWebClient.imageSearch({ query, max_results: 6, min_width: 800, min_height: 600, aspect: "any" });
          const batchCandidates = response.results.slice(0, 6).map((item) => ({
            candidate_id: `image-${crypto.randomUUID()}`,
            query,
            image_url: item.image_url,
            thumbnail_url: item.thumbnail_url,
            source_url: item.source_url,
            title: item.title,
            width: item.width,
            height: item.height,
            ...(item.mime_type ? { mime_type: item.mime_type } : {}),
            use_in_ppt: false,
            description: "Not returned by image analysis.",
            reason: "Not returned by image analysis; defaulted to use_in_ppt: false.",
            download_status: "pending" as const,
          }));
          checkpoint.image!.searches!.push({ query, status: batchCandidates.length > 0 ? "completed" : "warning", result: batchCandidates, ...(batchCandidates.length === 0 ? { error: "No image results" } : {}) });
        } catch (error) {
          checkpoint.image!.searches!.push({ query, status: "warning", error: errorMessage(error) });
          checkpoint.image!.diagnostic_errors = appendUnique(checkpoint.image!.diagnostic_errors, `${query}: ${errorMessage(error)}`);
          await logResearchError(runtime, "image-search", error, { query });
        }
        await persist();
      }));
      checkpoint.image.analyzed_query_indexes ??= [];
      const downloadTasks: Promise<void>[] = [];
      await mapWithConcurrency(checkpoint.image.searches, getResearchImageSessionConcurrency(runtime), async (search, searchIndex) => {
        if (!search.result?.length) return;
        if (!checkpoint.image!.analyzed_query_indexes!.includes(searchIndex)) {
          const attachments: AnnaAgentImageAttachment[] = search.result.map((candidate) => ({
            type: inferAttachmentType({ image_url: candidate.image_url, source_url: candidate.source_url, mime_type: candidate.mime_type }),
            url: candidate.image_url || candidate.thumbnail_url || "",
            filename: candidate.candidate_id,
            detail: "auto",
          }));
          try {
            const analysis = await runtime.agentClient.runImageResearchPrompt(buildImagePrompt(runtime, styleGuide.content, search.query, search.result), {
              attachments,
              signal: runtime.cancelSignal,
              isCancelled: runtime.isCancelled,
              logContext: researchLogContext(runtime, "image_candidate_analysis", search.query),
            });
            const byId = new Map(analysis.candidates.map((item) => [item.candidate_id, item]));
            for (const candidate of search.result) {
              const decision = byId.get(candidate.candidate_id);
              if (!decision) continue;
              Object.assign(candidate, decision);
            }
          } catch (error) {
            if (isAgentRunCancelledError(error) || runtime.isCancelled()) throw error;
            checkpoint.image!.gaps = appendUnique(
              checkpoint.image!.gaps,
              runtime.locale === "zh" ? `图片搜索词“${search.query}”的候选未能完成视觉判断。` : `Image candidates for query “${search.query}” could not be visually assessed.`,
            );
            checkpoint.image!.diagnostic_errors = appendUnique(checkpoint.image!.diagnostic_errors, `${search.query}: ${errorMessage(error)}`);
            await logResearchError(runtime, "image-analysis", error, { query: search.query });
          }
          checkpoint.image!.analyzed_query_indexes!.push(searchIndex);
          await persist();
        }
        for (const candidate of search.result.filter((item) => item.use_in_ppt && item.download_status === "pending")) {
          const downloadTask = (async () => {
            try {
              await importSelectedImage(runtime, candidate);
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
          })();
          downloadTask.catch(() => undefined);
          downloadTasks.push(downloadTask);
        }
      });
      throwIfCancelled(runtime);
      await Promise.all(downloadTasks);
      throwIfCancelled(runtime);
      candidates = checkpoint.image.searches.flatMap((item) => item.result ?? []).map((candidate) => {
        const { error: _diagnosticError, ...formalCandidate } = candidate;
        return formalCandidate;
      });
      gaps.push(...(checkpoint.image.gaps ?? []));
      for (const search of checkpoint.image.searches) {
        queries.push({
          query: search.query,
          status: search.status === "completed" ? "completed" : "warning",
          candidate_count: search.result?.length ?? 0,
          ...(search.error ? { message: runtime.locale === "zh" ? "未获得可用图片候选。" : "No usable image candidates were returned." } : {}),
        });
        if (search.error) gaps.push(runtime.locale === "zh" ? `图片搜索词“${search.query}”未获得可用候选。` : `No usable image candidates were collected for query “${search.query}”.`);
      }
    } else if (decision.needs_search) {
      gaps.push("Image research was requested, but no usable query was returned.");
    }
    const status: SharedResearchStageState = !decision.needs_search ? "skipped" : gaps.length > 0 || candidates.length === 0 ? "warning" : "completed";
    const uniqueGaps = [...new Set(gaps)];
    checkpoint.image.prepared_batch = {
      title: batchTitle(runtime),
      status,
      queries,
      candidates,
      gaps: uniqueGaps,
      statistics: {
        queries: queries.length,
        candidates: candidates.length,
        selected: candidates.filter((candidate) => candidate.use_in_ppt).length,
        imported: candidates.filter((candidate) => candidate.download_status === "imported").length,
        failed: candidates.filter((candidate) => candidate.download_status === "failed").length,
        gaps: uniqueGaps.length,
      },
    };
    await persist();
    await runtime.backend.appendImageResearchBatch({ workspace_dir: runtime.workspace.workspace_dir, batch: checkpoint.image.prepared_batch });
    checkpoint.image.written = true;
    const stageStates = Object.values(checkpoint.stages);
    const noNewResearch = checkpoint.web?.decision?.needs_search !== true && checkpoint.image?.decision?.needs_search !== true;
    checkpoint.status = status === "warning" || stageStates.includes("warning")
      ? "warning"
      : noNewResearch
        ? "skipped"
        : "completed";
    await setStage(runtime, checkpoint, "image_research", status);
  }
}
