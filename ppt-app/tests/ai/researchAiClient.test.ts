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
      imageCatalog: { schema_version: 1, batches: [] },
      locale: "en",
    });

    assert.equal(decision.needs_search, true);
    assert.equal(decision.queries.length, 6);
    assert.deepEqual(decision.queries.slice(0, 2), ["modern office", "team portrait"]);
    assert.match(prompts[0] ?? "", /Every query must be English/);
    assert.match(prompts[0] ?? "", /preferably 1-4 words/);
  });
});
