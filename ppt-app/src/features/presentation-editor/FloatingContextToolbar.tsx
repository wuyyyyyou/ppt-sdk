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
  Link,
  MoreHorizontal,
  PaintBucket,
  Redo2,
  RotateCcw,
  Shapes,
  Strikethrough,
  Table,
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
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  modelHexColor,
  normalizeTableData,
  patchElementAlignment,
  patchElementFill,
  patchElementFont,
  patchElementParagraphSpacing,
  patchElementStroke,
  patchImageFit,
  patchTableCellAlignment,
  patchTableCellFill,
  patchTableCellFont,
  patchTableStyle,
  readElementFill,
  readElementFont,
  readElementParagraphSpacing,
  readElementStroke,
  readImageFit,
  readTableCellFill,
  readTableCellFont,
  setElementHyperlink,
  type ArrangeAction,
  type TableCellRef,
} from "./editor/documentOps";
import {
  applyFontToActiveEditor,
  applyParagraphPropsToActiveEditor,
} from "./editor/richText";

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

const LINE_HEIGHTS = [1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3];

const PARAGRAPH_SPACINGS = [0, 2, 4, 8, 12, 16, 24, 32];

interface FloatingContextToolbarProps {
  t: Messages;
  slide: PresentationSlideDocument;
  element: PresentationElement | null;
  /** Element currently in inline text editing mode, if any. */
  editingElementId: string | null;
  /** Highlighted cell when the selected element is a table. */
  selectedTableCell: TableCellRef | null;
  onSelectedTableCellChange: (cell: TableCellRef | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  exportArtifact: ExportArtifact | null;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onAddImage: () => void;
  onAddShape: () => void;
  onAddTable: () => void;
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
  const { t, slide, element, selectedTableCell } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);
  const arrangeRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen && !arrangeOpen && !linkOpen) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node) {
        if (moreRef.current?.contains(event.target)) return;
        if (arrangeRef.current?.contains(event.target)) return;
        if (linkRef.current?.contains(event.target)) return;
      }
      setMoreOpen(false);
      setArrangeOpen(false);
      setLinkOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [moreOpen, arrangeOpen, linkOpen]);

  useEffect(() => {
    setArrangeOpen(false);
    setLinkOpen(false);
  }, [element?.id]);

  // While inline editing, styling is routed to the active editor selection
  // (falling back to the whole content); the model is updated on commit.
  const editingSelected = element !== null && props.editingElementId === element.id;

  const editableElement = element && element.type !== "unsupported" && !element.locked ? element : null;
  const isTable = editableElement?.type === "table";
  const tableData = isTable ? normalizeTableData(editableElement.table) : null;

  const patchFont = (patch: Parameters<typeof patchElementFont>[1]) => {
    if (!element) return;
    if (editingSelected && applyFontToActiveEditor(patch)) return;
    props.updateElement(slide.id, element.id, (target) => {
      if (target.type === "table") patchTableCellFont(target, selectedTableCell, patch);
      else patchElementFont(target, patch);
    });
  };

  const patchAlignment = (alignment: 1 | 2 | 3) => {
    if (!element) return;
    if (editingSelected && applyParagraphPropsToActiveEditor({ alignment }, "selection")) return;
    props.updateElement(slide.id, element.id, (target) => {
      if (target.type === "table") patchTableCellAlignment(target, selectedTableCell, alignment);
      else patchElementAlignment(target, alignment);
    });
  };

  const patchSpacing = (patch: Parameters<typeof patchElementParagraphSpacing>[1]) => {
    if (!element) return;
    if (editingSelected && applyParagraphPropsToActiveEditor({
      ...(patch.lineHeight !== undefined ? { line_height: patch.lineHeight } : {}),
      ...(patch.spaceBefore !== undefined || patch.spaceAfter !== undefined
        ? { spacing: { top: patch.spaceBefore, bottom: patch.spaceAfter } }
        : {}),
    }, "all")) return;
    props.updateElement(slide.id, element.id, (target) => patchElementParagraphSpacing(target, patch));
  };

  const font = editableElement
    ? editableElement.type === "text" || editableElement.type === "shape"
      ? readElementFont(editableElement)
      : isTable
        ? readTableCellFont(editableElement, selectedTableCell)
        : null
    : null;
  const fill = editableElement && (editableElement.type === "text" || editableElement.type === "shape")
    ? readElementFill(editableElement)
    : null;
  const stroke = editableElement && (editableElement.type === "text" || editableElement.type === "shape")
    ? readElementStroke(editableElement)
    : null;
  const spacing = editableElement && (editableElement.type === "text" || editableElement.type === "shape")
    ? readElementParagraphSpacing(editableElement)
    : null;
  const linkable = editableElement && editableElement.type !== "table" ? editableElement : null;

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

  const linkMenu = linkable ? (
    <div className="toolbar-popover-anchor" ref={linkRef}>
      <button
        type="button"
        className={`editor-btn icon ${linkable.hyperlink || linkOpen ? "active" : ""}`}
        title={t.editor.hyperlink}
        onClick={() => {
          setLinkDraft(linkable.hyperlink ?? "");
          setLinkOpen((value) => !value);
        }}
      >
        <Link size={15} />
      </button>
      {linkOpen ? (
        <div className="toolbar-menu toolbar-link-menu" role="menu">
          <input
            type="url"
            className="toolbar-link-input"
            placeholder={t.editor.hyperlinkPlaceholder}
            value={linkDraft}
            autoFocus
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                props.updateElement(slide.id, linkable.id, (target) => setElementHyperlink(target, linkDraft));
                setLinkOpen(false);
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
          />
          <div className="toolbar-link-actions">
            <button
              type="button"
              className="editor-btn primary"
              onClick={() => {
                props.updateElement(slide.id, linkable.id, (target) => setElementHyperlink(target, linkDraft));
                setLinkOpen(false);
              }}
            >
              {t.editor.hyperlinkApply}
            </button>
            {linkable.hyperlink ? (
              <button
                type="button"
                className="editor-btn"
                onClick={() => {
                  props.updateElement(slide.id, linkable.id, (target) => setElementHyperlink(target, ""));
                  setLinkOpen(false);
                }}
              >
                {t.editor.hyperlinkRemove}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

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

  const fontControls = editableElement && font ? (
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
          onClick={() => patchAlignment(alignment)}
        >
          <Icon size={15} />
        </button>
      ))}
      {spacing ? (
        <>
          <Divider />
          <select
            className="toolbar-select line-height"
            title={t.editor.lineHeight}
            value={spacing.lineHeight ? String(spacing.lineHeight) : ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value > 0) patchSpacing({ lineHeight: value });
            }}
          >
            {!spacing.lineHeight || LINE_HEIGHTS.includes(spacing.lineHeight) ? null : (
              <option value={String(spacing.lineHeight)}>{spacing.lineHeight}</option>
            )}
            {spacing.lineHeight ? null : <option value="">{t.editor.lineHeightAuto}</option>}
            {LINE_HEIGHTS.map((value) => (
              <option key={value} value={String(value)}>{value}</option>
            ))}
          </select>
          <select
            className="toolbar-select paragraph-spacing"
            title={t.editor.paragraphSpacing}
            value={String(spacing.spaceAfter)}
            onChange={(event) => patchSpacing({ spaceAfter: Number(event.target.value) })}
          >
            {PARAGRAPH_SPACINGS.includes(spacing.spaceAfter) ? null : (
              <option value={String(spacing.spaceAfter)}>{spacing.spaceAfter}pt</option>
            )}
            {PARAGRAPH_SPACINGS.map((value) => (
              <option key={value} value={String(value)}>{value}pt</option>
            ))}
          </select>
        </>
      ) : null}
      <Divider />
      <label className="toolbar-color" title={t.editor.textColor}>
        <span className="toolbar-color-sample" style={{ color: cssHexColor(font.color) }}>A</span>
        <input
          type="color"
          value={cssHexColor(font.color)}
          onChange={(event) => patchFont({ color: modelHexColor(event.target.value) })}
        />
      </label>
    </>
  ) : null;

  return (
    <div className="floating-context-toolbar" role="toolbar">
      <div className="toolbar-row">
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
            <button type="button" className="editor-btn icon" title={t.editor.addTable} onClick={props.onAddTable}>
              <Table size={15} />
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

        {fontControls}

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
      </div>

      {editableElement ? (
        <div className="toolbar-row">
          {isTable && tableData ? (
            <>
              <button
                type="button"
                className="editor-btn text"
                onClick={() => props.updateElement(slide.id, editableElement.id, (target) =>
                  insertTableRow(target, selectedTableCell?.row))}
              >
                {t.editor.tableInsertRow}
              </button>
              <button
                type="button"
                className="editor-btn text"
                disabled={tableData.cells.length <= 1}
                onClick={() => {
                  props.updateElement(slide.id, editableElement.id, (target) =>
                    deleteTableRow(target, selectedTableCell?.row));
                  props.onSelectedTableCellChange(null);
                }}
              >
                {t.editor.tableDeleteRow}
              </button>
              <button
                type="button"
                className="editor-btn text"
                onClick={() => props.updateElement(slide.id, editableElement.id, (target) =>
                  insertTableColumn(target, selectedTableCell?.col))}
              >
                {t.editor.tableInsertColumn}
              </button>
              <button
                type="button"
                className="editor-btn text"
                disabled={(tableData.cells[0]?.length ?? 0) <= 1}
                onClick={() => {
                  props.updateElement(slide.id, editableElement.id, (target) =>
                    deleteTableColumn(target, selectedTableCell?.col));
                  props.onSelectedTableCellChange(null);
                }}
              >
                {t.editor.tableDeleteColumn}
              </button>
              <Divider />
              <label
                className="toolbar-color"
                title={selectedTableCell ? t.editor.tableCellFill : t.editor.tableAllCellsFill}
              >
                <PaintBucket size={15} />
                <input
                  type="color"
                  value={cssHexColor(readTableCellFill(editableElement, selectedTableCell), "#ffffff")}
                  onChange={(event) => {
                    const fillColor = modelHexColor(event.target.value);
                    props.updateElement(slide.id, editableElement.id, (target) => {
                      patchTableCellFill(target, selectedTableCell, fillColor);
                    });
                  }}
                />
              </label>
              <label className="toolbar-color" title={t.editor.borderColor}>
                <span className="toolbar-border-sample" />
                <input
                  type="color"
                  value={cssHexColor(tableData.style.borderColor, "#e5e7eb")}
                  onChange={(event) => {
                    const borderColor = modelHexColor(event.target.value);
                    props.updateElement(slide.id, editableElement.id, (target) => {
                      patchTableStyle(target, { borderColor });
                    });
                  }}
                />
              </label>
              {selectedTableCell ? (
                <span className="toolbar-hint">
                  {`R${selectedTableCell.row + 1} · C${selectedTableCell.col + 1}`}
                </span>
              ) : null}
            </>
          ) : null}

          {editableElement.type === "text" || editableElement.type === "shape" ? (
            <>
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
              {stroke ? (
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
            </>
          ) : null}

          <span className="toolbar-spacer" />
          {linkMenu}
          {opacityControl}
          {arrangeMenu}
          {deleteButton}
        </div>
      ) : null}

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
