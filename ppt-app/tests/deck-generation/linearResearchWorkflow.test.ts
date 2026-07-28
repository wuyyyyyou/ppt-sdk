import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AiInteractionLogger } from "../../src/ai/interactionLog.ts";
import type { SharedResearchContextResult, SharedResearchImageBatch } from "../../src/api/types.ts";
import { runLinearSharedResearch } from "../../src/features/deck-generation/linearResearchWorkflow.ts";
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
    image_catalog: { schema_version: 1, batches: [] },
    progress: {},
  };
  const webBatches: string[] = [];
  const imageBatches: SharedResearchImageBatch[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const pageProgress = { pages: [] };
  const backend = {
    prepareSharedResearchWorkspace: async () => context,
    getSharedResearchContext: async () => context,
    getWorkspaceStyleGuide: async () => ({ content: "Use documentary photography." }),
    recordSharedResearchProgress: async ({ progress }: { progress: Record<string, unknown> }) => {
      context.progress = structuredClone(progress);
      return progress;
    },
    recordPageProgress: async () => pageProgress,
    appendWebResearchBatch: async ({ markdown }: { markdown: string }) => {
      webBatches.push(markdown);
      context.web_summary = `${context.web_summary.trimEnd()}\n\n${markdown}\n`;
      return { workspace_dir: context.workspace_dir, web_summary_path: context.web_summary_path, appended: true };
    },
    appendImageResearchBatch: async ({ batch }: { batch: SharedResearchImageBatch }) => {
      imageBatches.push(structuredClone(batch));
      context.image_catalog.batches.push(structuredClone(batch));
      return { workspace_dir: context.workspace_dir, image_catalog_path: context.image_catalog_path, appended: true };
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
    const { runtime, context, imageBatches } = createRuntime({
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
        imageFetch: async ({ url }: { url: string }) => ({
          path: `aps/${url.endsWith("a.jpg") ? "a" : "b"}`,
          get_url: "https://download.test/shared-image",
          mime_type: "image/jpeg",
          bytes_size: 3,
          sha256: "same-content-sha256",
          source_url: url,
          final_url: url,
        }),
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
        uploadFile: async () => {
          uploadCount += 1;
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
      context.image_catalog.batches.length = 0;

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
