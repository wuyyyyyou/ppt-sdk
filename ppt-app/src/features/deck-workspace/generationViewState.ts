import type { DeckGenerationProgress } from "../deck-generation";
import { isActivePageGenerationStatus, isUnfinishedPageGenerationStatus } from "../deck-generation/pageStatusPolicy";
import type { LoadingKind } from "./types";

export type ActiveGenerationRunKind = "deck-generation" | "page-refinement" | "deck-refinement";

export interface ActiveGenerationRun {
  kind: ActiveGenerationRunKind;
  runId: string;
  officialWorkspaceDir: string;
  shadowWorkspaceDir: string;
  stopping: boolean;
  committing: boolean;
}

export type GenerationViewStatus =
  | "preparing"
  | "running"
  | "stopping"
  | "interrupted"
  | "unresumable"
  | "complete";

export interface GenerationViewState {
  status: GenerationViewStatus;
  isActive: boolean;
  isStopping: boolean;
  canResume: boolean;
  canBackToOutline: boolean;
  showResume: boolean;
  showBackToOutline: boolean;
  hasUnfinishedPages: boolean;
  resumeAction: "generation" | "refinement";
  /**
   * Whether the page is showing a deck generation or an AI refinement, which
   * decides how Back is labelled: abandoning a refinement returns to the last
   * saved version rather than one stage back.
   */
  runIntent: "generation" | "refinement";
  /**
   * GEN-003: top-level navigation stays available during a run and asks for
   * confirmation instead. Only Generation Commit and an in-flight stop take the
   * entries away, because neither can be abandoned safely.
   */
  navigationLocked: boolean;
}

export interface BuildGenerationViewStateInput {
  loading: LoadingKind;
  progress: DeckGenerationProgress | null;
  activeRun: ActiveGenerationRun | null;
  preparing?: boolean;
  unresumable?: boolean;
  resumeAllowed?: boolean;
}

function hasUnfinishedPages(progress: DeckGenerationProgress | null) {
  return progress?.pages.some((page) => isUnfinishedPageGenerationStatus(page.status)) ?? false;
}

function hasActivePage(progress: DeckGenerationProgress | null) {
  return progress?.pages.some((page) => isActivePageGenerationStatus(page.status)) ?? false;
}

function isProgressComplete(progress: DeckGenerationProgress | null) {
  return progress?.step === "complete" && !hasUnfinishedPages(progress);
}

function recoveryAction(progress: DeckGenerationProgress | null): "generation" | "refinement" {
  return progress?.recoveryRunKind === "page-refinement" ||
    progress?.recoveryRunKind === "deck-refinement"
    ? "refinement"
    : "generation";
}

export function buildGenerationViewState(
  input: BuildGenerationViewStateInput,
): GenerationViewState {
  const activeRun = input.activeRun;
  const isActive = Boolean(activeRun);
  const isStopping = activeRun?.stopping === true;
  const isCommitting = activeRun?.committing === true;
  const unfinishedPages = hasUnfinishedPages(input.progress);
  const resumeAllowed = input.resumeAllowed !== false;
  const runIntent: "generation" | "refinement" = activeRun
    ? (activeRun.kind === "deck-generation" ? "generation" : "refinement")
    : recoveryAction(input.progress);

  if (isStopping) {
    return {
      status: "stopping",
      isActive: true,
      isStopping: true,
      canResume: false,
      canBackToOutline: false,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
      runIntent,
      navigationLocked: true,
    };
  }

  if (input.preparing) {
    return {
      status: "preparing",
      isActive,
      isStopping: false,
      canResume: false,
      canBackToOutline: false,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
      runIntent,
      navigationLocked: isCommitting,
    };
  }

  if (isActive) {
    return {
      status: "running",
      isActive: true,
      isStopping: false,
      canResume: false,
      canBackToOutline: false,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
      runIntent,
      navigationLocked: isCommitting,
    };
  }

  if (input.unresumable) {
    return {
      status: "unresumable",
      isActive: false,
      isStopping: false,
      canResume: false,
      canBackToOutline: true,
      showResume: false,
      showBackToOutline: true,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
      runIntent,
      navigationLocked: false,
    };
  }

  if (isProgressComplete(input.progress)) {
    return {
      status: "complete",
      isActive: false,
      isStopping: false,
      canResume: false,
      canBackToOutline: false,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: false,
      resumeAction: "generation",
      runIntent,
      navigationLocked: false,
    };
  }

  if (
    unfinishedPages ||
    hasActivePage(input.progress) ||
    input.progress?.step === "failed" ||
    input.progress?.step === "cancelled" ||
    input.progress?.step === "interrupted" ||
    input.progress?.step === "final-render"
  ) {
    return {
      status: "interrupted",
      isActive: false,
      isStopping: false,
      canResume: resumeAllowed,
      canBackToOutline: false,
      showResume: resumeAllowed,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: recoveryAction(input.progress),
      runIntent,
      navigationLocked: false,
    };
  }

  return {
    status: "interrupted",
    isActive: false,
    isStopping: false,
    canResume: resumeAllowed,
    canBackToOutline: false,
    showResume: resumeAllowed,
    showBackToOutline: false,
    hasUnfinishedPages: unfinishedPages,
    resumeAction: recoveryAction(input.progress),
    runIntent,
    navigationLocked: false,
  };
}
