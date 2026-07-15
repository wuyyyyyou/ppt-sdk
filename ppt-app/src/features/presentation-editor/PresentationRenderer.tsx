import { memo, useEffect, useRef, useState } from "react";
import type {
  PresentationElement,
  PresentationSlideDocument,
} from "../../api/types";

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
  onSelectElement?: (elementId: string | null) => void;
  onElementPointerDown?: (element: PresentationElement, event: React.PointerEvent) => void;
  onElementResizePointerDown?: (
    element: PresentationElement,
    event: React.PointerEvent,
    handle: ResizeHandle,
  ) => void;
  onElementDoubleClick?: (element: PresentationElement) => void;
  onTextCommit?: (element: PresentationElement, text: string) => void;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * ContentEditable surface for inline text editing. It intentionally never
 * re-renders while active (memo comparator always returns true) so React does
 * not fight the browser over the edited DOM text; a remount (key change)
 * starts a fresh editing session.
 */
const InlineTextEditor = memo(function InlineTextEditor(props: {
  className: string;
  style: React.CSSProperties;
  initialText: string;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  return (
    <div
      ref={ref}
      className={props.className}
      style={props.style}
      contentEditable
      suppressContentEditableWarning
      data-inline-text-editor="true"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      onBlur={() => props.onCommit(ref.current?.innerText ?? props.initialText)}
      dangerouslySetInnerHTML={{
        __html: escapeHtml(props.initialText).replaceAll("\n", "<br>"),
      }}
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
  onSelect?: (elementId: string) => void;
  onDragStart?: (element: PresentationElement, event: React.PointerEvent) => void;
  onResizeStart?: (element: PresentationElement, event: React.PointerEvent, handle: ResizeHandle) => void;
  onDoubleClick?: (element: PresentationElement) => void;
  onTextCommit?: (element: PresentationElement, text: string) => void;
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

  const text = element.type === "text" || element.type === "shape" ? element.text : "";
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
    border: element.type === "shape" && typeof stroke.thickness === "number" && stroke.thickness > 0
      ? `${stroke.thickness}px solid ${color(stroke.color, "transparent")}`
      : undefined,
    flexDirection: "column",
  };

  if (props.editing && interactive) {
    return (
      <InlineTextEditor
        key={`${element.id}-editing`}
        className={`${className} presentation-text-editing`}
        style={{ ...textStyle, overflow: "visible", userSelect: "text", cursor: "text" }}
        initialText={text}
        onCommit={(value) => props.onTextCommit?.(element, value)}
      />
    );
  }

  return (
    <div {...commonProps} style={textStyle}>
      {text}
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
              onSelect={props.onSelectElement ?? undefined}
              onDragStart={props.onElementPointerDown}
              onResizeStart={props.onElementResizePointerDown}
              onDoubleClick={props.onElementDoubleClick}
              onTextCommit={props.onTextCommit}
            />
          ))}
      </div>
    </div>
  );
}
