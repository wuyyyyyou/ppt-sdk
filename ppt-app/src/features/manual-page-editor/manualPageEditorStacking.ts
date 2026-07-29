export type ArrangeAction = "front" | "forward" | "backward" | "back";

export interface StackingEntry {
  /** Explicit z-index, or null when the element paints in document order. */
  zIndex: number | null;
}

export interface StackingUpdate {
  index: number;
  zIndex: number;
}

export function explicitZIndex(value: string | undefined): number | null {
  if (!value || value === "auto") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Layer changes write on the moved element alone. Renumbering the whole group
 * would overwrite the layering its template designed, including against
 * elements outside this parent.
 */
export function planStackingChange(
  entries: readonly StackingEntry[],
  target: number,
  action: ArrangeAction,
): StackingUpdate[] {
  const self = entries[target];
  if (!self) return [];
  const effective = (entry: StackingEntry) => entry.zIndex ?? 0;
  const mine = effective(self);
  const others = entries.filter((_, index) => index !== target).map(effective);
  if (others.length === 0) return [];

  const above = others.filter((value) => value > mine);
  const below = others.filter((value) => value < mine);
  const tied = others.some((value) => value === mine);
  let desired: number | null = null;

  if (action === "front") {
    const highest = Math.max(...others);
    desired = mine > highest ? null : highest + 1;
  } else if (action === "back") {
    const lowest = Math.min(...others);
    desired = mine < lowest ? null : lowest - 1;
  } else if (action === "forward") {
    if (above.length > 0) desired = Math.min(...above) + 1;
    else if (tied) desired = mine + 1;
  } else if (below.length > 0) {
    desired = Math.max(...below) - 1;
  } else if (tied) {
    desired = mine - 1;
  }

  if (desired === null) return [];
  if (desired >= 0) return [{ index: target, zIndex: desired }];

  // Going below zero would paint the element behind its own parent background,
  // so lift the group instead, keeping every existing gap between the layers.
  const lift = -desired;
  return [
    { index: target, zIndex: 0 },
    ...entries.flatMap((entry, index) =>
      index === target ? [] : [{ index, zIndex: effective(entry) + lift }]),
  ];
}
