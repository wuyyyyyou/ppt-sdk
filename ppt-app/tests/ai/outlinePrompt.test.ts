import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGenerateOutlineLlmRequest, buildReviseOutlineLlmRequest } from "../../src/ai/outlinePrompt.ts";
import { validateGeneratedOutline } from "../../src/ai/outlineParser.ts";
import type { PresentationRequirements } from "../../src/api/types.ts";

function confirmedRequirements(): PresentationRequirements {
  const semantic = (label: string, description: string) => ({ label, description });
  return {
    version: 1,
    status: "confirmed",
    source: { brief: "为投资人制作一份 8 页的 AI 客服方案。" },
    candidates: {
      audience: [semantic("投资人", "关注市场机会与回报的投资人。")],
      purpose: [semantic("融资沟通", "说明方案价值与增长路径。")],
      desired_outcome: [semantic("进入尽调", "推动投资人进入下一轮尽调。")],
      slide_count: [8],
      output_language: ["中文"],
      visual_tone: [semantic("编辑式", "专业、清晰、有观点。")],
    },
    selections: {
      audience: semantic("投资人", "关注市场机会与回报的投资人。"),
      purpose: semantic("融资沟通", "说明方案价值与增长路径。"),
      desired_outcome: semantic("进入尽调", "推动投资人进入下一轮尽调。"),
      slide_count: 8,
      output_language: "中文",
      visual_tone: semantic("其他", "体育杂志式的强标题与高能节奏。"),
    },
    updated_at: "2026-07-17T00:00:00.000Z",
    confirmed_at: "2026-07-17T00:00:00.000Z",
  };
}

describe("outline prompts", () => {
  it("consumes confirmed requirements without legacy context rows or workspace settings", () => {
    const request = buildGenerateOutlineLlmRequest({ requirements: confirmedRequirements() });
    const prompt = request.messages[1]?.content.text ?? "";
    assert.match(prompt, /Confirmed Presentation Requirements input/);
    assert.match(prompt, /投资人/);
    assert.match(prompt, /体育杂志式的强标题/);
    assert.doesNotMatch(prompt, /contextRows/);
    assert.doesNotMatch(prompt, /workspace setting/i);
    assert.doesNotMatch(prompt, /\"label\":\"其他\"/);
  });

  it("passes current unsaved outline content into rewrite requests", () => {
    const request = buildReviseOutlineLlmRequest({
      title: "Demo",
      outline: [{ title: "Intro", core_message: "Set context", required_content: "- Explain the context" }],
      feedback: "增加一页并重排顺序",
      requirements: confirmedRequirements(),
    });
    const prompt = request.messages[1]?.content.text ?? "";
    assert.match(prompt, /增加一页并重排顺序/);
    assert.match(prompt, /core_message/);
    assert.match(prompt, /required_content/);
  });
});

describe("outline validation", () => {
  it("converts structured required_content arrays to canonical Markdown", () => {
    const outline = validateGeneratedOutline({
      title: "Valid outline",
      items: [{
        title: "Opening",
        core_message: "One idea to remember.",
        required_content: ["First requirement", "Second requirement"],
      }],
    });
    assert.equal(outline.items[0]?.required_content, "- First requirement\n- Second requirement");
  });

  it("rejects incomplete or unexpected AI output", () => {
    assert.throws(
      () => validateGeneratedOutline({
        title: "Invalid",
        items: [{ title: "Only", core_message: "", required_content: "- Wrong protocol" }],
      }),
      /core_message|required_content/,
    );
  });
});
