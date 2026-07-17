import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  OutlinePage,
  requiredContentDisplayItems,
} from "../../src/features/deck-workspace/components/OutlinePage.tsx";
import { normalizeRequiredContentMarkdown } from "../../src/features/outline/model.ts";
import { messages } from "../../src/i18n/messages.ts";

function renderOutlinePage(dirty: boolean) {
  return renderToStaticMarkup(createElement(OutlinePage, {
    t: messages.zh,
    title: "演示文稿标题",
    outline: [{
      title: "第一页",
      core_message: "核心信息",
      required_content: "- 必要内容",
    }],
    dirty,
    error: "",
    loading: "none",
    setTitle: () => undefined,
    updateItem: () => undefined,
    addItem: () => undefined,
    insertItem: () => undefined,
    deleteItem: () => undefined,
    moveItem: () => undefined,
    save: async () => undefined,
    retry: async () => undefined,
    backToRequirements: () => undefined,
    feedback: "",
    setFeedback: () => undefined,
    applyFeedback: async () => undefined,
    confirm: async () => undefined,
  }));
}

describe("OutlinePage", () => {
  it("shows the return-to-requirements action in the footer for an existing outline", () => {
    const html = renderOutlinePage(false);
    const footer = html.match(/<div class="outline-card-footer">([\s\S]*?)<\/div><\/section>/)?.[1] ?? "";

    assert.match(footer, /返回演示需求/);
    assert.ok(footer.indexOf("返回演示需求") < footer.indexOf("大纲草稿已保存"));
  });

  it("renders the save state in the footer before the save and confirm actions", () => {
    const html = renderOutlinePage(false);
    const footer = html.match(/<div class="outline-card-footer">([\s\S]*?)<\/div><\/section>/)?.[1] ?? "";

    assert.match(footer, /大纲草稿已保存/);
    assert.ok(footer.indexOf("大纲草稿已保存") < footer.indexOf("保存修改"));
    assert.ok(footer.indexOf("保存修改") < footer.indexOf("确认并生成"));
  });

  it("uses a compact read mode with global required-content controls", () => {
    const html = renderOutlinePage(false);

    assert.match(html, /全部展开/);
    assert.match(html, /全部收起/);
    assert.match(html, /outline-page-title-read/);
    assert.match(html, /outline-core-message-read/);
    assert.match(html, /outline-page-rail/);
    assert.match(html, /outline-card-floating-actions/);
    assert.doesNotMatch(html, /outline-item-head/);
    assert.doesNotMatch(html, /outline-markdown-preview/);
    assert.equal(html.match(/outline-action-button/g)?.length, 3);
    assert.match(html, /class="outline-add-page"/);
  });

  it("parses supported Markdown markers into display bullets", () => {
    assert.deepEqual(
      requiredContentDisplayItems("- 第一项\n  * 嵌套项\n1. 第三项\n• 第四项"),
      [
        { content: "第一项", depth: 0 },
        { content: "嵌套项", depth: 1 },
        { content: "第三项", depth: 0 },
        { content: "第四项", depth: 0 },
      ],
    );
  });

  it("accepts plain lines and normalizes them into Markdown bullets", () => {
    assert.equal(
      normalizeRequiredContentMarkdown("- 已有项目\n普通文本\n  嵌套文本"),
      "- 已有项目\n- 普通文本\n  - 嵌套文本",
    );
  });
});
