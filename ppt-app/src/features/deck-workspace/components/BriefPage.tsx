import { AlertTriangle, Check, HelpCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Messages } from "../../../i18n/messages";
import {
  isStrictReviewModeEnabled,
  type PageReviewSettings,
} from "../reviewSettings";
import type { LoadingKind } from "../types";

export interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  loading: LoadingKind;
  pageReviewSettings: PageReviewSettings;
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  workspaceSettingsSaving: boolean;
  generateDeck: () => Promise<void>;
}

export function BriefPage({
  t,
  prompt,
  setPrompt,
  loading,
  pageReviewSettings,
  setStrictReviewMode,
  workspaceSettingsSaving,
  generateDeck,
}: BriefPageProps) {
  const busy = loading !== "none";
  const strictReviewMode = isStrictReviewModeEnabled(pageReviewSettings);
  const [strictReviewConfirmOpen, setStrictReviewConfirmOpen] = useState(false);

  function toggleStrictReviewMode() {
    if (strictReviewMode) {
      void setStrictReviewMode(false);
      return;
    }

    setStrictReviewConfirmOpen(true);
  }

  function confirmStrictReviewMode() {
    setStrictReviewConfirmOpen(false);
    void setStrictReviewMode(true);
  }

  return (
    <section className="page active brief-page">
      <h1 className="prompt-label">{t.brief.title}</h1>
      <div className="prompt-input-wrapper">
        <textarea
          className="prompt-input"
          id="deck-brief-prompt"
          name="deck-brief-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t.brief.placeholder}
          disabled={busy}
        />
        <div className="prompt-inline-actions">
          <button
            className="inline-create-btn"
            disabled={busy || workspaceSettingsSaving || !prompt.trim()}
            onClick={() => void generateDeck()}
          >
            {busy ? <span className="spinner small" /> : <Sparkles size={14} />}
            {t.controls.createDeck}
          </button>
        </div>
      </div>

      <div className="brief-toggle-columns">
        <div className="brief-toggle-column">
          <div className="checkbox-row-with-help">
            <button
              type="button"
              className={`checkbox-row ${strictReviewMode ? "active" : ""}`}
              onClick={toggleStrictReviewMode}
              aria-checked={strictReviewMode}
              role="switch"
              disabled={busy || workspaceSettingsSaving}
            >
              <span className="checkbox-custom">
                {strictReviewMode ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              <span>{t.brief.strictReviewMode}</span>
            </button>
            <span
              className="help-tooltip"
              tabIndex={0}
              aria-label={t.brief.strictReviewModeHelp}
            >
              <HelpCircle size={15} />
              <span className="help-tooltip-content">
                {t.brief.strictReviewModeHelp}
              </span>
            </span>
          </div>
        </div>
      </div>

      {strictReviewConfirmOpen ? (
        <div
          className="strict-review-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="strict-review-confirm-title"
          onClick={() => setStrictReviewConfirmOpen(false)}
        >
          <section
            className="strict-review-confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="strict-review-confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <div className="strict-review-confirm-copy">
              <h2 id="strict-review-confirm-title">
                {t.brief.strictReviewConfirmTitle}
              </h2>
              <p>{t.brief.strictReviewConfirmBody}</p>
            </div>
            <footer className="strict-review-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setStrictReviewConfirmOpen(false)}
              >
                {t.controls.cancel}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={confirmStrictReviewMode}
              >
                {t.brief.strictReviewConfirmAction}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function ThinkingStatusText({ text, active = false, showOrb = false }: { text: string; active?: boolean; showOrb?: boolean }) {
  return <span className={`thinking-status-text ${active ? "active" : ""}`}>{showOrb ? <i /> : null}{text}</span>;
}
