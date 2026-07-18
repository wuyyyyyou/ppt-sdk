import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { messages } from "../../src/i18n/messages.ts";
import { ProgressLine } from "../../src/features/deck-workspace/components/ProgressLine.tsx";
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
        outlineEnabled: true,
        onNavigate: () => undefined,
      }),
    );

    assert.match(html, /title="需求"/);
    assert.match(html, /title="演示需求"/);
    assert.doesNotMatch(html, /title="上传资料分析"/);
    assert.match(html, /title="大纲"/);
    assert.match(html, /title="生成中"/);
    assert.match(html, /title="成稿"/);
    assert.equal((html.match(/progress-node/g) ?? []).length, 5);
  });

  it("disables outline navigation until presentation requirements are confirmed", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressLine, {
        stage: "requirements",
        t: messages.zh,
        outlineEnabled: false,
        onNavigate: () => undefined,
      }),
    );

    assert.match(html, /title="演示需求已修改，请先重新确认演示需求" disabled=""/);
  });
});
