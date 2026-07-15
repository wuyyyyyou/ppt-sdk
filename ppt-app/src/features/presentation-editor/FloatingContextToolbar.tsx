import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bold,
  Download,
  FileText,
  File,
  ImagePlus,
  Italic,
  Keyboard,
  Layers,
  MoreHorizontal,
  PaintBucket,
  Redo2,
  RotateCcw,
  Shapes,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  PresentationDocument,
  PresentationElement,
  PresentationSlideDocument,
} from "../../api/types";
import type { ExportArtifact } from "../deck-workspace/types";
import type { Messages } from "../../i18n/messages";
import {
  clearElementFill,
  cssHexColor,
  modelHexColor,
  patchElementAlignment,
  patchElementFill,
  patchElementFont,
  patchElementStroke,
  patchImageFit,
  readElementFill,
  readElementFont,
  readElementStroke,
  readImageFit,
  type ArrangeAction,
} from "./editor/documentOps";

const FONT_FAMILIES = [
  "Microsoft YaHei",
  "Inter",
  "Arial",
  "Roboto",
  "Georgia",
  "Times New Roman",
  "Courier New",
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 88];

interface FloatingContextToolbarProps {
  t: Messages;
  slide: PresentationSlideDocument;
  element: PresentationElement | null;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  exportArtifact: ExportArtifact | null;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onAddImage: () => void;
  onAddShape: () => void;
  onReplaceImage: () => void;
  onArrange: (action: ArrangeAction) => void;
  onDeleteElement: () => void;
  onRestore: () => void;
  onExport: (type: "PPTX" | "PDF") => void;
  onDownloadArtifact: (artifact: ExportArtifact) => void;
  updateDocument: (update: (current: PresentationDocument) => PresentationDocument) => void;
  updateElement: (
    slideId: string,
    elementId: string,
    update: (element: PresentationElement) => void,
  ) => void;
}

function Divider() {
  return <span className="toolbar-divider" aria-hidden="true" />;
}

export function FloatingContextToolbar(props: FloatingContextToolbarProps) {
  const { t, slide, element } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const arrangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen && !arrangeOpen) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node) {
        if (moreRef.current?.contains(event.target)) return;
        if (arrangeRef.current?.contains(event.target)) return;
      }
      setMoreOpen(false);
      setArrangeOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [moreOpen, arrangeOpen]);

  useEffect(() => {
    setArrangeOpen(false);
  }, [element?.id]);

  const patchFont = (patch: Parameters<typeof patchElementFont>[1]) => {
    if (!element) return;
    props.updateElement(slide.id, element.id, (target) => patchElementFont(target, patch));
  };

  const editableElement = element && element.type !== "unsupported" && !element.locked ? element : null;
  const font = editableElement && (editableElement.type === "text" || editableElement.type === "shape")
    ? readElementFont(editableElement)
    : null;
  const fill = editableElement && (editableElement.type === "text" || editableElement.type === "shape")
    ? readElementFill(editableElement)
    : null;
  const stroke = editableElement?.type === "shape" ? readElementStroke(editableElement) : null;

  const arrangeMenu = (
    <div className="toolbar-popover-anchor" ref={arrangeRef}>
      <button
        type="button"
        className={`editor-btn icon ${arrangeOpen ? "active" : ""}`}
        title={t.editor.arrange}
        onClick={() => setArrangeOpen((value) => !value)}
      >
        <Layers size={15} />
      </button>
      {arrangeOpen ? (
        <div className="toolbar-menu" role="menu">
          {([
            ["front", ArrowUpToLine, t.editor.bringToFront],
            ["forward", ArrowUp, t.editor.bringForward],
            ["backward", ArrowDown, t.editor.sendBackward],
            ["back", ArrowDownToLine, t.editor.sendToBack],
          ] as const).map(([action, Icon, label]) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => {
                props.onArrange(action);
                setArrangeOpen(false);
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const deleteButton = (
    <button
      type="button"
      className="editor-btn icon danger"
      title={`${t.editor.delete} (Delete)`}
      onClick={props.onDeleteElement}
    >
      <Trash2 size={15} />
    </button>
  );

  const opacityControl = editableElement ? (
    <label className="toolbar-field" title={t.editor.opacity}>
      <span className="toolbar-field-label">{t.editor.opacity}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((editableElement.opacity ?? 1) * 100)}
        onChange={(event) => {
          const value = Number(event.target.value) / 100;
          props.updateElement(slide.id, editableElement.id, (target) => {
            target.opacity = value;
          });
        }}
      />
    </label>
  ) : null;

  return (
    <div className="floating-context-toolbar" role="toolbar">
      <button
        type="button"
        className="editor-btn icon"
        title={`${t.editor.undo} (Ctrl+Z)`}
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        <Undo2 size={15} />
      </button>
      <button
        type="button"
        className="editor-btn icon"
        title={`${t.editor.redo} (Ctrl+Shift+Z)`}
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        <Redo2 size={15} />
      </button>
      <Divider />

      {!editableElement ? (
        <>
          <button type="button" className="editor-btn icon" title={t.editor.addText} onClick={props.onAddText}>
            <Type size={15} />
          </button>
          <button type="button" className="editor-btn icon" title={t.editor.addImage} onClick={props.onAddImage}>
            <ImagePlus size={15} />
          </button>
          <button type="button" className="editor-btn icon" title={t.editor.addShape} onClick={props.onAddShape}>
            <Shapes size={15} />
          </button>
          <Divider />
          <label className="toolbar-color" title={t.editor.pageBackground}>
            <PaintBucket size={15} />
            <input
              type="color"
              value={cssHexColor(slide.background?.color ?? "FFFFFF", "#ffffff")}
              onChange={(event) => {
                const color = modelHexColor(event.target.value);
                props.updateDocument((current) => {
                  const target = current.slides.find((item) => item.id === slide.id);
                  if (target) target.background = { color, opacity: target.background?.opacity ?? 1 };
                  return current;
                });
              }}
            />
          </label>
          {element && !editableElement ? (
            <span className="toolbar-hint">{t.editor.unsupportedElement}</span>
          ) : null}
        </>
      ) : null}

      {editableElement && font ? (
        <>
          <select
            className="toolbar-select font-family"
            title={t.editor.fontFamily}
            value={FONT_FAMILIES.includes(font.name) ? font.name : font.name}
            onChange={(event) => patchFont({ name: event.target.value })}
          >
            {(FONT_FAMILIES.includes(font.name) ? FONT_FAMILIES : [font.name, ...FONT_FAMILIES]).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            className="toolbar-select font-size"
            title={t.editor.fontSize}
            value={String(font.size)}
            onChange={(event) => patchFont({ size: Number(event.target.value) })}
          >
            {(FONT_SIZES.includes(font.size) ? FONT_SIZES : [font.size, ...FONT_SIZES].sort((a, b) => a - b)).map((size) => (
              <option key={size} value={String(size)}>{size}</option>
            ))}
          </select>
          <Divider />
          <button
            type="button"
            className={`editor-btn icon ${font.bold ? "active" : ""}`}
            title={t.editor.bold}
            onClick={() => patchFont({ font_weight: font.bold ? 400 : 700 })}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className={`editor-btn icon ${font.italic ? "active" : ""}`}
            title={t.editor.italic}
            onClick={() => patchFont({ italic: !font.italic })}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className={`editor-btn icon ${font.underline ? "active" : ""}`}
            title={t.editor.underline}
            onClick={() => patchFont({ underline: !font.underline })}
          >
            <Underline size={15} />
          </button>
          <button
            type="button"
            className={`editor-btn icon ${font.strike ? "active" : ""}`}
            title={t.editor.strike}
            onClick={() => patchFont({ strike: !font.strike })}
          >
            <Strikethrough size={15} />
          </button>
          <Divider />
          {([
            [1, AlignLeft, t.editor.alignLeft],
            [2, AlignCenter, t.editor.alignCenter],
            [3, AlignRight, t.editor.alignRight],
          ] as const).map(([alignment, Icon, label]) => (
            <button
              key={alignment}
              type="button"
              className={`editor-btn icon ${font.alignment === alignment ? "active" : ""}`}
              title={label}
              onClick={() => {
                props.updateElement(slide.id, editableElement.id, (target) => {
                  patchElementAlignment(target, alignment);
                });
              }}
            >
              <Icon size={15} />
            </button>
          ))}
          <Divider />
          <label className="toolbar-color" title={t.editor.textColor}>
            <span className="toolbar-color-sample" style={{ color: cssHexColor(font.color) }}>A</span>
            <input
              type="color"
              value={cssHexColor(font.color)}
              onChange={(event) => patchFont({ color: modelHexColor(event.target.value) })}
            />
          </label>
          {fill ? (
            <label className="toolbar-color" title={t.editor.fillColor}>
              <PaintBucket size={15} />
              <input
                type="color"
                value={cssHexColor(fill.color, "#ffffff")}
                onChange={(event) => {
                  const color = modelHexColor(event.target.value);
                  props.updateElement(slide.id, editableElement.id, (target) => {
                    patchElementFill(target, { color });
                  });
                }}
              />
            </label>
          ) : null}
          {fill && fill.color ? (
            <button
              type="button"
              className="editor-btn text"
              title={t.editor.clearFill}
              onClick={() => {
                props.updateElement(slide.id, editableElement.id, (target) => {
                  clearElementFill(target);
                });
              }}
            >
              {t.editor.clearFill}
            </button>
          ) : null}
          {editableElement.type === "shape" && stroke ? (
            <>
              <label className="toolbar-color" title={t.editor.borderColor}>
                <span className="toolbar-border-sample" />
                <input
                  type="color"
                  value={cssHexColor(stroke.color, "#111827")}
                  onChange={(event) => {
                    const color = modelHexColor(event.target.value);
                    props.updateElement(slide.id, editableElement.id, (target) => {
                      patchElementStroke(target, { color, thickness: Math.max(1, stroke.thickness) });
                    });
                  }}
                />
              </label>
              <select
                className="toolbar-select border-width"
                title={t.editor.borderWidth}
                value={String(stroke.thickness)}
                onChange={(event) => {
                  const thickness = Number(event.target.value);
                  props.updateElement(slide.id, editableElement.id, (target) => {
                    patchElementStroke(target, { thickness });
                  });
                }}
              >
                {[0, 1, 2, 3, 4, 6, 8].map((width) => (
                  <option key={width} value={String(width)}>{width}px</option>
                ))}
              </select>
            </>
          ) : null}
          <Divider />
          {opacityControl}
          {arrangeMenu}
          {deleteButton}
        </>
      ) : null}

      {editableElement?.type === "image" ? (
        <>
          <button type="button" className="editor-btn text" onClick={props.onReplaceImage}>
            <ImagePlus size={15} />
            {t.editor.replaceImage}
          </button>
          <select
            className="toolbar-select"
            title={t.editor.imageFit}
            value={readImageFit(editableElement)}
            onChange={(event) => {
              const fit = event.target.value as "cover" | "contain" | "fill";
              props.updateElement(slide.id, editableElement.id, (target) => {
                patchImageFit(target, fit);
              });
            }}
          >
            <option value="cover">{t.editor.fitCover}</option>
            <option value="contain">{t.editor.fitContain}</option>
            <option value="fill">{t.editor.fitFill}</option>
          </select>
          <Divider />
          {opacityControl}
          {arrangeMenu}
          {deleteButton}
        </>
      ) : null}

      <span className="toolbar-spacer" />
      <div className="toolbar-popover-anchor" ref={moreRef}>
        <button
          type="button"
          className={`editor-btn icon ${moreOpen ? "active" : ""}`}
          title={t.editor.more}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <MoreHorizontal size={15} />
        </button>
        {moreOpen ? (
          <div className="toolbar-menu align-right" role="menu">
            <button
              type="button"
              role="menuitem"
              disabled={props.exporting}
              onClick={() => {
                setMoreOpen(false);
                props.onExport("PPTX");
              }}
            >
              <FileText size={13} />
              {props.exporting ? t.editor.exporting : t.editor.exportPptx}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={props.exporting}
              onClick={() => {
                setMoreOpen(false);
                props.onExport("PDF");
              }}
            >
              <File size={13} />
              {props.exporting ? t.editor.exporting : t.editor.exportPdf}
            </button>
            {props.exportArtifact?.href ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  props.onDownloadArtifact(props.exportArtifact!);
                }}
              >
                <Download size={13} />
                {t.exportPage.download} {props.exportArtifact.type}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                props.onRestore();
              }}
            >
              <RotateCcw size={13} />
              {t.editor.restore}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                setShortcutsOpen(true);
              }}
            >
              <Keyboard size={13} />
              {t.editor.shortcuts}
            </button>
          </div>
        ) : null}
      </div>

      {shortcutsOpen ? (
        <div className="editor-shortcuts-overlay" onClick={() => setShortcutsOpen(false)}>
          <div className="editor-shortcuts-panel" onClick={(event) => event.stopPropagation()}>
            <strong>{t.editor.shortcuts}</strong>
            <table>
              <tbody>
                {t.editor.shortcutList.map(([keys, label]) => (
                  <tr key={keys}>
                    <td><kbd>{keys}</kbd></td>
                    <td>{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="editor-btn" onClick={() => setShortcutsOpen(false)}>
              {t.editor.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}