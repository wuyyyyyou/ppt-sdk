import { formatMessage, type Messages } from "../../i18n/messages";
import type {
  DeckGenerationProgress,
  DeckGenerationProgressMessageKey,
  DeckGenerationStep,
  ResearchDiscoveryProgressPhase,
} from "../deck-generation";
import {
  isActivePageGenerationStatus,
  isGenuinelyFailedPageGenerationStatus,
} from "../deck-generation/pageStatusPolicy";
import { isDiscoveryPageId } from "./researchDiscoveryStageRecords";

export function getGenerationProgressDisplayMessage(
  t: Messages,
  progress: DeckGenerationProgress | null,
): string {
  if (!progress) return t.status.creatingDeck;
  if (progress.step === "complete") return t.generating.generationComplete;
  // App-owned captions win over the stored string so switching locale mid-run
  // immediately re-resolves them.
  if (progress.messageKey) return appOwnedMessage(t, progress.messageKey);
  if (isResearchDiscoveryStep(progress.step) && isPageAcceptedSummary(progress.message)) {
    return activeResearchDiscoveryLabel(t, progress) ?? t.generating.steps.researchDiscovery;
  }
  return progress.message;
}

function appOwnedMessage(t: Messages, key: DeckGenerationProgressMessageKey): string {
  const messages: Record<DeckGenerationProgressMessageKey, string> = {
    confirmingOutline: t.generating.confirmingOutline,
  };
  return messages[key];
}

/**
 * STAB-002: the page-level counts a user needs to understand where a run stands.
 * Internal paths, task_dir, run ids and RPC envelopes are deliberately absent.
 */
export interface GenerationPageSummary {
  accepted: number;
  failed: number;
  running: number;
  pending: number;
  total: number;
}

export function buildGenerationPageSummary(
  progress: DeckGenerationProgress | null,
): GenerationPageSummary | null {
  const pages = (progress?.pages ?? []).filter((page) => !isDiscoveryPageId(page.page_id));
  const total = pages.length || progress?.totalPages || 0;
  if (total === 0) return null;

  const accepted = pages.filter((page) => page.status === "accepted").length;
  const failed = pages.filter((page) => isGenuinelyFailedPageGenerationStatus(page.status)).length;
  const running = pages.filter((page) => isActivePageGenerationStatus(page.status)).length;

  return {
    accepted,
    failed,
    running,
    pending: Math.max(0, total - accepted - failed - running),
    total,
  };
}

/** Formatted, locale-owned segments. Never assembled by string concatenation. */
export function formatGenerationPageSummary(
  t: Messages,
  summary: GenerationPageSummary,
): string[] {
  const parts = [formatMessage(t.generating.pageSummary.accepted, {
    accepted: summary.accepted,
    total: summary.total,
  })];
  if (summary.running > 0) {
    parts.push(formatMessage(t.generating.pageSummary.running, { count: summary.running }));
  }
  if (summary.pending > 0) {
    parts.push(formatMessage(t.generating.pageSummary.pending, { count: summary.pending }));
  }
  if (summary.failed > 0) {
    parts.push(formatMessage(t.generating.pageSummary.failed, { count: summary.failed }));
  }
  return parts;
}

function isResearchDiscoveryStep(step: DeckGenerationStep) {
  return step === "research-discovery" ||
    step === "research-collection" ||
    step === "research-curation" ||
    step === "evidence-page-planning";
}

function isPageAcceptedSummary(message: string) {
  const value = message.trim();
  return /\d+\s*\/\s*\d+\s*页(?:已)?通过/.test(value) ||
    /正在生成\s*\d+\s*页，\s*\d+\s*\/\s*\d+\s*页已通过/.test(value) ||
    /\d+\s*\/\s*\d+\s*(?:pages\s+)?(?:accepted|passed)/i.test(value) ||
    /Generating\s+\d+\s+pages?,\s*\d+\s*\/\s*\d+\s+accepted/i.test(value);
}

function activeResearchDiscoveryLabel(t: Messages, progress: DeckGenerationProgress) {
  const activePhase = progress.researchDiscovery?.records.find((record) => record.state === "running")?.phase;
  if (activePhase) return t.generating.researchDiscovery.phases[activePhase];
  const phase = researchStepFallbackPhase(progress.step);
  return phase ? t.generating.researchDiscovery.phases[phase] : null;
}

function researchStepFallbackPhase(step: DeckGenerationStep): ResearchDiscoveryProgressPhase | null {
  switch (step) {
    case "research-collection":
      return "web-collection";
    case "research-curation":
      return "web-collection";
    case "evidence-page-planning":
      return "visual-collection";
    case "research-discovery":
      return "web-decision";
    default:
      return null;
  }
}
