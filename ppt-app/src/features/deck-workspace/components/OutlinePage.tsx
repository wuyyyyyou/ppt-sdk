import { CheckCircle2, Sparkles } from "lucide-react";
import type { OutlineDetail } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { DeckGenerationProgress } from "../../deck-generation";
import type { LoadingKind } from "../types";
import { formatSlideNumber } from "../utils";
import { GenerationProgressPanel } from "./BriefPage";

interface OutlinePageProps {
  t: Messages;
  outline: OutlineDetail[];
  outlineDraft: OutlineDetail[];
  outlineEditMode: boolean;
  beginOutlineEdit: () => void;
  cancelOutlineEdit: () => void;
  saveOutlineEdit: () => Promise<void>;
  updateOutlineDraftItem: (index: number, patch: Partial<OutlineDetail>) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  applyFeedback: () => Promise<void>;
  createDeck: () => Promise<void>;
  cancelGenerateDeck: () => void;
  createDeckProgress: DeckGenerationProgress | null;
  loading: LoadingKind;
}

export function OutlinePage(props: OutlinePageProps) {
  const {
    t,
    outline,
    outlineDraft,
    outlineEditMode,
    beginOutlineEdit,
    cancelOutlineEdit,
    saveOutlineEdit,
    updateOutlineDraftItem,
    feedback,
    setFeedback,
    applyFeedback,
    createDeck,
    cancelGenerateDeck,
    createDeckProgress,
    loading
  } = props;
  const activeOutline = outlineEditMode ? outlineDraft : outline;
  const generating = loading === "deck" || loading === "deckFromOutline";

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
            disabled={generating}
          />
          <div className="feedback-actions">
            <button className="primary-btn" onClick={applyFeedback} disabled={loading === "outline" || generating}>
              {loading === "outline" ? <span className="spinner small" /> : <Sparkles size={14} />}
              {t.controls.reviseOutline}
            </button>
          </div>
        </div>
      </div>

      {createDeckProgress ? (
        <GenerationProgressPanel
          t={t}
          progress={createDeckProgress}
          onCancel={cancelGenerateDeck}
          cancellable={loading === "deck" && createDeckProgress.step !== "cancelled"}
        />
      ) : null}

      <section className="outline-card">
        <div className="outline-card-header">
          <div>
            <div className="section-label">{t.outline.cardTitle}</div>
            <p>{outlineEditMode ? t.outline.helper : t.outline.readOnlyHint}</p>
          </div>
          {!outlineEditMode ? (
            <button className="secondary-btn compact" onClick={beginOutlineEdit} disabled={generating}>
              {t.outline.editOutline}
            </button>
          ) : null}
        </div>
        <div className="outline-list-large">
          <div className="timeline-line" />
          {activeOutline.map((item, index) => (
            <article key={`outline-item-${index}`} className="outline-item-large">
              <div className="outline-item-head">
                <span className="outline-num">{formatSlideNumber(index)}</span>
                {outlineEditMode ? (
                  <input
                    value={item.title}
                    disabled={generating}
                    onChange={(event) =>
                      updateOutlineDraftItem(index, { title: event.target.value })
                    }
                  />
                ) : (
                  <strong>{item.title}</strong>
                )}
              </div>
              {outlineEditMode ? (
                <textarea
                  className="outline-body-input"
                  value={item.outline}
                  disabled={generating}
                  onChange={(event) =>
                    updateOutlineDraftItem(index, { outline: event.target.value })
                  }
                  placeholder={t.outline.fallbackSummary}
                />
              ) : (
                <p className="outline-body-readonly">{item.outline || t.outline.fallbackSummary}</p>
              )}
            </article>
          ))}
        </div>
        <div className="outline-card-footer">
          {outlineEditMode ? (
            <>
              <button className="secondary-btn" onClick={cancelOutlineEdit} disabled={generating}>
                {t.outline.cancelChanges}
              </button>
              <button className="primary-btn" onClick={saveOutlineEdit} disabled={generating}>
                {t.outline.saveChanges}
              </button>
            </>
          ) : (
            <button
              className="primary-btn confirm-outline-btn"
              onClick={createDeck}
              disabled={loading === "deck" || loading === "outline"}
            >
              {loading === "deck" ? <span className="spinner small" /> : <CheckCircle2 size={14} />}
              {t.controls.confirmOutline}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
