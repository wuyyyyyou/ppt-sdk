import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExportPage } from "../../src/features/deck-workspace/components/ExportPage.tsx";
import { hasActiveDownloadUrl } from "../../src/features/deck-workspace/downloadUrl.ts";
import type {
  ExportArtifact,
  ExportDownloadState,
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

function renderExportPage(
  artifact: ExportArtifact | null,
  download?: ExportDownloadState,
) {
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
      download: download ?? { status: "idle", message: "" },
      loading: "none",
      onBack: () => undefined,
      onExport: () => undefined,
      onDownload: async () => undefined,
    }),
  );
}

describe("ExportPage", () => {
  it("asks for a download in one press, without a preparation step", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      fileName: "deck.pptx",
      updatedAt: "2026-07-18T10:00:00Z",
      mirrorStatus: "ready",
    });

    assert.match(html, /<button class="export-download-btn" type="button" aria-busy="false">/);
    assert.match(html, /下载 PPTX/);
    assert.doesNotMatch(html, /准备下载/);
    assert.doesNotMatch(html, /anna-workspace/);
    assert.doesNotMatch(html, /href=/);
  });

  it("still downloads in one press when the mirror has to be published first", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      fileName: "deck.pptx",
      updatedAt: "2026-07-18T10:00:00Z",
      mirrorStatus: "missing",
    });

    assert.match(html, /<button class="export-download-btn" type="button" aria-busy="false">/);
    assert.match(html, /下载 PPTX/);
    assert.doesNotMatch(html, /anna-workspace/);
  });

  it("keeps the button and adds the URL as a fallback once one exists", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      fileName: "deck.pptx",
      updatedAt: "2026-07-18T10:00:00Z",
      mirrorStatus: "ready",
    }, {
      status: "ready",
      message: messages.zh.exportPage.downloadStartedWithLink,
      href: "https://storage.example/current.pptx",
      expiresAt: "2099-07-18T10:00:00Z",
    });

    // Pressing again retries the transfer, so the button never disappears.
    assert.match(html, /export-download-btn/);
    assert.match(html, /下载 PPTX/);
    assert.match(html, /已开始下载。如果浏览器没有保存文件/);
    assert.match(html, /<input[^>]+readonly=""[^>]+value="https:\/\/storage\.example\/current\.pptx"/);
    assert.match(html, /title="复制下载链接"/);
    assert.match(html, /复制链接后粘贴到浏览器地址栏打开。/);
    assert.ok(
      html.indexOf("export-download-action-row") > html.indexOf("export-progress-row"),
    );
    assert.doesNotMatch(html, /<a[^>]+storage\.example/);
    assert.doesNotMatch(html, /anna-workspace/);
  });

  it("offers a retry that goes straight back to downloading", () => {
    const html = renderExportPage({
      type: "PPTX",
      path: "/Users/leyouming/anna-workspace/ppt/demo/output/deck.pptx",
      fileName: "deck.pptx",
      updatedAt: "2026-07-18T10:00:00Z",
      mirrorStatus: "ready",
    }, { status: "error", message: "下载失败。" });

    assert.match(html, /重试下载/);
    assert.doesNotMatch(html, /重试准备下载/);
  });

  it("offers a retry entry when the export itself failed", () => {
    const html = renderToStaticMarkup(
      createElement(ExportPage, {
        t: messages.zh,
        progress: {
          type: "PPTX",
          mode: "error",
          message: messages.zh.exportPage.exportFailedSummary,
          percent: 40,
          active: false,
        },
        artifact: null,
        download: { status: "idle", message: "" },
        loading: "none",
        onBack: () => undefined,
        onExport: () => undefined,
        onDownload: async () => undefined,
      }),
    );

    assert.match(html, /export-retry-row/);
    assert.match(html, /重新导出/);
    assert.match(html, /导出未能完成。/);
    assert.doesNotMatch(html, /JSON-RPC/);
  });

  it("keeps the retry entry hidden while an export is still running", () => {
    const html = renderToStaticMarkup(
      createElement(ExportPage, {
        t: messages.zh,
        progress: {
          type: "PPTX",
          mode: "determinate",
          message: messages.zh.exportPage.pptxGenerating,
          percent: 40,
          active: true,
        },
        artifact: null,
        download: { status: "idle", message: "" },
        loading: "export",
        onBack: () => undefined,
        onExport: () => undefined,
        onDownload: async () => undefined,
      }),
    );

    assert.doesNotMatch(html, /export-retry-row/);
  });

  it("treats expired and malformed URLs as unavailable", () => {
    assert.equal(hasActiveDownloadUrl({
      status: "ready",
      message: "",
      href: "https://storage.example/expired.pptx",
      expiresAt: "2026-07-18T10:00:00Z",
    }, Date.parse("2026-07-18T10:00:01Z")), false);

    assert.equal(hasActiveDownloadUrl({
      status: "ready",
      message: "",
      href: "https://storage.example/malformed.pptx",
      expiresAt: "soon",
    }), false);
  });

  it("treats APS expiration timestamps without an offset as UTC", () => {
    assert.equal(hasActiveDownloadUrl({
      status: "ready",
      message: "",
      href: "https://storage.example/current.pptx",
      expiresAt: "2026-07-19T01:39:08.714827",
    }, Date.parse("2026-07-19T01:35:13.784Z")), true);
  });
});
