import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import type {
  PresentationElement,
  PresentationSlideDocument,
} from "../../api/types";
import {
  clearRememberedSelection,
  editorDomToParagraphs,
  editorHtmlToParagraphs,
  elementRichParagraphs,
  modelColorToCss,
  normalizeRichParagraphs,
  paragraphsToEditorHtml,
  rememberEditorSelection,
  resolveRichFont,
  type RichFont,
  type RichParagraph,
} from "./editor/richText";
import { normalizeTableData } from "./editor/documentOps";

export type PresentationRendererMode = "preview" | "edit" | "thumbnail";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

interface PresentationRendererProps {
  slide: PresentationSlideDocument;
  width?: number;
  height?: number;
  mode: PresentationRendererMode;
  /** Maps local file-path image `src` references to browser-loadable data URLs. */
  imageAssets?: Record<string, string>;
  selectedElementId?: string | null;
  editingElementId?: string | null;
  /** Cell being edited when `editingElementId` points at a table element. */
  editingTableCell?: { row: number; col: number } | null;
  /** Cell highlighted (not editing) when the selected element is a table. */
  selectedTableCell?: { row: number; col: number } | null;
  onSelectElement?: (elementId: string | null) => void;
  onElementPointerDown?: (element: PresentationElement, event: React.PointerEvent) => void;
  onElementResizePointerDown?: (
    element: PresentationElement,
    event: React.PointerEvent,
    handle: ResizeHandle,
  ) => void;
  onElementDoubleClick?: (element: PresentationElement) => void;
  onTextCommit?: (element: PresentationElement, text: string) => void;
  onRichTextCommit?: (
    element: PresentationElement,
    text: string,
    paragraphs: RichParagraph[],
  ) => void;
  onTableCellSelect?: (element: PresentationElement, row: number, col: number) => void;
  onTableCellDoubleClick?: (element: PresentationElement, row: number, col: number) => void;
  onTableCellCommit?: (
    element: PresentationElement,
    row: number,
    col: number,
    paragraphs: RichParagraph[],
  ) => void;
  fallback?: React.ReactNode;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function color(value: unknown, fallback = "transparent"): string {
  return typeof value === "string" && value.length > 0
    ? value.startsWith("#") ? value : `#${value}`
    : fallback;
}

function readTextStyle(element: PresentationElement) {
  const source = record(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const firstParagraph = record(paragraphs[0]);
  const runs = Array.isArray(firstParagraph.text_runs) ? firstParagraph.text_runs : [];
  const font = record(firstParagraph.font ?? record(runs[0]).font);
  const fill = record(source.fill);
  const margin = record(source.margin);
  const alignment = firstParagraph.alignment;
  const verticalAlignment = source.vertical_alignment;
  const decorations = [
    font.underline === true ? "underline" : "",
    font.strike === true ? "line-through" : "",
  ].filter(Boolean).join(" ");
  return {
    color: color(font.color, "#111827"),
    fontFamily: typeof font.name === "string" ? font.name : "Arial, sans-serif",
    fontSize: typeof font.size === "number" ? font.size : 20,
    fontWeight: typeof font.font_weight === "number" ? font.font_weight : 400,
    fontStyle: font.italic === true ? "italic" : "normal",
    textDecoration: decorations || "none",
    textAlign: alignment === 2 ? "center" : alignment === 3 ? "right" : alignment === 4 ? "justify" : "left",
    justifyContent: verticalAlignment === 3 ? "center" : verticalAlignment === 4 ? "flex-end" : "flex-start",
    background: color(fill.color),
    backgroundOpacity: typeof fill.opacity === "number" ? fill.opacity : 1,
    borderRadius: typeof source.border_radius === "number" ? source.border_radius : 0,
    padding: `${Number(margin.top) || 0}px ${Number(margin.right) || 0}px ${Number(margin.bottom) || 0}px ${Number(margin.left) || 0}px`,
    // Continuous digits/latin words must never break per character. Wrapping is
    // only allowed for boxes that opted into text wrapping in the source model.
    whiteSpace: source.text_wrap === false ? "pre" : "pre-wrap",
    wordBreak: "normal",
    overflowWrap: source.text_wrap === false ? "normal" : "break-word",
  } as const;
}

function runReactStyle(font: RichFont): React.CSSProperties {
  const decorations = [
    font.underline ? "underline" : "",
    font.strike ? "line-through" : "",
  ].filter(Boolean).join(" ");
  return {
    fontFamily: font.name,
    fontSize: font.size,
    fontWeight: font.font_weight,
    fontStyle: font.italic ? "italic" : "normal",
    textDecorationLine: decorations || "none",
    color: modelColorToCss(font.color),
  };
}

function paragraphReactStyle(paragraph: RichParagraph): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (paragraph.alignment === 2) style.textAlign = "center";
  else if (paragraph.alignment === 3) style.textAlign = "right";
  else if (paragraph.alignment === 4) style.textAlign = "justify";
  if (paragraph.line_height) style.lineHeight = paragraph.line_height;
  if (paragraph.spacing?.top) style.marginTop = paragraph.spacing.top;
  if (paragraph.spacing?.bottom) style.marginBottom = paragraph.spacing.bottom;
  return style;
}

/** Static (non-editing) run-level rendering of a text/shape element's body. */
function RichTextBody(props: { paragraphs: RichParagraph[] }) {
  return (
    <>
      {props.paragraphs.map((paragraph, index) => (
        <div key={index} style={paragraphReactStyle(paragraph)}>
          {paragraph.text_runs.length === 0 ? (
            <br />
          ) : (
            paragraph.text_runs.map((run, runIndex) => (
              <span key={runIndex} style={runReactStyle(resolveRichFont(run.font, paragraph.font))}>
                {run.text}
              </span>
            ))
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Rich-text variant of the inline editor for text/shape elements. Runs are
 * rendered as styled spans so the toolbar can style the current selection
 * (see richText.ts); committing parses the DOM back into paragraphs + text.
 * Like InlineTextEditor it never re-renders while mounted.
 */
const RichTextEditor = memo(function RichTextEditor(props: {
  className: string;
  style: React.CSSProperties;
  paragraphs: RichParagraph[];
  fallbackFont: RichFont;
  onCommit: (text: string, paragraphs: RichParagraph[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const initialHtml = useRef(paragraphsToEditorHtml(props.paragraphs)).current;
  const latestHtmlRef = useRef(initialHtml);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    clearRememberedSelection();
    const node = ref.current;
    const result = node && node.isConnected
      ? editorDomToParagraphs(node, props.fallbackFont)
      : editorHtmlToParagraphs(latestHtmlRef.current, props.fallbackFont);
    props.onCommit(result.text, result.paragraphs);
    // The memo comparator freezes props at mount time, so this closure is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
      rememberEditorSelection(node);
    }
    // Commit on unmount: clicking elsewhere ends editing before blur fires.
    return () => commit();
  }, [commit]);

  const trackSelection = () => {
    if (ref.current) rememberEditorSelection(ref.current);
  };

  return (
    <div
      ref={ref}
      className={props.className}
      style={props.style}
      contentEditable
      suppressContentEditableWarning
      data-inline-text-editor="true"
      data-rich-text-editor="true"
      onInput={() => {
        latestHtmlRef.current = ref.current?.innerHTML ?? latestHtmlRef.current;
        trackSelection();
      }}
      onKeyUp={trackSelection}
      onMouseUp={trackSelection}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const meta = event.ctrlKey || event.metaKey;
        if (meta && event.key.toLowerCase() === "s") {
          event.preventDefault();
          ref.current?.blur();
          return;
        }
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      onBlur={(event) => {
        // Toolbar interactions (styling the selection) must not end editing.
        const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        if (related?.closest(".floating-context-toolbar")) return;
        commit();
      }}
      dangerouslySetInnerHTML={{ __html: initialHtml }}
    />
  );
}, () => true);

function SelectionChrome(props: {
  element: PresentationElement;
  onResizeStart?: (element: PresentationElement, event: React.PointerEvent, handle: ResizeHandle) => void;
}) {
  return (
    <>
      <span className="presentation-selection-label">{props.element.type}</span>
      {RESIZE_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className={`presentation-resize-handle handle-${handle}`}
          aria-label={`Resize ${handle}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            props.onResizeStart?.(props.element, event, handle);
          }}
        />
      ))}
    </>
  );
}

function ElementRenderer(props: {
  element: PresentationElement;
  selected: boolean;
  editing: boolean;
  mode: PresentationRendererMode;
  imageAssets?: Record<string, string>;
  editingTableCell?: { row: number; col: number } | null;
  selectedTableCell?: { row: number; col: number } | null;
  onSelect?: (elementId: string) => void;
  onDragStart?: (element: PresentationElement, event: React.PointerEvent) => void;
  onResizeStart?: (element: PresentationElement, event: React.PointerEvent, handle: ResizeHandle) => void;
  onDoubleClick?: (element: PresentationElement) => void;
  onTextCommit?: (element: PresentationElement, text: string) => void;
  onRichTextCommit?: (
    element: PresentationElement,
    text: string,
    paragraphs: RichParagraph[],
  ) => void;
  onTableCellSelect?: (element: PresentationElement, row: number, col: number) => void;
  onTableCellDoubleClick?: (element: PresentationElement, row: number, col: number) => void;
  onTableCellCommit?: (
    element: PresentationElement,
    row: number,
    col: number,
    paragraphs: RichParagraph[],
  ) => void;
}) {
  const { element } = props;
  if (element.hidden) return null;
  const interactive = props.mode === "edit";
  const style = readTextStyle(element);
  const source = record(element.sourceData);
  const stroke = record(source.stroke);
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    opacity: element.opacity ?? 1,
    boxSizing: "border-box",
    pointerEvents: interactive ? "auto" : "none",
  };
  const className = [
    "presentation-element",
    props.selected ? "selected" : "",
    props.editing ? "editing" : "",
    element.locked ? "locked" : "",
  ].filter(Boolean).join(" ");
  const commonProps = {
    "data-element-id": element.id,
    className,
    onPointerDown: interactive
      ? (event: React.PointerEvent) => {
          if (props.editing) return;
          event.stopPropagation();
          props.onSelect?.(element.id);
          props.onDragStart?.(element, event);
        }
      : undefined,
    onDoubleClick: interactive
      ? (event: React.MouseEvent) => {
          event.stopPropagation();
          props.onDoubleClick?.(element);
        }
      : undefined,
  };
  const showChrome = interactive && props.selected && !props.editing;
  const hyperlinkBadge = element.hyperlink && props.mode !== "thumbnail" ? (
    <span className="presentation-hyperlink-badge" title={element.hyperlink}>
      <LinkIcon size={11} />
    </span>
  ) : null;

  if (element.type === "image") {
    const objectFit = record(source.object_fit).fit;
    return (
      <div {...commonProps} style={baseStyle}>
        <img
          src={props.imageAssets?.[element.src] ?? element.src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: objectFit === "contain" || objectFit === "fill" ? objectFit : "cover",
            borderRadius: style.borderRadius,
          }}
        />
        {hyperlinkBadge}
        {showChrome ? (
          <SelectionChrome element={element} onResizeStart={props.onResizeStart} />
        ) : null}
      </div>
    );
  }

  if (element.type === "unsupported") {
    if (element.metadata.sourceShapeType === "connector") {
      const connectorColor = color(source.color, "#6b7280");
      const thickness = typeof source.thickness === "number" ? source.thickness : 2;
      return (
        <svg {...commonProps} style={baseStyle} viewBox={`0 0 ${element.width} ${element.height}`}>
          <line x1="0" y1="0" x2={element.width} y2={element.height} stroke={connectorColor} strokeWidth={thickness} />
        </svg>
      );
    }
    return <div {...commonProps} style={{ ...baseStyle, background: "rgba(148, 163, 184, .15)" }} />;
  }

  if (element.type === "table") {
    const { cells, style: tableStyle } = normalizeTableData(element.table);
    const columnCount = cells[0]?.length ?? 0;
    const cellFallbackFont = resolveRichFont({
      name: tableStyle.fontName,
      size: tableStyle.fontSize,
      color: tableStyle.textColor,
    });
    return (
      <div
        {...commonProps}
        style={{
          ...baseStyle,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, 1fr)`,
          gridTemplateRows: `repeat(${Math.max(cells.length, 1)}, 1fr)`,
          fontFamily: tableStyle.fontName,
          fontSize: tableStyle.fontSize,
        }}
      >
        {cells.map((row, rowIndex) => row.map((cell, colIndex) => {
          const cellStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
            padding: "2px 6px",
            border: `1px solid ${color(tableStyle.borderColor, "#e5e7eb")}`,
            background: color(cell.fill, "#ffffff"),
            color: color(tableStyle.textColor, "#1f2937"),
            whiteSpace: "pre-wrap",
            wordBreak: "normal",
            overflowWrap: "break-word",
          };
          const paragraphs = normalizeRichParagraphs(cell.paragraphs, cellFallbackFont);
          const cellEditing = interactive &&
            props.editing &&
            props.editingTableCell?.row === rowIndex &&
            props.editingTableCell?.col === colIndex;
          if (cellEditing) {
            return (
              <RichTextEditor
                key={`cell-${rowIndex}-${colIndex}-editing`}
                className="presentation-table-cell editing"
                style={{ ...cellStyle, overflow: "visible", userSelect: "text", cursor: "text" }}
                paragraphs={paragraphs}
                fallbackFont={cellFallbackFont}
                onCommit={(_, nextParagraphs) =>
                  props.onTableCellCommit?.(element, rowIndex, colIndex, nextParagraphs)}
              />
            );
          }
          const cellSelected = props.selected &&
            props.selectedTableCell?.row === rowIndex &&
            props.selectedTableCell?.col === colIndex;
          return (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              className={`presentation-table-cell${cellSelected ? " selected" : ""}`}
              style={cellStyle}
              // Selecting a cell must not block dragging: the event still
              // bubbles to the element's pointer-down (select + drag start).
              onPointerDown={interactive
                ? () => {
                    if (props.selected) props.onTableCellSelect?.(element, rowIndex, colIndex);
                  }
                : undefined}
              onDoubleClick={interactive
                ? (event) => {
                    event.stopPropagation();
                    props.onTableCellDoubleClick?.(element, rowIndex, colIndex);
                  }
                : undefined}
            >
              <RichTextBody paragraphs={paragraphs} />
            </div>
          );
        }))}
        {showChrome ? (
          <SelectionChrome element={element} onResizeStart={props.onResizeStart} />
        ) : null}
      </div>
    );
  }

  const paragraphs = elementRichParagraphs(element);
  const fallbackFont = resolveRichFont({
    name: style.fontFamily,
    size: style.fontSize,
    font_weight: style.fontWeight,
    italic: style.fontStyle === "italic",
    color: style.color.replace(/^#/, ""),
  });
  const textStyle: React.CSSProperties = {
    ...baseStyle,
    display: "flex",
    overflow: "hidden",
    padding: style.padding,
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    textAlign: style.textAlign,
    justifyContent: style.justifyContent,
    whiteSpace: style.whiteSpace,
    wordBreak: style.wordBreak,
    overflowWrap: style.overflowWrap,
    background: style.background === "transparent"
      ? "transparent"
      : `color-mix(in srgb, ${style.background} ${style.backgroundOpacity * 100}%, transparent)`,
    borderRadius: element.type === "shape" && element.shapeType === "rounded_rectangle"
      ? Math.max(style.borderRadius, 12)
      : style.borderRadius,
    border: typeof stroke.thickness === "number" && stroke.thickness > 0
      ? `${stroke.thickness}px solid ${color(stroke.color, "transparent")}`
      : undefined,
    flexDirection: "column",
  };

  if (props.editing && interactive) {
    return (
      <RichTextEditor
        key={`${element.id}-editing`}
        className={`${className} presentation-text-editing`}
        style={{ ...textStyle, overflow: "visible", userSelect: "text", cursor: "text" }}
        paragraphs={paragraphs}
        fallbackFont={fallbackFont}
        onCommit={(value, nextParagraphs) => props.onRichTextCommit?.(element, value, nextParagraphs)}
      />
    );
  }

  return (
    <div {...commonProps} style={textStyle}>
      <RichTextBody paragraphs={paragraphs} />
      {hyperlinkBadge}
      {showChrome ? (
        <SelectionChrome element={element} onResizeStart={props.onResizeStart} />
      ) : null}
    </div>
  );
}

export function PresentationRenderer(props: PresentationRendererProps) {
  const logicalWidth = props.width ?? 1280;
  const logicalHeight = props.height ?? 720;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setScale(container.clientWidth / logicalWidth || 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [logicalWidth]);

  if (!props.slide) return <>{props.fallback}</>;
  return (
    <div
      ref={containerRef}
      className={`presentation-renderer mode-${props.mode}`}
      style={{ aspectRatio: `${logicalWidth} / ${logicalHeight}` }}
      onPointerDown={props.mode === "edit" ? () => props.onSelectElement?.(null) : undefined}
    >
      <div
        className="presentation-slide-canvas"
        data-slide-id={props.slide.id}
        style={{
          width: logicalWidth,
          height: logicalHeight,
          transform: `scale(${scale})`,
          background: props.slide.background
            ? color(props.slide.background.color, "#ffffff")
            : "#ffffff",
          ["--renderer-scale" as string]: String(scale || 1),
        }}
      >
        {[...props.slide.elements]
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((element) => (
            <ElementRenderer
              key={element.id}
              element={element}
              selected={props.selectedElementId === element.id}
              editing={props.editingElementId === element.id}
              mode={props.mode}
              imageAssets={props.imageAssets}
              editingTableCell={props.editingTableCell}
              selectedTableCell={props.selectedTableCell}
              onSelect={props.onSelectElement ?? undefined}
              onDragStart={props.onElementPointerDown}
              onResizeStart={props.onElementResizePointerDown}
              onDoubleClick={props.onElementDoubleClick}
              onTextCommit={props.onTextCommit}
              onRichTextCommit={props.onRichTextCommit}
              onTableCellSelect={props.onTableCellSelect}
              onTableCellDoubleClick={props.onTableCellDoubleClick}
              onTableCellCommit={props.onTableCellCommit}
            />
          ))}
      </div>
    </div>
  );
}
