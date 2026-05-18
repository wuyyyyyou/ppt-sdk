import { ChevronDown } from "lucide-react";
import type { OutlineDetail } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { LoadingKind } from "../types";
import { formatSlideNumber } from "../utils";

interface OutlinePageProps {
  t: Messages;
  outline: OutlineDetail[];
  expandedOutline: number | null;
  setExpandedOutline: (index: number | null) => void;
  updateOutlineItem: (index: number, title: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  applyFeedback: () => Promise<void>;
  createDeck: () => Promise<void>;
  loading: LoadingKind;
}

export function OutlinePage(props: OutlinePageProps) {
  const {
    t,
    outline,
    expandedOutline,
    setExpandedOutline,
    updateOutlineItem,
    feedback,
    setFeedback,
    applyFeedback,
    createDeck,
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

      <div className="feedback-box">
        <textarea
          className="prompt-input compact"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t.outline.feedbackPlaceholder}
        />
        <div className="feedback-actions">
          <button className="secondary-btn" onClick={applyFeedback}>
            {t.controls.reviseOutline}
          </button>
          <button
            className="primary-btn"
            onClick={createDeck}
            disabled={loading === "deckFromOutline"}
          >
            {loading === "deckFromOutline" ? <span className="spinner small" /> : null}
            {t.controls.createDeckFromOutline}
          </button>
        </div>
      </div>

      <div className="outline-list-large">
        <div className="timeline-line" />
        {outline.map((item, index) => {
          const expanded = expandedOutline === index;
          return (
            <article key={`${item.title}-${index}`} className="outline-item-large">
              <button
                className="outline-item-head"
                onClick={() => setExpandedOutline(expanded ? null : index)}
              >
                <span className="outline-num">{formatSlideNumber(index)}</span>
                <input
                  value={item.title}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateOutlineItem(index, event.target.value)}
                />
              </button>
              <button
                className="outline-summary"
                onClick={() => setExpandedOutline(expanded ? null : index)}
              >
                <span>{item.summary || t.outline.fallbackSummary}</span>
                <ChevronDown className={expanded ? "rotated" : ""} size={14} />
              </button>
              {expanded && item.bullets.length > 0 ? (
                <ul>
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
