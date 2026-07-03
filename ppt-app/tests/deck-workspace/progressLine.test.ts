import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { messages } from "../../src/i18n/messages.ts";
import { ProgressLine } from "../../src/features/deck-workspace/components/ProgressLine.tsx";
import { stageOrder } from "../../src/features/deck-workspace/utils.ts";

describe("ProgressLine", () => {
  it("orders uploaded source analysis between brief and outline", () => {
    assert.equal(stageOrder("brief"), 1);
    assert.equal(stageOrder("uploaded-source-analysis"), 2);
    assert.equal(stageOrder("outline"), 3);
    assert.equal(stageOrder("generating"), 4);
    assert.equal(stageOrder("deck"), 5);
  });

  it("renders the five navigable main stages", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressLine, {
        stage: "uploaded-source-analysis",
        t: messages.zh,
        onNavigate: () => undefined,
      }),
    );

    assert.match(html, /title="需求"/);
    assert.match(html, /title="上传资料分析"/);
    assert.match(html, /title="大纲"/);
    assert.match(html, /title="生成中"/);
    assert.match(html, /title="成稿"/);
    assert.equal((html.match(/progress-node/g) ?? []).length, 5);
  });
});
