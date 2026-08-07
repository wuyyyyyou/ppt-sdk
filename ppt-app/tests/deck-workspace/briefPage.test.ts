import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { VisualStylePreset } from "../../src/api/types.ts";
import { BriefPage } from "../../src/features/deck-workspace/components/BriefPage.tsx";
import type { LoadingKind } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

const presets: VisualStylePreset[] = [
  {
    id: "aurora-consulting",
    version: 1,
    score: 90,
    name: "Aurora Consulting",
    description: "克制的咨询风格版式。",
    user: "顾问",
    use_case: "汇报",
    industry: "咨询",
    theme: "浅色",
    color: "蓝",
    style_guide: "# Aurora",
    preview_images: [{ url: "/previews/aurora-1.png", alt: "Aurora cover" }],
  },
  {
    id: "midnight-product",
    version: 1,
    score: 80,
    name: "Midnight Product",
    description: "适合产品发布的深色风格。",
    user: "产品经理",
    use_case: "发布会",
    industry: "科技",
    theme: "深色",
    color: "紫",
    style_guide: "# Midnight",
    preview_images: [{ url: "/previews/midnight-1.png", alt: "Midnight cover" }],
  },
];

function renderBriefPage(options: {
  loading?: LoadingKind;
  workspaceSettingsSaving?: boolean;
  selectedVisualStylePresetId?: string | null;
} = {}) {
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
      researchSearchControlSettings: {
        disableWebResearch: false,
        disableImageResearch: false,
      },
      setResearchSearchControlSettings: async () => undefined,
      workspaceSettingsSaving: options.workspaceSettingsSaving ?? false,
      generateDeck: async () => undefined,
      visualStylePresets: presets,
      selectedVisualStylePresetId: options.selectedVisualStylePresetId ?? null,
      onSelectVisualStylePreset: () => undefined,
      onForward: () => undefined,
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
  it("offers stage browsing separately from presentation generation", () => {
    const html = renderBriefPage();

    assert.match(html, /data-performance-id="brief.forward"/);
    assert.match(html, />前进</);
    assert.match(html, /data-performance-id="brief.create-deck"/);
  });

  it("keeps the original styled composer structure", () => {
    const html = renderBriefPage();

    assert.match(html, /class="page active brief-page"/);
    assert.match(html, /class="prompt-label"/);
    assert.match(html, /class="prompt-input-wrapper"/);
    assert.match(html, /class="prompt-input"/);
    assert.match(html, /class="prompt-inline-actions"/);
    assert.match(html, /class="inline-create-btn"/);
    assert.match(html, /class="help-tooltip"/);
    assert.ok(html.indexOf('<textarea class="prompt-input"') < html.indexOf('class="prompt-inline-actions"'));
  });

  it("keeps the visual check switch inside the composer action row", () => {
    const html = renderBriefPage();

    const actionRow = /class="prompt-inline-actions">([\s\S]*?)<section class="brief-style-presets"/
      .exec(html)?.[1] ?? "";
    assert.match(actionRow, /class="prompt-inline-options"/);
    assert.match(actionRow, /role="switch"/);
    assert.match(actionRow, /视觉检查/);
    assert.match(actionRow, /inline-create-btn/);
    assert.doesNotMatch(html, /brief-toggle-columns/);
  });

  it("shows the create button loading state while requirements are being generated", () => {
    const html = renderBriefPage({ loading: "requirements" });

    assert.match(html, /inline-create-btn/);
    assert.match(html, /spinner small/);
  });

  it("shows research search controls while keeping sealed feature entry points hidden", () => {
    const html = renderBriefPage();

    assert.doesNotMatch(html, />附件</);
    assert.doesNotMatch(html, /上传资料/);
    assert.doesNotMatch(html, /模板选择/);
    assert.doesNotMatch(html, /风格画像/);
    assert.match(html, /禁止网络资料搜索/);
    assert.match(html, /禁止图片搜索/);
    assert.doesNotMatch(html, /补全上下文/);
    assert.match(html, /生成演示文稿/);
  });

  it("disables create, visual review, and research controls while workspace settings are saving", () => {
    const html = renderBriefPage({ workspaceSettingsSaving: true });

    assertDisabledButtonWithLabel(html, "生成演示文稿");
    assertDisabledButtonWithLabel(html, "视觉检查");
    assertDisabledButtonWithLabel(html, "禁止网络资料搜索");
    assertDisabledButtonWithLabel(html, "禁止图片搜索");
  });

  it("renders preset cards as cover images while keeping an accessible name", () => {
    const html = renderBriefPage();

    assert.match(html, /class="brief-style-preset-accessible-name">Aurora Consulting</);
    assert.match(html, /class="brief-style-preset-accessible-name">Midnight Product</);
    assert.doesNotMatch(html, /克制的咨询风格版式。/);
    assert.doesNotMatch(html, /适合产品发布的深色风格。/);
    assert.match(html, /src="\/previews\/aurora-1\.png"/);
  });

  it("keeps the no-preset card to a title inside the frame", () => {
    const html = renderBriefPage();
    const card = html.slice(
      html.indexOf("brief-style-preset-none-card"),
      html.indexOf("</button>", html.indexOf("brief-style-preset-none-card")),
    );
    const copy = card.slice(card.indexOf("brief-style-preset-none-copy"));

    assert.match(copy, new RegExp(messages.zh.template.none));
    assert.doesNotMatch(copy, /<small>/);
  });

  it("marks the selected preset without hiding the other cards", () => {
    const html = renderBriefPage({ selectedVisualStylePresetId: "midnight-product" });

    assert.match(html, /brief-style-preset-card active/);
    assert.match(html, /class="brief-style-preset-selected"/);
  });

  it("offers an all option for every style filter", () => {
    const html = renderBriefPage();

    const filterBlock = /class="brief-style-preset-filters"[\s\S]*?class="brief-style-preset-grid"/
      .exec(html)?.[0] ?? "";
    const allOptions = filterBlock.match(/<option value=""[^>]*>全部<\/option>/g) ?? [];
    assert.equal(allOptions.length, 5);
    assert.match(filterBlock, /<option value="咨询">咨询<\/option>/);
  });

  it("opens a preview from the whole card and only applies the style from the dialog", () => {
    const html = renderBriefPage();

    assert.match(html, /data-performance-id="brief.visual-style.preview"[^>]*aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /brief-style-preset-preview-btn/);
    assert.doesNotMatch(html, /data-performance-id="brief.visual-style.select"/);
  });
});
