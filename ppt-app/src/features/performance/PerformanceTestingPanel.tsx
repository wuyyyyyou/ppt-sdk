import { Activity, FileText, Play, RefreshCw, Square, Trash2, XCircle } from "lucide-react";
import type { PerformanceRunSummary } from "../../api/types";
import type { Messages } from "../../i18n/messages";
import type { PerformanceTestingState } from "../deck-workspace/types";

interface PerformanceTestingPanelProps {
  t: Messages;
  locale: "en" | "zh";
  state: PerformanceTestingState;
  onRefresh: () => Promise<void>;
  onStart: () => Promise<void>;
  onFinish: () => Promise<void>;
  onAbandon: () => Promise<void>;
  onViewReport: (run: PerformanceRunSummary) => Promise<void>;
  onRegenerateReport: (run: PerformanceRunSummary) => Promise<void>;
  onDelete: (run: PerformanceRunSummary) => Promise<void>;
}

function runStatus(run: PerformanceRunSummary, t: Messages) {
  if (run.status === "recording" || run.status === "finalizing") return t.performance.recording;
  if (run.status === "completed") return t.performance.completed;
  if (run.status === "abandoned") return t.performance.abandoned;
  return t.performance.finalizationFailed;
}

export function PerformanceTestingPanel({ t, locale, state, onRefresh, onStart, onFinish, onAbandon, onViewReport, onRegenerateReport, onDelete }: PerformanceTestingPanelProps) {
  if (!state.enabled) return null;
  return (
    <div className="performance-testing-box" data-performance-control="true">
      <div className="performance-testing-header">
        <div><strong>{t.performance.title}</strong><p>{t.performance.description}</p></div>
        <button type="button" className="icon-btn" data-performance-exclude="true" aria-label={t.performance.refresh} title={t.performance.refresh} disabled={state.loading || state.busy} onClick={() => void onRefresh()}><RefreshCw size={17} /></button>
      </div>

      {state.loading ? <div className="performance-testing-message">{t.performance.loading}</div> : null}
      {!state.loading && !state.supported ? <div className="performance-testing-message error">{state.error || t.performance.unavailable}</div> : null}
      {state.supported ? (
        <>
          <div className={`performance-run-status ${state.activeRun ? "recording" : ""}`}>
            <Activity size={18} aria-hidden="true" />
            <div><strong>{state.activeRun ? t.performance.active : t.performance.inactive}</strong>{state.activeRun ? <span>{state.activeRun.run_id}</span> : null}</div>
          </div>
          <div className="performance-testing-actions">
            {state.activeRun ? (
              <>
                <button type="button" className="primary-btn" data-performance-exclude="true" disabled={state.busy} onClick={() => void onFinish()}><Square size={14} />{t.performance.finish}</button>
                <button type="button" className="secondary-btn" data-performance-exclude="true" disabled={state.busy} onClick={() => void onAbandon()}><XCircle size={14} />{t.performance.abandon}</button>
              </>
            ) : <button type="button" className="primary-btn" data-performance-exclude="true" disabled={state.busy} onClick={() => void onStart()}><Play size={14} />{t.performance.start}</button>}
          </div>
          {state.error ? <div className="performance-testing-message error">{state.error}</div> : null}
          <div className="performance-history-header"><strong>{t.performance.history}</strong><span>{state.runs.length}</span></div>
          {state.runs.length === 0 ? <div className="performance-testing-message">{t.performance.empty}</div> : (
            <div className="performance-run-list">
              {state.runs.map((run) => (
                <div className="performance-run-row" key={run.run_id}>
                  <div className="performance-run-main"><strong>{run.run_id}</strong><span>{runStatus(run, t)} · {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(new Date(run.started_at))} · {run.event_count} {t.performance.events}</span></div>
                  <div className="performance-run-actions">
                    {run.status === "completed" ? <button type="button" className="icon-btn" data-performance-exclude="true" aria-label={t.performance.regenerateReport} title={t.performance.regenerateReport} disabled={state.busy} onClick={() => void onRegenerateReport(run)}><RefreshCw size={16} /></button> : null}
                    {run.report_available ? <button type="button" className="icon-btn" data-performance-exclude="true" aria-label={t.performance.viewReport} title={t.performance.viewReport} disabled={state.busy} onClick={() => void onViewReport(run)}><FileText size={16} /></button> : null}
                    {(run.status === "completed" || run.status === "abandoned") ? <button type="button" className="icon-btn danger" data-performance-exclude="true" aria-label={t.performance.deleteRun} title={t.performance.deleteRun} disabled={state.busy} onClick={() => void onDelete(run)}><Trash2 size={16} /></button> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
