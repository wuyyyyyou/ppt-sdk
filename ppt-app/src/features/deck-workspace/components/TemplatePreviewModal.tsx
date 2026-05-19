import { ChevronLeft, ChevronRight, Layers, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TemplatePreviewRef, TemplateSummary } from "../../../api/types";
import { formatMessage, type Messages } from "../../../i18n/messages";

interface TemplatePreviewModalProps {
  t: Messages;
  template: TemplateSummary;
  previews: TemplatePreviewRef[];
  initialIndex?: number;
  selected: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export function TemplatePreviewModal(props: TemplatePreviewModalProps) {
  const { t, template, previews, initialIndex = 0, selected, busy, onClose, onSelect } = props;
  const total = previews.length;
  const safeInitial = Math.max(0, Math.min(initialIndex, total - 1));
  const [index, setIndex] = useState(safeInitial);

  useEffect(() => {
    setIndex(safeInitial);
  }, [safeInitial, template.group_id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((value) => (total === 0 ? 0 : (value + 1) % total));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((value) => (total === 0 ? 0 : (value - 1 + total) % total));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  if (total === 0) {
    return null;
  }

  const current = previews[index];
  const counter = formatMessage(t.template.pageCounter, {
    current: String(index + 1),
    total: String(total),
  });

  function goPrev() {
    setIndex((value) => (value - 1 + total) % total);
  }

  function goNext() {
    setIndex((value) => (value + 1) % total);
  }

  return (
    <div
      className="template-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label={t.template.previewTitle}
      onClick={onClose}
    >
      <div className="template-preview-modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="template-preview-modal-header">
          <div className="template-preview-modal-title">
            <h2>{template.group_name}</h2>
            <span>
              <Layers size={13} />
              {template.layout_count} {t.template.layouts}
            </span>
          </div>
          <button
            type="button"
            className="template-preview-modal-close"
            aria-label={t.template.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="template-preview-modal-stage">
          <button
            type="button"
            className="template-preview-modal-nav prev"
            aria-label={t.template.previous}
            onClick={goPrev}
            disabled={total <= 1}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="template-preview-modal-frame">
            <img src={current.url} alt={current.layout_name} />
            <div className="template-preview-modal-counter">{counter}</div>
          </div>
          <button
            type="button"
            className="template-preview-modal-nav next"
            aria-label={t.template.next}
            onClick={goNext}
            disabled={total <= 1}
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="template-preview-modal-thumbs">
          {previews.map((image, thumbIndex) => (
            <button
              key={image.layout_id}
              type="button"
              className={`template-preview-modal-thumb ${index === thumbIndex ? "active" : ""}`}
              onClick={() => setIndex(thumbIndex)}
              aria-label={image.layout_name}
            >
              <img src={image.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>

        <footer className="template-preview-modal-footer">
          <div className="template-preview-modal-layout-name">{current.layout_name}</div>
          <button
            type="button"
            className="template-use-btn"
            disabled={busy || selected}
            onClick={onSelect}
          >
            {busy ? <span className="spinner small" /> : <Sparkles size={14} />}
            {t.controls.useTemplate}
          </button>
        </footer>
      </div>
    </div>
  );
}
