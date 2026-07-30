import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createResearchWebClient } from "../../src/api/researchWebClient.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

describe("Research Web Client", () => {
  it("uses the official host Web API with the confirmed limits", async () => {
    const calls: Array<{ method: string; input: unknown; options?: unknown }> = [];
    const logWrites: Array<{ channel?: string; entry: Record<string, unknown>; payload_keys?: string[] }> = [];
    const runtime = {
      web: {
        search: async (input: unknown) => {
          calls.push({ method: "search", input });
          return { results: [{ title: "Result", url: "https://example.com", snippet: "Useful", site: "example.com" }] };
        },
        fetch: async (input: unknown, options?: unknown) => {
          calls.push({ method: "fetch", input, options });
          return { pages: [{ url: "https://example.com", ok: true, content: "Body" }] };
        },
        image_search: async (input: unknown) => {
          calls.push({ method: "image_search", input });
          return { results: [{ image_url: "https://example.com/image.jpg", source_url: "https://example.com/page", mime_type: null }] };
        },
      },
    } as unknown as AnnaRuntime;
    const client = createResearchWebClient(runtime, {
      appendWorkspaceLog: async (input) => {
        logWrites.push({ channel: input.channel, entry: structuredClone(input.entry), payload_keys: input.payload_keys });
      },
    });
    const context = () => ({ workspace_dir: "/tmp/workspace", operation_id: "research-operation-1" });

    await client.search({ query: "market size", max_results: 6 }, context());
    await client.fetch({ urls: ["https://example.com"] }, context());
    await client.imageSearch({ query: "modern office" }, context());

    assert.deepEqual(calls[0], {
      method: "search",
      input: { query: "market size", max_results: 6, search_depth: "basic", topic: "general" },
    });
    assert.deepEqual(calls[1], {
      method: "fetch",
      input: { urls: ["https://example.com"], format: "markdown", max_chars: 8000, timeout_ms: 30000 },
      options: { timeoutMs: 90000 },
    });
    assert.deepEqual(calls[2], {
      method: "image_search",
      input: { query: "modern office", max_results: 6, min_width: 800, min_height: 600, aspect: "any" },
    });
    assert.deepEqual(logWrites.map((write) => write.channel), Array(6).fill("research-web-interactions"));
    assert.deepEqual(logWrites.map((write) => write.entry.status), [
      "started", "succeeded",
      "started", "succeeded",
      "started", "succeeded",
    ]);
    assert.deepEqual(logWrites.filter((write) => write.entry.status === "started").map((write) => write.entry.method), [
      "search", "fetch", "image_search",
    ]);
    assert.ok(logWrites.every((write) => write.entry.operation_id === "research-operation-1"));
    assert.equal(new Set(logWrites.map((write) => write.entry.interaction_id)).size, 3);
  });

  it("keeps tolerant normalization while recording warnings and normalization failures", async () => {
    const logWrites: Array<Record<string, unknown>> = [];
    const runtime = {
      web: {
        search: async () => ({ unexpected: true }),
        fetch: async () => {
          const error = new Error("Anna fetch failed", { cause: new Error("Provider timeout") }) as Error & {
            code?: string;
            data?: Record<string, unknown>;
          };
          error.code = "UPSTREAM_TIMEOUT";
          error.data = { status: 504 };
          (error as Error & { self?: unknown }).self = error;
          throw error;
        },
        image_search: async () => ({ results: [] }),
      },
    } as unknown as AnnaRuntime;
    const client = createResearchWebClient(runtime, {
      appendWorkspaceLog: async (input) => { logWrites.push(structuredClone(input.entry)); },
    });
    const context = () => ({ workspace_dir: "/tmp/workspace", operation_id: "research-operation-2" });

    assert.deepEqual(await client.search({ query: "market size" }, context()), { results: [] });
    const tolerantFinish = logWrites.find((entry) => entry.method === "search" && entry.status === "succeeded");
    assert.deepEqual(tolerantFinish?.normalization_warnings, [{
      code: "missing_or_invalid_array",
      path: "$.results",
      fallback: "normalized_to_empty_array",
    }]);

    await assert.rejects(
      () => client.fetch({ urls: ["https://example.com"] }, context()),
      /Anna fetch failed/,
    );
    const invokeFailure = logWrites.find((entry) => entry.method === "fetch" && entry.status === "failed");
    const error = invokeFailure?.error as Record<string, unknown>;
    assert.equal(invokeFailure?.failure_phase, "invoke");
    assert.equal(error.code, "UPSTREAM_TIMEOUT");
    assert.deepEqual(error.data, { status: 504 });
    assert.equal((error.cause as Record<string, unknown>).message, "Provider timeout");
    assert.deepEqual(invokeFailure?.serialization_warnings, [{
      code: "circular_reference_replaced",
      path: "$.error.self",
    }]);
  });

  it("does not change the API result when interaction logging fails", async () => {
    const runtime = {
      web: {
        search: async () => ({ results: [{ title: "Result", url: "https://example.com", snippet: "Useful", site: "example.com" }] }),
        fetch: async () => ({ pages: [] }),
        image_search: async () => ({ results: [] }),
      },
    } as unknown as AnnaRuntime;
    const originalWarn = console.warn;
    console.warn = () => undefined;
    try {
      const client = createResearchWebClient(runtime, {
        appendWorkspaceLog: async () => { throw new Error("log unavailable"); },
      });
      const result = await client.search(
        { query: "market size" },
        { workspace_dir: "/tmp/workspace", operation_id: "research-operation-3" },
      );
      assert.equal(result.results.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});
