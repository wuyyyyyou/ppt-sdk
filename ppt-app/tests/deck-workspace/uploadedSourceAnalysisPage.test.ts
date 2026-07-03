import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { messages } from "../../src/i18n/messages.ts";
import { UploadedSourceAnalysisPage } from "../../src/features/deck-workspace/components/UploadedSourceAnalysisPage.tsx";
import {
  applyUploadedSourceAnalysisWorkflowEvent,
  createSkippedUploadedSourceAnalysisProgress,
  createUploadedSourceAnalysisProgress,
  failUploadedSourceAnalysisProgress,
} from "../../src/features/deck-workspace/uploadedSourceAnalysisProgress.ts";
import type { UploadedSourceAnalysisViewState } from "../../src/features/deck-workspace/types.ts";

const t = messages.zh;

function renderPage(
  progress = createUploadedSourceAnalysisProgress(t),
  viewState: UploadedSourceAnalysisViewState = {
    status: "pending",
    sourceCount: 1,
    factCount: null,
    visualAssetCount: null,
    gapCount: null,
  },
) {
  return renderToStaticMarkup(
    createElement(UploadedSourceAnalysisPage, {
      t,
      progress,
      viewState,
      onReturnToBrief: () => undefined,
      onRetry: async () => undefined,
    }),
  );
}

describe("UploadedSourceAnalysisPage", () => {
  it("shows no-source skipped state for manual review", () => {
    const html = renderPage(
      createSkippedUploadedSourceAnalysisProgress(t),
      {
        status: "hidden",
        sourceCount: 0,
        factCount: null,
        visualAssetCount: null,
        gapCount: null,
      },
    );

    assert.match(html, /无上传资料，不需要分析/);
    assert.match(html, /准备上传资料/);
    assert.doesNotMatch(html, /重试分析/);
  });

  it("renders raw stream path details without generation-page sanitization", () => {
    let progress = createUploadedSourceAnalysisProgress(t);
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "phase",
      phase: "factual",
      state: "active",
      sourceCount: 1,
    });
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "stream",
      phase: "factual",
      event: { type: "content", text: 'template_id:abc path="/tmp/workspace/source.md"' },
    });

    const html = renderPage(progress);

    assert.match(html, /template_id:abc path=&quot;\/tmp\/workspace\/source\.md&quot;/);
  });

  it("shows return and retry actions after failure", () => {
    const failed = failUploadedSourceAnalysisProgress(
      t,
      createUploadedSourceAnalysisProgress(t),
      "draft missing",
    );
    const html = renderPage(failed);

    assert.match(html, /上传资料分析失败/);
    assert.match(html, /返回需求/);
    assert.match(html, /重试分析/);
    assert.match(html, /draft missing/);
  });
});
