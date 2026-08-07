import assert from "node:assert/strict";
import test from "node:test";
import {
  parseVisualStylePresetColorResponse,
  parseVisualStylePresetResponse,
} from "../../src/ai/visualStylePresetSelectionPrompt";
import { sampleVisualStylePresetsByColor } from "../../src/features/templates/visualStylePresetSampling";
import type { VisualStylePresetSelectionCandidate } from "../../src/ai/types";
import { createAnnaAiClient } from "../../src/ai/annaAiClient";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime";

const candidates: VisualStylePresetSelectionCandidate[] = [
  {
    id: "one",
    version: 1,
    name: "One",
    description: "One",
    theme: "light",
    color: ["blue"],
    user: "Business",
    use_case: "Review",
    industry: "Technology",
    style_guide: "# One",
  },
  {
    id: "two",
    version: 1,
    name: "Two",
    description: "Two",
    theme: "dark",
    color: ["blue"],
    user: "Business",
    use_case: "Review",
    industry: "Technology",
    style_guide: "# Two",
  },
];

test("validates the selected color against the catalog", () => {
  assert.equal(parseVisualStylePresetColorResponse({ color: "blue" }, ["blue", "red"]), "blue");
  assert.throws(() => parseVisualStylePresetColorResponse({ color: "green" }, ["blue"]), /one of/);
  assert.throws(() => parseVisualStylePresetColorResponse({ color: "blue", reason: "x" }, ["blue"]), /exactly/);
});

test("validates the selected preset against the supplied candidates", () => {
  assert.equal(parseVisualStylePresetResponse({ preset_id: "one" }, candidates), "one");
  assert.throws(() => parseVisualStylePresetResponse({ preset_id: "missing" }, candidates), /candidate/);
});

test("returns all matching presets up to ten and samples larger groups", () => {
  const all = sampleVisualStylePresetsByColor([...candidates, ...candidates, ...candidates, ...candidates, ...candidates, ...candidates], "blue", 10, () => 0);
  assert.ok(all.length <= 10);
  assert.ok(all.every((preset) => preset.color.includes("blue")));
  const small = sampleVisualStylePresetsByColor(candidates, "blue", 10);
  assert.equal(small.length, 2);
});

test("retries and cleans fenced JSON for both selection calls", async () => {
  const responses = [
    { content: { type: "text", text: "not json" } },
    { content: { type: "text", text: "```json\n{\"color\":\"blue\"}\n```" } },
    { content: { type: "text", text: "```json\n{\"preset_id\":\"two\"}\n```" } },
  ];
  let index = 0;
  const runtime: AnnaRuntime = {
    tools: { invoke: async () => ({}) },
    llm: { complete: async () => responses[index++] },
    agent: { session: async () => { throw new Error("not used"); } },
  };
  const client = createAnnaAiClient(runtime);
  const requirements = {
    version: 1 as const,
    status: "draft" as const,
    source: { brief: "A technology review" },
    candidates: { audience: [], purpose: [], desired_outcome: [], slide_count: [], output_language: [], visual_tone: [] },
    selections: { audience: null, purpose: null, desired_outcome: null, slide_count: null, output_language: null, visual_tone: null, visual_style_preset: null },
    updated_at: null,
    confirmed_at: null,
  };
  const color = await client.selectVisualStylePresetColor({ brief: "A technology review", requirements, colors: ["blue", "red"] });
  const presetId = await client.selectVisualStylePreset({ brief: "A technology review", requirements, color, candidates });
  assert.equal(color, "blue");
  assert.equal(presetId, "two");
  assert.equal(index, 3);
});
