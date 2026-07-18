import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BriefPage } from "../../src/features/deck-workspace/components/BriefPage.tsx";
import type { LoadingKind } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

function renderBriefPage(options: { loading?: LoadingKind; workspaceSettingsSaving?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(BriefPage, {
      t: messages.zh,
      prompt: "生成一份介绍 AI 的 PPT",
      setPrompt: () => undefined,
      loading: options.loading ?? "none",
      pageReviewSettings: {
        visualReviewEnabled: false,
        visualReviewFailureLimit: 2,
      },
      setStrictReviewMode: async () => undefined,
      workspaceSettingsSaving: options.workspaceSettingsSaving ?? false,
      generateDeck: async () => undefined,
    }),
  );
}

function assertDisabledButtonWithLabel(html: string, label: string) {
  assert.match(
    html,
    new RegExp(`<button(?=[^>]*disabled="")[^>]*>[\\s\\S]*?${label}[\\s\\S]*?</button>`),
  );
}

describe("BriefPage", () => {
  it("keeps the original styled composer structure", () => {
    const html = renderBriefPage();

    assert.match(html, /class="page active brief-page"/);
    assert.match(html, /class="prompt-label"/);
    assert.match(html, /class="prompt-input-wrapper"/);
    assert.match(html, /class="prompt-input"/);
    assert.match(html, /class="prompt-inline-actions"/);
    assert.match(html, /class="inline-create-btn"/);
    assert.match(html, /class="brief-toggle-columns"/);
    assert.match(html, /class="checkbox-row /);
    assert.match(html, /class="help-tooltip"/);
  });

  it("shows the create button loading state while requirements are being generated", () => {
    const html = renderBriefPage({ loading: "requirements" });

    assert.match(html, /inline-create-btn/);
    assert.match(html, /spinner small/);
  });

  it("keeps sealed feature entry points hidden", () => {
    const html = renderBriefPage();

    assert.doesNotMatch(html, />附件</);
    assert.doesNotMatch(html, /上传资料/);
    assert.doesNotMatch(html, /模板选择/);
    assert.doesNotMatch(html, /风格画像/);
    assert.doesNotMatch(html, /禁止网络资料搜索/);
    assert.doesNotMatch(html, /禁止图片搜索/);
    assert.doesNotMatch(html, /补全上下文/);
    assert.match(html, /生成演示文稿/);
  });

  it("disables create and visual review controls while workspace settings are saving", () => {
    const html = renderBriefPage({ workspaceSettingsSaving: true });

    assert.match(html, /<button class="inline-create-btn" disabled="">/);
    assertDisabledButtonWithLabel(html, "视觉检查");
  });
});
