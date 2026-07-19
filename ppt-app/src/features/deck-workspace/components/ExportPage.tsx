import { Download, File, FileText } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import { hasActiveDownloadUrl } from "../downloadUrl";
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
  if (download.status === "error") return t.exportPage.retryDownloadPreparation;
  if (hasActiveDownloadUrl(download)) return downloadLabel(t, artifact);
  return `${t.exportPage.prepareDownload} ${artifact?.type ?? ""}`.trim();
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
        <button className="export-card" onClick={() => onExport("PPTX")} disabled={loading === "export"}>
          <FileText size={32} />
          <strong>{t.controls.pptx}</strong>
          <span>{t.exportPage.pptxDescription}</span>
        </button>
        <button className="export-card" onClick={() => onExport("PDF")} disabled={loading === "export"}>
          <File size={32} />
          <strong>{t.controls.pdf}</strong>
          <span>{t.exportPage.pdfDescription}</span>
        </button>
      </div>
      <div className={`export-progress-panel ${progress.mode === "error" ? "error" : ""}`}>
        <div className={`export-progress-message ${progress.active ? "breathing" : ""}`}>
          {progress.message}
        </div>
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
          {artifact && downloadAvailability.active && download.href ? (
            <CopyableDownloadLink
              href={download.href}
              inputLabel={t.exportPage.downloadLinkLabel}
              copyLabel={t.exportPage.copyDownloadLink}
              copiedMessage={t.exportPage.downloadLinkCopied}
              copyHint={t.exportPage.downloadCopyHint}
            />
          ) : artifact ? (
            <button
              className="export-download-btn"
              type="button"
              disabled={downloadDisabled}
              aria-busy={download.status === "preparing"}
              onClick={() => {
                void onDownload();
              }}
            >
              <Download size={16} />
              <span>{downloadButtonLabel(t, artifact, download)}</span>
            </button>
          ) : (
            <button className="export-download-btn" type="button" disabled>
              <Download size={16} />
              <span>{downloadLabel(t, artifact)}</span>
            </button>
          )}
        </div>
        {download.message ? (
          <div className={`export-download-status ${download.status === "error" ? "error" : ""}`}>
            {download.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
