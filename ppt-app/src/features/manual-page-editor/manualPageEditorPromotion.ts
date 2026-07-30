export interface PromotionGeometry {
  rect: { left: number; top: number; width: number; height: number };
  parentRect: { left: number; top: number };
  parentScrollLeft: number;
  parentScrollTop: number;
  parentBorderLeft: number;
  parentBorderTop: number;
  /** Accumulated scale applied to the parent, 1 when no ancestor scales. */
  parentScaleX?: number;
  parentScaleY?: number;
}

export interface PromotionStyle {
  flex: string;
  gridArea: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
}

export interface ContainingBlockStyle {
  position: string;
  transform: string;
  perspective: string;
  filter: string;
  contain: string;
}

export interface AbsolutePromotionPlan {
  placeholder: Record<string, string>;
  element: Record<string, string>;
}

const CONTAINMENT = /\b(paint|layout|strict|content)\b/;

/**
 * An absolutely positioned element resolves its offsets against the nearest
 * ancestor that establishes a containing block, which is not always its parent.
 */
export function isAbsoluteContainingBlock(style: ContainingBlockStyle | undefined): boolean {
  if (!style) return false;
  if (style.position && style.position !== "static") return true;
  return Boolean(
    (style.transform && style.transform !== "none") ||
    (style.perspective && style.perspective !== "none") ||
    (style.filter && style.filter !== "none") ||
    CONTAINMENT.test(style.contain ?? ""),
  );
}

/** Transforms move an element visually without moving the box flow reserved for it. */
export function hasLayoutAffectingTransform(transform: string | undefined): boolean {
  return Boolean(transform && transform !== "none");
}

function usableScale(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : 1;
}

export function planAbsolutePromotion(
  geometry: PromotionGeometry,
  style: PromotionStyle,
): AbsolutePromotionPlan {
  // Client rects come back in the scaled space of the outermost transform, while
  // the inline offsets we are about to write live in the parent's own space.
  const scaleX = usableScale(geometry.parentScaleX);
  const scaleY = usableScale(geometry.parentScaleY);
  const width = `${geometry.rect.width / scaleX}px`;
  const height = `${geometry.rect.height / scaleY}px`;

  return {
    placeholder: {
      boxSizing: "border-box",
      width,
      height,
      visibility: "hidden",
      pointerEvents: "none",
      flex: style.flex || "0 0 auto",
      // Siblings are spaced by the margins of the element being lifted out of
      // flow, so the placeholder has to keep paying them.
      marginTop: style.marginTop || "0px",
      marginRight: style.marginRight || "0px",
      marginBottom: style.marginBottom || "0px",
      marginLeft: style.marginLeft || "0px",
      ...(style.gridArea ? { gridArea: style.gridArea } : {}),
    },
    element: {
      position: "absolute",
      boxSizing: "border-box",
      // Offsets are relative to the padding box of the containing block, so the
      // parent border sits outside the coordinate space.
      left: `${(geometry.rect.left - geometry.parentRect.left) / scaleX - geometry.parentBorderLeft + geometry.parentScrollLeft}px`,
      top: `${(geometry.rect.top - geometry.parentRect.top) / scaleY - geometry.parentBorderTop + geometry.parentScrollTop}px`,
      width,
      height,
      margin: "0",
    },
  };
}

function measureLayoutRect(element: HTMLElement, transform: string | undefined) {
  if (!hasLayoutAffectingTransform(transform)) return element.getBoundingClientRect();
  const inlineTransform = element.style.transform;
  element.style.transform = "none";
  const rect = element.getBoundingClientRect();
  element.style.transform = inlineTransform;
  return rect;
}

function numeric(value: string | undefined): number {
  return Number.parseFloat(value ?? "0") || 0;
}

/**
 * Comparing the painted box against the layout box reveals the scale every
 * ancestor transform contributes, without having to walk and multiply matrices.
 */
export function measureAccumulatedScale(
  element: HTMLElement,
  rect: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
    y: element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1,
  };
}

/**
 * Scale that pointer deltas have to be divided by before they can be written as
 * `left`/`top` on an already promoted element.
 */
export function measureLocalScale(element: HTMLElement): { x: number; y: number } {
  // `instanceof` is unreliable here: the element lives in the iframe realm.
  const origin = element.offsetParent as HTMLElement | null;
  if (!origin || typeof origin.getBoundingClientRect !== "function") return { x: 1, y: 1 };
  const scale = measureAccumulatedScale(origin, origin.getBoundingClientRect());
  return { x: usableScale(scale.x), y: usableScale(scale.y) };
}

export function promoteToAbsolute(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (style?.position === "absolute") return;
  const parent = element.parentElement;
  if (!parent) return;
  const parentStyle = parent.ownerDocument.defaultView?.getComputedStyle(parent);
  const parentRect = parent.getBoundingClientRect();
  const parentScale = measureAccumulatedScale(parent, parentRect);

  const plan = planAbsolutePromotion({
    rect: measureLayoutRect(element, style?.transform),
    parentRect,
    parentScrollLeft: parent.scrollLeft,
    parentScrollTop: parent.scrollTop,
    parentBorderLeft: numeric(parentStyle?.borderLeftWidth),
    parentBorderTop: numeric(parentStyle?.borderTopWidth),
    parentScaleX: parentScale.x,
    parentScaleY: parentScale.y,
  }, {
    flex: style?.flex ?? "",
    gridArea: style?.gridArea ?? "",
    marginTop: style?.marginTop ?? "",
    marginRight: style?.marginRight ?? "",
    marginBottom: style?.marginBottom ?? "",
    marginLeft: style?.marginLeft ?? "",
  });

  const placeholder = element.ownerDocument.createElement("div");
  placeholder.dataset.pptEditorPlaceholder = "true";
  placeholder.setAttribute("aria-hidden", "true");
  Object.assign(placeholder.style, plan.placeholder);
  parent.insertBefore(placeholder, element);
  if (!isAbsoluteContainingBlock(parentStyle)) parent.style.position = "relative";
  Object.assign(element.style, plan.element);
}
