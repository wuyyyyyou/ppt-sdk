import type { TemplateSummary } from "../../api/types";

export const SELECTABLE_TEMPLATE_GROUP_IDS = [
  "red-finance-canvas",
  "red-finance-v3",
  "red-blue-comparison-v1",
  "red-blue-comparison-canvas",
  "chart-analytics-v1",
  "chart-analytics-canvas",
] as const;

const SELECTABLE_TEMPLATE_GROUP_ID_SET = new Set<string>(
  SELECTABLE_TEMPLATE_GROUP_IDS,
);

export function isSelectableTemplateGroup(groupId: string): boolean {
  return SELECTABLE_TEMPLATE_GROUP_ID_SET.has(groupId);
}

export function filterSelectableTemplates(
  templates: TemplateSummary[],
): TemplateSummary[] {
  return templates.filter((template) =>
    isSelectableTemplateGroup(template.group_id),
  );
}
