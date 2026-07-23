export const MOVEABLE_EDITOR_CLASS = "manual-editor-moveable";
export const DRAG_THRESHOLD_PX = 4;

function closestElement(target: EventTarget | null): Element | null {
  const element = target && typeof (target as Element).closest === "function"
    ? target as Element
    : null;
  return element;
}

export function isMoveableEditorTarget(target: EventTarget | null): boolean {
  return Boolean(closestElement(target)?.closest(`.${MOVEABLE_EDITOR_CLASS}`));
}

export function exceedsDragThreshold(
  distance: readonly number[],
  scale = 1,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const canvasDistance = Math.hypot(distance[0] / safeScale, distance[1] / safeScale);
  return canvasDistance >= threshold;
}

export function canvasDistance(
  distance: readonly number[],
  scale = 1,
): [number, number] {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return [distance[0] / safeScale, distance[1] / safeScale];
}
