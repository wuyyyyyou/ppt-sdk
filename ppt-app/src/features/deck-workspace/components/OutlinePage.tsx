import { AlertTriangle, CheckCircle2, ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import type { OutlineDetail } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { LoadingKind, UploadedSourceAnalysisViewState } from "../types";
import { formatSlideNumber } from "../utils";
import { DEFAULT_OUTPUT_LANGUAGE_OPTIONS } from "../../../ai/outputLanguage";

interface OutlinePageProps {
  t: Messages;
  outline: OutlineDetail[];
  outlineDraft: OutlineDetail[];
  outputLanguage: string;
  outputLanguageDraft: string;
  outlineEditMode: boolean;
  beginOutlineEdit: () => void;
  cancelOutlineEdit: () => void;
  saveOutlineEdit: () => Promise<void>;
  updateOutlineDraftItem: (index: number, patch: Partial<OutlineDetail>) => void;
  setOutputLanguageDraft: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  applyFeedback: () => Promise<void>;
  createDeck: () => Promise<void>;
  loading: LoadingKind;
  uploadedSourceAnalysisState: UploadedSourceAnalysisViewState;
}

export function OutlinePage(props: OutlinePageProps) {
  const {
    t,
    outline,
    outlineDraft,
    outputLanguage,
    outputLanguageDraft,
    outlineEditMode,
    beginOutlineEdit,
    cancelOutlineEdit,
    saveOutlineEdit,
    updateOutlineDraftItem,
    setOutputLanguageDraft,
    feedback,
    setFeedback,
    applyFeedback,
    createDeck,
    loading,
    uploadedSourceAnalysisState,
  } = props;
  const activeOutline = outlineEditMode ? outlineDraft : outline;
  const languageOptions = DEFAULT_OUTPUT_LANGUAGE_OPTIONS.includes(
    outputLanguageDraft as (typeof DEFAULT_OUTPUT_LANGUAGE_OPTIONS)[number]
  )
    ? [...DEFAULT_OUTPUT_LANGUAGE_OPTIONS]
    : [...DEFAULT_OUTPUT_LANGUAGE_OPTIONS, outputLanguageDraft];
  const analyzingUploadedSources = loading === "uploadedSourceAnalysis";
  const generating = loading === "deck" || loading === "deckFromOutline" || analyzingUploadedSources;

  return (
    <section className="page active outline-page">
      <div className="page-header compact">
        <div>
          <div className="page-title">{t.outline.title}</div>
          <p>{t.outline.helper}</p>
        </div>
      </div>

      <div className="outline-review-controls">
        {uploadedSourceAnalysisState.status === "stale" ? (
          <div className="uploaded-source-outline-warning">
            <AlertTriangle size={14} />
            <span>{t.brief.uploadedSourceStatus.stale}</span>
          </div>
        ) : null}
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
              {loading === "outline" || analyzingUploadedSources ? <span className="spinner small" /> : <Sparkles size={14} />}
              {t.controls.reviseOutline}
            </button>
          </div>
        </div>
      </div>

      <section className="outline-card">
        <div className="outline-card-header">
          <div>
            <div className="section-label">{t.outline.cardTitle}</div>
            <p>{outlineEditMode ? t.outline.helper : t.outline.readOnlyHint}</p>
          </div>
          <div className="outline-card-actions">
            <label className="outline-language-field">
              <span>{t.brief.contextLabels.outputLanguage}</span>
              {outlineEditMode ? (
                <span className="outline-language-select-wrap">
                  <select
                    value={outputLanguageDraft}
                    onChange={(event) => setOutputLanguageDraft(event.target.value)}
                    disabled={generating}
                  >
                    {languageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </span>
              ) : (
                <strong>{outputLanguage || "auto"}</strong>
              )}
            </label>
            {!outlineEditMode ? (
              <button className="secondary-btn compact" onClick={beginOutlineEdit} disabled={generating}>
                {t.outline.editOutline}
              </button>
            ) : null}
          </div>
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
              disabled={loading === "deck" || loading === "outline" || analyzingUploadedSources}
            >
              {analyzingUploadedSources ? <LoaderCircle className="generation-running-icon" size={14} /> : loading === "deck" ? <span className="spinner small" /> : <CheckCircle2 size={14} />}
              {t.controls.confirmOutline}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
