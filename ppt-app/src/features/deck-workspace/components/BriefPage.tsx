import { Check, File, Plus, Sparkles, Upload, X } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { ContextRow, LoadingKind } from "../types";
import {
  MAX_AGENT_FAILURES,
  MAX_RENDER_ATTEMPTS,
  MAX_SELF_REVIEW_ATTEMPTS,
  type CreateDeckFlowProgress
} from "../orchestration/createDeckFlow";

interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  loading: LoadingKind;
  reviewOutlineFirst: boolean;
  setReviewOutlineFirst: (value: boolean) => void;
  contextRows: ContextRow[];
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  addStyleRow: () => void;
  addMoreRows: () => void;
  lookPickerOpen: boolean;
  setLookPickerOpen: (value: boolean) => void;
  selectedLookId: string | null;
  selectLook: (id: string) => void;
  generateDeck: () => Promise<void>;
  cancelGenerateDeck: () => void;
  createDeckProgress: CreateDeckFlowProgress | null;
  showToast: (message: string) => void;
}

export function BriefPage(props: BriefPageProps) {
  const {
    t,
    prompt,
    setPrompt,
    loading,
    reviewOutlineFirst,
    setReviewOutlineFirst,
    contextRows,
    addContextRow,
    updateContextRow,
    removeContextRow,
    addStyleRow,
    addMoreRows,
    lookPickerOpen,
    setLookPickerOpen,
    selectedLookId,
    selectLook,
    generateDeck,
    cancelGenerateDeck,
    createDeckProgress,
    showToast
  } = props;
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
          progress={createDeckProgress}
          onCancel={cancelGenerateDeck}
          cancellable={isCreating && createDeckProgress.phase !== "cancelled"}
        />
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
                  value: t.brief.contextDefaults.audience
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
                  value: t.brief.contextDefaults.goal
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
                  value: t.brief.contextDefaults.contentSource
                })
              }
            >
              {t.brief.chips.content}
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
            <button className="chip-btn" onClick={addMoreRows}>
              {t.brief.chips.more}
            </button>
          </div>
        </div>
      </div>

      <div className="context-rows-container">
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

        {contextRows.some((row) => row.id === "style") ? (
          <div>
            <button className="add-context-btn" onClick={() => setLookPickerOpen(!lookPickerOpen)}>
              <Plus size={12} />
              {selectedLookId ? t.controls.changeLook : t.controls.addLook}
            </button>
            <LookPicker
              t={t}
              open={lookPickerOpen}
              selectedLookId={selectedLookId}
              selectLook={selectLook}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function GenerationProgressPanel(props: {
  progress: CreateDeckFlowProgress;
  onCancel: () => void;
  cancellable: boolean;
}) {
  const { progress, onCancel, cancellable } = props;
  const completed = progress.pages.filter((page) => page.status === "accepted").length;
  const total = progress.totalPages || progress.pages.length || 0;

  return (
    <section className="generation-progress-panel">
      <div className="generation-progress-header">
        <div>
          <div className="section-label">生成进度</div>
          <strong>{progress.message}</strong>
          {total > 0 ? (
            <span>
              {completed}/{total} 页通过
            </span>
          ) : null}
        </div>
        {cancellable ? (
          <button className="secondary-btn compact" onClick={onCancel}>
            停止
          </button>
        ) : null}
      </div>
      <div className="generation-step-row">
        {["outline", "page-plan", "prepare", "authoring", "render", "self-review", "final-render"].map((phase) => (
          <span
            key={phase}
            className={`generation-step ${progress.phase === phase ? "active" : ""}`}
          >
            {phase}
          </span>
        ))}
      </div>
      {progress.stream ? (
        <div className="generation-live-stream">
          <div className="generation-live-header">
            <strong>
              第 {progress.stream.page_index + 1} 页 · {progress.stream.status}
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
                render {page.render_attempts}/{MAX_RENDER_ATTEMPTS} · review {page.self_review_attempts}/{MAX_SELF_REVIEW_ATTEMPTS} · agent {page.agent_failures}/{MAX_AGENT_FAILURES}
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
            placeholder={t.brief.contextDefaults.attachmentPlaceholder}
          />
        </div>
      ) : (
        <input
          className="context-input"
          value={row.value}
          onChange={(event) => update(row.id, event.target.value)}
        />
      )}
      <button className="context-remove-btn" onClick={() => remove(row.id)}>
        <X size={12} />
      </button>
    </div>
  );
}

function LookPicker(props: {
  t: Messages;
  open: boolean;
  selectedLookId: string | null;
  selectLook: (id: string) => void;
}) {
  const { t, open, selectedLookId, selectLook } = props;

  return (
    <div className={`look-picker ${open ? "visible" : ""}`}>
      <div className="look-picker-header">
        <div className="look-picker-title">{t.controls.addLook}</div>
      </div>
      <div className="look-grid">
        {t.looks.map((look) => (
          <button
            key={look.id}
            className={`look-card ${selectedLookId === look.id ? "active" : ""}`}
            onClick={() => selectLook(look.id)}
          >
            <div className={`look-card-preview preview-${look.id}`}>
              <span />
              <span />
              <span />
            </div>
            <div className="look-card-info">
              <div className="look-card-name">{look.name}</div>
              <div className="look-card-hint">{look.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
