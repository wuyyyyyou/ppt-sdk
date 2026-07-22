import { AlertTriangle, Check, ChevronLeft, ChevronRight, HelpCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { Messages } from "../../../i18n/messages";
import type { VisualStylePreset } from "../../../api/types";
import {
  VISUAL_STYLE_PRESET_FILTER_OPTIONS,
  VISUAL_STYLE_PRESETS,
} from "../../templates/visualStylePresets";
import {
  matchesVisualStylePresetFilters,
  VISUAL_STYLE_PRESET_FILTER_FIELDS,
  type VisualStylePresetFilters,
} from "../../templates/visualStylePresetFilters";
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
  selectedVisualStylePresetId: string | null;
  onSelectVisualStylePreset: (presetId: string | null) => void;
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
  selectedVisualStylePresetId,
  onSelectVisualStylePreset,
}: BriefPageProps) {
  const busy = loading !== "none";
  const strictReviewMode = isStrictReviewModeEnabled(pageReviewSettings);
  const [strictReviewConfirmOpen, setStrictReviewConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<{ preset: VisualStylePreset; index: number } | null>(null);
  const [presetFilters, setPresetFilters] = useState<VisualStylePresetFilters>({
    user: "",
    use_case: "",
    industry: "",
    theme: "",
    color: "",
  });
  const filteredPresets = VISUAL_STYLE_PRESETS.filter((preset) => matchesVisualStylePresetFilters(preset, presetFilters));

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

      <section className="brief-style-presets" aria-labelledby="brief-style-presets-title">
        <div className="brief-style-presets-heading">
          <div>
            <h2 id="brief-style-presets-title">{t.template.title}</h2>
            <p>{t.template.helper}</p>
          </div>
          <span className="brief-style-presets-note">{selectedVisualStylePresetId ? t.template.selected : t.template.noneSelected}</span>
        </div>
        <div className="brief-style-preset-filters" aria-label={t.template.filtersLabel}>
          {VISUAL_STYLE_PRESET_FILTER_FIELDS.map((field) => (
            <label className={`brief-style-preset-filter ${presetFilters[field] ? "active" : ""}`} key={field}>
              <span>{t.template.filters[field]}</span>
              <select
                value={presetFilters[field]}
                disabled={busy}
                onChange={(event) => setPresetFilters((current) => ({ ...current, [field]: event.target.value }))}
              >
                <option value="">{t.template.all}</option>
                {VISUAL_STYLE_PRESET_FILTER_OPTIONS[field].map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="brief-style-preset-grid">
          <button
            type="button"
            className={`brief-style-preset-card brief-style-preset-none-card ${!selectedVisualStylePresetId ? "active" : ""}`}
            disabled={busy}
            onClick={() => onSelectVisualStylePreset(null)}
          >
            <span className="brief-style-preset-none-mark" aria-hidden="true">
              <svg viewBox="0 0 640 360" role="presentation">
                <rect x="80" y="62" width="480" height="236" rx="10" fill="#f8f9fb" stroke="#d8dce5" />
                <rect x="112" y="96" width="184" height="12" rx="6" fill="#d9dde7" />
                <rect x="112" y="126" width="276" height="8" rx="4" fill="#e4e7ee" />
                <rect x="112" y="184" width="124" height="64" rx="8" fill="#eef0f5" />
                <rect x="252" y="184" width="124" height="64" rx="8" fill="#f1f3f7" />
                <rect x="392" y="184" width="124" height="64" rx="8" fill="#ebeef4" />
                <path d="M112 278H516" stroke="#e0e3ea" strokeLinecap="round" />
                <circle cx="510" cy="112" r="8" fill="#c9ceda" />
              </svg>
              {!selectedVisualStylePresetId ? (
                <span className="brief-style-preset-none-selection"><Check size={15} /></span>
              ) : null}
            </span>
            <strong>{t.template.none}</strong>
            <small>{t.template.noneDescription}</small>
          </button>
          {filteredPresets.map((preset: VisualStylePreset) => {
            const selected = selectedVisualStylePresetId === preset.id;
            return (
              <button
                type="button"
                className={`brief-style-preset-card ${selected ? "active" : ""}`}
                key={preset.id}
                disabled={busy}
                onClick={() => onSelectVisualStylePreset(preset.id)}
              >
                <span
                  className="brief-style-preset-image-wrap"
                  role="button"
                  tabIndex={0}
                  aria-label={t.template.previewTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreview({ preset, index: 0 });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      setPreview({ preset, index: 0 });
                    }
                  }}
                >
                  <img src={preset.preview_images[0]?.url} alt={preset.preview_images[0]?.alt ?? preset.name} />
                  {selected ? <span className="brief-style-preset-selected"><Check size={14} /></span> : null}
                </span>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            );
          })}
          {filteredPresets.length === 0 ? (
            <p className="brief-style-preset-empty">{t.template.noFilterMatches}</p>
          ) : null}
        </div>
      </section>

      {preview ? (
        <div className="template-preview-modal" role="dialog" aria-modal="true" aria-label={preview.preset.name} onClick={() => setPreview(null)}>
          <section className="template-preview-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="template-preview-modal-header">
              <div className="template-preview-modal-title"><h2>{preview.preset.name}</h2><span>{preview.preset.description}</span></div>
              <button type="button" className="template-preview-modal-close" aria-label={t.template.close} onClick={() => setPreview(null)}><X size={17} /></button>
            </header>
            <div className="template-preview-modal-stage">
              <button type="button" className="template-preview-modal-nav" aria-label={t.template.previous} disabled={preview.index === 0} onClick={() => setPreview((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}><ChevronLeft size={18} /></button>
              <div className="template-preview-modal-frame"><img src={preview.preset.preview_images[preview.index]?.url} alt={preview.preset.preview_images[preview.index]?.alt ?? preview.preset.name} /><span className="template-preview-modal-counter">{preview.index + 1} / {preview.preset.preview_images.length}</span></div>
              <button type="button" className="template-preview-modal-nav" aria-label={t.template.next} disabled={preview.index >= preview.preset.preview_images.length - 1} onClick={() => setPreview((current) => current ? { ...current, index: Math.min(current.preset.preview_images.length - 1, current.index + 1) } : current)}><ChevronRight size={18} /></button>
            </div>
            <footer className="template-preview-modal-footer">
              <span className="template-preview-modal-layout-name">{t.template.previewTitle}</span>
              <button type="button" className="template-use-btn" onClick={() => { onSelectVisualStylePreset(preview.preset.id); setPreview(null); }}>{t.controls.useTemplate}</button>
            </footer>
          </section>
        </div>
      ) : null}

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
