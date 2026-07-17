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
