import { AlertCircle, CheckCircle2, ChevronDown, Circle, RotateCcw } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { DeckGenerationProgress, DeckGenerationStep } from "../../deck-generation";
import type { GenerationStreamSnapshot, LoadingKind } from "../types";
import { GenerationProgressPanel } from "./BriefPage";

interface GeneratingPageProps {
  t: Messages;
  loading: LoadingKind;
  progress: DeckGenerationProgress | null;
  history: GenerationStreamSnapshot[];
  onCancel: () => void;
  onBackToOutline: () => void;
  onRegenerate: () => Promise<void>;
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

function snapshotsForStep(stepId: string, history: GenerationStreamSnapshot[]) {
  if (stepId === "pages") {
    return history.filter((item) => ["page-authoring", "page-render", "page-review", "failed", "cancelled"].includes(item.phase));
  }
  const step = majorSteps.find((item) => item.id === stepId);
  if (!step) return [];
  return history.filter((item) => step.steps.includes(item.phase as DeckGenerationStep));
}

export function GeneratingPage(props: GeneratingPageProps) {
  const { t, loading, progress, history, onCancel, onBackToOutline, onRegenerate, canBackToOutline } = props;
  const activeIndex = majorStepIndex(progress?.step ?? null);
  const activeStep = majorSteps[activeIndex] ?? majorSteps[0];
  const activeSnapshots = snapshotsForStep(activeStep.id, history);
  const failed = progress?.step === "failed" || progress?.step === "cancelled";
  const running = loading === "deck" || loading === "deckFromOutline";

  return (
    <section className="page active generating-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{t.stages.generating}</div>
          <p>{progress?.message ?? t.status.creatingDeck}</p>
        </div>
      </div>

      <div className="generation-major-timeline">
        {majorSteps.map((step, index) => {
          const state = stepState(index, activeIndex, progress);
          return (
            <button key={step.id} className={`generation-major-node ${state}`}>
              {state === "done" ? <CheckCircle2 size={15} /> : state === "failed" ? <AlertCircle size={15} /> : <Circle size={15} />}
              <span>{t.generating.steps[step.labelKey]}</span>
            </button>
          );
        })}
      </div>

      {progress ? (
        <GenerationProgressPanel
          t={t}
          progress={progress}
          onCancel={onCancel}
          cancellable={running && progress.step !== "cancelled"}
        />
      ) : (
        <div className="generation-progress-panel">
          <strong>{t.status.creatingDeck}</strong>
        </div>
      )}

      <section className="generation-history-panel">
        <div className="generation-history-header">
          <div>
            <div className="section-label">{t.generating.steps[activeStep.labelKey]}</div>
            <strong>{activeSnapshots.length > 0 ? t.generating.currentSessionStream : t.generating.waitingForStep}</strong>
          </div>
          <ChevronDown size={16} />
        </div>
        {activeStep.id === "pages" && progress?.pages.length ? (
          <div className="generation-page-timeline">
            {progress.pages.map((page) => {
              const pageSnapshots = history.filter((item) => item.page_id === page.page_id);
              return (
                <details key={page.page_id} className={`generation-page-detail ${page.status}`} open={page.index === progress.currentPageIndex}>
                  <summary>
                    <strong>{page.index + 1}. {page.title}</strong>
                    <span>{page.status}</span>
                  </summary>
                  {pageSnapshots.length > 0 ? <SnapshotList snapshots={pageSnapshots} /> : <p>{t.generating.noStream}</p>}
                </details>
              );
            })}
          </div>
        ) : activeSnapshots.length > 0 ? (
          <SnapshotList snapshots={activeSnapshots} />
        ) : (
          <p className="generation-empty-stream">{t.generating.streamHint}</p>
        )}
      </section>

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

function SnapshotList({ snapshots }: { snapshots: GenerationStreamSnapshot[] }) {
  return (
    <div className="generation-snapshot-list">
      {snapshots.map((snapshot) => (
        <article key={snapshot.id} className="generation-snapshot">
          <div>
            <strong>{snapshot.label}</strong>
            <span>{snapshot.status}</span>
          </div>
          {snapshot.activities.length > 0 ? (
            <div className="generation-activity-list">
              {snapshot.activities.map((activity, index) => (
                <span key={`${snapshot.id}-activity-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {snapshot.lines.some((line) => line.trim()) ? (
            <pre className="generation-stream-text">{snapshot.lines.join("\n").trim()}</pre>
          ) : null}
        </article>
      ))}
    </div>
  );
}
