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

export interface SelectionCandidate {
  tagName: string;
  /** Computed display, already blockified for absolutely positioned elements. */
  display: string;
  visibility: string;
  width: number;
  height: number;
  isEditorArtifact: boolean;
}

const TEXT_RUN_TAGS = new Set(["SPAN", "STRONG", "EM", "B", "I", "U", "S", "BR", "SMALL", "A", "CODE"]);

/**
 * Templates draw accent bars, chips and rules as `<span>` with an explicit box,
 * so tag name alone cannot decide what is grabbable. A run of inline text is
 * still passed over — it has no box of its own to move or resize — but anything
 * the layout gave a box to is fair game.
 */
export function isSelectableBox(candidate: SelectionCandidate): boolean {
  if (candidate.isEditorArtifact) return false;
  if (candidate.display === "none" || candidate.display === "contents") return false;
  if (candidate.visibility === "hidden" || candidate.visibility === "collapse") return false;
  if (candidate.width <= 0 || candidate.height <= 0) return false;
  const inlineFlow = candidate.display === "inline" || candidate.display === "inline list-item";
  return !(inlineFlow && TEXT_RUN_TAGS.has(candidate.tagName.toUpperCase()));
}

export function canvasDistance(
  distance: readonly number[],
  scale = 1,
): [number, number] {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return [distance[0] / safeScale, distance[1] / safeScale];
}
