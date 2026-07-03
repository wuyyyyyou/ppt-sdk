import type { AgentStreamEvent } from "../../agent/agentClient";
import type { Messages } from "../../i18n/messages";
import type {
  UploadedSourceAnalysisWorkflowEvent,
  UploadedSourceAnalysisWorkflowPhase,
} from "../deck-generation/uploadedSourceAnalysisWorkflow";
import type { UploadedSourceAnalysis } from "../deck-generation/uploadedSourceAnalysis";
import type {
  UploadedSourceAnalysisProgress,
  UploadedSourceAnalysisRecord,
  UploadedSourceAnalysisRecordId,
  UploadedSourceAnalysisRecordState,
  UploadedSourceAnalysisResultSummary,
  UploadedSourceAnalysisRunStatus,
} from "./types";

const recordIds: UploadedSourceAnalysisRecordId[] = ["prepare", "factual", "visual", "merge"];

export function createUploadedSourceAnalysisProgress(
  t: Messages,
  patch: Partial<UploadedSourceAnalysisProgress> = {},
): UploadedSourceAnalysisProgress {
  return {
    status: "idle",
    sourceCount: 0,
    message: t.uploadedSourceAnalysis.messages.idle,
    records: recordIds.map((id) => ({
      id,
      label: t.uploadedSourceAnalysis.records[id],
      state: "pending",
      activities: [],
      lines: [],
      summaryLines: [],
    })),
    ...patch,
  };
}

export function createSkippedUploadedSourceAnalysisProgress(
  t: Messages,
): UploadedSourceAnalysisProgress {
  return createUploadedSourceAnalysisProgress(t, {
    status: "skipped",
    sourceCount: 0,
    message: t.uploadedSourceAnalysis.messages.skipped,
    records: recordIds.map((id) => ({
      id,
      label: t.uploadedSourceAnalysis.records[id],
      state: "skipped",
      activities: [],
      lines: [],
      summaryLines: [t.uploadedSourceAnalysis.noSources],
      updated_at: new Date().toISOString(),
    })),
  });
}

export function summarizeUploadedSourceAnalysis(
  analysis: UploadedSourceAnalysis,
): UploadedSourceAnalysisResultSummary {
  return {
    status: analysis.status,
    factCount: analysis.facts.length,
    visualAssetCount: analysis.visual_assets.length,
    gapCount: analysis.gaps.length,
    rejectedCount: analysis.rejected_material.length,
    reason: analysis.continuation_decision.reason,
  };
}

export function createCompletedUploadedSourceAnalysisProgress(
  t: Messages,
  sourceCount: number,
  analysis: UploadedSourceAnalysis,
): UploadedSourceAnalysisProgress {
  const resultSummary = summarizeUploadedSourceAnalysis(analysis);
  const terminalStatus: UploadedSourceAnalysisRunStatus =
    resultSummary.status === "blocked" || !analysis.continuation_decision.can_continue
      ? "blocked"
      : "completed";
  const recordState: UploadedSourceAnalysisRecordState =
    terminalStatus === "blocked" ? "failed" : "completed";

  return createUploadedSourceAnalysisProgress(t, {
    status: terminalStatus,
    sourceCount,
    message: terminalStatus === "blocked"
      ? t.uploadedSourceAnalysis.messages.blocked
      : t.uploadedSourceAnalysis.messages.completed,
    records: recordIds.map((id) => ({
      id,
      label: t.uploadedSourceAnalysis.records[id],
      state: recordState,
      activities: [],
      lines: [],
      summaryLines: id === "merge" ? summaryLines(t, resultSummary) : [],
      updated_at: analysis.updated_at,
    })),
    resultSummary,
  });
}

export function applyUploadedSourceAnalysisWorkflowEvent(
  t: Messages,
  progress: UploadedSourceAnalysisProgress,
  event: UploadedSourceAnalysisWorkflowEvent,
): UploadedSourceAnalysisProgress {
  if (event.type === "stream") {
    return updateRecord(progress, event.phase, (record) =>
      applyStreamEvent(record, event.event)
    );
  }

  const recordId = event.phase;
  const now = new Date().toISOString();
  const nextStatus = statusForPhaseEvent(event, progress.status);
  const resultSummary = event.analysis
    ? summarizeUploadedSourceAnalysis(event.analysis)
    : progress.resultSummary;
  const message = messageForPhaseEvent(t, event, nextStatus);

  return {
    ...progress,
    status: nextStatus,
    sourceCount: event.sourceCount ?? progress.sourceCount,
    message,
    resultSummary,
    records: progress.records.map((record) => {
      if (record.id !== recordId) return record;
      const nextState = event.state === "failed" && event.analysis?.status !== "blocked"
        ? "failed"
        : event.state;
      return {
        ...record,
        state: nextState,
        summaryLines: event.analysis
          ? summaryLines(t, summarizeUploadedSourceAnalysis(event.analysis))
          : event.message
            ? appendBounded(record.summaryLines, event.message, 8)
            : record.summaryLines,
        error: event.error ?? record.error,
        started_at: record.started_at ?? (event.state === "active" ? now : undefined),
        updated_at: now,
      };
    }),
  };
}

export function failUploadedSourceAnalysisProgress(
  t: Messages,
  progress: UploadedSourceAnalysisProgress,
  message: string,
): UploadedSourceAnalysisProgress {
  const now = new Date().toISOString();
  const activeRecord = progress.records.find((record) => record.state === "active");
  const fallbackRecord = progress.records.find((record) => record.state === "pending");
  const failedId = activeRecord?.id ?? fallbackRecord?.id ?? "merge";

  return {
    ...progress,
    status: "failed",
    message: message || t.uploadedSourceAnalysis.messages.failed,
    records: progress.records.map((record) =>
      record.id === failedId
        ? {
            ...record,
            state: "failed",
            error: message,
            updated_at: now,
          }
        : record
    ),
  };
}

function statusForPhaseEvent(
  event: Extract<UploadedSourceAnalysisWorkflowEvent, { type: "phase" }>,
  current: UploadedSourceAnalysisRunStatus,
): UploadedSourceAnalysisRunStatus {
  if (event.state === "active") return "running";
  if (event.state === "skipped" && event.phase === "prepare") return "skipped";
  if (event.state === "failed") {
    if (event.analysis?.status === "blocked" || event.analysis?.continuation_decision.can_continue === false) {
      return "blocked";
    }
    return "failed";
  }
  if (event.phase === "merge" && event.state === "completed") return "completed";
  return current === "idle" ? "running" : current;
}

function messageForPhaseEvent(
  t: Messages,
  event: Extract<UploadedSourceAnalysisWorkflowEvent, { type: "phase" }>,
  status: UploadedSourceAnalysisRunStatus,
) {
  if (status === "completed") return t.uploadedSourceAnalysis.messages.completed;
  if (status === "blocked") return t.uploadedSourceAnalysis.messages.blocked;
  if (status === "failed") return event.error || event.message || t.uploadedSourceAnalysis.messages.failed;
  if (status === "skipped") return t.uploadedSourceAnalysis.messages.skipped;
  const keyByPhase: Record<UploadedSourceAnalysisWorkflowPhase, keyof Messages["uploadedSourceAnalysis"]["messages"]> = {
    prepare: "prepare",
    factual: "factual",
    visual: "visual",
    merge: "merge",
  };
  return event.message || t.uploadedSourceAnalysis.messages[keyByPhase[event.phase]];
}

function applyStreamEvent(
  record: UploadedSourceAnalysisRecord,
  event: AgentStreamEvent,
): UploadedSourceAnalysisRecord {
  const now = new Date().toISOString();
  if (event.type === "content") {
    return {
      ...record,
      state: record.state === "pending" ? "active" : record.state,
      lines: appendTextToLines(record.lines, event.text, 30),
      started_at: record.started_at ?? now,
      updated_at: now,
    };
  }
  if (event.type === "activity") {
    return {
      ...record,
      state: record.state === "pending" ? "active" : record.state,
      activities: appendBounded(record.activities, event.message, 12),
      started_at: record.started_at ?? now,
      updated_at: now,
    };
  }
  if (event.type === "error") {
    return {
      ...record,
      activities: appendBounded(record.activities, event.message, 12),
      error: event.message,
      updated_at: now,
    };
  }
  return {
    ...record,
    activities: appendBounded(record.activities, "Agent run completed", 12),
    updated_at: now,
  };
}

function updateRecord(
  progress: UploadedSourceAnalysisProgress,
  id: UploadedSourceAnalysisRecordId,
  update: (record: UploadedSourceAnalysisRecord) => UploadedSourceAnalysisRecord,
) {
  return {
    ...progress,
    records: progress.records.map((record) => (record.id === id ? update(record) : record)),
  };
}

function appendTextToLines(lines: string[], text: string, limit: number) {
  if (!text) return lines;
  const next = [...lines];
  const parts = text.split(/\r?\n/);
  parts.forEach((part, index) => {
    if (index === 0 && next.length > 0) {
      next[next.length - 1] = `${next[next.length - 1]}${part}`;
    } else {
      next.push(part);
    }
  });
  return next.slice(-limit);
}

function appendBounded(lines: string[], value: string, limit: number) {
  if (!value) return lines;
  return [...lines, value].slice(-limit);
}

function summaryLines(
  t: Messages,
  summary: UploadedSourceAnalysisResultSummary,
) {
  return [
    `${t.uploadedSourceAnalysis.summaryLabels.facts}: ${summary.factCount}`,
    `${t.uploadedSourceAnalysis.summaryLabels.visualAssets}: ${summary.visualAssetCount}`,
    `${t.uploadedSourceAnalysis.summaryLabels.gaps}: ${summary.gapCount}`,
    `${t.uploadedSourceAnalysis.summaryLabels.rejected}: ${summary.rejectedCount}`,
    `${t.uploadedSourceAnalysis.summaryLabels.reason}: ${summary.reason}`,
  ];
}
