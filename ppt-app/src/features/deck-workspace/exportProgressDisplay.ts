import type { PptxExportJob } from "../../api/types";
import { formatMessage, type Messages } from "../../i18n/messages";
import type { ExportArtifact, ExportProgressState } from "./types";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createIdleExportProgress(t: Messages): ExportProgressState {
  return {
    type: null,
    mode: "idle",
    message: t.exportPage.noFile,
    percent: 0,
    active: false,
  };
}

export function createArtifactExportProgress(
  t: Messages,
  artifact: ExportArtifact | null,
): ExportProgressState {
  if (!artifact) {
    return createIdleExportProgress(t);
  }

  return {
    type: artifact.type,
    mode: "complete",
    message: formatMessage(t.exportPage.ready, { type: artifact.type }),
    percent: 100,
    active: false,
  };
}

export function createExportStartProgress(
  t: Messages,
  type: "PPTX" | "PDF",
): ExportProgressState {
  if (type === "PDF") {
    return {
      type,
      mode: "indeterminate",
      message: t.exportPage.pdfGenerating,
      percent: 0,
      active: true,
    };
  }

  return {
    type,
    mode: "determinate",
    message: t.exportPage.preparing,
    percent: 0,
    active: true,
  };
}

export function createExportErrorProgress(
  message: string,
  type: "PPTX" | "PDF" | null,
  previousPercent = 0,
): ExportProgressState {
  return {
    type,
    mode: "error",
    message,
    percent: clampPercent(previousPercent),
    active: false,
  };
}

export function createPptxJobExportProgress(
  t: Messages,
  job: PptxExportJob,
): ExportProgressState {
  const percent = clampPercent(job.percent);

  if (job.error?.message) {
    return createExportErrorProgress(job.error.message, "PPTX", percent);
  }

  switch (job.status) {
    case "queued":
      return {
        type: "PPTX",
        mode: "determinate",
        message: t.exportPage.pptxPreparingModel,
        percent,
        active: true,
      };
    case "validating":
      return {
        type: "PPTX",
        mode: "determinate",
        message: t.exportPage.pptxModelReady,
        percent,
        active: true,
      };
    case "converting":
      return {
        type: "PPTX",
        mode: "determinate",
        message: t.exportPage.pptxGenerating,
        percent,
        active: true,
      };
    case "completed":
      return {
        type: "PPTX",
        mode: "complete",
        message: formatMessage(t.exportPage.ready, { type: "PPTX" }),
        percent: 100,
        active: false,
      };
    case "failed":
      return createExportErrorProgress(
        job.message || t.exportPage.pptxFailed,
        "PPTX",
        percent,
      );
    case "idle":
    default:
      return createExportStartProgress(t, "PPTX");
  }
}
