import { Download, File, FileText } from "lucide-react";
import { useState } from "react";
import type { Messages } from "../../../i18n/messages";
import { downloadExportArtifact } from "../exportArtifactDownload";
import type { ExportArtifact, ExportProgressState } from "../types";
import type { LoadingKind } from "../types";
import { PageHeader } from "./PageHeader";

interface ExportPageProps {
  t: Messages;
  progress: ExportProgressState;
  artifact: ExportArtifact | null;
  loading: LoadingKind;
  onBack: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
}

function downloadLabel(t: Messages, artifact: ExportArtifact | null) {
  return artifact ? `${t.exportPage.download} ${artifact.type}` : t.exportPage.download;
}

function downloadButtonLabel(t: Messages, artifact: ExportArtifact | null, active: boolean) {
  return active ? t.exportPage.downloadPreparing : downloadLabel(t, artifact);
}

function isDeterminateProgress(progress: ExportProgressState) {
  return progress.mode === "determinate" ||
    progress.mode === "complete" ||
    progress.mode === "error";
}

export function ExportPage({ t, progress, artifact, loading, onBack, onExport }: ExportPageProps) {
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const downloadableArtifact = artifact?.href ? artifact : null;
  const progressClass = [
    "export-progress-track",
    `mode-${progress.mode}`,
    progress.active ? "active" : "",
  ].filter(Boolean).join(" ");
  const fillStyle = isDeterminateProgress(progress)
    ? { width: `${progress.percent}%` }
    : undefined;
  const ariaValueNow = isDeterminateProgress(progress) ? progress.percent : undefined;
  const downloadDisabled = downloadInProgress;

  async function handleArtifactDownload(targetArtifact: ExportArtifact) {
    if (downloadInProgress) return;
    setDownloadInProgress(true);
    try {
      await downloadExportArtifact(targetArtifact);
    } finally {
      setDownloadInProgress(false);
    }
  }

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
          {downloadableArtifact ? (
            <button
              className="export-download-btn"
              type="button"
              disabled={downloadDisabled}
              aria-busy={downloadInProgress}
              onClick={() => {
                void handleArtifactDownload(downloadableArtifact);
              }}
            >
              <Download size={16} />
              <span>{downloadButtonLabel(t, downloadableArtifact, downloadInProgress)}</span>
            </button>
          ) : (
            <button className="export-download-btn" type="button" disabled>
              <Download size={16} />
              <span>{downloadLabel(t, artifact)}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
