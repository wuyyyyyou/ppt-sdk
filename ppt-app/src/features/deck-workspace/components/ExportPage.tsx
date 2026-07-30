import { Download, File, FileText } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import { useDownloadUrlAvailability } from "../useDownloadUrlAvailability";
import type { ExportArtifact, ExportDownloadState, ExportProgressState } from "../types";
import type { LoadingKind } from "../types";
import { CopyableDownloadLink } from "./CopyableDownloadLink";
import { PageHeader } from "./PageHeader";

interface ExportPageProps {
  t: Messages;
  progress: ExportProgressState;
  artifact: ExportArtifact | null;
  download: ExportDownloadState;
  loading: LoadingKind;
  onBack: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
  onDownload: () => Promise<void>;
}

function downloadLabel(t: Messages, artifact: ExportArtifact | null) {
  return artifact ? `${t.exportPage.download} ${artifact.type}` : t.exportPage.download;
}

function downloadButtonLabel(t: Messages, artifact: ExportArtifact | null, download: ExportDownloadState) {
  if (download.status === "preparing") return t.exportPage.downloadPreparing;
  if (download.status === "error") return t.exportPage.retryDownload;
  return downloadLabel(t, artifact);
}

function isDeterminateProgress(progress: ExportProgressState) {
  return progress.mode === "determinate" ||
    progress.mode === "complete" ||
    progress.mode === "error";
}

export function ExportPage({ t, progress, artifact, download, loading, onBack, onExport, onDownload }: ExportPageProps) {
  const downloadAvailability = useDownloadUrlAvailability(download);
  const progressClass = [
    "export-progress-track",
    `mode-${progress.mode}`,
    progress.active ? "active" : "",
  ].filter(Boolean).join(" ");
  const fillStyle = isDeterminateProgress(progress)
    ? { width: `${progress.percent}%` }
    : undefined;
  const ariaValueNow = isDeterminateProgress(progress) ? progress.percent : undefined;
  const downloadDisabled = download.status === "preparing";

  return (
    <section className="page active export-page">
      <PageHeader title={t.exportPage.title} onBack={onBack} t={t} />
      <div className="export-grid">
        <button data-performance-id="export.pptx.start" className="export-card" onClick={() => onExport("PPTX")} disabled={loading === "export"}>
          <FileText size={32} aria-hidden="true" />
          <strong>{t.controls.pptx}</strong>
          <span>{t.exportPage.pptxDescription}</span>
        </button>
        <button data-performance-id="export.pdf.start" className="export-card" onClick={() => onExport("PDF")} disabled={loading === "export"}>
          <File size={32} aria-hidden="true" />
          <strong>{t.controls.pdf}</strong>
          <span>{t.exportPage.pdfDescription}</span>
        </button>
      </div>
      <div className={`export-progress-panel ${progress.mode === "error" ? "error" : ""}`}>
        <div
          className={`export-progress-message ${progress.active ? "breathing" : ""}`}
          role="status"
          aria-live="polite"
        >
          {progress.message}
        </div>
        {progress.mode === "error" && progress.type ? (
          <div className="export-retry-row">
            <button
              data-performance-id="export.retry"
              className="secondary-btn compact"
              type="button"
              disabled={loading === "export"}
              onClick={() => onExport(progress.type as "PPTX" | "PDF")}
            >
              {t.exportPage.retryExport}
            </button>
          </div>
        ) : null}
        <div className="export-progress-row">
          <div
            className={progressClass}
            role="progressbar"
            aria-label={progress.message}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ariaValueNow}
          >
            <div className="export-progress-fill" style={fillStyle} />
          </div>
        </div>
        <div className="export-download-action-row">
          <button
            data-performance-id={artifact ? "export.download.prepare" : "export.download.unavailable"}
            className="export-download-btn"
            type="button"
            disabled={!artifact || downloadDisabled}
            aria-busy={download.status === "preparing"}
            onClick={() => {
              void onDownload();
            }}
          >
            <Download size={16} aria-hidden="true" />
            <span>{artifact ? downloadButtonLabel(t, artifact, download) : downloadLabel(t, artifact)}</span>
          </button>
          {/* ADR-0025: the host iframe may still refuse to start the transfer, so
              the signed URL stays reachable as a manual fallback. */}
          {artifact && downloadAvailability.active && download.href ? (
            <CopyableDownloadLink
              href={download.href}
              inputLabel={t.exportPage.downloadLinkLabel}
              copyLabel={t.exportPage.copyDownloadLink}
              copiedMessage={t.exportPage.downloadLinkCopied}
              copyHint={t.exportPage.downloadFallbackHint}
            />
          ) : null}
        </div>
        {download.message ? (
          <div className={`export-download-status ${download.status === "error" ? "error" : ""}`} role="status" aria-live="polite">
            {download.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
