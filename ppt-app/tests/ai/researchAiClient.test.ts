import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createResearchAiClient } from "../../src/ai/researchAiClient.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

describe("Research AI Client", () => {
  it("accepts fenced JSON, removes duplicate queries, and caps queries at six", async () => {
    const prompts: string[] = [];
    const runtime = {
      llm: {
        complete: async (input: { messages: Array<{ content: { text: string } }> }) => {
          prompts.push(input.messages.at(-1)?.content.text ?? "");
          return {
            text: "```json\n{\"needs_search\":true,\"queries\":[\"modern office\",\"MODERN OFFICE\",\"team portrait\",\"city skyline\",\"product photo\",\"factory floor\",\"customer service\",\"extra query\"]}\n```",
          };
        },
      },
    } as unknown as AnnaRuntime;
    const client = createResearchAiClient(runtime);
    const decision = await client.decideImageResearch({
      brief: "A visual company introduction",
      outline: { version: 3, title: "Demo", output_language: "English", status: "confirmed", items: [], source: { prompt: "", context: [], setting: {} }, updated_at: "now", confirmed_at: "now" },
      styleGuide: "Use editorial photography.",
      webSummary: "# Web Research Summary",
      imageCatalog: { schema_version: 2, assets: [{ asset_id: "asset-1", file_path: "/tmp/asset.png" }] },
      locale: "en",
    });

    assert.equal(decision.needs_search, true);
    assert.equal(decision.queries.length, 6);
    assert.deepEqual(decision.queries.slice(0, 2), ["modern office", "team portrait"]);
    assert.match(prompts[0] ?? "", /Every query must be English/);
    assert.match(prompts[0] ?? "", /preferably 1-4 words/);
  });

  it("only includes the reusable image catalog in image research decisions", async () => {
    const prompts: string[] = [];
    const runtime = {
      llm: {
        complete: async ({ messages }: { messages: Array<{ content: { text: string } }> }) => {
          prompts.push(messages[0]?.content.text ?? "");
          return { text: '{"needs_search":false,"queries":[]}' };
        },
      },
    } as never;
    const client = createResearchAiClient(runtime);
    const context = {
      brief: "Brief",
      outline: { title: "Deck", items: [] },
      styleGuide: "Style",
      webSummary: "Summary",
      imageCatalog: { schema_version: 2, assets: [{ asset_id: "asset-1", file_path: "/tmp/asset.png" }] },
      locale: "en" as const,
    };

    await client.decideWebResearch(context);
    await client.decideImageResearch(context);

    assert.equal(prompts[0]?.includes("image-catalog.json"), false);
    assert.equal(prompts[1]?.includes('"asset_id": "asset-1"'), true);
  });
});
