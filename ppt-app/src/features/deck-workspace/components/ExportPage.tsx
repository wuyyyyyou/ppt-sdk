import { ExternalLink, File, FileText } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { ExportArtifact } from "../types";
import type { LoadingKind } from "../types";
import { PageHeader } from "./PageHeader";

interface ExportPageProps {
  t: Messages;
  status: string;
  artifact: ExportArtifact | null;
  loading: LoadingKind;
  onBack: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
}

function fileUrlLabel(path: string) {
  return path;
}

export function ExportPage({ t, status, artifact, loading, onBack, onExport }: ExportPageProps) {
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
      <div className="export-status">
        {loading === "export" ? <span className="spinner small" /> : null}
        <div className="export-status-main">{status}</div>
        {artifact ? (
          <a
            className="export-status-link"
            href={artifact.href}
            target="_blank"
            rel="noreferrer"
            title={artifact.path}
          >
            <ExternalLink size={12} />
            <span>{fileUrlLabel(artifact.path)}</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
