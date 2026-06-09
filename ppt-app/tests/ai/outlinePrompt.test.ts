import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAnnaAiClient } from "../../src/ai/annaAiClient.ts";
import {
  buildGenerateOutlineLlmRequest,
  buildReviseOutlineLlmRequest,
  getExpectedSlideCount,
  getExpectedSlideCountForRevision,
} from "../../src/ai/outlinePrompt.ts";
import { validateGeneratedOutline } from "../../src/ai/outlineParser.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

function createRuntimeWithLlmResponse(response: unknown): AnnaRuntime {
  return {
    tools: {
      invoke: async () => ({}),
    },
    llm: {
      complete: async () => response,
    },
    agent: {
      session: async () => {
        throw new Error("agent session is not used in this test");
      },
    },
  };
}

describe("outline prompt slide count handling", () => {
  it("does not create a hard expected slide count from brief or context rows", () => {
    assert.equal(
      getExpectedSlideCount(undefined, "Please make 9 slides", []),
      null,
    );
    assert.equal(
      getExpectedSlideCount(undefined, "Please make 9 slides", [
        { id: "slides", value: "12" },
      ]),
      null,
    );
  });

  it("does not create a hard expected slide count from outline revision feedback or context rows", () => {
    assert.equal(
      getExpectedSlideCountForRevision(undefined, "改成 5 页", []),
      null,
    );
    assert.equal(
      getExpectedSlideCountForRevision(undefined, "改成 5 页", [
        { id: "slides", value: "8" },
      ]),
      null,
    );
  });

  it("leaves brief slide count decisions to the model when slides context is auto", () => {
    const request = buildGenerateOutlineLlmRequest({
      prompt: "做一份 AI Agent 工作流介绍，5 页",
      contextRows: [{ id: "slides", value: "auto" }],
      locale: "zh",
      setting: { output_language: "Chinese" },
    });
    const userPrompt = request.messages[1]?.content.text ?? "";

    assert.match(userPrompt, /必须完全按照用户简报里的页数意图来/);
    assert.doesNotMatch(userPrompt, /items 中必须严格返回 5 页/);
  });

  it("passes explicit slides context as a lower-priority prompt signal", () => {
    const request = buildGenerateOutlineLlmRequest({
      prompt: "做一份 AI Agent 工作流介绍",
      contextRows: [{ id: "slides", value: "25" }],
      locale: "zh",
      setting: { output_language: "Chinese" },
    });
    const userPrompt = request.messages[1]?.content.text ?? "";

    assert.match(userPrompt, /contextRows\.slides = 25/);
    assert.match(userPrompt, /只有当用户简报没有表达页数相关要求时，才参考 contextRows\.slides/);
    assert.doesNotMatch(userPrompt, /items 中必须严格返回 25 页/);
  });

  it("does not parse revision feedback into an exact slide count", () => {
    const request = buildReviseOutlineLlmRequest({
      title: "Demo",
      outline: [{ title: "Intro", outline: "Set context" }],
      feedback: "改成 5 页",
      contextRows: [],
      locale: "zh",
      setting: { output_language: "Chinese" },
    });
    const userPrompt = request.messages[1]?.content.text ?? "";

    assert.doesNotMatch(userPrompt, /items 中必须严格返回 5 页/);
    assert.match(userPrompt, /必须完全按照最高优先级修改反馈里的页数意图来/);
  });

  it("does not reject outlines that differ from a provided expected slide count", () => {
    const outline = validateGeneratedOutline(
      {
        title: "One Page",
        output_language: "English",
        items: [{ title: "Only", outline: "A focused one-page outline." }],
      },
      12,
    );

    assert.equal(outline.items.length, 1);
  });

  it("requires generated outlines to include output_language", () => {
    assert.throws(
      () =>
        validateGeneratedOutline(
          {
            title: "Missing Language",
            items: [{ title: "Only", outline: "A focused one-page outline." }],
          },
          null,
        ),
      /output_language/,
    );
  });

  it("asks the model to infer output language when setting is auto", () => {
    const request = buildGenerateOutlineLlmRequest({
      prompt: "帮我做一份发布会复盘",
      contextRows: [],
      locale: "en",
      setting: { output_language: "auto" },
    });
    const userPrompt = request.messages[1]?.content.text ?? "";

    assert.match(userPrompt, /output_language/);
    assert.match(userPrompt, /auto/);
    assert.doesNotMatch(userPrompt, /Locale: en[\s\S]*content language must be English/);
  });
});

describe("context suggestion slide count handling", () => {
  it("normalizes valid suggested slide count", async () => {
    const aiClient = createAnnaAiClient(
      createRuntimeWithLlmResponse({
        content: {
          type: "text",
          text: JSON.stringify({
            audience: ["Execs"],
            goal: ["Explain roadmap"],
            style: ["Concise"],
            theme: ["digital-indigo"],
            slides: "24",
          }),
        },
      }),
    );

    const result = await aiClient.suggestContext({
      prompt: "Create a detailed roadmap deck",
      locale: "en",
    });

    assert.equal(result.slides, "24");
  });

  it("normalizes invalid suggested slide count to auto", async () => {
    const aiClient = createAnnaAiClient(
      createRuntimeWithLlmResponse({
        content: {
          type: "text",
          text: JSON.stringify({
            audience: ["Execs"],
            goal: ["Explain roadmap"],
            style: ["Concise"],
            theme: ["digital-indigo"],
            slides: "many",
          }),
        },
      }),
    );

    const result = await aiClient.suggestContext({
      prompt: "Create a detailed roadmap deck",
      locale: "en",
    });

    assert.equal(result.slides, "auto");
  });
});
