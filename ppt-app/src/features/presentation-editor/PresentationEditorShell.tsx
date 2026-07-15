import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PresentationDocument,
  PresentationElement,
} from "../../api/types";
import type { ExportArtifact, LoadingKind } from "../../features/deck-workspace/types";
import { downloadExportArtifact } from "../deck-workspace/exportArtifactDownload";
import { formatMessage, type Messages } from "../../i18n/messages";
import type { PresentationEditorSaveStatus } from "./usePresentationEditor";
import { PresentationRenderer, type ResizeHandle } from "./PresentationRenderer";
import { SlideFilmstrip } from "./SlideFilmstrip";
import { FloatingContextToolbar } from "./FloatingContextToolbar";
import {
  addImageElement,
  addShapeElement,
  addTextElement,
  arrangeElement,
  deleteElement,
  duplicateSlide,
  orderedSlides,
  pasteElement,
  type ArrangeAction,
} from "./editor/documentOps";

const MIN_ELEMENT_SIZE = 16;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

interface PresentationEditorShellProps {
  t: Messages;
  document: PresentationDocument | null;
  status: "idle" | "loading" | "ready" | "readonly" | "error";
  saveStatus: PresentationEditorSaveStatus;
  error: string;
  canUndo: boolean;
  canRedo: boolean;
  loading: LoadingKind;
  exportArtifact: ExportArtifact | null;
  imageAssets?: Record<string, string>;
  onBack: () => void;
  onSave: () => Promise<unknown>;
  onRestore: () => Promise<unknown>;
  onUndo: () => void;
  onRedo: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
  updateDocument: (update: (current: PresentationDocument) => PresentationDocument) => void;
  updateElement: (
    slideId: string,
    elementId: string,
    update: (element: PresentationElement) => void,
  ) => void;
  updateElementTransient: (
    slideId: string,
    elementId: string,
    update: (element: PresentationElement) => void,
  ) => void;
}

interface DragState {
  mode: "move" | "resize";
  handle: ResizeHandle;
  slideId: string;
  elementId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  scale: number;
  keepRatio: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return Boolean(
    element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']"),
  );
}

export function PresentationEditorShell(props: PresentationEditorShellProps) {
  const { t, document: presentationDocument } = props;
  const [slideId, setSlideId] = useState<string | null>(null);
  const [elementId, setElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(false);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [exiting, setExiting] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const clipboardRef = useRef<PresentationElement | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const slides = useMemo(
    () => (presentationDocument ? orderedSlides(presentationDocument) : []),
    [presentationDocument],
  );
  const slide = slides.find((item) => item.id === slideId) ?? slides[0] ?? null;
  const element = slide?.elements.find((item) => item.id === elementId) ?? null;

  useEffect(() => {
    if (slides.length === 0) return;
    if (!slideId || !slides.some((item) => item.id === slideId)) {
      setSlideId(slides[0]!.id);
    }
  }, [slides, slideId]);

  useEffect(() => {
    setElementId(null);
    setEditingElementId(null);
  }, [slide?.id]);

  const logicalWidth = presentationDocument?.width ?? 1280;
  const logicalHeight = presentationDocument?.height ?? 720;

  // Fit-to-screen scale: recomputed whenever the canvas area resizes
  // (window resize, filmstrip collapse, toolbar width changes).
  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    const update = () => {
      // Mirror .editor-canvas-scroll padding (88px top, 64px bottom, 24px sides).
      const width = area.clientWidth - 48;
      const height = area.clientHeight - 152;
      if (width <= 0 || height <= 0) return;
      setFitScale(Math.max(0.05, Math.min(width / logicalWidth, height / logicalHeight)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, [logicalWidth, logicalHeight]);

  const scale = zoom === "fit" ? fitScale : zoom;
  const zoomPercent = Math.round(scale * 100);

  const zoomBy = (direction: 1 | -1) => {
    const current = scale;
    const next = direction === 1
      ? ZOOM_STEPS.find((step) => step > current + 0.001)
      : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001);
    if (next) setZoom(next);
  };

  const selectElement = useCallback((next: string | null) => {
    setElementId(next);
    if (next !== editingElementId) setEditingElementId(null);
  }, [editingElementId]);

  const commitDrag = props.updateElement;
  const beginDrag = (
    target: PresentationElement,
    event: React.PointerEvent,
    mode: "move" | "resize",
    handle: ResizeHandle = "se",
  ) => {
    if (!slide || target.locked || target.type === "unsupported") return;
    event.preventDefault();
    // Snapshot the pre-drag state into undo history.
    commitDrag(slide.id, target.id, () => undefined);
    const renderer = (event.currentTarget as Element).closest(".presentation-renderer");
    const renderedScale = renderer
      ? renderer.getBoundingClientRect().width / logicalWidth
      : scale;
    dragRef.current = {
      mode,
      handle,
      slideId: slide.id,
      elementId: target.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: target.x,
      originY: target.y,
      originWidth: target.width,
      originHeight: target.height,
      scale: renderedScale || 1,
      keepRatio: target.type === "image",
    };
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / drag.scale;
      const dy = (event.clientY - drag.startY) / drag.scale;
      props.updateElementTransient(drag.slideId, drag.elementId, (target) => {
        if (drag.mode === "move") {
          target.x = Math.round(drag.originX + dx);
          target.y = Math.round(drag.originY + dy);
          return;
        }
        let x = drag.originX;
        let y = drag.originY;
        let width = drag.originWidth;
        let height = drag.originHeight;
        const { handle } = drag;
        if (handle.includes("e")) width = drag.originWidth + dx;
        if (handle.includes("s")) height = drag.originHeight + dy;
        if (handle.includes("w")) {
          width = drag.originWidth - dx;
          x = drag.originX + dx;
        }
        if (handle.includes("n")) {
          height = drag.originHeight - dy;
          y = drag.originY + dy;
        }
        const keepRatio = drag.keepRatio !== event.shiftKey;
        if (keepRatio && handle.length === 2 && drag.originWidth > 0 && drag.originHeight > 0) {
          const ratio = drag.originWidth / drag.originHeight;
          if (Math.abs(width - drag.originWidth) >= Math.abs(height - drag.originHeight) * ratio) {
            height = width / ratio;
          } else {
            width = height * ratio;
          }
          if (handle.includes("w")) x = drag.originX + (drag.originWidth - width);
          if (handle.includes("n")) y = drag.originY + (drag.originHeight - height);
        }
        if (width < MIN_ELEMENT_SIZE) {
          if (handle.includes("w")) x -= MIN_ELEMENT_SIZE - width;
          width = MIN_ELEMENT_SIZE;
        }
        if (height < MIN_ELEMENT_SIZE) {
          if (handle.includes("n")) y -= MIN_ELEMENT_SIZE - height;
          height = MIN_ELEMENT_SIZE;
        }
        target.x = Math.round(x);
        target.y = Math.round(y);
        target.width = Math.round(width);
        target.height = Math.round(height);
      });
    };
    const end = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [props.updateElementTransient]);

  const removeSelectedElement = useCallback(() => {
    if (!slide || !element || element.type === "unsupported" || element.locked) return;
    const targetId = element.id;
    props.updateDocument((current) => {
      deleteElement(current, slide.id, targetId);
      return current;
    });
    setElementId(null);
  }, [element, props, slide]);

  const nudgeSelectedElement = useCallback((dx: number, dy: number) => {
    if (!slide || !element || element.type === "unsupported" || element.locked) return;
    props.updateElement(slide.id, element.id, (target) => {
      target.x += dx;
      target.y += dy;
    });
  }, [element, props, slide]);

  const duplicateSelection = useCallback(() => {
    if (!slide) return;
    if (element && element.type !== "unsupported") {
      const source = structuredClone(element);
      props.updateDocument((current) => {
        const result = pasteElement(current, slide.id, source);
        if (result) setElementId(result.elementId);
        return current;
      });
      return;
    }
    props.updateDocument((current) => {
      const newId = duplicateSlide(current, slide.id);
      if (newId) setSlideId(newId);
      return current;
    });
  }, [element, props, slide]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key;
      if (meta && key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) props.onRedo();
        else props.onUndo();
        return;
      }
      if (meta && key.toLowerCase() === "y") {
        event.preventDefault();
        props.onRedo();
        return;
      }
      if (meta && key.toLowerCase() === "c") {
        if (element && element.type !== "unsupported") {
          clipboardRef.current = structuredClone(element);
          event.preventDefault();
        }
        return;
      }
      if (meta && key.toLowerCase() === "v") {
        const copied = clipboardRef.current;
        if (copied && slide) {
          event.preventDefault();
          props.updateDocument((current) => {
            const result = pasteElement(current, slide.id, copied);
            if (result) setElementId(result.elementId);
            return current;
          });
        }
        return;
      }
      if (meta && key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        if (element) {
          event.preventDefault();
          removeSelectedElement();
        }
        return;
      }
      if (key === "Escape") {
        setEditingElementId(null);
        setElementId(null);
        return;
      }
      if (key === "Enter") {
        if (element && (element.type === "text" || element.type === "shape") && !element.locked) {
          event.preventDefault();
          setEditingElementId(element.id);
        }
        return;
      }
      if (key.startsWith("Arrow")) {
        if (!element) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
        const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
        nudgeSelectedElement(dx, dy);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [duplicateSelection, element, nudgeSelectedElement, props, removeSelectedElement, slide]);

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

  const handleAddImage = async (file: File) => {
    if (!slide) return;
    const src = await readFileAsDataUrl(file);
    props.updateDocument((current) => {
      const result = addImageElement(current, slide.id, src);
      if (result) setElementId(result.elementId);
      return current;
    });
  };

  const handleReplaceImage = async (file: File) => {
    if (!slide || !element || element.type !== "image") return;
    const src = await readFileAsDataUrl(file);
    props.updateElement(slide.id, element.id, (target) => {
      if (target.type !== "image") return;
      target.src = src;
      const source = target.sourceData as Record<string, unknown>;
      const picture = source.picture as Record<string, unknown> | undefined;
      if (picture) {
        picture.path = src;
        picture.is_network = false;
      }
    });
  };

  const handleArrange = (action: ArrangeAction) => {
    if (!slide || !element) return;
    const targetId = element.id;
    props.updateDocument((current) => {
      arrangeElement(current, slide.id, targetId, action);
      return current;
    });
  };

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      if (props.saveStatus === "conflict") {
        if (!window.confirm(t.editor.exitConflictWarning)) return;
      } else if (props.saveStatus !== "saved") {
        try {
          await props.onSave();
        } catch {
          if (!window.confirm(t.editor.exitSaveFailedWarning)) return;
        }
      }
      props.onBack();
    } finally {
      setExiting(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm(t.editor.restoreConfirm)) return;
    try {
      await props.onRestore();
      setElementId(null);
      setEditingElementId(null);
    } catch {
      // Failure state is surfaced through saveStatus/error.
    }
  };

  if (props.status === "loading" || props.status === "idle") {
    return (
      <div className="presentation-editor-shell">
        <div className="editor-shell-message">{t.editor.structuredLoading}</div>
      </div>
    );
  }

  if (!presentationDocument || !slide) {
    return (
      <div className="presentation-editor-shell">
        <div className="editor-shell-message error">
          <p>{props.error || t.editor.structuredUnavailable}</p>
          <button type="button" className="editor-btn" onClick={props.onBack}>{t.editor.back}</button>
        </div>
      </div>
    );
  }

  const saveStateLabel = t.editor[props.saveStatus];
  const revisionLabel = presentationDocument.revision > 0
    ? formatMessage(t.editor.revisionEdited, { revision: String(presentationDocument.revision) })
    : t.editor.revisionOriginal;

  return (
    <div className="presentation-editor-shell" data-editor-shell="true">
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleAddImage(file);
        }}
      />
      <input
        ref={replaceInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleReplaceImage(file);
        }}
      />

      <SlideFilmstrip
        t={t}
        document={presentationDocument}
        slides={slides}
        activeSlideId={slide.id}
        collapsed={filmstripCollapsed}
        onToggleCollapsed={() => setFilmstripCollapsed((value) => !value)}
        onBack={() => void handleExit()}
        onSelectSlide={(id) => {
          setSlideId(id);
          setElementId(null);
        }}
        onSelectSlideId={setSlideId}
        updateDocument={props.updateDocument}
        imageAssets={props.imageAssets}
      />

      <FloatingContextToolbar
        t={t}
        slide={slide}
        element={element}
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        exporting={props.loading === "export"}
        exportArtifact={props.exportArtifact}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onAddText={() => {
          props.updateDocument((current) => {
            const result = addTextElement(current, slide.id);
            if (result) {
              setElementId(result.elementId);
              setEditingElementId(result.elementId);
            }
            return current;
          });
        }}
        onAddImage={() => fileInputRef.current?.click()}
        onAddShape={() => {
          props.updateDocument((current) => {
            const result = addShapeElement(current, slide.id);
            if (result) setElementId(result.elementId);
            return current;
          });
        }}
        onReplaceImage={() => replaceInputRef.current?.click()}
        onArrange={handleArrange}
        onDeleteElement={removeSelectedElement}
        onRestore={() => void handleRestore()}
        onExport={props.onExport}
        onDownloadArtifact={(artifact) => void downloadExportArtifact(artifact)}
        updateDocument={props.updateDocument}
        updateElement={props.updateElement}
      />

      <div className="editor-canvas-area">
        <div
          ref={canvasAreaRef}
          className="editor-canvas-scroll"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              selectElement(null);
              setEditingElementId(null);
            }
          }}
        >
          <div className="editor-slide-frame" style={{ width: Math.round(logicalWidth * scale) }}>
            <PresentationRenderer
              slide={slide}
              width={logicalWidth}
              height={logicalHeight}
              mode="edit"
              imageAssets={props.imageAssets}
              selectedElementId={elementId}
              editingElementId={editingElementId}
              onSelectElement={selectElement}
              onElementPointerDown={(target, event) => beginDrag(target, event, "move")}
              onElementResizePointerDown={(target, event, handle) => beginDrag(target, event, "resize", handle)}
              onElementDoubleClick={(target) => {
                if (target.locked) return;
                if (target.type === "text" || target.type === "shape") {
                  setElementId(target.id);
                  setEditingElementId(target.id);
                } else if (target.type === "image") {
                  setElementId(target.id);
                  replaceInputRef.current?.click();
                }
              }}
              onTextCommit={(target, text) => {
                setEditingElementId(null);
                props.updateElement(slide.id, target.id, (item) => {
                  if (item.type === "text" || item.type === "shape") item.text = text;
                });
              }}
            />
          </div>
        </div>

        <div className="editor-status-bar">
          <div className="editor-zoom-control">
            <button
              type="button"
              className={`editor-btn ghost ${zoom === "fit" ? "active" : ""}`}
              onClick={() => setZoom("fit")}
              title={t.editor.zoomFit}
            >
              {t.editor.zoomFit}
            </button>
            <button type="button" className="editor-btn ghost" onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
            <span className="editor-zoom-value">{zoomPercent}%</span>
            <button type="button" className="editor-btn ghost" onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
          </div>
          <div className={`editor-save-state state-${props.saveStatus}`} role="status">
            <span className="editor-save-dot" />
            {saveStateLabel}
            <span className="editor-revision">{revisionLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
