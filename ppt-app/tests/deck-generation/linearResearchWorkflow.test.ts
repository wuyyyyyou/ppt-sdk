import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AiInteractionLogger } from "../../src/ai/interactionLog.ts";
import type {
  SharedResearchContextResult,
  SharedResearchImageAsset,
  SharedResearchImageBatch,
  SharedResearchProgressOperation,
} from "../../src/api/types.ts";
import {
  buildLinearResearchUiProgress,
  chunkSharedResearchProgressOperations,
  runLinearSharedResearch,
} from "../../src/features/deck-generation/linearResearchWorkflow.ts";
import type { DeckGenerationRuntime } from "../../src/features/deck-generation/types.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function createRuntime(overrides: Record<string, unknown> = {}) {
  const context: SharedResearchContextResult = {
    workspace_dir: "/tmp/workspace",
    web_summary_path: "/tmp/workspace/research/evidence/web-summary.md",
    image_catalog_path: "/tmp/workspace/research/evidence/image-catalog.json",
    images_dir: "/tmp/workspace/research/evidence/images",
    progress_path: "/tmp/workspace/research/web-image-search-progress.json",
    web_summary: "# Web Research Summary\n",
    image_catalog: { schema_version: 2, assets: [] },
    progress: {},
  };
  const webBatches: string[] = [];
  const imageBatches: SharedResearchImageBatch[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const pageProgress = { pages: [] };
  const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const upsert = (items: unknown, key: string, value: Record<string, unknown>) => {
    const current = Array.isArray(items) ? items.map(asRecord) : [];
    const index = current.findIndex((item) => item[key] === value[key]);
    if (index >= 0) current[index] = structuredClone(value);
    else current.push(structuredClone(value));
    return current;
  };
  const applyPatch = (operations: SharedResearchProgressOperation[]) => {
    const progress = context.progress;
    progress.schema_version ??= 2;
    progress.status ??= "waiting";
    progress.stages ??= {};
    for (const operation of operations) {
      const web = asRecord(progress.web);
      const image = asRecord(progress.image);
      if (operation.op === "set_stage") {
        asRecord(progress.stages)[operation.stage] = operation.state;
        if (operation.state === "running" && progress.status === "waiting") progress.status = "running";
      } else if (operation.op === "set_web_decision") progress.web = { ...web, decision: structuredClone(operation.decision) };
      else if (operation.op === "upsert_web_search") progress.web = { ...web, searches: upsert(web.searches, "query", { ...operation.search, query: operation.query }) };
      else if (operation.op === "set_web_fetch_result_ids") progress.web = { ...web, fetch_result_ids: [...operation.result_ids] };
      else if (operation.op === "upsert_web_fetched_page") progress.web = { ...web, fetched_pages: upsert(web.fetched_pages, "url", { ...operation.page, url: operation.url }) };
      else if (operation.op === "set_web_prepared_batch") progress.web = { ...web, prepared_batch: operation.markdown, written: false };
      else if (operation.op === "set_web_diagnostics") progress.web = { ...web, gaps: [...operation.gaps], diagnostic_errors: [...operation.diagnostic_errors] };
      else if (operation.op === "set_image_decision") progress.image = { ...image, decision: structuredClone(operation.decision) };
      else if (operation.op === "upsert_image_search") progress.image = { ...image, searches: upsert(image.searches, "query", { ...operation.search, query: operation.query }) };
      else if (operation.op === "set_image_work_status") progress.image = { ...image, [operation.field]: operation.state };
      else if (operation.op === "upsert_image_deduplication_entry") {
        const deduplication = asRecord(image.deduplication);
        progress.image = {
          ...image,
          deduplication: { ...deduplication, groups: upsert(deduplication.groups, "candidate_id", { ...operation.group, candidate_id: operation.candidate_id }) },
          candidates: upsert(image.candidates, "candidate_id", { ...operation.candidate, candidate_id: operation.candidate_id }),
        };
      } else if (operation.op === "set_image_deduplication_summary") {
        progress.image = { ...image, deduplication: { ...asRecord(image.deduplication), status: "completed", strategy: operation.strategy, statistics: operation.statistics } };
      } else if (operation.op === "upsert_image_analysis_batch") {
        let candidates = image.candidates;
        for (const candidate of operation.candidates) candidates = upsert(candidates, "candidate_id", { ...candidate.candidate, candidate_id: candidate.candidate_id });
        progress.image = { ...image, analysis_batches: upsert(image.analysis_batches, "batch_id", { ...operation.batch, batch_id: operation.batch_id }), candidates };
      }
      else if (operation.op === "upsert_image_candidate") progress.image = { ...image, candidates: upsert(image.candidates, "candidate_id", { ...operation.candidate, candidate_id: operation.candidate_id }) };
      else if (operation.op === "set_image_diagnostics") progress.image = { ...image, gaps: [...operation.gaps], diagnostic_errors: [...operation.diagnostic_errors] };
      else if (operation.op === "set_image_content_deduplication") progress.image = { ...image, content_deduplication: structuredClone(operation.value) };
      else if (operation.op === "finalize_image_research") {
        progress.image = {
          ...image,
          prepared_batch: {
            title: operation.title,
            status: operation.status,
            queries: structuredClone(operation.queries),
            candidates: structuredClone(Array.isArray(image.candidates) ? image.candidates : []),
            gaps: [...operation.gaps],
            statistics: structuredClone(operation.statistics),
          },
          written: false,
        };
      } else if (operation.op === "finalize_shared_research") progress.status = "completed";
    }
  };
  const backend = {
    prepareSharedResearchWorkspace: async () => context,
    getSharedResearchContext: async () => context,
    getWorkspaceStyleGuide: async () => ({ content: "Use documentary photography." }),
    patchSharedResearchProgress: async ({ operations }: { operations: SharedResearchProgressOperation[] }) => {
      applyPatch(operations);
      return { workspace_dir: context.workspace_dir, progress_path: context.progress_path, updated: true, revision: 1, updated_at: new Date().toISOString() };
    },
    recordPageProgress: async () => pageProgress,
    publishPreparedWebResearchBatch: async () => {
      const web = asRecord(context.progress.web);
      const markdown = String(web.prepared_batch ?? "");
      webBatches.push(markdown);
      context.web_summary = `${context.web_summary.trimEnd()}\n\n${markdown}\n`;
      context.progress.web = { ...web, written: true };
      return { workspace_dir: context.workspace_dir, artifact_path: context.web_summary_path, published: true, already_published: false, revision: 1 };
    },
    publishPreparedImageResearchBatch: async () => {
      const batch = asRecord(asRecord(context.progress.image).prepared_batch) as unknown as SharedResearchImageBatch;
      imageBatches.push(structuredClone(batch));
      const assets = batch.candidates.filter((candidate) => (
        candidate.use_in_ppt
        && candidate.import_status === "imported"
        && candidate.file_path
        && candidate.sha256
        && candidate.mime_type
        && candidate.bytes_size
      )).map((candidate): SharedResearchImageAsset => ({
        asset_id: candidate.candidate_id,
        file_path: candidate.file_path as string,
        sha256: candidate.sha256 as string,
        mime_type: candidate.mime_type as string,
        bytes_size: candidate.bytes_size as number,
        ...(typeof candidate.width === "number" ? { width: candidate.width } : {}),
        ...(typeof candidate.height === "number" ? { height: candidate.height } : {}),
        description: candidate.description,
        reason: candidate.reason,
        matched_queries: candidate.matched_queries ?? [candidate.query],
        source_url: candidate.source_url,
      }));
      for (const asset of assets) {
        if (!context.image_catalog.assets.some((existing) => existing.sha256 === asset.sha256)) {
          context.image_catalog.assets.push(structuredClone(asset));
        }
      }
      context.progress.image = { ...asRecord(context.progress.image), written: true };
      return { workspace_dir: context.workspace_dir, artifact_path: context.image_catalog_path, published: true, already_published: false, revision: 1 };
    },
    prepareSharedResearchImageCandidate: async ({ candidate_id, source_url }: { candidate_id: string; source_url: string }) => ({
      workspace_dir: context.workspace_dir,
      candidate_id,
      local_file_path: `/tmp/workspace/research/evidence/images/.staging/research/${candidate_id}.jpg`,
      final_url: source_url,
      mime_type: "image/jpeg",
      bytes_size: 3,
      sha256: candidate_id.padEnd(64, "0").slice(0, 64),
      width: 1600,
      height: 900,
    }),
    uploadSharedResearchImageCandidate: async ({ candidate_id }: { candidate_id: string }) => ({
      workspace_dir: context.workspace_dir,
      candidate_id,
      host_upload: {
        transport: "host_upload" as const,
        r2_key: `uploads/${candidate_id}`,
        url: `https://upload.test/${candidate_id}`,
        mime_type: "image/jpeg",
        size_bytes: 3,
        filename: `${candidate_id}.jpg`,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    }),
    importSharedResearchImageLocal: async ({
      candidate_id,
      sha256,
      mime_type,
      size_bytes,
    }: { candidate_id: string; sha256: string; mime_type: string; size_bytes: number }) => ({
      workspace_dir: context.workspace_dir,
      candidate_id,
      file_path: `/tmp/workspace/research/evidence/images/${candidate_id}.png`,
      sha256,
      mime_type,
      bytes_size: size_bytes,
    }),
    cleanupSharedResearchImageStaging: async ({ operation_id }: { operation_id: string }) => ({
      workspace_dir: context.workspace_dir,
      operation_id,
      cleaned: true,
    }),
    appendWorkspaceLog: async ({ entry }: { entry: Record<string, unknown> }) => {
      logs.push(structuredClone(entry));
      return { appended: true };
    },
  };
  const runtime = {
    backend,
    workspace: {
      workspace_dir: context.workspace_dir,
      setting: { research_image_session_concurrency: 2 },
      requirements: { source: { brief: "Create a market deck." } },
    },
    confirmedOutline: {
      version: 3,
      title: "Market deck",
      status: "confirmed",
      items: [{ page_id: "page-01", title: "Market", core_message: "Growth", required_content: "Data" }],
    },
    locale: "en",
    activeStreams: new Map(),
    getProgress: () => pageProgress,
    setProgress: () => undefined,
    onProgress: () => undefined,
    isCancelled: () => false,
    researchAiClient: {
      decideWebResearch: async () => ({ needs_search: false, queries: [] }),
      selectWebFetchResults: async () => [],
      summarizeWebResearch: async () => "Summary",
      decideImageResearch: async () => ({ needs_search: false, queries: [] }),
    },
    researchWebClient: {
      search: async () => ({ results: [] }),
      fetch: async () => ({ pages: [] }),
      imageSearch: async () => ({ results: [] }),
      imageFetch: async () => ({
        path: "aps/image",
        get_url: "https://download.test/image",
        mime_type: "image/png",
        bytes_size: 3,
        sha256: "sha256",
        source_url: "https://source.test",
        final_url: "https://image.test",
      }),
    },
    agentClient: { runImageResearchPrompt: async () => ({ candidates: [] }) },
    hostUploadClient: {
      uploadFile: async () => ({
        transport: "host_upload",
        r2_key: "key",
        url: "https://upload.test/image",
        mime_type: "image/png",
        size_bytes: 3,
      }),
    },
    ...overrides,
  } as unknown as DeckGenerationRuntime;
  return { runtime, context, webBatches, imageBatches, logs };
}

describe("Linear Shared Research workflow", () => {
  it("projects bounded live Web and image progress from the checkpoint", () => {
    const checkpoint = {
      schema_version: 2,
      status: "running",
      stages: {
        web_decision: "completed",
        web_research: "running",
        image_decision: "completed",
        image_research: "running",
        image_search: "completed",
        image_deduplication: "completed",
        image_prefetch: "completed",
        image_analysis: "running",
        image_import: "running",
      },
      web: {
        decision: { needs_search: true, queries: ["market evidence", "policy update"], rationale: "Current sources are needed." },
        searches: [
          { query: "market evidence", status: "completed", result: [{ result_id: "web-q1-r1", title: "Official report", url: "https://source.test/report", snippet: "Evidence", site: "source.test" }] },
          { query: "policy update", status: "running" },
        ],
      },
      image: {
        decision: { needs_search: true, queries: ["factory photo"] },
        searches: [{ query: "factory photo", status: "completed", result: [] }],
        candidates: [{
          candidate_id: "image-1",
          query: "factory photo",
          image_url: "https://images.test/factory.jpg",
          source_url: "https://source.test/factory",
          use_in_ppt: true,
          description: "Factory",
          reason: "Relevant",
          local_download_status: "completed",
          upload_status: "completed",
          analysis_status: "completed",
          import_status: "imported",
        }],
        analysis_batches: [
          { batch_id: "batch-1", candidate_ids: ["image-1"], status: "completed", attempt: 1, interaction_ids: [] },
          { batch_id: "batch-2", candidate_ids: [], status: "running", attempt: 1, interaction_ids: [] },
        ],
      },
    } as Parameters<typeof buildLinearResearchUiProgress>[0];

    const progress = buildLinearResearchUiProgress(checkpoint, "2026-08-05T00:00:00.000Z");
    const web = progress.records.find((record) => record.phase === "web-collection");
    const image = progress.records.find((record) => record.phase === "visual-collection");

    assert.deepEqual(web?.activity, { kind: "web-search", completed: 1, total: 2 });
    assert.deepEqual(web?.queries?.map((query) => query.status), ["collected", "running"]);
    assert.deepEqual(image?.activity, { kind: "image-analysis", completed: 1, total: 2, selected: 1 });
    assert.equal(progress.summary.visualAssets, 1);
    assert.equal(JSON.stringify(progress).includes("images.test"), false);
  });

  it("fetches selected web pages one URL at a time in order", async () => {
    const urls = [
      "https://source.test/first",
      "https://source.test/second",
      "https://source.test/third",
    ];
    const fetchCalls: Array<{ urls: string[]; max_chars?: number }> = [];
    let activeFetches = 0;
    let maxActiveFetches = 0;
    const { runtime } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: true, queries: ["market evidence"] }),
        selectWebFetchResults: async (input: { results: Array<{ result_id: string }> }) => (
          input.results.map((result) => result.result_id)
        ),
        summarizeWebResearch: async () => "Market evidence summary.",
        decideImageResearch: async () => ({ needs_search: false, queries: [] }),
      },
      researchWebClient: {
        search: async () => ({
          results: urls.map((url, index) => ({
            title: `Source ${index + 1}`,
            url,
            snippet: `Evidence ${index + 1}`,
            site: "source.test",
          })),
        }),
        fetch: async (input: { urls: string[]; max_chars?: number }) => {
          fetchCalls.push(structuredClone(input));
          activeFetches += 1;
          maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
          await new Promise<void>((resolve) => setImmediate(resolve));
          activeFetches -= 1;
          return {
            pages: input.urls.map((url) => ({ url, ok: true, content: `Content for ${url}` })),
          };
        },
        imageSearch: async () => ({ results: [] }),
        imageFetch: async () => ({
          path: "aps/image",
          get_url: "https://download.test/image",
          mime_type: "image/png",
          bytes_size: 3,
          sha256: "sha256",
          source_url: "https://source.test",
          final_url: "https://image.test",
        }),
      },
    });

    await runLinearSharedResearch(runtime, { resume: false });

    assert.deepEqual(fetchCalls, urls.map((url) => ({ urls: [url], max_chars: 8000 })));
    assert.equal(maxActiveFetches, 1);
  });

  it("continues fetching the remaining selected pages after one page fails", async () => {
    const urls = ["https://source.test/failing", "https://source.test/available"];
    const fetchCalls: string[] = [];
    const { runtime, context } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: true, queries: ["market evidence"] }),
        selectWebFetchResults: async (input: { results: Array<{ result_id: string }> }) => input.results.map((result) => result.result_id),
        summarizeWebResearch: async () => "Market evidence summary.",
        decideImageResearch: async () => ({ needs_search: false, queries: [] }),
      },
      researchWebClient: {
        search: async () => ({ results: urls.map((url, index) => ({ title: `Source ${index + 1}`, url, snippet: "Evidence", site: "source.test" })) }),
        fetch: async ({ urls: requested }: { urls: string[] }) => {
          const url = requested[0] ?? "";
          fetchCalls.push(url);
          if (url.endsWith("failing")) throw new Error("source unavailable");
          return { pages: [{ url, ok: true, content: "Available evidence" }] };
        },
        imageSearch: async () => ({ results: [] }),
      },
    });

    await runLinearSharedResearch(runtime, { resume: false });

    assert.deepEqual(fetchCalls, urls);
    const fetchedPages = (context.progress as { web?: { fetched_pages?: Array<{ ok: boolean }> } }).web?.fetched_pages ?? [];
    assert.deepEqual(fetchedPages.map((page) => page.ok), [false, true]);
  });

  it("splits a five-query image checkpoint into patches below 32 KiB", () => {
    const operations: SharedResearchProgressOperation[] = Array.from({ length: 5 }, (_, queryIndex) => ({
      op: "upsert_image_search" as const,
      query: `query-${queryIndex + 1}`,
      search: {
        query: `query-${queryIndex + 1}`,
        status: "completed",
        result: Array.from({ length: 6 }, (_, resultIndex) => ({
          occurrence_id: `image-q${queryIndex + 1}-r${resultIndex + 1}`,
          image_url: `https://images.test/${queryIndex + 1}/${resultIndex + 1}.jpg`,
          source_url: `https://source.test/${queryIndex + 1}/${resultIndex + 1}`,
          title: `Candidate ${queryIndex + 1}-${resultIndex + 1}`,
          description: "x".repeat(1200),
        })),
      },
    }));
    const batches = chunkSharedResearchProgressOperations("/tmp/workspace", operations);
    assert.ok(batches.length > 1);
    assert.equal(batches.flat().length, operations.length);
    for (const batch of batches) {
      const bytes = new TextEncoder().encode(JSON.stringify({ workspace_dir: "/tmp/workspace", operations: batch })).byteLength;
      assert.ok(bytes <= 32 * 1024, `patch was ${bytes} bytes`);
    }
  });

  it("starts selected-image local imports as soon as each image Session finishes", async () => {
    const secondSessionEntered = deferred();
    const releaseSecondSession = deferred();
    const firstImportStarted = deferred();
    const seenLogContexts: string[] = [];
    const fakeLogger = {
      createOperationId: (_domain: string, operation: string) => `operation-${operation}`,
    } as unknown as AiInteractionLogger;
    const { runtime } = createRuntime({
      aiLogger: fakeLogger,
      researchAiClient: {
        decideWebResearch: async (input: { logContext?: { operation?: string } }) => {
          seenLogContexts.push(input.logContext?.operation ?? "");
          return { needs_search: true, queries: ["market evidence"] };
        },
        selectWebFetchResults: async (input: { logContext?: { operation?: string }; results: Array<{ result_id: string }> }) => {
          seenLogContexts.push(input.logContext?.operation ?? "");
          return [input.results[0]?.result_id ?? ""];
        },
        summarizeWebResearch: async (input: { logContext?: { operation?: string } }) => {
          seenLogContexts.push(input.logContext?.operation ?? "");
          return "Market evidence summary.";
        },
        decideImageResearch: async (input: { logContext?: { operation?: string } }) => {
          seenLogContexts.push(input.logContext?.operation ?? "");
          return { needs_search: true, queries: ["first image", "second image"] };
        },
      },
      researchWebClient: {
        search: async () => ({ results: [{
          title: "Market source",
          url: "https://source.test/market",
          snippet: "Useful market evidence.",
          site: "source.test",
        }] }),
        fetch: async () => ({ pages: [{
          url: "https://source.test/market",
          ok: true,
          content: "Market evidence.",
        }] }),
        imageSearch: async ({ query }: { query: string }) => ({
          results: Array.from({ length: query === "first image" ? 6 : 1 }, (_, index) => ({
            image_url: `https://image.test/${encodeURIComponent(query)}-${index}.png`,
            source_url: "https://source.test",
            mime_type: "image/png",
          })),
        }),
        imageFetch: async ({ url }: { url: string }) => {
          return {
            path: `aps/${encodeURIComponent(url)}`,
            get_url: "https://download.test/image",
            mime_type: "image/png",
            bytes_size: 3,
            sha256: url,
            source_url: "https://source.test",
            final_url: "https://image.test",
          };
        },
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string, options: { logContext?: { operation?: string } }) => {
          assert.equal(options.logContext?.operation, "image_candidate_analysis");
          if (prompt.includes("Image queries: second image")) {
            secondSessionEntered.resolve();
            await releaseSecondSession.promise;
          }
          return {
            candidates: [...prompt.matchAll(/"candidate_id": "([^"]+)"/g)].map((match, index) => ({
              candidate_id: match[1] ?? "",
              use_in_ppt: index === 0,
              description: "Usable",
              reason: "Relevant",
            })),
          };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalBackend = runtimeRecord.backend;
    runtimeRecord.backend = {
      ...originalBackend,
      importSharedResearchImageLocal: async (input: { candidate_id: string; sha256: string; mime_type: string; size_bytes: number }) => {
        firstImportStarted.resolve();
        return {
          workspace_dir: "/tmp/workspace",
          candidate_id: input.candidate_id,
          file_path: `/tmp/workspace/research/evidence/images/${input.candidate_id}.png`,
          sha256: input.sha256,
          mime_type: input.mime_type,
          bytes_size: input.size_bytes,
        };
      },
    };
    const run = runLinearSharedResearch(runtime, { resume: false });
    try {
      await secondSessionEntered.promise;
      const outcome = await Promise.race([
        firstImportStarted.promise.then(() => "imported"),
        new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 50)),
      ]);
      assert.equal(outcome, "imported");
    } finally {
      releaseSecondSession.resolve();
      await run;
    }
    assert.deepEqual(seenLogContexts, [
      "web_research_decision",
      "web_fetch_selection",
      "web_research_summary",
      "image_research_decision",
    ]);
  });

  it("deduplicates normalized image URLs across queries before image analysis", async () => {
    let analysisRuns = 0;
    let analyzedAttachmentCount = 0;
    let analyzedAttachmentUrl = "";
    const { runtime, context, imageBatches } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: false, queries: [] }),
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => ({ needs_search: true, queries: ["first", "second"] }),
      },
      researchWebClient: {
        search: async () => ({ results: [] }),
        fetch: async () => ({ pages: [] }),
        imageSearch: async ({ query }: { query: string }) => ({ results: [{
          image_url: query === "first"
            ? "HTTPS://IMAGE.TEST:443/messi.jpg?UTM_SOURCE=first&width=1200#hero"
            : "https://image.test/messi.jpg?width=1200&utm_id=second",
          source_url: `https://source.test/${query}`,
          mime_type: "image/jpeg",
        }] }),
        imageFetch: async () => ({
          path: "aps/image",
          get_url: "https://download.test/image",
          mime_type: "image/jpeg",
          bytes_size: 3,
          sha256: "sha256",
          source_url: "https://source.test",
          final_url: "https://image.test/messi.jpg",
        }),
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string, options: { attachments?: unknown[] }) => {
          analysisRuns += 1;
          analyzedAttachmentCount += options.attachments?.length ?? 0;
          analyzedAttachmentUrl = String((options.attachments?.[0] as { url?: unknown } | undefined)?.url ?? "");
          const candidateId = prompt.match(/"candidate_id": "([^"]+)"/)?.[1] ?? "";
          return { candidates: [{ candidate_id: candidateId, use_in_ppt: false, description: "Messi", reason: "Relevant" }] };
        },
      },
    });

    await runLinearSharedResearch(runtime, { resume: false });

    assert.equal(analysisRuns, 1);
    assert.equal(analyzedAttachmentCount, 1);
    assert.match(analyzedAttachmentUrl, /^https:\/\/upload\.test\//);
    assert.equal(analyzedAttachmentUrl.includes("image.test/messi.jpg"), false);
    assert.equal(imageBatches[0]?.candidates.length, 1);
    assert.deepEqual(imageBatches[0]?.candidates[0]?.matched_queries, ["first", "second"]);
    const progress = context.progress as {
      schema_version?: number;
      image?: { deduplication?: { statistics?: Record<string, number>; groups?: Array<{ occurrence_ids?: string[] }> } };
    };
    assert.equal(progress.schema_version, 2);
    assert.equal(progress.image?.deduplication?.statistics?.raw_occurrences, 2);
    assert.equal(progress.image?.deduplication?.statistics?.unique_urls, 1);
    assert.equal(progress.image?.deduplication?.statistics?.duplicate_occurrences, 1);
    assert.deepEqual(progress.image?.deduplication?.groups?.[0]?.occurrence_ids, ["image-q1-r1", "image-q2-r1"]);
  });

  it("filters only the candidate whose safe HTTPS download fails", async () => {
    let analyzedAttachmentCount = 0;
    const { runtime, context, imageBatches, logs } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: false, queries: [] }),
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => ({ needs_search: true, queries: ["images"] }),
      },
      researchWebClient: {
        search: async () => ({ results: [] }),
        fetch: async () => ({ pages: [] }),
        imageSearch: async () => ({ results: [
          { image_url: "https://image.test/good.jpg", source_url: "https://source.test/good", mime_type: "image/jpeg" },
          { image_url: "https://image.test/bad.jpg", source_url: "https://source.test/bad", mime_type: "image/jpeg" },
        ] }),
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string, options: { attachments?: unknown[] }) => {
          analyzedAttachmentCount += options.attachments?.length ?? 0;
          const candidateId = prompt.match(/"candidate_id": "([^"]+)"/)?.[1] ?? "";
          return { candidates: [{ candidate_id: candidateId, use_in_ppt: false, description: "Usable", reason: "Relevant" }] };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalPrepare = runtimeRecord.backend.prepareSharedResearchImageCandidate as (input: { source_url: string }) => Promise<unknown>;
    runtimeRecord.backend = {
      ...runtimeRecord.backend,
      prepareSharedResearchImageCandidate: async (input: { source_url: string }) => {
        if (input.source_url.endsWith("bad.jpg")) throw new Error("source returned 403");
        return originalPrepare(input);
      },
    };

    await runLinearSharedResearch(runtime, { resume: false });

    assert.equal(analyzedAttachmentCount, 1);
    const failed = imageBatches[0]?.candidates.find((candidate) => candidate.image_url.endsWith("bad.jpg"));
    assert.equal(failed?.local_download_status, "failed");
    assert.equal(failed?.use_in_ppt, false);
    const progress = context.progress as { stages?: Record<string, string>; image?: { prepare_status?: string } };
    assert.equal(progress.stages?.image_prefetch, "warning");
    assert.equal(progress.image?.prepare_status, "warning");
    assert.ok(logs.some((entry) => entry.event === "research.warning" && entry.operation === "image-download"));
  });

  it("analyzes and imports one representative when distinct image URLs have the same content hash", async () => {
    let backendImportCount = 0;
    let analyzedAttachmentCount = 0;
    const { runtime, context, imageBatches, logs } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: false, queries: [] }),
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => ({ needs_search: true, queries: ["images"] }),
      },
      researchWebClient: {
        search: async () => ({ results: [] }),
        fetch: async () => ({ pages: [] }),
        imageSearch: async () => ({ results: [
          { image_url: "https://image.test/a.jpg", source_url: "https://source.test/a", mime_type: "image/jpeg" },
          { image_url: "https://image.test/b.jpg", source_url: "https://source.test/b", mime_type: "image/jpeg" },
        ] }),
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string, options: { attachments?: unknown[] }) => {
          analyzedAttachmentCount += options.attachments?.length ?? 0;
          return { candidates: [...prompt.matchAll(/"candidate_id": "([^"]+)"/g)].map((match) => ({
            candidate_id: match[1] ?? "",
            use_in_ppt: true,
            description: "Messi",
            reason: "Relevant",
          })) };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalBackend = runtimeRecord.backend;
    const originalPrepare = originalBackend.prepareSharedResearchImageCandidate as (input: { candidate_id: string; source_url: string }) => Promise<Record<string, unknown>>;
    runtimeRecord.backend = {
      ...originalBackend,
      prepareSharedResearchImageCandidate: async (input: { candidate_id: string; source_url: string }) => ({
        ...(await originalPrepare(input)),
        sha256: "a".repeat(64),
      }),
      importSharedResearchImageLocal: async ({ candidate_id }: { candidate_id: string }) => {
        backendImportCount += 1;
        return {
          workspace_dir: "/tmp/workspace",
          candidate_id,
          file_path: `/tmp/workspace/research/evidence/images/${candidate_id}.jpg`,
          sha256: "a".repeat(64),
          mime_type: "image/jpeg",
          bytes_size: 3,
        };
      },
    };
    await runLinearSharedResearch(runtime, { resume: false });

    assert.equal(analyzedAttachmentCount, 1);
    assert.equal(backendImportCount, 1);
    assert.equal(imageBatches[0]?.candidates.filter((candidate) => candidate.import_status === "imported").length, 1);
    assert.equal(imageBatches[0]?.statistics?.unique_content_imported, 1);
    const duplicate = imageBatches[0]?.candidates.find((candidate) => candidate.content_duplicate_of);
    assert.ok(duplicate?.content_duplicate_of);
    assert.equal(duplicate?.analysis_status, "skipped");
    const progress = context.progress as { image?: { content_deduplication?: { statistics?: Record<string, number> } } };
    assert.equal(progress.image?.content_deduplication?.statistics?.fetched_candidates, 2);
    assert.equal(progress.image?.content_deduplication?.statistics?.unique_content, 1);
    assert.equal(context.image_catalog.assets.length, 1);
    assert.equal(JSON.stringify(context.image_catalog).includes("prefetch_status"), false);
    assert.equal(JSON.stringify(context.image_catalog).includes("aps_path"), false);
    assert.equal(logs.some((entry) => entry.transport === "aps_files"), false);
  });

  it("resumes from completed image checkpoints without repeating analysis or local import", async () => {
    let analysisRuns = 0;
    let importCount = 0;
    const { runtime, context, imageBatches } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: false, queries: [] }),
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => ({ needs_search: true, queries: ["resume image"] }),
      },
      researchWebClient: {
        search: async () => ({ results: [] }),
        fetch: async () => ({ pages: [] }),
        imageSearch: async () => ({ results: [{
          image_url: "https://image.test/resume.jpg",
          source_url: "https://source.test/resume",
          mime_type: "image/jpeg",
        }] }),
        imageFetch: async () => ({
          path: "aps/resume",
          get_url: "https://download.test/resume-image",
          mime_type: "image/jpeg",
          bytes_size: 3,
          sha256: "resume-image-sha256",
          source_url: "https://source.test/resume",
          final_url: "https://image.test/resume.jpg",
        }),
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string) => {
          analysisRuns += 1;
          const candidateId = prompt.match(/"candidate_id": "([^"]+)"/)?.[1] ?? "";
          return { candidates: [{ candidate_id: candidateId, use_in_ppt: true, description: "Usable", reason: "Relevant" }] };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalBackend = runtimeRecord.backend;
    runtimeRecord.backend = {
      ...originalBackend,
      importSharedResearchImageLocal: async (input: { candidate_id: string; sha256: string; mime_type: string; size_bytes: number }) => {
        importCount += 1;
        return {
          workspace_dir: "/tmp/workspace",
          candidate_id: input.candidate_id,
          file_path: `/tmp/workspace/research/evidence/images/${input.candidate_id}.jpg`,
          sha256: input.sha256,
          mime_type: input.mime_type,
          bytes_size: input.size_bytes,
        };
      },
    };
    await runLinearSharedResearch(runtime, { resume: false });
    assert.equal(analysisRuns, 1);
    assert.equal(importCount, 1);

    const progress = context.progress as { image?: { written?: boolean } };
    if (!progress.image) throw new Error("Expected persisted image checkpoint");
    progress.image.written = false;
    imageBatches.length = 0;
    context.image_catalog.assets.length = 0;

    await runLinearSharedResearch(runtime, { resume: true });

    assert.equal(analysisRuns, 1);
    assert.equal(importCount, 1);
    assert.equal(imageBatches.length, 1);
    assert.equal(imageBatches[0]?.candidates[0]?.import_status, "imported");
  });

  it("revalidates the staged file and uploads again when resuming interrupted image analysis", async () => {
    const prepareInputs: Array<Record<string, unknown>> = [];
    let uploadCount = 0;
    let analysisCount = 0;
    const { runtime, context, imageBatches } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => ({ needs_search: false, queries: [] }),
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => ({ needs_search: true, queries: ["resume image"] }),
      },
      researchWebClient: {
        search: async () => ({ results: [] }),
        fetch: async () => ({ pages: [] }),
        imageSearch: async () => ({ results: [{
          image_url: "https://image.test/resume.jpg",
          source_url: "https://source.test/resume",
          mime_type: "image/jpeg",
        }] }),
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string) => {
          analysisCount += 1;
          const candidateId = prompt.match(/"candidate_id": "([^"]+)"/)?.[1] ?? "";
          return { candidates: [{ candidate_id: candidateId, use_in_ppt: true, description: "Usable", reason: "Relevant" }] };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalPrepare = runtimeRecord.backend.prepareSharedResearchImageCandidate as (input: Record<string, unknown>) => Promise<unknown>;
    const originalUpload = runtimeRecord.backend.uploadSharedResearchImageCandidate as (input: Record<string, unknown>) => Promise<unknown>;
    runtimeRecord.backend = {
      ...runtimeRecord.backend,
      prepareSharedResearchImageCandidate: async (input: Record<string, unknown>) => {
        prepareInputs.push(structuredClone(input));
        return originalPrepare(input);
      },
      uploadSharedResearchImageCandidate: async (input: Record<string, unknown>) => {
        uploadCount += 1;
        return originalUpload(input);
      },
    };

    await runLinearSharedResearch(runtime, { resume: false });
    const progress = context.progress as unknown as {
      status: string;
      stages: Record<string, string>;
      image: {
        written: boolean;
        candidates: Array<Record<string, unknown>>;
        analysis_batches: Array<Record<string, unknown>>;
      };
    };
    const candidate = progress.image.candidates[0] as Record<string, unknown>;
    const priorLocalPath = String(candidate.local_file_path);
    const priorSha256 = String(candidate.sha256);
    progress.status = "running";
    progress.stages.image_research = "running";
    progress.stages.image_analysis = "running";
    progress.stages.image_import = "running";
    progress.image.written = false;
    candidate.analysis_status = "pending";
    candidate.import_status = "pending";
    candidate.use_in_ppt = false;
    progress.image.analysis_batches[0] = {
      ...progress.image.analysis_batches[0],
      status: "running",
    };
    imageBatches.length = 0;
    context.image_catalog.assets.length = 0;

    await runLinearSharedResearch(runtime, { resume: true });

    assert.equal(analysisCount, 2);
    assert.equal(uploadCount, 2);
    assert.equal(prepareInputs.length, 2);
    assert.equal(prepareInputs[1]?.existing_file_path, priorLocalPath);
    assert.equal(prepareInputs[1]?.expected_sha256, priorSha256);
    assert.equal(imageBatches[0]?.candidates[0]?.import_status, "imported");

    progress.status = "running";
    progress.stages.image_research = "running";
    progress.stages.image_analysis = "running";
    progress.stages.image_import = "running";
    progress.image.written = false;
    const legacyCandidate = progress.image.candidates[0] as Record<string, unknown>;
    legacyCandidate.prefetch_status = "completed";
    legacyCandidate.aps_path = "legacy-aps/candidate-1.jpg";
    legacyCandidate.download_status = "pending";
    legacyCandidate.analysis_status = "pending";
    legacyCandidate.use_in_ppt = false;
    delete legacyCandidate.local_download_status;
    delete legacyCandidate.local_file_path;
    delete legacyCandidate.upload_status;
    delete legacyCandidate.import_status;
    progress.image.analysis_batches[0] = {
      ...progress.image.analysis_batches[0],
      status: "running",
    };
    imageBatches.length = 0;
    context.image_catalog.assets.length = 0;

    await runLinearSharedResearch(runtime, { resume: true });

    assert.equal(analysisCount, 3);
    assert.equal(uploadCount, 3);
    assert.equal(prepareInputs.length, 3);
    assert.equal(prepareInputs[2]?.existing_file_path, undefined);
    assert.equal(JSON.stringify(context.progress).includes("legacy-aps"), false);
    assert.equal(imageBatches[0]?.candidates[0]?.import_status, "imported");
  });

  it("keeps raw technical errors out of formal research batches", async () => {
    const sentinel = "SECRET_TECHNICAL_ERROR_123";
    const { runtime, webBatches, imageBatches, logs, context } = createRuntime({
      researchAiClient: {
        decideWebResearch: async () => { throw new Error(sentinel); },
        selectWebFetchResults: async () => [],
        summarizeWebResearch: async () => "Summary",
        decideImageResearch: async () => { throw new Error(sentinel); },
      },
    });
    await runLinearSharedResearch(runtime, { resume: false });
    assert.equal(webBatches.some((batch) => batch.includes(sentinel)), false);
    assert.equal(JSON.stringify(imageBatches).includes(sentinel), false);
    assert.equal(JSON.stringify(logs).includes(sentinel), true);
    assert.equal(JSON.stringify(context.progress).includes(sentinel), true);
  });
});
