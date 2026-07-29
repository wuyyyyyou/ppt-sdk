import { Check, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, ImageOff, Maximize2, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Messages } from "../../../i18n/messages";
import type { VisualStylePreset } from "../../../api/types";
import {
  buildVisualStylePresetFilterOptions,
  createEmptyVisualStylePresetFilters,
  filterVisualStylePresets,
  VISUAL_STYLE_PRESET_FILTER_FIELDS,
  type VisualStylePresetFilters,
} from "../../templates/visualStylePresetFilters";
import {
  isStrictReviewModeEnabled,
  type PageReviewSettings,
} from "../reviewSettings";
import type { ResearchSearchControlSettings } from "../researchSearchControl";
import type { LoadingKind } from "../types";
import { ResearchSearchControlSwitches } from "./ResearchSearchControlSwitches";
import { ConfirmationDialog } from "./ConfirmationDialog";

export interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  loading: LoadingKind;
  pageReviewSettings: PageReviewSettings;
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  researchSearchControlSettings: ResearchSearchControlSettings;
  setResearchSearchControlSettings: (settings: ResearchSearchControlSettings) => Promise<void>;
  workspaceSettingsSaving: boolean;
  generateDeck: () => Promise<void>;
  visualStylePresets: readonly VisualStylePreset[];
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
  researchSearchControlSettings,
  setResearchSearchControlSettings,
  workspaceSettingsSaving,
  generateDeck,
  visualStylePresets,
  selectedVisualStylePresetId,
  onSelectVisualStylePreset,
}: BriefPageProps) {
  const busy = loading !== "none";
  const strictReviewMode = isStrictReviewModeEnabled(pageReviewSettings);
  const [strictReviewConfirmOpen, setStrictReviewConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ preset: VisualStylePreset; index: number } | null>(null);
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<string[]>([]);
  const [presetFilters, setPresetFilters] = useState<VisualStylePresetFilters>(
    createEmptyVisualStylePresetFilters,
  );
  const filterOptions = useMemo(
    () => buildVisualStylePresetFilterOptions(visualStylePresets),
    [visualStylePresets],
  );
  const filteredPresets = useMemo(
    () => filterVisualStylePresets(visualStylePresets, presetFilters),
    [presetFilters, visualStylePresets],
  );
  // A local guard so the very first click already locks the composer, before the
  // Workspace or requirements request has had a chance to move `loading`.
  const submitBlocked = busy || submitting || workspaceSettingsSaving;

  function toggleStrictReviewMode() {
    if (strictReviewMode) {
      void setStrictReviewMode(false);
      return;
    }

    setStrictReviewConfirmOpen(true);
  }

  function resolveStrictReviewConfirmation(confirmed: boolean) {
    setStrictReviewConfirmOpen(false);
    if (confirmed) void setStrictReviewMode(true);
  }

  async function submitBrief() {
    if (submitBlocked || !prompt.trim()) return;
    setSubmitting(true);
    try {
      await generateDeck();
    } finally {
      setSubmitting(false);
    }
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
          <div className="prompt-inline-options">
            <div className="checkbox-row-with-help">
              <button
                data-performance-id="brief.strict-review.toggle"
                type="button"
                className={`checkbox-row ${strictReviewMode ? "active" : ""}`}
                onClick={toggleStrictReviewMode}
                aria-checked={strictReviewMode}
                role="switch"
                disabled={submitBlocked}
              >
                <span className="checkbox-custom" aria-hidden="true">
                  {strictReviewMode ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span>{t.brief.strictReviewMode}</span>
              </button>
              <span
                className="help-tooltip"
                tabIndex={0}
                role="note"
                aria-label={t.brief.strictReviewModeHelp}
              >
                <HelpCircle size={15} aria-hidden="true" />
                <span className="help-tooltip-content">
                  {t.brief.strictReviewModeHelp}
                </span>
              </span>
            </div>
            <ResearchSearchControlSwitches
              t={t}
              settings={researchSearchControlSettings}
              disabled={submitBlocked}
              onChange={(settings) => void setResearchSearchControlSettings(settings)}
            />
          </div>
          <button
            data-performance-id="brief.create-deck"
            className="inline-create-btn"
            type="button"
            disabled={submitBlocked || !prompt.trim()}
            aria-busy={submitting || busy}
            onClick={() => void submitBrief()}
          >
            {submitting || busy
              ? <span className="spinner small" aria-hidden="true" />
              : <Sparkles size={14} aria-hidden="true" />}
            {t.controls.createDeck}
          </button>
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
        <div className="brief-style-preset-filters" role="group" aria-label={t.template.filtersLabel}>
          {VISUAL_STYLE_PRESET_FILTER_FIELDS.map((field) => (
            <label className={`brief-style-preset-filter ${presetFilters[field] ? "active" : ""}`} key={field}>
              <span>{t.template.filters[field]}</span>
              <select
                value={presetFilters[field]}
                disabled={busy}
                title={presetFilters[field] || t.template.all}
                onChange={(event) => setPresetFilters((current) => ({ ...current, [field]: event.target.value }))}
              >
                <option value="">{t.template.all}</option>
                {filterOptions[field].map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="brief-style-preset-filter-chevron" size={14} aria-hidden="true" />
            </label>
          ))}
        </div>
        <div className="brief-style-preset-grid">
          {/* The "no preset" card keeps its visible label: HOME-004 only covers
              ordinary Visual Style Preset cards, and its final form is still an
              open product question. */}
          <button
            data-performance-id="brief.visual-style.clear"
            type="button"
            className={`brief-style-preset-card brief-style-preset-none-card ${!selectedVisualStylePresetId ? "active" : ""}`}
            disabled={busy}
            aria-pressed={!selectedVisualStylePresetId}
            onClick={() => onSelectVisualStylePreset(null)}
          >
            <span className="brief-style-preset-none-mark" aria-hidden="true">
              <svg viewBox="0 0 640 360" role="presentation">
                <rect x="80" y="62" width="480" height="236" rx="10" fill="#f8f9fb" stroke="#d8dce5" />
                <rect x="112" y="96" width="184" height="12" rx="6" fill="#d9dde7" />
                <rect x="112" y="126" width="276" height="8" rx="4" fill="#e4e7ee" />
                {/* The card title sits over this band, so the blocks stay fainter
                    than the rest of the illustration. */}
                <g className="brief-style-preset-none-blocks">
                  <rect x="112" y="184" width="124" height="64" rx="8" fill="#eef0f5" />
                  <rect x="252" y="184" width="124" height="64" rx="8" fill="#f1f3f7" />
                  <rect x="392" y="184" width="124" height="64" rx="8" fill="#ebeef4" />
                </g>
                <path d="M112 278H516" stroke="#e0e3ea" strokeLinecap="round" />
                <circle cx="510" cy="112" r="8" fill="#c9ceda" />
              </svg>
              {!selectedVisualStylePresetId ? (
                <span className="brief-style-preset-none-selection"><Check size={15} /></span>
              ) : null}
            </span>
            <span className="brief-style-preset-none-copy">
              <strong>{t.template.none}</strong>
            </span>
          </button>
          {filteredPresets.map((preset: VisualStylePreset) => {
            const selected = selectedVisualStylePresetId === preset.id;
            const cover = preset.preview_images[0];
            const coverBroken = brokenPreviewIds.includes(preset.id);
            return (
              <article
                className={`brief-style-preset-card ${selected ? "active" : ""}`}
                key={preset.id}
              >
                <span className="brief-style-preset-image-wrap">
                  {coverBroken || !cover ? (
                    <span className="brief-style-preset-image-fallback" aria-hidden="true">
                      <ImageOff size={20} />
                    </span>
                  ) : (
                    <img
                      src={cover.url}
                      alt=""
                      loading="lazy"
                      onError={() => setBrokenPreviewIds((current) =>
                        current.includes(preset.id) ? current : [...current, preset.id])}
                    />
                  )}
                </span>
                <button
                  data-performance-id="brief.visual-style.select"
                  type="button"
                  className="brief-style-preset-select"
                  disabled={busy}
                  aria-pressed={selected}
                  onClick={() => onSelectVisualStylePreset(preset.id)}
                >
                  <span className="brief-style-preset-accessible-name">{preset.name}</span>
                </button>
                <button
                  data-performance-id="brief.visual-style.preview"
                  type="button"
                  className="brief-style-preset-preview-btn"
                  disabled={busy}
                  title={`${t.template.previewTitle} · ${preset.name}`}
                  aria-label={`${t.template.previewTitle} · ${preset.name}`}
                  onClick={() => setPreview({ preset, index: 0 })}
                >
                  <Maximize2 size={14} aria-hidden="true" />
                </button>
                {selected ? (
                  <span className="brief-style-preset-selected" aria-hidden="true"><Check size={14} /></span>
                ) : null}
              </article>
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
              <button data-performance-id="brief.visual-style.preview.close" type="button" className="template-preview-modal-close" aria-label={t.template.close} onClick={() => setPreview(null)}><X size={17} /></button>
            </header>
            <div className="template-preview-modal-stage">
              <button data-performance-id="brief.visual-style.preview.previous" type="button" className="template-preview-modal-nav" aria-label={t.template.previous} disabled={preview.index === 0} onClick={() => setPreview((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}><ChevronLeft size={18} /></button>
              <div className="template-preview-modal-frame"><img src={preview.preset.preview_images[preview.index]?.url} alt={preview.preset.preview_images[preview.index]?.alt ?? preview.preset.name} /><span className="template-preview-modal-counter">{preview.index + 1} / {preview.preset.preview_images.length}</span></div>
              <button data-performance-id="brief.visual-style.preview.next" type="button" className="template-preview-modal-nav" aria-label={t.template.next} disabled={preview.index >= preview.preset.preview_images.length - 1} onClick={() => setPreview((current) => current ? { ...current, index: Math.min(current.preset.preview_images.length - 1, current.index + 1) } : current)}><ChevronRight size={18} /></button>
            </div>
            <footer className="template-preview-modal-footer">
              <span className="template-preview-modal-layout-name">{t.template.previewTitle}</span>
              <button data-performance-id="brief.visual-style.preview.use" type="button" className="template-use-btn" onClick={() => { onSelectVisualStylePreset(preview.preset.id); setPreview(null); }}>{t.controls.useTemplate}</button>
            </footer>
          </section>
        </div>
      ) : null}

      <ConfirmationDialog
        request={strictReviewConfirmOpen ? {
          title: t.brief.strictReviewConfirmTitle,
          body: t.brief.strictReviewConfirmBody,
          confirmLabel: t.brief.strictReviewConfirmAction,
          cancelLabel: t.controls.cancel,
          closeLabel: t.controls.close,
          tone: "warning",
        } : null}
        onResolve={resolveStrictReviewConfirmation}
      />
    </section>
  );
}

export function ThinkingStatusText({ text, active = false, showOrb = false }: { text: string; active?: boolean; showOrb?: boolean }) {
  return <span className={`thinking-status-text ${active ? "active" : ""}`}>{showOrb ? <i /> : null}{text}</span>;
}
