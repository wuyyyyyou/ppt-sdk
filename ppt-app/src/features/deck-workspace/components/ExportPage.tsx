import { Download, File, FileText } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
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

function getDownloadDocument(): Document | null {
  if (!window.parent || window.parent === window) {
    return document.body ? document : null;
  }

  try {
    if (window.parent.document?.body) {
      return window.parent.document;
    }
  } catch {
    // Cross-origin hosts cannot expose parent.document. Fall back to a popup.
  }

  return null;
}

function triggerArtifactDownload(artifact: ExportArtifact) {
  const targetDocument = getDownloadDocument();
  if (!targetDocument) {
    window.open(artifact.href, "_blank", "noopener,noreferrer");
    return;
  }

  const link = targetDocument.createElement("a");
  link.href = artifact.href;
  link.download = artifact.fileName ?? "";
  link.rel = "noopener";
  link.style.display = "none";
  targetDocument.body.appendChild(link);
  link.click();
  link.remove();
}

function isDeterminateProgress(progress: ExportProgressState) {
  return progress.mode === "determinate" ||
    progress.mode === "complete" ||
    progress.mode === "error";
}

export function ExportPage({ t, progress, artifact, loading, onBack, onExport }: ExportPageProps) {
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
              onClick={() => triggerArtifactDownload(downloadableArtifact)}
            >
              <Download size={16} />
              <span>{downloadLabel(t, downloadableArtifact)}</span>
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
