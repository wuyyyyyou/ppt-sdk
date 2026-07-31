import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { MOVEABLE_EDITOR_CLASS, canvasDistance } from "./manualPageEditorInteractions";
import {
  clampSourcePosition,
  constrainCropFrame,
  constrainSourceBox,
  type ImageBox,
} from "./manualPageEditorImages";

export interface ImageCropSession {
  target: HTMLElement;
  sourceUrl: string;
  before: string;
  previousVisibility: string;
  initialFrame: ImageBox;
  frame: ImageBox;
  source: ImageBox;
  sourceAspectRatio: number;
}

interface Props {
  session: ImageCropSession;
  canvasScale: number;
  onChange: (frame: ImageBox, source: ImageBox) => void;
}

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type CropGestureMode = "move-source" | "scale-source" | "resize-frame";

interface CropGesture {
  pointerId: number;
  mode: CropGestureMode;
  direction?: ResizeDirection;
  clientX: number;
  clientY: number;
  frame: ImageBox;
  source: ImageBox;
}

const SOURCE_DIRECTIONS: ResizeDirection[] = ["nw", "ne", "se", "sw"];
const FRAME_DIRECTIONS: ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function boxStyle(box: ImageBox): CSSProperties {
  return {
    position: "absolute",
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    boxSizing: "border-box",
  };
}

function handlePosition(box: ImageBox, direction: ResizeDirection): Pick<CSSProperties, "left" | "top"> {
  const left = direction.includes("w")
    ? box.left
    : direction.includes("e")
      ? box.left + box.width
      : box.left + box.width / 2;
  const top = direction.includes("n")
    ? box.top
    : direction.includes("s")
      ? box.top + box.height
      : box.top + box.height / 2;
  return { left, top };
}

function sourceHandlePosition(
  box: ImageBox,
  direction: ResizeDirection,
): Pick<CSSProperties, "left" | "top"> {
  const insetX = Math.min(14, box.width / 4);
  const insetY = Math.min(14, box.height / 4);
  return {
    left: direction.includes("w") ? box.left + insetX : box.left + box.width - insetX,
    top: direction.includes("n") ? box.top + insetY : box.top + box.height - insetY,
  };
}

function resizeCursor(direction: ResizeDirection): CSSProperties["cursor"] {
  if (direction === "n" || direction === "s") return "ns-resize";
  if (direction === "e" || direction === "w") return "ew-resize";
  if (direction === "ne" || direction === "sw") return "nesw-resize";
  return "nwse-resize";
}

function frameCandidate(
  start: ImageBox,
  direction: ResizeDirection,
  dx: number,
  dy: number,
): ImageBox {
  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;
  if (direction.includes("w")) left += dx;
  if (direction.includes("e")) right += dx;
  if (direction.includes("n")) top += dy;
  if (direction.includes("s")) bottom += dy;
  return { left, top, width: right - left, height: bottom - top };
}

function sourceScaleCandidate(
  start: ImageBox,
  direction: ResizeDirection,
  dx: number,
  dy: number,
): ImageBox {
  const widthFactor = 1 + (direction.includes("e") ? dx : -dx) / start.width;
  const heightFactor = 1 + (direction.includes("s") ? dy : -dy) / start.height;
  const factor = Math.max(0.000001, Math.max(widthFactor, heightFactor));
  const width = start.width * factor;
  const height = start.height * factor;
  return {
    left: start.left + (start.width - width) / 2,
    top: start.top + (start.height - height) / 2,
    width,
    height,
  };
}

export function ManualImageCropOverlay({ session, canvasScale, onChange }: Props) {
  const gesture = useRef<CropGesture | null>(null);

  const beginGesture = (
    event: ReactPointerEvent<HTMLElement>,
    mode: CropGestureMode,
    direction?: ResizeDirection,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointerId: event.pointerId,
      mode,
      direction,
      clientX: event.clientX,
      clientY: event.clientY,
      frame: { ...session.frame },
      source: { ...session.source },
    };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = canvasDistance(
      [event.clientX - active.clientX, event.clientY - active.clientY],
      canvasScale,
    );
    if (active.mode === "move-source") {
      onChange(active.frame, clampSourcePosition({
        ...active.source,
        left: active.source.left + dx,
        top: active.source.top + dy,
      }, active.frame));
      return;
    }
    if (active.mode === "scale-source" && active.direction) {
      const source = constrainSourceBox(
        sourceScaleCandidate(active.source, active.direction, dx, dy),
        active.frame,
        session.sourceAspectRatio,
      );
      onChange(active.frame, source);
      return;
    }
    if (active.mode === "resize-frame" && active.direction) {
      const frame = constrainCropFrame(
        frameCandidate(active.frame, active.direction, dx, dy),
        active.source,
      );
      onChange(frame, constrainSourceBox(active.source, frame, session.sourceAspectRatio));
    }
  };

  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const gestureEvents = {
    onPointerMove: moveGesture,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
    onLostPointerCapture: () => { gesture.current = null; },
  };

  return (
    <div
      className={`${MOVEABLE_EDITOR_CLASS} manual-editor-crop-overlay`}
      style={{ position: "absolute", inset: 0, zIndex: 2147483600, pointerEvents: "none" }}
    >
      <div
        style={{
          ...boxStyle(session.source),
          overflow: "hidden",
          pointerEvents: "none",
          boxShadow: "inset 0 0 0 1.5px rgba(124, 108, 240, .9)",
        }}
      >
        <img
          src={session.sourceUrl}
          alt=""
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            maxWidth: "none",
            maxHeight: "none",
            objectFit: "fill",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>
      <div
        style={{
          ...boxStyle(session.frame),
          border: "1px solid rgba(255, 255, 255, .95)",
          boxShadow: "0 0 0 9999px rgba(17, 24, 39, .54)",
          pointerEvents: "none",
        }}
      />
      <div
        data-crop-interaction="move-source"
        style={{
          ...boxStyle(session.frame),
          zIndex: 1,
          pointerEvents: "auto",
          touchAction: "none",
          cursor: "move",
        }}
        onPointerDown={(event) => beginGesture(event, "move-source")}
        {...gestureEvents}
      />
      {SOURCE_DIRECTIONS.map((direction) => (
        <span
          key={`source-${direction}`}
          data-crop-interaction={`scale-source-${direction}`}
          style={{
            position: "absolute",
            ...sourceHandlePosition(session.source, direction),
            zIndex: 2,
            width: 18,
            height: 18,
            marginLeft: -9,
            marginTop: -9,
            boxSizing: "border-box",
            border: "3px solid rgba(255, 255, 255, .94)",
            borderRadius: "50%",
            background: "#7c6cf0",
            boxShadow: "0 1px 4px rgba(17, 24, 39, .45)",
            pointerEvents: "auto",
            touchAction: "none",
            cursor: resizeCursor(direction),
          }}
          onPointerDown={(event) => beginGesture(event, "scale-source", direction)}
          {...gestureEvents}
        />
      ))}
      {FRAME_DIRECTIONS.map((direction) => (
        <span
          key={`frame-${direction}`}
          data-crop-interaction={`resize-frame-${direction}`}
          style={{
            position: "absolute",
            ...handlePosition(session.frame, direction),
            zIndex: 3,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
            boxSizing: "border-box",
            border: "2px solid #fff",
            borderRadius: 1,
            background: "#111827",
            boxShadow: "0 1px 3px rgba(17, 24, 39, .4)",
            pointerEvents: "auto",
            touchAction: "none",
            cursor: resizeCursor(direction),
          }}
          onPointerDown={(event) => beginGesture(event, "resize-frame", direction)}
          {...gestureEvents}
        />
      ))}
    </div>
  );
}
