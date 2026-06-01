import { Check, CheckCircle2, File, ImageIcon, Search, Sparkles, Upload, X } from "lucide-react";
import { useState } from "react";
import type { TemplateSummary } from "../../../api/types";
import { formatMessage, type Messages } from "../../../i18n/messages";
import type { DeckGenerationProgress } from "../../deck-generation";
import type { ContextRow, LoadingKind } from "../types";
import { TemplatePreviewModal } from "./TemplatePreviewModal";

const SLIDE_COUNT_OPTIONS = ["auto", ...Array.from({ length: 20 }, (_, index) => String(index + 1))];

interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  templates: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  loading: LoadingKind;
  selectTemplate: (groupId: string) => Promise<void>;
  reviewOutlineFirst: boolean;
  setReviewOutlineFirst: (value: boolean) => void;
  contextRows: ContextRow[];
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  addStyleRow: () => void;
  generateDeck: () => Promise<void>;
  cancelGenerateDeck: () => void;
  createDeckProgress: DeckGenerationProgress | null;
  showToast: (message: string) => void;
}

export function BriefPage(props: BriefPageProps) {
  const {
    t,
    prompt,
    setPrompt,
    templates,
    selectedTemplateGroupId,
    loading,
    selectTemplate,
    reviewOutlineFirst,
    setReviewOutlineFirst,
    contextRows,
    addContextRow,
    updateContextRow,
    removeContextRow,
    addStyleRow,
    generateDeck,
    cancelGenerateDeck,
    createDeckProgress,
  showToast
  } = props;
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const isCreating =
    loading === "deck" || loading === "outline" || loading === "review";

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
        />
        <button
          className="inline-create-btn"
          onClick={generateDeck}
          disabled={isCreating}
        >
          {isCreating ? (
            <span className="spinner small" />
          ) : (
            <Sparkles size={14} />
          )}
          {t.controls.createDeck}
        </button>
      </div>

      <button
        type="button"
        className={`checkbox-row ${reviewOutlineFirst ? "active" : ""}`}
        onClick={() => setReviewOutlineFirst(!reviewOutlineFirst)}
        aria-checked={reviewOutlineFirst}
        role="switch"
      >
        <span className="checkbox-custom">
          {reviewOutlineFirst ? <Check size={11} strokeWidth={3} /> : null}
        </span>
        <span>{t.brief.reviewOutlineFirst}</span>
      </button>

      {createDeckProgress ? (
        <GenerationProgressPanel
          t={t}
          progress={createDeckProgress}
          onCancel={cancelGenerateDeck}
          cancellable={isCreating && createDeckProgress.step !== "cancelled"}
        />
      ) : null}
      {!createDeckProgress && loading === "outline" && !reviewOutlineFirst ? (
        <section className="generation-progress-panel">
          <div className="generation-progress-header">
            <div>
              <div className="section-label">{t.generating.progressTitle}</div>
              <strong>{t.status.creatingOutline}</strong>
            </div>
            <button className="secondary-btn compact" onClick={cancelGenerateDeck}>
              {t.controls.stop}
            </button>
          </div>
        </section>
      ) : null}

      <div className="brief-options">
        <div>
          <div className="section-label">{t.brief.optionalContext}</div>
          <div className="chips-row">
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "audience",
                  label: t.brief.contextLabels.audience,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.audience
                })
              }
            >
              {t.brief.chips.audience}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "goal",
                  label: t.brief.contextLabels.goal,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.goal
                })
              }
            >
              {t.brief.chips.goal}
            </button>
            <button className="chip-btn" onClick={addStyleRow}>
              {t.brief.chips.style}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "content",
                  label: t.brief.contextLabels.contentSource,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.contentSource
                })
              }
            >
              {t.brief.chips.content}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "slides",
                  label: t.brief.contextLabels.slides,
                  value: "auto",
                  type: "select",
                  options: SLIDE_COUNT_OPTIONS
                })
              }
            >
              {t.brief.contextLabels.slides}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "attachment",
                  label: t.brief.contextLabels.attachment,
                  value: "",
                  type: "attachment"
                })
              }
            >
              {t.brief.chips.attachment}
            </button>
            <button
              className={`chip-btn ${templatePickerOpen ? "active" : ""}`}
              onClick={() => setTemplatePickerOpen((value) => !value)}
            >
              {t.brief.chips.template}
            </button>
          </div>
        </div>
      </div>

      <div className="context-rows-container">
        {templatePickerOpen ? (
          <StyleSelection
            t={t}
            templates={templates}
            selectedTemplateGroupId={selectedTemplateGroupId}
            loading={loading}
            selectTemplate={selectTemplate}
          />
        ) : null}

        {contextRows.map((row) => (
          <ContextRowView
            key={row.id}
            row={row}
            t={t}
            update={updateContextRow}
            remove={removeContextRow}
            onUpload={() => showToast(t.toasts.attachmentAdded)}
          />
        ))}
      </div>
    </section>
  );
}

function StyleSelection(props: {
  t: Messages;
  templates: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  loading: LoadingKind;
  selectTemplate: (groupId: string) => Promise<void>;
}) {
  const { t, templates, selectedTemplateGroupId, loading, selectTemplate } = props;
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewTemplate = previewGroupId
    ? templates.find((template) => template.group_id === previewGroupId) ?? null
    : null;

  function openPreview(groupId: string, index = 0) {
    setPreviewGroupId(groupId);
    setPreviewIndex(index);
  }

  function closePreview() {
    setPreviewGroupId(null);
  }

  return (
    <section className="style-selection-section">
      <div className="style-selection-heading">
        <div>
          <div className="section-label">{t.template.title}</div>
          <p>{t.template.helper}</p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="template-empty">
          {loading === "template" ? t.template.loading : t.template.empty}
        </div>
      ) : (
        <div className="template-grid style-template-grid">
          {templates.map((template) => (
            <StyleTemplateCard
              key={template.group_id}
              t={t}
              template={template}
              selected={selectedTemplateGroupId === template.group_id}
              busy={loading === "template" && selectedTemplateGroupId !== template.group_id}
              onSelect={() => selectTemplate(template.group_id)}
              onOpenPreview={() => openPreview(template.group_id, 0)}
            />
          ))}
        </div>
      )}

      {previewTemplate && previewTemplate.previews.length > 0 ? (
        <TemplatePreviewModal
          t={t}
          template={previewTemplate}
          previews={previewTemplate.previews}
          initialIndex={previewIndex}
          selected={selectedTemplateGroupId === previewTemplate.group_id}
          busy={loading === "template"}
          onClose={closePreview}
          onSelect={() => {
            void selectTemplate(previewTemplate.group_id).then(closePreview);
          }}
        />
      ) : null}
    </section>
  );
}

function StyleTemplateCard(props: {
  t: Messages;
  template: TemplateSummary;
  selected: boolean;
  busy: boolean;
  onSelect: () => Promise<void>;
  onOpenPreview: () => void;
}) {
  const { t, template, selected, busy, onSelect, onOpenPreview } = props;
  const previewUrl = template.preview?.url;
  const previewCount = template.previews?.length ?? 0;
  const canOpenPreview = previewCount > 0;

  return (
    <article className={`template-card ${selected ? "active" : ""}`}>
      <button
        type="button"
        className="template-preview template-preview-button"
        onClick={onOpenPreview}
        disabled={!canOpenPreview}
        aria-label={t.template.viewAll}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" loading="lazy" />
        ) : (
          <div className="template-preview-placeholder">
            <ImageIcon size={22} />
          </div>
        )}
        {selected ? (
          <div className="template-selected-badge">
            <CheckCircle2 size={14} />
          </div>
        ) : null}
        {canOpenPreview ? (
          <div className="template-preview-overlay">
            <span className="template-preview-overlay-chip">
              <Search size={13} />
              {t.template.viewAll}
              <em>{previewCount}</em>
            </span>
          </div>
        ) : null}
      </button>
      <div className="template-card-body">
        <div className="template-card-title-row">
          <h2>{template.group_name}</h2>
        </div>
        <button className="template-use-btn" disabled={busy} onClick={() => void onSelect()}>
          {busy ? <span className="spinner small" /> : <Sparkles size={14} />}
          {t.controls.useTemplate}
        </button>
      </div>
    </article>
  );
}

export function GenerationProgressPanel(props: {
  t: Messages;
  progress: DeckGenerationProgress;
  onCancel: () => void;
  cancellable: boolean;
}) {
  const { t, progress, onCancel, cancellable } = props;
  const completed = progress.pages.filter((page) => page.status === "accepted").length;
  const total = progress.totalPages || progress.pages.length || 0;

  return (
    <section className="generation-progress-panel">
      <div className="generation-progress-header">
        <div>
          <div className="section-label">{t.generating.progressTitle}</div>
          <strong>{progress.message}</strong>
          {total > 0 ? (
            <span>
              {formatMessage(t.generating.pagesPassed, {
                completed: String(completed),
                total: String(total)
              })}
            </span>
          ) : null}
        </div>
        {cancellable ? (
          <button className="secondary-btn compact" onClick={onCancel}>
            {t.controls.stop}
          </button>
        ) : null}
      </div>
      <div className="generation-step-row">
        {["page-plan", "prepare", "page-authoring", "page-render", "page-review", "final-render"].map((step) => (
          <span
            key={step}
            className={`generation-step ${progress.step === step ? "active" : ""}`}
          >
            {step}
          </span>
        ))}
      </div>
      {progress.stream ? (
        <div className="generation-live-stream">
          <div className="generation-live-header">
            <strong>
              {formatMessage(t.generating.pageLabel, {
                page: String(progress.stream.page_index + 1)
              })} · {progress.stream.status}
            </strong>
          </div>
          {progress.stream.activities.length > 0 ? (
            <div className="generation-activity-list">
              {progress.stream.activities.map((activity, index) => (
                <span key={`${activity}-${index}`}>{activity}</span>
              ))}
            </div>
          ) : null}
          {progress.stream.lines.some((line) => line.trim()) ? (
            <pre className="generation-stream-text">
              {progress.stream.lines.join("\n").trim()}
            </pre>
          ) : null}
        </div>
      ) : null}
      {progress.pages.length > 0 ? (
        <div className="generation-page-list">
          {progress.pages.map((page) => (
            <div key={page.page_id} className={`generation-page-item ${page.status}`}>
              <div>
                <strong>{page.index + 1}. {page.title}</strong>
                <span>{page.status}</span>
              </div>
              <small>
                render {page.render_attempts}/{page.render_attempt_limit} · review {page.self_review_attempts}/{page.self_review_attempt_limit} · agent {page.agent_failures}/{page.agent_failure_limit}
                {page.agent_infrastructure_failures > 0 ? ` · session ${page.agent_infrastructure_failures}` : ""}
              </small>
              {page.last_error ? <p>{page.last_error}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ContextRowView(props: {
  row: ContextRow;
  t: Messages;
  update: (id: string, value: string) => void;
  remove: (id: string) => void;
  onUpload: () => void;
}) {
  const { row, t, update, remove, onUpload } = props;

  return (
    <div className="context-row">
      <div className="context-label">{row.label}</div>
      {row.type === "select" ? (
        <select
          className="context-select"
          value={row.value}
          onChange={(event) => update(row.id, event.target.value)}
        >
          {row.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : row.type === "attachment" ? (
        <div className="attachment-inline">
          <button className="upload-btn" onClick={onUpload}>
            <Upload size={12} />
            {t.controls.chooseFile}
          </button>
          <span className="file-pill visible">
            <File size={12} />
            anna-logo.png
          </span>
          <input
            className="context-input"
            value={row.value}
            onChange={(event) => update(row.id, event.target.value)}
            placeholder={row.placeholder ?? t.brief.contextDefaults.attachmentPlaceholder}
          />
        </div>
      ) : (
        <input
          className="context-input"
          value={row.value}
          onChange={(event) => update(row.id, event.target.value)}
          placeholder={row.placeholder}
        />
      )}
      <button className="context-remove-btn" onClick={() => remove(row.id)}>
        <X size={12} />
      </button>
    </div>
  );
}
