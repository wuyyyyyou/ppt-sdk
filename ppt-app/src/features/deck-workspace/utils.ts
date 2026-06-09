import type { Messages } from "../../i18n/messages";
import type { WorkspaceResult } from "../../api/types";
import type { ContextRow, MainStage } from "./types";

const SLIDE_COUNT_CONTEXT_OPTIONS = ["auto", ...Array.from({ length: 20 }, (_, index) => String(index + 1))];

export const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export function formatSlideNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function formatSlideCount(count: number) {
  return String(count).padStart(2, "0");
}

export function deckReadyStatus(t: Messages, count: number) {
  return `${t.status.draftReady} · ${count} slides`;
}

export function stageOrder(stage: MainStage) {
  return { brief: 1, outline: 2, generating: 3, deck: 4 }[stage];
}

export function syncSlideCountContextRow(
  rows: Array<Pick<ContextRow, "id" | "value"> & Partial<ContextRow>>,
  slideCount: number,
  label: string
): ContextRow[] {
  const value = String(Math.max(1, slideCount));
  const syncedRow: ContextRow = {
    id: "slides",
    label,
    value,
    type: "select",
    options: SLIDE_COUNT_CONTEXT_OPTIONS,
    allowCustomValue: true,
  };
  const hasSlidesRow = rows.some((row) => row.id === "slides");
  const contextRows = rows as ContextRow[];

  return hasSlidesRow
    ? contextRows.map((row) => (row.id === "slides" ? syncedRow : row))
    : [...contextRows, syncedRow];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function readPagePlanSourceOutlineUpdatedAt(pagePlanRecord: Record<string, unknown> | null) {
  const source = isRecord(pagePlanRecord?.source) ? pagePlanRecord.source : null;
  return readString(source, "outline_updated_at");
}

export function hasDownstreamArtifacts(workspace: WorkspaceResult) {
  const pagePlanRecord = isRecord(workspace.page_plan) ? workspace.page_plan : null;
  const progressRecord = isRecord(workspace.page_progress) ? workspace.page_progress : null;
  const pagesRecord = isRecord(workspace.pages) ? workspace.pages : null;

  return (
    (Array.isArray(pagePlanRecord?.pages) && pagePlanRecord.pages.length > 0) ||
    (Array.isArray(progressRecord?.pages) && progressRecord.pages.length > 0) ||
    (Array.isArray(pagesRecord?.pages) && pagesRecord.pages.length > 0)
  );
}

function outlineMatchesPagePlan(
  outlineRecord: Record<string, unknown> | null,
  pagePlanRecord: Record<string, unknown> | null
) {
  const outlineItems = Array.isArray(outlineRecord?.items) ? outlineRecord.items : [];
  const pagePlanPages = Array.isArray(pagePlanRecord?.pages) ? pagePlanRecord.pages : [];

  if (outlineItems.length !== pagePlanPages.length) {
    return false;
  }

  const outlineTitle = readString(outlineRecord, "title").trim();
  const pagePlanTitle = readString(pagePlanRecord, "title").trim();
  if (outlineTitle && pagePlanTitle && outlineTitle !== pagePlanTitle) {
    return false;
  }

  return pagePlanPages.every((page, index) => {
    if (!isRecord(page)) return false;
    const item = outlineItems[index];
    if (!isRecord(item)) return false;

    return (
      readString(page, "title").trim() === readString(item, "title").trim() &&
      readString(page, "outline").trim() === readString(item, "outline").trim()
    );
  });
}

export function isWorkspaceDeckStale(workspace: WorkspaceResult) {
  const outlineRecord = isRecord(workspace.outline) ? workspace.outline : null;
  const pagePlanRecord = isRecord(workspace.page_plan) ? workspace.page_plan : null;
  const outlineUpdatedAt = readString(outlineRecord, "updated_at");
  const pagePlanOutlineUpdatedAt = readPagePlanSourceOutlineUpdatedAt(pagePlanRecord);

  if (readString(outlineRecord, "status") === "draft" && hasDownstreamArtifacts(workspace)) {
    return true;
  }

  if (outlineUpdatedAt && pagePlanOutlineUpdatedAt && outlineUpdatedAt !== pagePlanOutlineUpdatedAt) {
    return !outlineMatchesPagePlan(outlineRecord, pagePlanRecord);
  }

  return false;
}
