import type { DeckGenerationProgress } from "../deck-generation";
import { isActivePageGenerationStatus, isUnfinishedPageGenerationStatus } from "../deck-generation/pageStatusPolicy";
import type { LoadingKind } from "./types";

export type ActiveGenerationRunKind = "deck-generation" | "page-refinement" | "deck-refinement";

export interface ActiveGenerationRun {
  kind: ActiveGenerationRunKind;
  stopping: boolean;
}

export type GenerationViewStatus =
  | "running"
  | "stopping"
  | "interrupted"
  | "unresumable"
  | "complete";

export interface GenerationViewState {
  status: GenerationViewStatus;
  isActive: boolean;
  isStopping: boolean;
  canStop: boolean;
  canResume: boolean;
  canBackToOutline: boolean;
  showStop: boolean;
  showResume: boolean;
  showBackToOutline: boolean;
  hasUnfinishedPages: boolean;
  resumeAction: "generation" | "refinement";
}

export interface BuildGenerationViewStateInput {
  loading: LoadingKind;
  progress: DeckGenerationProgress | null;
  activeRun: ActiveGenerationRun | null;
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

export function buildGenerationViewState(
  input: BuildGenerationViewStateInput,
): GenerationViewState {
  const activeRun = input.activeRun;
  const isActive = Boolean(activeRun);
  const isStopping = activeRun?.stopping === true;
  const unfinishedPages = hasUnfinishedPages(input.progress);
  const resumeAllowed = input.resumeAllowed !== false;

  if (isStopping) {
    return {
      status: "stopping",
      isActive: true,
      isStopping: true,
      canStop: false,
      canResume: false,
      canBackToOutline: false,
      showStop: true,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
    };
  }

  if (isActive) {
    return {
      status: "running",
      isActive: true,
      isStopping: false,
      canStop: true,
      canResume: false,
      canBackToOutline: false,
      showStop: true,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
    };
  }

  if (input.unresumable) {
    return {
      status: "unresumable",
      isActive: false,
      isStopping: false,
      canStop: false,
      canResume: false,
      canBackToOutline: true,
      showStop: true,
      showResume: false,
      showBackToOutline: true,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: "generation",
    };
  }

  if (isProgressComplete(input.progress)) {
    return {
      status: "complete",
      isActive: false,
      isStopping: false,
      canStop: false,
      canResume: false,
      canBackToOutline: false,
      showStop: false,
      showResume: false,
      showBackToOutline: false,
      hasUnfinishedPages: false,
      resumeAction: "generation",
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
      canStop: false,
      canResume: resumeAllowed,
      canBackToOutline: false,
      showStop: true,
      showResume: resumeAllowed,
      showBackToOutline: false,
      hasUnfinishedPages: unfinishedPages,
      resumeAction: input.progress?.recoveryRunKind === "page-refinement" ||
        input.progress?.recoveryRunKind === "deck-refinement"
        ? "refinement"
        : "generation",
    };
  }

  return {
    status: "interrupted",
    isActive: false,
    isStopping: false,
    canStop: false,
    canResume: resumeAllowed,
    canBackToOutline: false,
    showStop: true,
    showResume: resumeAllowed,
    showBackToOutline: false,
    hasUnfinishedPages: unfinishedPages,
    resumeAction: input.progress?.recoveryRunKind === "page-refinement" ||
      input.progress?.recoveryRunKind === "deck-refinement"
      ? "refinement"
      : "generation",
  };
}
