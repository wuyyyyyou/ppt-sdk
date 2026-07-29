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
        && candidate.download_status === "imported"
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
    importSharedResearchImageHostUpload: async ({ candidate_id }: { candidate_id: string }) => ({
      workspace_dir: context.workspace_dir,
      candidate_id,
      file_path: `/tmp/workspace/research/evidence/images/${candidate_id}.png`,
      sha256: "sha256",
      mime_type: "image/png",
      bytes_size: 3,
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

  it("starts selected-image downloads as soon as each image Session finishes", async () => {
    const secondSessionEntered = deferred();
    const releaseSecondSession = deferred();
    const firstDownloadStarted = deferred();
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
        imageFetch: async () => {
          firstDownloadStarted.resolve();
          return {
            path: "aps/image",
            get_url: "https://download.test/image",
            mime_type: "image/png",
            bytes_size: 3,
            sha256: "sha256",
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
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
    const run = runLinearSharedResearch(runtime, { resume: false });
    try {
      await secondSessionEntered.promise;
      const outcome = await Promise.race([
        firstDownloadStarted.promise.then(() => "downloaded"),
        new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 50)),
      ]);
      assert.equal(outcome, "downloaded");
    } finally {
      releaseSecondSession.resolve();
      await run;
      globalThis.fetch = originalFetch;
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
          const candidateId = prompt.match(/"candidate_id": "([^"]+)"/)?.[1] ?? "";
          return { candidates: [{ candidate_id: candidateId, use_in_ppt: false, description: "Messi", reason: "Relevant" }] };
        },
      },
    });

    await runLinearSharedResearch(runtime, { resume: false });

    assert.equal(analysisRuns, 1);
    assert.equal(analyzedAttachmentCount, 1);
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

  it("reuses one imported file when distinct image URLs have the same content hash", async () => {
    let uploadCount = 0;
    let backendImportCount = 0;
    let hostUploadMetadata: Record<string, unknown> | undefined;
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
        imageFetch: async (
          { url }: { url: string },
          callContext: { interaction_id?: string },
        ) => {
          callContext.interaction_id = `image-fetch-${url.endsWith("a.jpg") ? "a" : "b"}`;
          return {
            path: `aps/${url.endsWith("a.jpg") ? "a" : "b"}`,
            get_url: "https://download.test/shared-image",
            mime_type: "image/jpeg",
            bytes_size: 3,
            sha256: "same-content-sha256",
            source_url: url,
            final_url: url,
          };
        },
      },
      agentClient: {
        runImageResearchPrompt: async (prompt: string) => ({
          candidates: [...prompt.matchAll(/"candidate_id": "([^"]+)"/g)].map((match) => ({
            candidate_id: match[1] ?? "",
            use_in_ppt: true,
            description: "Messi",
            reason: "Relevant",
          })),
        }),
      },
      hostUploadClient: {
        uploadFile: async (_file: File, input: { metadata?: Record<string, unknown> }) => {
          uploadCount += 1;
          hostUploadMetadata = input.metadata;
          return { transport: "host_upload", r2_key: "key", url: "https://upload.test/image", mime_type: "image/jpeg", size_bytes: 3 };
        },
      },
    });
    const runtimeRecord = runtime as unknown as { backend: Record<string, unknown> };
    const originalBackend = runtimeRecord.backend;
    runtimeRecord.backend = {
      ...originalBackend,
      importSharedResearchImageHostUpload: async ({ candidate_id }: { candidate_id: string }) => {
        backendImportCount += 1;
        return {
          workspace_dir: "/tmp/workspace",
          candidate_id,
          file_path: `/tmp/workspace/research/evidence/images/${candidate_id}.jpg`,
          sha256: "same-content-sha256",
          mime_type: "image/jpeg",
          bytes_size: 3,
        };
      },
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(new Blob(["img"], { type: "image/jpeg" }), { status: 200 });
    try {
      await runLinearSharedResearch(runtime, { resume: false });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(uploadCount, 1);
    assert.equal(backendImportCount, 1);
    assert.equal(imageBatches[0]?.candidates.filter((candidate) => candidate.download_status === "imported").length, 2);
    assert.equal(imageBatches[0]?.statistics?.unique_content_imported, 1);
    const duplicate = imageBatches[0]?.candidates.find((candidate) => candidate.content_duplicate_of);
    assert.ok(duplicate?.content_duplicate_of);
    const progress = context.progress as { image?: { content_deduplication?: { statistics?: Record<string, number> } } };
    assert.equal(progress.image?.content_deduplication?.statistics?.imported_candidates, 2);
    assert.equal(progress.image?.content_deduplication?.statistics?.unique_content, 1);
    const apsEvents = logs.filter((entry) => entry.transport === "aps_files");
    assert.deepEqual(apsEvents.map((entry) => entry.event), ["storage.transfer.started", "storage.transfer.finished"]);
    assert.equal(apsEvents[0]?.operation_id, hostUploadMetadata?.operation_id);
    assert.equal(apsEvents[0]?.parent_interaction_id, hostUploadMetadata?.parent_interaction_id);
    assert.match(String(apsEvents[0]?.parent_interaction_id), /^image-fetch-/);
  });

  it("resumes from completed image checkpoints without repeating analysis or upload", async () => {
    let analysisRuns = 0;
    let uploadCount = 0;
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
      hostUploadClient: {
        uploadFile: async () => {
          uploadCount += 1;
          return { transport: "host_upload", r2_key: "key", url: "https://upload.test/resume-image", mime_type: "image/jpeg", size_bytes: 3 };
        },
      },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(new Blob(["img"], { type: "image/jpeg" }), { status: 200 });
    try {
      await runLinearSharedResearch(runtime, { resume: false });
      assert.equal(analysisRuns, 1);
      assert.equal(uploadCount, 1);

      const progress = context.progress as { image?: { written?: boolean } };
      if (!progress.image) throw new Error("Expected persisted image checkpoint");
      progress.image.written = false;
      imageBatches.length = 0;
      context.image_catalog.assets.length = 0;

      await runLinearSharedResearch(runtime, { resume: true });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(analysisRuns, 1);
    assert.equal(uploadCount, 1);
    assert.equal(imageBatches.length, 1);
    assert.equal(imageBatches[0]?.candidates[0]?.download_status, "imported");
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
