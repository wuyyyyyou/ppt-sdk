import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSearchAdapter } from "../../src/api/searchAdapter.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

function createRuntime(handler: (input: { method: string; args: Record<string, unknown> }) => unknown): AnnaRuntime {
  return {
    tools: {
      invoke: async (input, options) => handler({
        method: input.method,
        args: input.args as Record<string, unknown>,
        timeoutMs: input.timeoutMs,
        optionTimeoutMs: options?.timeoutMs,
      } as never),
    },
    llm: { complete: async () => ({}) },
    agent: { session: async () => { throw new Error("not used"); } },
  };
}

describe("Search Adapter", () => {
  it("normalizes web search results and does not pass region by default", async () => {
    let receivedArgs: Record<string, unknown> = {};
    const adapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime(({ args }) => {
        receivedArgs = args;
        return {
          success: true,
          data: {
            query: "Anna Executa",
            provider: "ddgs",
            results: [
              { title: "Docs", url: "https://example.com", snippet: "Ref", source: "example.com" },
            ],
            count: 1,
          },
        };
      }),
    });

    const result = await adapter.webSearch({
      query: "Anna Executa",
      max_results: 5,
      safesearch: "moderate",
      timelimit: "m",
    });

    assert.equal(receivedArgs.region, undefined);
    assert.equal(receivedArgs.timelimit, "m");
    assert.equal(result.count, 1);
    assert.equal(result.results[0].url, "https://example.com");
  });

  it("uses a 600 second timeout for local search tools", async () => {
    let timeoutMs: unknown = null;
    let optionTimeoutMs: unknown = null;
    const adapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime((input) => {
        timeoutMs = (input as { timeoutMs?: unknown }).timeoutMs;
        optionTimeoutMs = (input as { optionTimeoutMs?: unknown }).optionTimeoutMs;
        return { success: true, data: { query: "slow", provider: "ddgs", results: [], count: 0 } };
      }),
    });

    await adapter.webSearch({ query: "slow" });

    assert.equal(timeoutMs, 600_000);
    assert.equal(optionTimeoutMs, 600_000);
  });

  it("normalizes no-result and malformed web search responses", async () => {
    const emptyAdapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime(() => ({ success: true, data: { query: "missing", provider: "ddgs", results: [], count: 0 } })),
    });
    assert.deepEqual((await emptyAdapter.webSearch({ query: "missing" })).results, []);

    const malformedAdapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime(() => ({ success: true, data: { results: [{ title: "No URL" }] } })),
    });
    const malformed = await malformedAdapter.webSearch({ query: "fallback" });
    assert.equal(malformed.query, "fallback");
    assert.deepEqual(malformed.results, []);
  });

  it("keeps per-item web fetch failures as normalized result records", async () => {
    const adapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime(() => ({
        success: true,
        data: {
          output_dir: "/tmp/raw/web",
          index_path: "/tmp/raw/web/index.json",
          format: "text_markdown",
          max_chars: 12000,
          results: [
            { url: "https://ok.example", file_path: "/tmp/raw/web/ok.md" },
            { url: "https://bad.example", error: "timeout" },
          ],
          count: 2,
        },
      })),
    });

    const result = await adapter.webFetch({
      urls: ["https://ok.example", "https://bad.example"],
      output_dir: "/tmp/raw/web",
      format: "text_markdown",
      max_chars: 12000,
    });

    assert.equal(result.index_path, "/tmp/raw/web/index.json");
    assert.equal(result.results[1].error, "timeout");
  });

  it("normalizes image search and image fetch responses", async () => {
    const adapter = createSearchAdapter({
      toolId: "tool-anna-search-local",
      runtime: createRuntime(({ method }) => {
        if (method === "image_search") {
          return {
            success: true,
            data: {
              query: "product photo",
              provider: "ddgs",
              results: [
                { title: "Photo", image_url: "https://img.example/a.jpg", width: 800, height: 450 },
                { title: "Broken" },
              ],
              count: 2,
            },
          };
        }
        return {
          success: true,
          data: {
            output_dir: "/tmp/raw/images",
            index_path: "/tmp/raw/images/index.json",
            max_bytes: 1000,
            results: [
              { url: "https://img.example/a.jpg", file_path: "/tmp/raw/images/a.jpg" },
              { url: "https://img.example/b.jpg", error: "unsupported content type" },
            ],
            count: 2,
          },
        };
      }),
    });

    const search = await adapter.imageSearch({ query: "product photo", max_results: 3 });
    assert.equal(search.results.length, 1);
    assert.equal(search.results[0].image_url, "https://img.example/a.jpg");

    const fetch = await adapter.imageFetch({ urls: ["https://img.example/a.jpg"], output_dir: "/tmp/raw/images" });
    assert.equal(fetch.index_path, "/tmp/raw/images/index.json");
    assert.equal(fetch.results[1].error, "unsupported content type");
  });
});
