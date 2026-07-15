import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  PresentationDocument,
  PresentationSlideDocument,
} from "../../api/types";
import type { Messages } from "../../i18n/messages";
import { PresentationRenderer } from "./PresentationRenderer";
import { addBlankSlide, deleteSlide, duplicateSlide, moveSlideTo, orderedSlides } from "./editor/documentOps";

interface SlideFilmstripProps {
  t: Messages;
  document: PresentationDocument;
  slides: PresentationSlideDocument[];
  activeSlideId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onBack: () => void;
  onSelectSlide: (slideId: string) => void;
  onSelectSlideId: (slideId: string) => void;
  updateDocument: (update: (current: PresentationDocument) => PresentationDocument) => void;
  imageAssets?: Record<string, string>;
}

export function SlideFilmstrip(props: SlideFilmstripProps) {
  const { t, document: presentationDocument, slides } = props;
  const [menuSlideId, setMenuSlideId] = useState<string | null>(null);
  const [dragSlideId, setDragSlideId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuSlideId) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setMenuSlideId(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuSlideId]);

  const handleDuplicate = (slideId: string) => {
    props.updateDocument((current) => {
      const newId = duplicateSlide(current, slideId);
      if (newId) props.onSelectSlideId(newId);
      return current;
    });
    setMenuSlideId(null);
  };

  const handleDelete = (slideId: string) => {
    props.updateDocument((current) => {
      const nextId = deleteSlide(current, slideId);
      if (nextId) props.onSelectSlideId(nextId);
      return current;
    });
    setMenuSlideId(null);
  };

  const handleMove = (slideId: string, targetIndex: number) => {
    props.updateDocument((current) => {
      moveSlideTo(current, slideId, targetIndex);
      return current;
    });
    setMenuSlideId(null);
  };

  const handleAdd = () => {
    props.updateDocument((current) => {
      const template = orderedSlides(current).at(-1);
      const newId = addBlankSlide(current, template);
      props.onSelectSlideId(newId);
      return current;
    });
  };

  if (props.collapsed) {
    return (
      <aside className="slide-filmstrip collapsed">
        <button type="button" className="editor-btn icon" onClick={props.onBack} title={t.editor.back}>
          <ArrowLeft size={16} />
        </button>
        <button
          type="button"
          className="editor-btn icon"
          onClick={props.onToggleCollapsed}
          title={t.editor.expandFilmstrip}
        >
          <PanelLeftOpen size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="slide-filmstrip">
      <div className="filmstrip-header">
        <button type="button" className="editor-btn icon" onClick={props.onBack} title={t.editor.back}>
          <ArrowLeft size={16} />
        </button>
        <strong className="filmstrip-title">{presentationDocument.title || t.editor.title}</strong>
        <button
          type="button"
          className="editor-btn icon"
          onClick={props.onToggleCollapsed}
          title={t.editor.collapseFilmstrip}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="filmstrip-scroll" role="list">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            role="listitem"
            className={[
              "filmstrip-item",
              slide.id === props.activeSlideId ? "active" : "",
              dragSlideId === slide.id ? "dragging" : "",
              dropIndex === index ? "drop-target" : "",
            ].filter(Boolean).join(" ")}
            draggable
            onDragStart={(event) => {
              setDragSlideId(slide.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropIndex(index);
            }}
            onDragLeave={() => setDropIndex((value) => (value === index ? null : value))}
            onDrop={(event) => {
              event.preventDefault();
              if (dragSlideId && dragSlideId !== slide.id) handleMove(dragSlideId, index);
              setDragSlideId(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDragSlideId(null);
              setDropIndex(null);
            }}
            onClick={() => props.onSelectSlide(slide.id)}
          >
            <span className="filmstrip-index">{index + 1}</span>
            <div className="filmstrip-thumb">
              <PresentationRenderer
                slide={slide}
                width={presentationDocument.width}
                height={presentationDocument.height}
                mode="thumbnail"
                imageAssets={props.imageAssets}
              />
            </div>
            <button
              type="button"
              className="editor-btn icon filmstrip-more"
              aria-label={t.editor.more}
              onClick={(event) => {
                event.stopPropagation();
                setMenuSlideId((value) => (value === slide.id ? null : slide.id));
              }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuSlideId === slide.id ? (
              <div className="filmstrip-menu" role="menu" ref={menuRef}>
                <button type="button" role="menuitem" onClick={() => handleDuplicate(slide.id)}>
                  <Copy size={13} />
                  {t.editor.duplicateSlide}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={index === 0}
                  onClick={() => handleMove(slide.id, index - 1)}
                >
                  <ChevronUp size={13} />
                  {t.editor.moveSlideUp}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={index === slides.length - 1}
                  onClick={() => handleMove(slide.id, index + 1)}
                >
                  <ChevronDown size={13} />
                  {t.editor.moveSlideDown}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  disabled={slides.length <= 1}
                  onClick={() => handleDelete(slide.id)}
                >
                  <Trash2 size={13} />
                  {t.editor.deleteSlide}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="filmstrip-footer">
        <button type="button" className="editor-btn icon" onClick={handleAdd} title={t.editor.addSlide}>
          <Plus size={16} />
        </button>
      </div>
    </aside>
  );
}
