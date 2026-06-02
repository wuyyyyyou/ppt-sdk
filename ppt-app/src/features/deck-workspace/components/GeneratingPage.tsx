import { AlertCircle, CheckCircle2, ChevronDown, Circle, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Messages } from "../../../i18n/messages";
import type { DeckGenerationProgress, DeckGenerationStep } from "../../deck-generation";
import { buildPageGenerationStageRecords, type PageGenerationStageRecord, type PageGenerationStageRecordGroup } from "../generationStageRecords";
import { getGenerationProgressDisplayMessage } from "../generationProgressDisplay";
import type { GenerationStreamSnapshot, LoadingKind } from "../types";
import { ThinkingStatusText } from "./BriefPage";

interface GeneratingPageProps {
  t: Messages;
  loading: LoadingKind;
  progress: DeckGenerationProgress | null;
  history: GenerationStreamSnapshot[];
  onCancel: () => void;
  onBackToOutline: () => void;
  onRegenerate: () => Promise<void>;
  onRetryPage: (pageId: string) => Promise<void>;
  canBackToOutline: boolean;
}

const majorSteps: Array<{
  id: string;
  labelKey: keyof Messages["generating"]["steps"];
  steps: DeckGenerationStep[];
}> = [
  { id: "page-plan", labelKey: "pagePlan", steps: ["page-plan"] },
  { id: "prepare", labelKey: "prepare", steps: ["prepare"] },
  {
    id: "pages",
    labelKey: "pages",
    steps: ["page-authoring", "page-render", "page-review", "failed", "cancelled"]
  },
  { id: "final-render", labelKey: "finalRender", steps: ["final-render", "complete"] }
];

function majorStepIndex(step: DeckGenerationStep | null) {
  if (!step) return 0;
  return Math.max(0, majorSteps.findIndex((item) => item.steps.includes(step)));
}

function stepState(index: number, activeIndex: number, progress: DeckGenerationProgress | null) {
  if (progress?.step === "failed" || progress?.step === "cancelled") {
    return index === activeIndex ? "failed" : index < activeIndex ? "done" : "pending";
  }
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

export function GeneratingPage(props: GeneratingPageProps) {
  const { t, loading, progress, history, onCancel, onBackToOutline, onRegenerate, onRetryPage, canBackToOutline } = props;
  const activeIndex = majorStepIndex(progress?.step ?? null);
  const failed = progress?.step === "failed" || progress?.step === "cancelled";
  const running = loading === "deck" || loading === "deckFromOutline";
  const progressMessage = getGenerationProgressDisplayMessage(t, progress);

  return (
    <section className="page active generating-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{t.stages.generating}</div>
          <p><ThinkingStatusText text={progressMessage} active={progress ? isProgressRunning(progress) : running} /></p>
        </div>
      </div>

      <div className="generation-major-timeline">
        {majorSteps.map((step, index) => {
          const state = stepState(index, activeIndex, progress);
          return (
            <button key={step.id} className={`generation-major-node ${state}`}>
              {state === "done" ? <CheckCircle2 size={15} /> : state === "failed" ? <AlertCircle size={15} /> : state === "active" ? <LoaderCircle className="generation-running-icon" size={15} /> : <Circle size={15} />}
              <span>{t.generating.steps[step.labelKey]}</span>
            </button>
          );
        })}
      </div>

      {progress ? (
        <GenerationProgressPanel
          t={t}
          progress={progress}
          history={history}
          onCancel={onCancel}
          cancellable={running && progress.step !== "cancelled"}
          onRetryPage={onRetryPage}
          retryDisabled={running}
        />
      ) : (
        <div className="generation-progress-panel">
          <strong>{t.status.creatingDeck}</strong>
        </div>
      )}

      {failed ? (
        <div className="generation-recovery-actions">
          <button className="secondary-btn" onClick={onBackToOutline} disabled={!canBackToOutline}>
            {t.stages.outline}
          </button>
          <button className="primary-btn" onClick={onRegenerate}>
            <RotateCcw size={14} />
            {t.controls.createDeck}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function GenerationProgressPanel(props: {
  t: Messages;
  progress: DeckGenerationProgress;
  history: GenerationStreamSnapshot[];
  onCancel: () => void;
  cancellable: boolean;
  onRetryPage?: (pageId: string) => Promise<void>;
  retryDisabled?: boolean;
}) {
  const { t, progress, history, onCancel, cancellable, onRetryPage, retryDisabled = false } = props;
  const completed = progress.pages.filter((page) => page.status === "accepted").length;
  const total = progress.totalPages || progress.pages.length || 0;
  const progressMessage = getGenerationProgressDisplayMessage(t, progress);
  const stageGroups = useMemo(
    () => buildPageGenerationStageRecords({ t, progress, history }),
    [t, progress, history],
  );
  const disclosure = useStageDisclosure(stageGroups);

  return (
    <section className="generation-progress-panel">
      <div className="generation-progress-header">
        <div>
          <div className="section-label">{t.generating.progressTitle}</div>
          <strong><ThinkingStatusText text={progressMessage} active={isProgressRunning(progress)} /></strong>
          {total > 0 ? (
            <span className="generation-pages-passed">
              {t.generating.pagesPassed
                .replace("{completed}", String(completed))
                .replace("{total}", String(total))}
            </span>
          ) : null}
        </div>
        {cancellable ? (
          <button className="secondary-btn compact" onClick={onCancel}>
            {t.controls.stop}
          </button>
        ) : null}
      </div>
      {stageGroups.length > 0 ? (
        <div className="generation-page-list generation-stage-record-list">
          {stageGroups.map((group) => (
            <PageStageRecordGroupView
              key={group.pageId}
              group={group}
              t={t}
              disclosure={disclosure}
              onRetryPage={onRetryPage}
              retryDisabled={retryDisabled}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isProgressRunning(progress: DeckGenerationProgress) {
  return !["complete", "failed", "cancelled"].includes(progress.step);
}

function PageStageRecordGroupView(props: {
  group: PageGenerationStageRecordGroup;
  t: Messages;
  disclosure: ReturnType<typeof useStageDisclosure>;
  onRetryPage?: (pageId: string) => Promise<void>;
  retryDisabled: boolean;
}) {
  const { group, t, disclosure, onRetryPage, retryDisabled } = props;
  const canRetry = Boolean(onRetryPage) && !retryDisabled && ["render_failed", "agent_failed", "needs_user_review"].includes(group.pageStatus);
  const badgeState = statusBadgeState(group.state);

  return (
    <article className={`generation-page-item generation-stage-page ${group.state} ${group.pageStatus}`}>
      <div className="generation-page-item-header">
        <div>
          <strong>{group.pageIndex + 1}. {group.title}</strong>
        </div>
        {canRetry ? (
          <button className="secondary-btn compact" onClick={() => void onRetryPage?.(group.pageId)}>
            {t.controls.retryPage}
          </button>
        ) : null}
        <span className={`generation-status-badge ${badgeState}`}>{group.pageStatusLabel}</span>
      </div>
      {group.lastError ? <p className="generation-page-error">{group.lastError}</p> : null}
      <div className="generation-page-stage-list">
        {group.stages.map((stage) => (
          <PageStageRecordView
            key={stage.id}
            stage={stage}
            t={t}
            open={disclosure.isOpen(stage)}
            onToggle={() => disclosure.toggle(stage.id)}
          />
        ))}
      </div>
    </article>
  );
}

function PageStageRecordView(props: {
  stage: PageGenerationStageRecord;
  t: Messages;
  open: boolean;
  onToggle: () => void;
}) {
  const { stage, t, open, onToggle } = props;
  const hasLines = stage.lines.some((line) => line.trim());
  const badgeState = statusBadgeState(stage.state);

  return (
    <article className={`generation-stage-record ${stage.state}`}>
      <button
        className="generation-stage-summary"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? t.generating.stageRecords.collapse : t.generating.stageRecords.expand}
      >
        <span className="generation-stage-title">
          {stage.state === "active" ? <Sparkles className="generation-stage-active-icon" size={14} /> : null}
          <strong>
            <ThinkingStatusText
              text={stage.label}
              active={stage.state === "active"}
              showOrb={false}
            />
          </strong>
        </span>
        <span className="generation-stage-meta">
          <span className={`generation-status-badge ${badgeState}`}>{stage.statusLabel}</span>
          <ChevronDown className="generation-stage-chevron" size={15} />
        </span>
      </button>
      {open ? (
        <div className="generation-stage-body">
          {stage.activities.length > 0 ? (
            <div className="generation-activity-list" aria-label={t.generating.stageRecords.activities}>
              {stage.activities.map((activity, index) => (
                <span key={`${stage.id}-activity-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {hasLines ? (
            <pre className="generation-stream-text" aria-label={t.generating.stageRecords.stream}>
              {stage.lines.join("\n").trim()}
            </pre>
          ) : null}
          {!hasLines && stage.activities.length === 0 ? (
            <p className="generation-empty-stream">{stage.lastError ?? t.generating.stageRecords.noOutput}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function statusBadgeState(state: PageGenerationStageRecord["state"]) {
  if (state === "completed") return "completed";
  if (state === "active") return "active";
  if (state === "failed") return "failed";
  return "pending";
}

function useStageDisclosure(groups: PageGenerationStageRecordGroup[]) {
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  const userTouchedRef = useRef<Set<string>>(new Set());
  const collapseTimersRef = useRef<Map<string, number>>(new Map());
  const stages = useMemo(() => groups.flatMap((group) => group.stages), [groups]);

  useEffect(() => {
    setOpenStages((current) => {
      const next = { ...current };
      stages.forEach((stage) => {
        if (userTouchedRef.current.has(stage.id)) return;
        if (stage.state === "active" || stage.state === "failed") {
          next[stage.id] = true;
        } else if (stage.state === "pending" && next[stage.id] === undefined) {
          next[stage.id] = false;
        }
      });
      return next;
    });

    const stageIds = new Set(stages.map((stage) => stage.id));
    for (const [stageId, timer] of collapseTimersRef.current.entries()) {
      if (!stageIds.has(stageId)) {
        window.clearTimeout(timer);
        collapseTimersRef.current.delete(stageId);
      }
    }

    stages.forEach((stage) => {
      if (
        stage.state !== "completed" ||
        userTouchedRef.current.has(stage.id) ||
        collapseTimersRef.current.has(stage.id)
      ) {
        return;
      }
      const timer = window.setTimeout(() => {
        collapseTimersRef.current.delete(stage.id);
        if (userTouchedRef.current.has(stage.id)) return;
        setOpenStages((current) => ({ ...current, [stage.id]: false }));
      }, 1200);
      collapseTimersRef.current.set(stage.id, timer);
    });
  }, [stages]);

  useEffect(() => () => {
    for (const timer of collapseTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    collapseTimersRef.current.clear();
  }, []);

  return {
    isOpen(stage: PageGenerationStageRecord) {
      return openStages[stage.id] ?? (stage.state === "active" || stage.state === "failed");
    },
    toggle(stageId: string) {
      userTouchedRef.current.add(stageId);
      setOpenStages((current) => ({ ...current, [stageId]: !(current[stageId] ?? false) }));
    },
  };
}
