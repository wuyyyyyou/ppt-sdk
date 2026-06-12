import { AlertCircle, CheckCircle2, ChevronDown, Circle, LoaderCircle, Play, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Messages } from "../../../i18n/messages";
import type { DeckGenerationProgress, DeckGenerationStep } from "../../deck-generation";
import { buildPageGenerationStageRecords, type PageGenerationStageRecord, type PageGenerationStageRecordGroup } from "../generationStageRecords";
import { getGenerationProgressDisplayMessage } from "../generationProgressDisplay";
import type { GenerationStreamSnapshot } from "../types";
import type { GenerationViewState } from "../generationViewState";
import { ThinkingStatusText } from "./BriefPage";

interface GeneratingPageProps {
  t: Messages;
  viewState: GenerationViewState;
  progress: DeckGenerationProgress | null;
  history: GenerationStreamSnapshot[];
  onCancel: () => void;
  onBackToOutline: () => void;
  onResume: () => Promise<void>;
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
    steps: ["page-authoring", "page-content-review", "page-render", "page-visual-review", "interrupted", "failed", "cancelled"]
  },
  { id: "final-render", labelKey: "finalRender", steps: ["final-render", "complete"] }
];

function majorStepIndex(step: DeckGenerationStep | null) {
  if (!step) return 0;
  return Math.max(0, majorSteps.findIndex((item) => item.steps.includes(step)));
}

function stepState(
  index: number,
  activeIndex: number,
  progress: DeckGenerationProgress | null,
  viewStatus: GenerationViewState["status"],
) {
  if (viewStatus === "interrupted") {
    return index === activeIndex ? "interrupted" : index < activeIndex ? "done" : "pending";
  }
  if (viewStatus === "unresumable") {
    return index === activeIndex ? "failed" : index < activeIndex ? "done" : "pending";
  }
  if (progress?.step === "interrupted") {
    return index === activeIndex ? "interrupted" : index < activeIndex ? "done" : "pending";
  }
  if (progress?.step === "failed" || progress?.step === "cancelled") {
    return index === activeIndex ? "failed" : index < activeIndex ? "done" : "pending";
  }
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

export function GeneratingPage(props: GeneratingPageProps) {
  const { t, viewState, progress, history, onCancel, onBackToOutline, onResume, canBackToOutline } = props;
  const activeIndex = majorStepIndex(progress?.step ?? null);
  const progressMessage = getGenerationProgressDisplayMessage(t, progress);
  const pageTitle = generationPageTitle(t, viewState.status);

  return (
    <section className="page active generating-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{pageTitle}</div>
          <p><ThinkingStatusText text={progressMessage} active={viewState.status === "running"} /></p>
        </div>
      </div>

      <div className="generation-major-timeline">
        {majorSteps.map((step, index) => {
          const state = stepState(index, activeIndex, progress, viewState.status);
          return (
            <button key={step.id} className={`generation-major-node ${state}`}>
              {state === "done" ? <CheckCircle2 size={15} /> : state === "failed" || state === "interrupted" ? <AlertCircle size={15} /> : state === "active" ? <LoaderCircle className="generation-running-icon" size={15} /> : <Circle size={15} />}
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
          showStop={viewState.showStop}
          canStop={viewState.canStop}
        />
      ) : (
        <div className="generation-progress-panel">
          <strong>{t.status.creatingDeck}</strong>
        </div>
      )}

      {viewState.showResume ? (
        <div className="generation-recovery-actions">
          <button className="primary-btn" onClick={() => void onResume()} disabled={!viewState.canResume}>
            <Play size={14} />
            {t.controls.resumeGeneration}
          </button>
        </div>
      ) : viewState.showBackToOutline ? (
        <div className="generation-recovery-actions">
          <button className="secondary-btn" onClick={onBackToOutline} disabled={!canBackToOutline}>
            {t.stages.outline}
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
  showStop: boolean;
  canStop: boolean;
}) {
  const { t, progress, history, onCancel, showStop, canStop } = props;
  const completed = progress.pages.filter((page) => page.status === "accepted").length;
  const total = progress.totalPages || progress.pages.length || 0;
  const progressMessage = getGenerationProgressDisplayMessage(t, progress);
  const stageGroups = useMemo(
    () => buildPageGenerationStageRecords({ t, progress, history }),
    [t, progress, history],
  );
  const disclosure = useStageDisclosure(stageGroups);
  const running = isProgressRunning(progress);

  return (
    <section className="generation-progress-panel">
      <div className="generation-progress-header">
        <div>
          <div className="section-label">{t.generating.progressTitle}</div>
          <strong><ThinkingStatusText text={progressMessage} active={running} /></strong>
          {running ? (
            <span className="generation-stay-hint">{t.generating.stayOnPageHint}</span>
          ) : null}
          {total > 0 ? (
            <span className="generation-pages-passed">
              {t.generating.pagesPassed
                .replace("{completed}", String(completed))
                .replace("{total}", String(total))}
            </span>
          ) : null}
        </div>
        {showStop ? (
          <button className="secondary-btn compact" onClick={onCancel} disabled={!canStop}>
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
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isProgressRunning(progress: DeckGenerationProgress) {
  return !["complete", "interrupted", "failed", "cancelled"].includes(progress.step);
}

function PageStageRecordGroupView(props: {
  group: PageGenerationStageRecordGroup;
  t: Messages;
  disclosure: ReturnType<typeof useStageDisclosure>;
}) {
  const { group, t, disclosure } = props;
  const badgeState = statusBadgeState(group.state);

  return (
    <article className={`generation-page-item generation-stage-page ${group.state} ${group.pageStatus}`}>
      <div className="generation-page-item-header">
        <div>
          <strong>{group.pageIndex + 1}. {group.title}</strong>
        </div>
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
  const displayActivities = stage.activities
    .map((activity) => sanitizeGenerationDebugText(activity))
    .filter((activity) => activity.length > 0);
  const displayLines = stage.lines
    .map((line) => sanitizeGenerationDebugText(line))
    .filter((line) => line.length > 0);
  const hasLines = displayLines.some((line) => line.trim());
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
          {displayActivities.length > 0 ? (
            <div className="generation-activity-list" aria-label={t.generating.stageRecords.activities}>
              {displayActivities.map((activity, index) => (
                <span key={`${stage.id}-activity-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {hasLines ? (
            <pre className="generation-stream-text" aria-label={t.generating.stageRecords.stream}>
              {displayLines.join("\n").trim()}
            </pre>
          ) : null}
          {!hasLines && displayActivities.length === 0 ? (
            <p className="generation-empty-stream">{stage.lastError ?? t.generating.stageRecords.noOutput}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function generationPageTitle(t: Messages, status: GenerationViewState["status"]) {
  switch (status) {
    case "running":
      return t.stages.generating;
    case "stopping":
      return t.generating.stoppingTitle;
    case "interrupted":
      return t.generating.interruptedTitle;
    case "unresumable":
      return t.generating.unresumableTitle;
    case "complete":
      return t.generating.generationComplete;
  }
}

function sanitizeGenerationDebugText(text: string) {
  return text
    .replace(/["']?\b(?:template|layout|blueprint|component|page)[_-]?id["']?\s*[:=]\s*["']?[a-z0-9:_-]+["']?,?/gi, "")
    .replace(/\b(?:template|layout|blueprint|component):[a-z0-9_-]+\b/gi, "")
    .replace(/\btemplate:[a-z0-9_-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
