import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExportPage } from "../../src/features/deck-workspace/components/ExportPage.tsx";
import type {
  ExportArtifact,
  ExportProgressState,
} from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

const readyProgress: ExportProgressState = {
  type: "PPTX",
  mode: "complete",
  message: "PPTX 已就绪",
  percent: 100,
  active: false,
};

function renderExportPage(artifact: ExportArtifact | null) {
  return renderToStaticMarkup(
    createElement(ExportPage, {
      t: messages.zh,
      progress: artifact
        ? readyProgress
        : {
            type: null,
            mode: "idle",
            message: "暂无可下载文件",
            percent: 0,
            active: false,
          },
      artifact,
      loading: "none",
      onBack: () => undefined,
      onExport: () => undefined,
    }),
  );
}

describe("ExportPage", () => {
  it("renders downloadable artifacts as a button without exposing the local path", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      href: "http://127.0.0.1:51824/artifact/demo/deck.pptx",
      fileName: "deck.pptx",
    });

    assert.match(html, /<button class="export-download-btn" type="button">/);
    assert.match(html, /下载 PPTX/);
    assert.doesNotMatch(html, /anna-workspace/);
    assert.doesNotMatch(html, /href=/);
  });

  it("keeps the download button disabled when no href is available", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      href: "",
      fileName: "deck.pptx",
    });

    assert.match(html, /<button class="export-download-btn" type="button" disabled="">/);
    assert.match(html, /下载 PPTX/);
    assert.doesNotMatch(html, /anna-workspace/);
  });
});
