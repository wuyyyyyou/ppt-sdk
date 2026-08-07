import type { ExportArtifactPublishJob, PptxExportJob } from "../../api/types";
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
  return {
    type,
    mode: "indeterminate",
    message: type === "PDF" ? t.exportPage.pdfGenerating : t.exportPage.preparing,
    percent: 0,
    active: true,
  };
}

export function createExportDownloadPreparingProgress(
  t: Messages,
  type: "PPTX" | "PDF",
): ExportProgressState {
  return {
    type,
    mode: "indeterminate",
    message: t.exportPage.downloadPreparing,
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

/**
 * EXPORT-001: a queued or in-flight job is resumed instead of started again, so
 * re-entering the export page never launches a second conversion.
 */
export function isPptxExportJobRunning(job: PptxExportJob | null | undefined): boolean {
  if (!job) return false;
  return job.status === "queued" || job.status === "validating" || job.status === "converting";
}

export function createPptxJobExportProgress(
  t: Messages,
  job: PptxExportJob,
): ExportProgressState {
  const percent = clampPercent(job.percent);
  const fontWarning = job.warnings?.length
    ? formatMessage(t.exportPage.fontVariantWarning, {
        warnings: job.warnings.join("; "),
      })
    : "";
  const withFontWarning = (message: string) => fontWarning ? `${message} — ${fontWarning}` : message;

  if (job.error?.message) {
    return createExportErrorProgress(job.error.message, "PPTX", percent);
  }

  switch (job.status) {
    case "queued":
      return {
        type: "PPTX",
        mode: "indeterminate",
        message: withFontWarning(t.exportPage.pptxPreparingModel),
        percent,
        active: true,
      };
    case "validating":
      return {
        type: "PPTX",
        mode: "indeterminate",
        message: withFontWarning(t.exportPage.pptxModelReady),
        percent,
        active: true,
      };
    case "converting":
      return {
        type: "PPTX",
        mode: "indeterminate",
        message: withFontWarning(t.exportPage.pptxGenerating),
        percent,
        active: true,
      };
    case "completed":
      return {
        type: "PPTX",
        mode: "complete",
        message: withFontWarning(formatMessage(t.exportPage.ready, { type: "PPTX" })),
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

export function isExportArtifactPublishJobRunning(
  job: ExportArtifactPublishJob | null | undefined,
): boolean {
  if (!job) return false;
  return ["queued", "preparing", "uploading", "committing"].includes(job.status);
}

export function createExportArtifactPublishProgress(
  t: Messages,
  job: ExportArtifactPublishJob,
): ExportProgressState {
  const percent = clampPercent(job.percent);
  if (job.status === "failed") {
    return createExportErrorProgress(
      job.message || t.exportPage.exportFailedSummary,
      job.artifact_type === "pptx" ? "PPTX" : "PDF",
      percent,
    );
  }
  if (job.status === "completed") {
    return {
      type: job.artifact_type === "pptx" ? "PPTX" : "PDF",
      mode: "complete",
      message: formatMessage(t.exportPage.ready, {
        type: job.artifact_type === "pptx" ? "PPTX" : "PDF",
      }),
      percent: 100,
      active: false,
    };
  }
  const type = job.artifact_type === "pptx" ? "PPTX" : "PDF";
  const message = job.status === "preparing"
    ? t.exportPage.mirrorPreparing
    : job.status === "uploading"
      ? t.exportPage.mirrorUploading
      : job.status === "committing"
        ? t.exportPage.mirrorCommitting
        : job.message || t.exportPage.downloadPreparing;
  return {
    type,
    mode: "indeterminate",
    message,
    percent,
    active: true,
  };
}
