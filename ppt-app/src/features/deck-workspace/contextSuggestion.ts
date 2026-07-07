import type { ContextSuggestionResult } from "../../ai/types";
import type { Messages } from "../../i18n/messages";
import type { ContextRow } from "./types";

export type ContextPatchId =
  | "audience"
  | "goal"
  | "style"
  | "content"
  | "slides";

export const SLIDE_COUNT_CONTEXT_OPTIONS = [
  "auto",
  ...Array.from({ length: 20 }, (_, index) => String(index + 1)),
];

export function normalizeSlideCountContextValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === normalized
    ? String(parsed)
    : "auto";
}

export function shouldSuggestContextBeforeGeneration(rows: ContextRow[]) {
  return rows.length === 0;
}

export function buildContextRowFromPatch(
  id: ContextPatchId,
  value: string,
  t: Messages
): ContextRow {
  switch (id) {
    case "audience":
      return {
        id,
        label: t.brief.contextLabels.audience,
        value,
        placeholder: t.brief.contextPlaceholders.audience,
      };
    case "goal":
      return {
        id,
        label: t.brief.contextLabels.goal,
        value,
        placeholder: t.brief.contextPlaceholders.goal,
      };
    case "style":
      return {
        id,
        label: t.brief.contextLabels.styleNotes,
        value,
        placeholder: t.brief.contextPlaceholders.styleNotes,
      };
    case "content":
      return {
        id,
        label: t.brief.contextLabels.contentSource,
        value,
        placeholder: t.brief.contextPlaceholders.contentSource,
      };
    case "slides":
      return {
        id,
        label: t.brief.contextLabels.slides,
        value: normalizeSlideCountContextValue(value),
        type: "select",
        options: SLIDE_COUNT_CONTEXT_OPTIONS,
        allowCustomValue: true,
      };
  }
}

function buildSuggestedContextRow(
  id: "audience" | "goal" | "style",
  values: string[],
  t: Messages
): ContextRow | null {
  const uniqueValues = values.reduce<string[]>((items, value) => {
    const trimmed = value.trim();
    if (trimmed && !items.includes(trimmed)) {
      items.push(trimmed);
    }
    return items;
  }, []);

  if (uniqueValues.length === 0) return null;

  const row = buildContextRowFromPatch(id, uniqueValues[0], t);
  if (uniqueValues.length === 1) {
    return row;
  }

  return {
    ...row,
    type: "select",
    options: uniqueValues,
    allowCustomValue: true,
  };
}

export function buildContextRowsFromSuggestion(
  result: ContextSuggestionResult,
  t: Messages
): ContextRow[] {
  return [
    buildSuggestedContextRow("audience", result.audience, t),
    buildSuggestedContextRow("goal", result.goal, t),
    buildSuggestedContextRow("style", result.style, t),
    buildContextRowFromPatch("slides", result.slides, t),
  ].filter((row): row is ContextRow => Boolean(row));
}

export function mergeSuggestedContextRows(
  currentRows: ContextRow[],
  suggestedRows: ContextRow[]
): ContextRow[] {
  if (suggestedRows.length === 0) return currentRows;

  const suggestedIds = new Set(suggestedRows.map((row) => row.id));
  return [
    ...currentRows.map((row) =>
      suggestedIds.has(row.id)
        ? suggestedRows.find((suggestedRow) => suggestedRow.id === row.id) ?? row
        : row
    ),
    ...suggestedRows.filter(
      (row) => !currentRows.some((currentRow) => currentRow.id === row.id)
    ),
  ];
}
