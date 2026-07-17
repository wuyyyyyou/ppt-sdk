import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { OutlineDetail } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { LoadingKind } from "../types";
import { formatSlideNumber } from "../utils";

interface OutlinePageProps {
  t: Messages;
  title: string;
  outline: OutlineDetail[];
  dirty: boolean;
  error: string;
  loading: LoadingKind;
  setTitle: (value: string) => void;
  updateItem: (index: number, patch: Partial<OutlineDetail>) => void;
  addItem: () => void;
  insertItem: (index: number, item: OutlineDetail) => void;
  deleteItem: (index: number) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  save: () => Promise<void>;
  retry: () => Promise<void>;
  backToRequirements: () => void;
  feedback: string;
  setFeedback: (value: string) => void;
  applyFeedback: () => Promise<void>;
  confirm: () => Promise<void>;
}

type PageEditField = "title" | "core_message" | "required_content";
type EditTarget = { kind: "presentation-title" } | { kind: "page"; index: number; field: PageEditField };

const REQUIRED_CONTENT_PATTERN = /^(\s*)(?:[-*+•]|\d+[.)])\s+(.+)$/;

export interface RequiredContentDisplayItem {
  content: string;
  depth: number;
}

export function requiredContentDisplayItems(value: string): RequiredContentDisplayItem[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = REQUIRED_CONTENT_PATTERN.exec(line);
      return {
        content: (match?.[2] ?? line).trim(),
        depth: Math.floor((match?.[1]?.length ?? 0) / 2),
      };
    });
}

function remapIndex(index: number, fromIndex: number, toIndex: number) {
  if (index === fromIndex) return toIndex;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
  if (toIndex < fromIndex && index >= toIndex && index < fromIndex) return index + 1;
  return index;
}

export function OutlinePage(props: OutlinePageProps) {
  const {
    t,
    title,
    outline,
    dirty,
    error,
    loading,
    setTitle,
    updateItem,
    addItem,
    insertItem,
    deleteItem,
    moveItem,
    save,
    retry,
    backToRequirements,
    feedback,
    setFeedback,
    applyFeedback,
    confirm,
  } = props;
  const dragIndexRef = useRef<number | null>(null);
  const [removed, setRemoved] = useState<{ item: OutlineDetail; index: number } | null>(null);
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(() => new Set());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const creating = loading === "outline" && outline.length === 0;
  const busy = loading !== "none";

  if (creating) {
    return (
      <section className="page active requirements-page requirements-loading" aria-live="polite">
        <div className="requirements-breathing-mark"><Sparkles size={26} /></div>
        <h1>{t.outline.loadingTitle}</h1>
        <p>{t.outline.loadingBody}</p>
        <div className="requirements-loading-lines" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  if (error && outline.length === 0) {
    return (
      <section className="page active requirements-page requirements-error" role="alert">
        <h1>{t.outline.errorTitle}</h1>
        <p>{error}</p>
        <div className="requirements-error-actions">
          <button className="primary-btn" type="button" onClick={() => void retry()}>
            <RefreshCw size={16} />{t.outline.retry}
          </button>
          <button className="secondary-btn" type="button" onClick={backToRequirements}>
            <ArrowLeft size={16} />{t.outline.backToRequirements}
          </button>
        </div>
      </section>
    );
  }

  function pageIsEditing(index: number, field: PageEditField) {
    return editTarget?.kind === "page" && editTarget.index === index && editTarget.field === field;
  }

  function toggleExpanded(index: number) {
    setExpandedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function expandAll() {
    setExpandedIndexes(new Set(outline.map((_, index) => index)));
  }

  function collapseAll() {
    setExpandedIndexes(new Set());
    if (editTarget?.kind === "page" && editTarget.field === "required_content") {
      setEditTarget(null);
    }
  }

  function removeItem(index: number) {
    if (outline.length <= 1) return;
    setRemoved({ item: { ...outline[index] }, index });
    setEditTarget(null);
    setExpandedIndexes((current) => new Set(
      [...current]
        .filter((itemIndex) => itemIndex !== index)
        .map((itemIndex) => itemIndex > index ? itemIndex - 1 : itemIndex),
    ));
    deleteItem(index);
  }

  function restoreRemovedItem() {
    if (!removed) return;
    setExpandedIndexes((current) => new Set(
      [...current].map((index) => index >= removed.index ? index + 1 : index),
    ));
    insertItem(removed.index, removed.item);
    setRemoved(null);
  }

  function addPage() {
    const nextIndex = outline.length;
    addItem();
    setExpandedIndexes((current) => new Set([...current, nextIndex]));
    setEditTarget({ kind: "page", index: nextIndex, field: "title" });
  }

  function movePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setEditTarget(null);
    setExpandedIndexes((current) => new Set(
      [...current].map((index) => remapIndex(index, fromIndex, toIndex)),
    ));
    moveItem(fromIndex, toIndex);
  }

  function handleSingleLineKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setEditTarget(null);
      event.currentTarget.blur();
    }
  }

  return (
    <section className="page active outline-page">
      <div className="page-header compact">
        <div><div className="page-title">{t.outline.title}</div><p>{t.outline.helper}</p></div>
      </div>

      <div className="outline-review-controls">
        <div className="feedback-box">
          <textarea
            className="prompt-input compact"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t.outline.feedbackPlaceholder}
            disabled={busy}
          />
          <div className="feedback-actions">
            <button className="primary-btn" onClick={() => void applyFeedback()} disabled={busy || !feedback.trim()}>
              {loading === "outline" ? <span className="spinner small" /> : <Sparkles size={14} />}
              {t.controls.reviseOutline}
            </button>
          </div>
        </div>
      </div>

      <section className="outline-card outline-review-card">
        <div className="outline-card-header outline-editor-title">
          <div className="outline-presentation-title">
            <span className="section-label">{t.outline.presentationTitle}</span>
            {editTarget?.kind === "presentation-title" ? (
              <input
                autoFocus
                value={title}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => setEditTarget(null)}
                onKeyDown={handleSingleLineKeyDown}
              />
            ) : (
              <button
                className="outline-inline-read outline-presentation-title-read"
                type="button"
                disabled={busy}
                onClick={() => setEditTarget({ kind: "presentation-title" })}
              >
                <span>{title}</span><Pencil size={14} />
              </button>
            )}
          </div>
          <div className="outline-collapse-controls">
            <button type="button" disabled={busy} onClick={expandAll}>
              <ChevronsUpDown size={14} />{t.outline.expandAll}
            </button>
            <button type="button" disabled={busy} onClick={collapseAll}>
              <ChevronsDownUp size={14} />{t.outline.collapseAll}
            </button>
          </div>
        </div>

        <div className="outline-list-large">
          {outline.map((item, index) => {
            const expanded = expandedIndexes.has(index);
            const requiredItems = requiredContentDisplayItems(item.required_content);
            return (
              <article
                key={`outline-item-${index}`}
                className="outline-item-large outline-editor-item"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const fromIndex = dragIndexRef.current;
                  dragIndexRef.current = null;
                  if (fromIndex !== null) movePage(fromIndex, index);
                }}
              >
                <div className="outline-page-rail">
                  <span
                    className="outline-drag-handle"
                    draggable={!busy}
                    onDragStart={() => { dragIndexRef.current = index; }}
                  >
                    <GripVertical size={18} />
                  </span>
                  <span className="outline-num">{formatSlideNumber(index)}</span>
                </div>
                <div className="outline-item-actions outline-card-floating-actions">
                  <button type="button" title={t.outline.moveUp} disabled={busy || index === 0} onClick={() => movePage(index, index - 1)}><ArrowUp size={15} /></button>
                  <button type="button" title={t.outline.moveDown} disabled={busy || index === outline.length - 1} onClick={() => movePage(index, index + 1)}><ArrowDown size={15} /></button>
                  <button type="button" title={t.outline.deletePage} disabled={busy || outline.length <= 1} onClick={() => removeItem(index)}><Trash2 size={15} /></button>
                </div>

                <div className="outline-read-section">
                  <span className="outline-field-label">{t.outline.pageTitle}</span>
                  {pageIsEditing(index, "title") ? (
                    <input
                      autoFocus
                      className="outline-inline-input outline-page-title-input"
                      value={item.title}
                      disabled={busy}
                      onChange={(event) => updateItem(index, { title: event.target.value })}
                      onBlur={() => setEditTarget(null)}
                      onKeyDown={handleSingleLineKeyDown}
                    />
                  ) : (
                    <button
                      className="outline-inline-read outline-page-title-read"
                      type="button"
                      disabled={busy}
                      onClick={() => setEditTarget({ kind: "page", index, field: "title" })}
                    >
                      <span>{item.title}</span><Pencil size={13} />
                    </button>
                  )}
                </div>

                <div className="outline-read-section">
                  <span className="outline-field-label">{t.outline.coreMessage}</span>
                  {pageIsEditing(index, "core_message") ? (
                    <input
                      autoFocus
                      className="outline-inline-input"
                      value={item.core_message}
                      disabled={busy}
                      onChange={(event) => updateItem(index, { core_message: event.target.value })}
                      onBlur={() => setEditTarget(null)}
                      onKeyDown={handleSingleLineKeyDown}
                    />
                  ) : (
                    <button
                      className="outline-inline-read outline-core-message-read"
                      type="button"
                      disabled={busy}
                      onClick={() => setEditTarget({ kind: "page", index, field: "core_message" })}
                    >
                      <span>{item.core_message}</span><Pencil size={13} />
                    </button>
                  )}
                </div>

                <div className={`outline-required-section ${expanded ? "expanded" : ""}`}>
                  <button className="outline-required-toggle" type="button" disabled={busy} onClick={() => toggleExpanded(index)}>
                    <span>
                      <strong>{t.outline.requiredContent}</strong>
                      <small>{t.outline.requiredContentCount.replace("{count}", String(requiredItems.length))}</small>
                    </span>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {expanded ? (
                    pageIsEditing(index, "required_content") ? (
                      <div className="outline-required-editor">
                        <textarea
                          autoFocus
                          value={item.required_content}
                          disabled={busy}
                          onChange={(event) => updateItem(index, { required_content: event.target.value })}
                          onBlur={() => setEditTarget(null)}
                        />
                        <small>{t.outline.requiredContentHint}</small>
                      </div>
                    ) : (
                      <div
                        className="outline-markdown-preview"
                        role="button"
                        aria-disabled={busy}
                        tabIndex={busy ? -1 : 0}
                        onClick={() => {
                          if (!busy) setEditTarget({ kind: "page", index, field: "required_content" });
                        }}
                        onKeyDown={(event) => {
                          if (!busy && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            setEditTarget({ kind: "page", index, field: "required_content" });
                          }
                        }}
                      >
                        <ul>
                          {requiredItems.map((requiredItem, itemIndex) => (
                            <li key={`${index}-required-${itemIndex}`} style={{ marginLeft: `${requiredItem.depth * 18}px` }}>
                              {requiredItem.content}
                            </li>
                          ))}
                        </ul>
                        <span className="outline-markdown-edit"><Pencil size={13} />{t.outline.clickToEdit}</span>
                      </div>
                    )
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <button className="outline-add-page" type="button" onClick={addPage} disabled={busy}>
          <Plus size={16} />{t.outline.addPage}
        </button>

        {removed ? (
          <div className="outline-undo" role="status">
            <span>{t.outline.deleted}</span>
            <button type="button" onClick={restoreRemovedItem}>{t.outline.undo}</button>
          </div>
        ) : null}

        <div className="outline-card-footer">
          <button className="secondary-btn outline-action-button" type="button" onClick={backToRequirements} disabled={busy}>
            <ArrowLeft size={14} />{t.outline.backToRequirements}
          </button>
          <div className="outline-footer-right">
            <span className="outline-save-state">{dirty ? t.outline.unsaved : t.outline.saved}</span>
            <div className="outline-footer-actions">
              <button className="secondary-btn outline-action-button" type="button" onClick={() => void save()} disabled={busy || !dirty}>
                <Save size={15} />{t.outline.saveChanges}
              </button>
              <button className="primary-btn confirm-outline-btn outline-action-button" type="button" onClick={() => void confirm()} disabled={busy}>
                {loading === "deck" ? <span className="spinner small" /> : <CheckCircle2 size={14} />}
                {t.controls.confirmOutline}
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
