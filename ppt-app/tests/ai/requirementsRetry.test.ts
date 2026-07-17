import assert from "node:assert/strict";
import test from "node:test";
import { createAnnaAiClient } from "../../src/ai/annaAiClient";
import type { AnnaLlmCompleteInput, AnnaRuntime } from "../../src/runtime/annaRuntime";

test("requirements retry sends the original context, invalid response, and complete repair prompt", async () => {
  const requests: AnnaLlmCompleteInput[] = [];
  const responses = [
    { content: { type: "text", text: '{"slide_count":["auto"]}' } },
    { content: { type: "text", text: JSON.stringify({
      audience: [{ label: "Leaders", description: "Senior decision-makers." }],
      purpose: [{ label: "Review", description: "Review a proposal." }],
      desired_outcome: [{ label: "Approve", description: "Approve the next step." }],
      slide_count: [5],
      output_language: ["English"],
      visual_tone: [{ label: "Editorial", description: "A strong editorial reading experience." }],
    }) } },
  ];
  const runtime: AnnaRuntime = {
    tools: { invoke: async () => ({}) },
    llm: {
      complete: async (input) => {
        requests.push(input);
        return responses[requests.length - 1];
      },
    },
    agent: { session: async () => { throw new Error("not used"); } },
  };

  const result = await createAnnaAiClient(runtime).generatePresentationRequirements({ brief: "Five slides in English." });
  assert.equal(result.slide_count[0], 5);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].messages.slice(0, 2), requests[0].messages);
  assert.equal(requests[1].messages[2].role, "assistant");
  assert.match(requests[1].messages[3].content.text, /all six fields/);
  assert.match(requests[1].messages[3].content.text, /missing audience/);
});
