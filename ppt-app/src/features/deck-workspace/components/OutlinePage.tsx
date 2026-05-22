import { CheckCircle2, Sparkles } from "lucide-react";
import type { OutlineDetail } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { CreateDeckFlowProgress } from "../orchestration/createDeckFlow";
import type { LoadingKind } from "../types";
import { formatSlideNumber } from "../utils";
import { GenerationProgressPanel } from "./BriefPage";

interface OutlinePageProps {
  t: Messages;
  outline: OutlineDetail[];
  updateOutlineItem: (index: number, patch: Partial<OutlineDetail>) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  applyFeedback: () => Promise<void>;
  createDeck: () => Promise<void>;
  cancelGenerateDeck: () => void;
  createDeckProgress: CreateDeckFlowProgress | null;
  loading: LoadingKind;
}

export function OutlinePage(props: OutlinePageProps) {
  const {
    t,
    outline,
    updateOutlineItem,
    feedback,
    setFeedback,
    applyFeedback,
    createDeck,
    cancelGenerateDeck,
    createDeckProgress,
    loading
  } = props;

  return (
    <section className="page active outline-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{t.outline.title}</div>
          <p>{t.outline.helper}</p>
        </div>
      </div>

      <div className="outline-review-controls">
        <div className="feedback-box">
          <textarea
            className="prompt-input compact"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t.outline.feedbackPlaceholder}
          />
          <div className="feedback-actions">
            <button className="primary-btn" onClick={applyFeedback} disabled={loading === "outline"}>
              {loading === "outline" ? <span className="spinner small" /> : <Sparkles size={14} />}
              {t.controls.reviseOutline}
            </button>
          </div>
        </div>
        <button
          className="primary-btn confirm-outline-btn"
          onClick={createDeck}
          disabled={loading === "deck" || loading === "outline"}
        >
          {loading === "deck" ? <span className="spinner small" /> : <CheckCircle2 size={14} />}
          {t.controls.confirmOutline}
        </button>
      </div>

      {createDeckProgress ? (
        <GenerationProgressPanel
          progress={createDeckProgress}
          onCancel={cancelGenerateDeck}
          cancellable={loading === "deck" && createDeckProgress.phase !== "cancelled"}
        />
      ) : null}

      <div className="outline-list-large">
        <div className="timeline-line" />
        {outline.map((item, index) => (
          <article key={`outline-item-${index}`} className="outline-item-large">
            <div className="outline-item-head">
              <span className="outline-num">{formatSlideNumber(index)}</span>
              <input
                value={item.title}
                onChange={(event) =>
                  updateOutlineItem(index, { title: event.target.value })
                }
              />
            </div>
            <textarea
              className="outline-body-input"
              value={item.outline}
              onChange={(event) =>
                updateOutlineItem(index, { outline: event.target.value })
              }
              placeholder={t.outline.fallbackSummary}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
