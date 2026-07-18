import type { PagePlan, PageProgress, WorkspaceOutline } from "../../api/types";

/** Legacy Refinement compatibility only. authoring-kit-v1 Deck Generation has no Page Plan. */
export function pagePlanMatchesOutlineAndTemplate(
  _workspace: unknown,
  pagePlan: PagePlan,
  progress: PageProgress | null,
  outline: WorkspaceOutline,
) {
  const progressIds = new Set(progress?.pages.map((page) => page.page_id) ?? []);
  return pagePlan.pages.length === outline.items.length &&
    (!progress || pagePlan.pages.every((page) => progressIds.has(page.page_id)));
}
