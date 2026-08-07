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

function renderOutlinePage(dirty: boolean, saving = false, loading: "none" | "deck" = "none") {
  return renderToStaticMarkup(createElement(OutlinePage, {
    t: messages.zh,
    title: "演示文稿标题",
    outline: [{
      title: "第一页",
      core_message: "核心信息",
      required_content: "- 必要内容",
    }],
    dirty,
    saving,
    error: "",
    loading,
    setTitle: () => undefined,
    updateItem: () => undefined,
    addItem: () => undefined,
    insertItem: () => undefined,
    deleteItem: () => undefined,
    moveItem: () => undefined,
    save: async () => undefined,
    retry: async () => undefined,
    backToRequirements: () => undefined,
    forward: () => undefined,
    feedback: "",
    setFeedback: () => undefined,
    applyFeedback: async () => undefined,
    confirm: async () => undefined,
  }));
}

describe("OutlinePage", () => {
  it("shows the return-to-requirements action in the footer for an existing outline", () => {
    const html = renderOutlinePage(false);
    const footer = html.slice(html.indexOf('<div class="outline-card-footer">'));

    assert.match(footer, />返回</);
    assert.ok(footer.indexOf("返回") < footer.indexOf("草稿已保存"));
    assert.match(footer, /data-performance-id="outline.forward"/);
    assert.ok(footer.indexOf("前进") < footer.indexOf("保存</button>"));
  });

  it("renders the save state in the footer before the save and confirm actions", () => {
    const html = renderOutlinePage(false);
    const footer = html.slice(html.indexOf('<div class="outline-card-footer">'));

    assert.match(footer, /草稿已保存/);
    assert.ok(footer.indexOf("草稿已保存") < footer.indexOf("保存</button>"));
    assert.ok(footer.indexOf("保存</button>") < footer.indexOf("确认并生成"));
  });

  it("uses a compact read mode with global required-content controls", () => {
    const html = renderOutlinePage(false);

    assert.match(html, /全部展开/);
    assert.match(html, /全部收起/);
    assert.match(html, /outline-page-title-read/);
    assert.match(html, /outline-core-message-read/);
    assert.match(html, /outline-page-rail/);
    assert.match(html, /outline-card-floating-actions/);
    assert.doesNotMatch(html, /data-performance-id="outline.required-content.edit"/);
    assert.doesNotMatch(html, /点击编辑 Markdown/);
    assert.match(html, /outline-required-header/);
    assert.doesNotMatch(html, /outline-item-head/);
    assert.doesNotMatch(html, /outline-markdown-preview/);
    assert.doesNotMatch(html, /outline-action-button/);
    assert.match(html, /class="outline-add-page"/);
  });

  it("places the generated outline before the rewrite dialog", () => {
    const html = renderOutlinePage(false);

    assert.ok(html.indexOf("outline-review-card") < html.indexOf("outline-review-controls"));
    assert.ok(html.indexOf("告诉Anna你想如何调整大纲") < html.indexOf("feedback-box"));
    assert.ok(html.indexOf("outline-review-controls") < html.indexOf("outline-card-footer"));
  });

  it("shows the draft-saving state while saving", () => {
    const html = renderOutlinePage(true, true);

    assert.match(html, /正在保存草稿\.\.\./);
    assert.doesNotMatch(html, /有未保存的修改/);
  });

  it("shows immediate feedback while confirming the Outline", () => {
    const html = renderOutlinePage(false, false, "deck");

    assert.match(html, /spinner small/);
    assert.match(html, /确认并生成/);
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
