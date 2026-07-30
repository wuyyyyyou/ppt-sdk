import type { Messages } from "../../i18n/messages";
import { PageHeader } from "../deck-workspace/components/PageHeader";

export function PerformanceReportPage({ t, html, runId, onBack }: { t: Messages; html: string; runId: string | null; onBack: () => void }) {
  return (
    <section className="page active performance-report-page" data-performance-control="true">
      <PageHeader title={`${t.performance.reportTitle}${runId ? ` · ${runId}` : ""}`} onBack={onBack} t={t} />
      {html ? <iframe className="performance-report-frame" title={t.performance.reportTitle} sandbox="" srcDoc={html} /> : <div className="performance-testing-message">{t.performance.reportLoading}</div>}
    </section>
  );
}
