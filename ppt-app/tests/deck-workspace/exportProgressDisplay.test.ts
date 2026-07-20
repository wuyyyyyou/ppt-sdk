import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PptxExportJob } from "../../src/api/types.ts";
import {
  createArtifactExportProgress,
  createIdleExportProgress,
  createPptxJobExportProgress,
} from "../../src/features/deck-workspace/exportProgressDisplay.ts";
import type { ExportArtifact } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

function makePptxJob(overrides: Partial<PptxExportJob>): PptxExportJob {
  return {
    version: 2,
    job_id: "job-1",
    status: "queued",
    message: "Queued for PPTX export.",
    percent: 5,
    workspace_dir: "/tmp/workspaces/demo",
    status_path: "/tmp/workspaces/demo/output/pptx-export.json",
    output_dir: "/tmp/workspaces/demo/output",
    deck_html_path: "",
    pptx_path: "/tmp/workspaces/demo/output/deck.pptx",
    started_at: null,
    updated_at: null,
    completed_at: null,
    error: null,
    warning_count: 0,
    ...overrides,
  };
}

describe("Export Progress Display", () => {
  it("shows an idle empty progress state when no artifact exists", () => {
    assert.deepEqual(createIdleExportProgress(messages.zh), {
      type: null,
      mode: "idle",
      message: "暂无可下载文件",
      percent: 0,
      active: false,
    });
  });

  it("maps an existing artifact to a completed progress state", () => {
    const artifact: ExportArtifact = {
      type: "PPTX",
      path: "/tmp/workspaces/demo/output/deck.pptx",
      fileName: "deck.pptx",
      updatedAt: "2026-07-18T10:00:00Z",
      mirrorStatus: "ready",
    };

    assert.deepEqual(createArtifactExportProgress(messages.en, artifact), {
      type: "PPTX",
      mode: "complete",
      message: "PPTX ready",
      percent: 100,
      active: false,
    });
  });

  it("uses localized PPTX job status text and real percent", () => {
    assert.deepEqual(
      createPptxJobExportProgress(messages.zh, makePptxJob({
        status: "converting",
        percent: 75,
      })),
      {
        type: "PPTX",
        mode: "determinate",
        message: "正在生成 PPTX 文件",
        percent: 75,
        active: true,
      },
    );
  });

  it("maps failed jobs to a non-breathing error state", () => {
    assert.deepEqual(
      createPptxJobExportProgress(messages.en, makePptxJob({
        status: "failed",
        message: "Generator failed",
        percent: 100,
      })),
      {
        type: "PPTX",
        mode: "error",
        message: "Generator failed",
        percent: 100,
        active: false,
      },
    );
  });
});
