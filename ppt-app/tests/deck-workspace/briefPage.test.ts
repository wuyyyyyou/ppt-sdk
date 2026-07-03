import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { TemplateSummary } from "../../src/api/types.ts";
import {
  BriefPage,
  StyleSelection,
} from "../../src/features/deck-workspace/components/BriefPage.tsx";
import type { ContextRow, LoadingKind } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

function makeTemplate(groupId: string, groupName: string): TemplateSummary {
  return {
    group_id: groupId,
    group_name: groupName,
    group_description: "",
    ordered: true,
    default: false,
    layout_count: 1,
    preview: null,
    previews: [],
  };
}

function renderBriefPage(options: { loading?: LoadingKind; workspaceSettingsSaving?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(BriefPage, {
      t: messages.zh,
      prompt: "",
      setPrompt: () => undefined,
      templates: [
        makeTemplate("red-finance-canvas", "Red Finance Canvas"),
        makeTemplate("red-finance-v3", "Business Professional"),
        makeTemplate("red-blue-comparison-v1", "Red Blue Comparison"),
        makeTemplate("red-blue-comparison-canvas", "Red Blue Comparison Canvas"),
        makeTemplate("chart-analytics-v1", "Dark Analytics Charts"),
        makeTemplate("chart-analytics-canvas", "Dark Analytics Canvas"),
        makeTemplate("legacy-hidden-template", "Legacy Hidden Template"),
      ],
      selectedTemplateGroupId: "red-finance-canvas",
      loading: options.loading ?? "none",
      selectTemplate: async () => undefined,
      reviewOutlineFirst: false,
      setReviewOutlineFirst: () => undefined,
      pageReviewSettings: {
        contentReviewEnabled: false,
        contentReviewFailureLimit: 5,
        visualReviewEnabled: false,
        visualReviewFailureLimit: 5,
      },
      setStrictReviewMode: async () => undefined,
      researchSearchControlSettings: {
        disableWebResearch: false,
        disableImageResearch: false,
      },
      workspaceSettingsSaving: options.workspaceSettingsSaving ?? false,
      setResearchSearchControlSettings: async () => undefined,
      contextRows: [],
      uploadedSources: [],
      addContextRow: (_row: ContextRow) => undefined,
      updateContextRow: () => undefined,
      removeContextRow: () => undefined,
      uploadUploadedSource: async () => undefined,
      removeUploadedSource: async () => undefined,
      addStyleRow: () => undefined,
      suggestContextFromPrompt: async () => undefined,
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

function renderStyleSelection() {
  return renderToStaticMarkup(
    createElement(StyleSelection, {
      t: messages.zh,
      templates: [
        makeTemplate("red-finance-canvas", "Red Finance Canvas"),
        makeTemplate("red-finance-v3", "Business Professional"),
        makeTemplate("red-blue-comparison-v1", "Red Blue Comparison"),
        makeTemplate("red-blue-comparison-canvas", "Red Blue Comparison Canvas"),
        makeTemplate("chart-analytics-v1", "Dark Analytics Charts"),
        makeTemplate("chart-analytics-canvas", "Dark Analytics Canvas"),
        makeTemplate("legacy-hidden-template", "Legacy Hidden Template"),
      ],
      selectedTemplateGroupId: "red-finance-canvas",
      loading: "none",
      selectTemplate: async () => undefined,
    }),
  );
}

describe("BriefPage", () => {
  it("hides the attachment chip in the first stage", () => {
    const html = renderBriefPage();

    assert.doesNotMatch(html, />附件</);
  });

  it("shows only selectable template groups in the first-stage picker", () => {
    const html = renderStyleSelection();

    assert.match(html, /Red Finance Canvas/);
    assert.match(html, /Business Professional/);
    assert.match(html, /Red Blue Comparison/);
    assert.match(html, /Red Blue Comparison Canvas/);
    assert.match(html, /Dark Analytics Charts/);
    assert.match(html, /Dark Analytics Canvas/);
    assert.doesNotMatch(html, /Legacy Hidden Template/);
  });

  it("shows the create button loading state while context is being suggested", () => {
    const html = renderBriefPage({ loading: "context" });

    assert.match(html, /inline-create-btn/);
    assert.match(html, /spinner small/);
  });

  it("disables research search controls while context is being suggested", () => {
    const html = renderBriefPage({ loading: "context" });

    assertDisabledButtonWithLabel(html, "禁止网络资料搜索");
    assertDisabledButtonWithLabel(html, "禁止图片搜索");
  });

  it("shows persistent research search controls on the first stage", () => {
    const html = renderBriefPage();

    assert.match(html, /禁止网络资料搜索/);
    assert.match(html, /禁止图片搜索/);
  });

  it("disables create and research search controls while workspace settings are saving", () => {
    const html = renderBriefPage({ workspaceSettingsSaving: true });

    assert.match(html, /<button class="inline-create-btn" disabled="">/);
    assertDisabledButtonWithLabel(html, "禁止网络资料搜索");
    assertDisabledButtonWithLabel(html, "禁止图片搜索");
  });
});
