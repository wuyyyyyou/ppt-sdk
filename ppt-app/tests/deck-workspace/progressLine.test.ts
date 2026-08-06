import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { messages } from "../../src/i18n/messages.ts";
import {
  adjacentEnabledStage,
  ProgressLine,
} from "../../src/features/deck-workspace/components/ProgressLine.tsx";
import { stageOrder } from "../../src/features/deck-workspace/utils.ts";

describe("ProgressLine", () => {
  it("orders requirements before uploaded source analysis and outline", () => {
    assert.equal(stageOrder("brief"), 1);
    assert.equal(stageOrder("requirements"), 2);
    assert.equal(stageOrder("uploaded-source-analysis"), 3);
    assert.equal(stageOrder("outline"), 4);
    assert.equal(stageOrder("generating"), 5);
    assert.equal(stageOrder("deck"), 6);
  });

  it("renders only the five active main stages", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressLine, {
        stage: "outline",
        t: messages.zh,
        requirementsEnabled: true,
        outlineEnabled: true,
        generatingEnabled: false,
        deckEnabled: false,
        onNavigate: () => undefined,
      }),
    );

    assert.match(html, />创建</);
    assert.match(html, />需求</);
    assert.doesNotMatch(html, /title="上传资料分析"/);
    assert.match(html, />大纲</);
    assert.match(html, />生成</);
    assert.match(html, />结果</);
    assert.equal((html.match(/class="progress-node /g) ?? []).length, 5);
  });

  it("disables inaccessible stages without exposing a disabled reason", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressLine, {
        stage: "requirements",
        t: messages.zh,
        requirementsEnabled: true,
        outlineEnabled: false,
        generatingEnabled: false,
        deckEnabled: false,
        onNavigate: () => undefined,
      }),
    );

    assert.equal((html.match(/disabled=""/g) ?? []).length, 3);
    assert.doesNotMatch(html, /演示需求已修改，请先重新确认演示需求/);
    assert.match(html, /title="大纲" disabled=""/);
  });

  it("moves only to the nearest existing stage and skips unavailable stages", () => {
    const enabled = {
      brief: true,
      requirements: true,
      outline: false,
      generating: true,
      deck: true,
    };

    assert.equal(adjacentEnabledStage("requirements", enabled, 1), "generating");
    assert.equal(adjacentEnabledStage("generating", enabled, -1), "requirements");
    assert.equal(adjacentEnabledStage("brief", enabled, -1), null);
    assert.equal(adjacentEnabledStage("deck", enabled, 1), null);
  });
});
