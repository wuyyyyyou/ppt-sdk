import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createResearchWebClient } from "../../src/api/researchWebClient.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

describe("Research Web Client", () => {
  it("uses the official host Web API with the confirmed limits", async () => {
    const calls: Array<{ method: string; input: unknown; options?: unknown }> = [];
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
        image_fetch: async (input: unknown, options?: unknown) => {
          calls.push({ method: "image_fetch", input, options });
          return {
            path: "research/image.jpg",
            get_url: "https://download.example/image.jpg",
            mime_type: "image/jpeg",
            bytes_size: 10,
            sha256: "abc",
            source_url: "https://example.com/image.jpg",
            final_url: "https://example.com/image.jpg",
          };
        },
      },
    } as unknown as AnnaRuntime;
    const client = createResearchWebClient(runtime);

    await client.search({ query: "market size", max_results: 6 });
    await client.fetch({ urls: ["https://example.com"] });
    await client.imageSearch({ query: "modern office" });
    await client.imageFetch({ url: "https://example.com/image.jpg" });

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
    assert.deepEqual(calls[3], {
      method: "image_fetch",
      input: { url: "https://example.com/image.jpg", max_bytes: 20 * 1024 * 1024, purpose: "ppt-research" },
      options: { timeoutMs: 90000 },
    });
  });
});
