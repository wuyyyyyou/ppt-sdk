import { ChevronDown, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Messages } from "../../../i18n/messages";
import type {
  UploadedSourceAnalysisProgress,
  UploadedSourceAnalysisRecord,
  UploadedSourceAnalysisRecordState,
  UploadedSourceAnalysisViewState,
} from "../types";
import { ThinkingStatusText } from "./BriefPage";

interface UploadedSourceAnalysisPageProps {
  t: Messages;
  progress: UploadedSourceAnalysisProgress;
  viewState: UploadedSourceAnalysisViewState;
  onReturnToBrief: () => void;
  onRetry: () => Promise<void>;
}

export function UploadedSourceAnalysisPage(props: UploadedSourceAnalysisPageProps) {
  const { t, progress, viewState, onReturnToBrief, onRetry } = props;
  const disclosure = useUploadedSourceAnalysisDisclosure(progress.records);
  const isRunning = progress.status === "running";
  const sourceCount = progress.sourceCount || viewState.sourceCount;
  const message = displayMessage(t, progress, viewState);
  const title = titleForStatus(t, progress.status, viewState);
  const showFailureActions = progress.status === "failed" || progress.status === "blocked";

  return (
    <section className="page active generating-page uploaded-source-analysis-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{title}</div>
          <p><ThinkingStatusText text={message} active={isRunning} /></p>
        </div>
      </div>

      <div className="generation-progress-panel">
        <div className="generation-progress-header">
          <div>
            <div className="section-label">{t.uploadedSourceAnalysis.title}</div>
            <strong>
              <ThinkingStatusText text={message} active={isRunning} />
            </strong>
            {sourceCount > 0 ? (
              <span className="generation-stay-hint">
                {t.uploadedSourceAnalysis.sourceCount.replace("{count}", String(sourceCount))}
              </span>
            ) : null}
          </div>
        </div>

        {viewState.sourceCount === 0 ? (
          <p className="generation-empty-stream">{t.uploadedSourceAnalysis.noSources}</p>
        ) : viewState.status === "stale" && progress.status !== "running" ? (
          <p className="generation-empty-stream">{t.uploadedSourceAnalysis.stale}</p>
        ) : null}

        <div className="generation-page-list generation-stage-record-list">
          <article className={`generation-page-item generation-stage-page ${recordGroupState(progress)}`}>
            <div className="generation-page-item-header">
              <div>
                <strong>{t.uploadedSourceAnalysis.title}</strong>
              </div>
              <span className={`generation-status-badge ${badgeState(recordGroupState(progress))}`}>
                {statusLabel(t, recordGroupState(progress))}
              </span>
            </div>
            <div className="generation-page-stage-list">
              {progress.records.map((record) => (
                <UploadedSourceAnalysisRecordView
                  key={record.id}
                  t={t}
                  record={record}
                  open={disclosure.isOpen(record)}
                  onToggle={() => disclosure.toggle(record.id)}
                />
              ))}
            </div>
          </article>
        </div>

        {progress.resultSummary ? (
          <div className="research-discovery-line-list">
            <strong>{t.uploadedSourceAnalysis.resultSummary}</strong>
            <span>{t.uploadedSourceAnalysis.summaryLabels.facts}: {progress.resultSummary.factCount}</span>
            <span>{t.uploadedSourceAnalysis.summaryLabels.visualAssets}: {progress.resultSummary.visualAssetCount}</span>
            <span>{t.uploadedSourceAnalysis.summaryLabels.gaps}: {progress.resultSummary.gapCount}</span>
            <span>{t.uploadedSourceAnalysis.summaryLabels.rejected}: {progress.resultSummary.rejectedCount}</span>
            <span>{t.uploadedSourceAnalysis.summaryLabels.reason}: {progress.resultSummary.reason}</span>
          </div>
        ) : null}

        {showFailureActions ? (
          <div className="generation-recovery-actions">
            <button className="secondary-btn" onClick={onReturnToBrief}>
              {t.uploadedSourceAnalysis.returnToBrief}
            </button>
            <button className="primary-btn" onClick={() => void onRetry()}>
              <RotateCw size={14} />
              {t.uploadedSourceAnalysis.retry}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function UploadedSourceAnalysisRecordView(props: {
  t: Messages;
  record: UploadedSourceAnalysisRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const { t, record, open, onToggle } = props;
  const hasLines = record.lines.some((line) => line.trim());
  const hasActivities = record.activities.length > 0;
  const hasSummary = record.summaryLines.length > 0;
  const hasBody = hasLines || hasActivities || hasSummary || Boolean(record.error);

  return (
    <article className={`generation-stage-record ${record.state}`}>
      <button
        className="generation-stage-summary"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? t.generating.stageRecords.collapse : t.generating.stageRecords.expand}
      >
        <span className="generation-stage-title">
          {record.state === "active" ? <Sparkles className="generation-stage-active-icon" size={14} /> : null}
          <strong>
            <ThinkingStatusText
              text={record.label}
              active={record.state === "active"}
              showOrb={false}
            />
          </strong>
        </span>
        <span className="generation-stage-meta">
          <span className={`generation-status-badge ${badgeState(record.state)}`}>{statusLabel(t, record.state)}</span>
          <ChevronDown className="generation-stage-chevron" size={15} />
        </span>
      </button>
      {open ? (
        <div className="generation-stage-body">
          {hasActivities ? (
            <div className="generation-activity-list" aria-label={t.generating.stageRecords.activities}>
              {record.activities.map((activity, index) => (
                <span key={`${record.id}-activity-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {hasLines ? (
            <pre className="generation-stream-text" aria-label={t.generating.stageRecords.stream}>
              {record.lines.join("\n").trim()}
            </pre>
          ) : null}
          {hasSummary ? (
            <div className="research-discovery-line-list">
              {record.summaryLines.map((line, index) => (
                <span key={`${record.id}-summary-${index}`}>{line}</span>
              ))}
            </div>
          ) : null}
          {record.error ? <p className="generation-page-error">{record.error}</p> : null}
          {!hasBody ? (
            <p className="generation-empty-stream">{t.generating.stageRecords.noOutput}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function displayMessage(
  t: Messages,
  progress: UploadedSourceAnalysisProgress,
  viewState: UploadedSourceAnalysisViewState,
) {
  if (viewState.sourceCount === 0) return t.uploadedSourceAnalysis.messages.skipped;
  if (viewState.status === "stale" && progress.status !== "running") return t.uploadedSourceAnalysis.stale;
  return progress.message;
}

function titleForStatus(
  t: Messages,
  status: UploadedSourceAnalysisProgress["status"],
  viewState: UploadedSourceAnalysisViewState,
) {
  if (viewState.sourceCount === 0 || status === "skipped") return t.uploadedSourceAnalysis.skipped;
  if (status === "running") return t.uploadedSourceAnalysis.running;
  if (status === "completed") return t.uploadedSourceAnalysis.completed;
  if (status === "blocked") return t.uploadedSourceAnalysis.blocked;
  if (status === "failed") return t.uploadedSourceAnalysis.failed;
  return t.uploadedSourceAnalysis.title;
}

function recordGroupState(progress: UploadedSourceAnalysisProgress): UploadedSourceAnalysisRecordState {
  if (progress.status === "completed") return "completed";
  if (progress.status === "failed" || progress.status === "blocked") return "failed";
  if (progress.status === "running") return "active";
  if (progress.status === "skipped") return "skipped";
  return "pending";
}

function badgeState(state: UploadedSourceAnalysisRecordState) {
  if (state === "completed") return "completed";
  if (state === "active") return "active";
  if (state === "failed") return "failed";
  return "pending";
}

function statusLabel(t: Messages, state: UploadedSourceAnalysisRecordState) {
  if (state === "completed") return t.generating.stageRecords.completed;
  if (state === "active") return t.generating.stageRecords.running;
  if (state === "failed") return t.generating.stageRecords.failed;
  if (state === "skipped") return t.uploadedSourceAnalysis.skipped;
  return t.generating.stageRecords.pending;
}

function useUploadedSourceAnalysisDisclosure(records: UploadedSourceAnalysisRecord[]) {
  const [openRecords, setOpenRecords] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      records.map((record) => [
        record.id,
        record.state === "active" || record.state === "failed",
      ])
    )
  );
  const userTouchedRef = useRef<Set<string>>(new Set());
  const recordKey = useMemo(
    () => records.map((record) => `${record.id}:${record.state}:${record.updated_at ?? ""}`).join("|"),
    [records],
  );

  useEffect(() => {
    setOpenRecords((current) => {
      const next = { ...current };
      records.forEach((record) => {
        if (userTouchedRef.current.has(record.id)) return;
        if (record.state === "active" || record.state === "failed") {
          next[record.id] = true;
        } else if (next[record.id] === undefined) {
          next[record.id] = false;
        }
      });
      return next;
    });
  }, [recordKey, records]);

  return {
    isOpen(record: UploadedSourceAnalysisRecord) {
      return openRecords[record.id] === true;
    },
    toggle(id: string) {
      userTouchedRef.current.add(id);
      setOpenRecords((current) => ({ ...current, [id]: !current[id] }));
    },
  };
}
