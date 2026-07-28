import type { ActiveGenerationRun } from "./generationViewState";
import type { LoadingKind } from "./types";

/**
 * Loading states that mean generation or refinement work is in flight, whether
 * or not a shadow run has been registered yet.
 */
const IN_FLIGHT_LOADING: readonly LoadingKind[] = [
  "deck",
  "deckFromOutline",
  "refineDeck",
  "refineSlide",
];

/**
 * Long AI steps that run before a generation run exists. They have no run to
 * abandon, but they do write Workspace state and stage when they land, so
 * leaving them behind has to be confirmed and cancelled just the same.
 */
const PREPARATION_LOADING: readonly LoadingKind[] = [
  "requirements",
  "outline",
  "uploadedSourceAnalysis",
];

export interface GenerationInFlightInput {
  activeRun: ActiveGenerationRun | null;
  hasTransaction: boolean;
  preparing: boolean;
  loading: LoadingKind;
}

/**
 * GEN-003: a shadow run only becomes visible to the UI once
 * `beginGenerationRun` comes back, which leaves several seconds at the start of
 * a run where the generating page is already on screen but `activeRun` is still
 * null. Guarding on the run alone lets those first clicks walk away without the
 * abandonment confirmation, so the loading state and the preparing flag count
 * as in flight too.
 */
export function generationInFlight(input: GenerationInFlightInput): boolean {
  return (
    input.activeRun !== null ||
    input.hasTransaction ||
    input.preparing ||
    IN_FLIGHT_LOADING.includes(input.loading)
  );
}

export function preparationInFlight(loading: LoadingKind): boolean {
  return PREPARATION_LOADING.includes(loading);
}
