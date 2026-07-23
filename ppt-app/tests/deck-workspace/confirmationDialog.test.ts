import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ConfirmationDialog } from "../../src/features/deck-workspace/components/ConfirmationDialog.tsx";

describe("ConfirmationDialog", () => {
  it("renders an app-owned destructive confirmation with explicit actions", () => {
    const html = renderToStaticMarkup(createElement(ConfirmationDialog, {
      request: {
        title: "停止生成？",
        body: "本次生成内容不会保留。",
        confirmLabel: "停止并放弃",
        cancelLabel: "继续生成",
        closeLabel: "关闭",
        tone: "danger" as const,
      },
      onResolve: () => undefined,
    }));

    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /app-confirmation-card danger/);
    assert.match(html, />继续生成</);
    assert.match(html, />停止并放弃</);
  });

  it("supports acknowledgement-only notices", () => {
    const html = renderToStaticMarkup(createElement(ConfirmationDialog, {
      request: {
        title: "提交失败",
        body: "已恢复生成前版本。",
        confirmLabel: "知道了",
        closeLabel: "关闭",
        tone: "warning" as const,
      },
      onResolve: () => undefined,
    }));

    assert.match(html, />知道了</);
    assert.doesNotMatch(html, /secondary-btn/);
  });
});
