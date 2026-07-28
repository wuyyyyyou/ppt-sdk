import type { Messages } from "../../i18n/messages";

export type MyWorkMenuItemId = "rename" | "duplicate" | "delete";

export interface MyWorkMenuItem {
  id: MyWorkMenuItemId;
  label: string;
  tone?: "danger";
  /** Renders a separator above the item so destructive actions read apart. */
  dividerBefore?: boolean;
}

/**
 * WORK-005/WORK-006: Duplicate only appears once a backend contract exists, and
 * Delete is always the last, separated entry.
 */
export function buildMyWorkMenuItems(
  t: Messages,
  options: { canDuplicate: boolean },
): MyWorkMenuItem[] {
  const items: MyWorkMenuItem[] = [{ id: "rename", label: t.myWork.rename }];

  if (options.canDuplicate) {
    items.push({ id: "duplicate", label: t.myWork.duplicate });
  }

  items.push({ id: "delete", label: t.myWork.delete, tone: "danger", dividerBefore: true });

  return items;
}
