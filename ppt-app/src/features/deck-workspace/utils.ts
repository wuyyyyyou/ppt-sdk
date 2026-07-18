import type { Messages } from "../../i18n/messages";
import type { WorkspaceResult } from "../../api/types";
import type { MainStage } from "./types";

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
  return { brief: 1, requirements: 2, "uploaded-source-analysis": 3, outline: 4, generating: 5, deck: 6 }[stage];
}

export function stageLabel(t: Messages, stage: MainStage) {
  if (stage === "uploaded-source-analysis") return t.stages.uploadedSourceAnalysis;
  return t.stages[stage];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

export function hasDownstreamArtifacts(workspace: WorkspaceResult) {
  const pagePlanRecord = isRecord(workspace.page_plan) ? workspace.page_plan : null;
  const progressRecord = isRecord(workspace.page_progress) ? workspace.page_progress : null;

  return (
    (Array.isArray(pagePlanRecord?.pages) && pagePlanRecord.pages.length > 0) ||
    (Array.isArray(progressRecord?.pages) && progressRecord.pages.length > 0)
  );
}

export function isWorkspaceDeckStale(_workspace: WorkspaceResult) {
  return false;
}
