import { File, FileText } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { LoadingKind } from "../types";
import { PageHeader } from "./PageHeader";

interface ExportPageProps {
  t: Messages;
  status: string;
  loading: LoadingKind;
  onBack: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
}

export function ExportPage({ t, status, loading, onBack, onExport }: ExportPageProps) {
  return (
    <section className="page active export-page">
      <PageHeader title={t.exportPage.title} onBack={onBack} t={t} />
      <div className="export-grid">
        <button className="export-card" onClick={() => onExport("PPTX")}>
          <FileText size={32} />
          <strong>{t.controls.pptx}</strong>
          <span>{t.exportPage.pptxDescription}</span>
        </button>
        <button className="export-card" onClick={() => onExport("PDF")}>
          <File size={32} />
          <strong>{t.controls.pdf}</strong>
          <span>{t.exportPage.pdfDescription}</span>
        </button>
      </div>
      <div className="export-status">
        {loading === "export" ? <span className="spinner small" /> : null}
        {status}
      </div>
    </section>
  );
}
