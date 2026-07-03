import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { messages } from "../../src/i18n/messages.ts";
import {
  applyUploadedSourceAnalysisWorkflowEvent,
  createSkippedUploadedSourceAnalysisProgress,
  createUploadedSourceAnalysisProgress,
  failUploadedSourceAnalysisProgress,
} from "../../src/features/deck-workspace/uploadedSourceAnalysisProgress.ts";
import type { UploadedSourceAnalysis } from "../../src/features/deck-generation/uploadedSourceAnalysis.ts";

const t = messages.zh;

function makeAnalysis(status: UploadedSourceAnalysis["status"] = "ready"): UploadedSourceAnalysis {
  return {
    version: 1,
    status,
    source: {
      active_uploaded_sources: [{
        uploaded_source_id: "source-1",
        sha256: "sha",
        size_bytes: 1,
        file_path: "/tmp/source.md",
      }],
      active_total_size_bytes: 1,
    },
    continuation_decision: {
      can_continue: status !== "blocked",
      reason: status === "blocked" ? "source is unreadable" : "ok",
      blocking: status === "blocked",
    },
    facts: [{ id: "fact-1", claim: "Revenue grew.", uploaded_source_id: "source-1", source_path: "/tmp/source.md" }],
    visual_assets: [{ id: "visual-1", uploaded_source_id: "source-1", source_path: "/tmp/chart.png", use_constraint: "usable_visual_asset", reason: "usable", visual_summary: "chart" }],
    gaps: [{ uploaded_source_id: "source-1", source_path: "/tmp/source.md", reason: "missing appendix" }],
    rejected_material: [{ uploaded_source_id: "source-1", source_path: "/tmp/source.md", reason: "duplicate" }],
    source_summaries: [],
    updated_at: "2026-07-03T00:00:00.000Z",
  };
}

describe("Uploaded Source Analysis progress", () => {
  it("creates skipped progress for manual navigation with no uploaded sources", () => {
    const progress = createSkippedUploadedSourceAnalysisProgress(t);

    assert.equal(progress.status, "skipped");
    assert.equal(progress.sourceCount, 0);
    assert.match(progress.message, /无上传资料/);
    assert.equal(progress.records.every((record) => record.state === "skipped"), true);
  });

  it("keeps factual and visual stream output on separate records without filtering details", () => {
    let progress = createUploadedSourceAnalysisProgress(t);
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "phase",
      phase: "factual",
      state: "active",
      sourceCount: 2,
    });
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "stream",
      phase: "factual",
      event: { type: "activity", message: "read /tmp/workspace/uploaded-sources/source.md" },
    });
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "stream",
      phase: "factual",
      event: { type: "content", text: "tool path: /tmp/workspace/uploaded-sources/source.md" },
    });
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "stream",
      phase: "visual",
      event: { type: "content", text: "image path: /tmp/workspace/uploaded-sources/chart.png" },
    });

    const factual = progress.records.find((record) => record.id === "factual");
    const visual = progress.records.find((record) => record.id === "visual");

    assert.equal(progress.status, "running");
    assert.deepEqual(factual?.activities, ["read /tmp/workspace/uploaded-sources/source.md"]);
    assert.deepEqual(factual?.lines, ["tool path: /tmp/workspace/uploaded-sources/source.md"]);
    assert.deepEqual(visual?.lines, ["image path: /tmp/workspace/uploaded-sources/chart.png"]);
  });

  it("summarizes completed and blocked analysis results", () => {
    let completed = createUploadedSourceAnalysisProgress(t);
    completed = applyUploadedSourceAnalysisWorkflowEvent(t, completed, {
      type: "phase",
      phase: "merge",
      state: "completed",
      sourceCount: 1,
      analysis: makeAnalysis("gap"),
    });

    assert.equal(completed.status, "completed");
    assert.equal(completed.resultSummary?.factCount, 1);
    assert.equal(completed.resultSummary?.visualAssetCount, 1);
    assert.equal(completed.resultSummary?.gapCount, 1);
    assert.equal(completed.resultSummary?.rejectedCount, 1);

    let blocked = createUploadedSourceAnalysisProgress(t);
    blocked = applyUploadedSourceAnalysisWorkflowEvent(t, blocked, {
      type: "phase",
      phase: "merge",
      state: "failed",
      sourceCount: 1,
      analysis: makeAnalysis("blocked"),
    });

    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.records.find((record) => record.id === "merge")?.state, "failed");
    assert.equal(blocked.resultSummary?.reason, "source is unreadable");
  });

  it("marks the active record failed when the workflow throws", () => {
    let progress = createUploadedSourceAnalysisProgress(t);
    progress = applyUploadedSourceAnalysisWorkflowEvent(t, progress, {
      type: "phase",
      phase: "visual",
      state: "active",
    });

    const failed = failUploadedSourceAnalysisProgress(t, progress, "visual draft missing");

    assert.equal(failed.status, "failed");
    assert.equal(failed.message, "visual draft missing");
    assert.equal(failed.records.find((record) => record.id === "visual")?.state, "failed");
  });
});
