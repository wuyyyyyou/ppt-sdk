import type { Messages } from "../../i18n/messages";
import type { DeckGenerationProgress, DeckGenerationStep, ResearchDiscoveryProgressPhase } from "../deck-generation";

export function getGenerationProgressDisplayMessage(
  t: Messages,
  progress: DeckGenerationProgress | null,
): string {
  if (!progress) return t.status.creatingDeck;
  if (progress.step === "complete") return t.generating.generationComplete;
  if (isResearchDiscoveryStep(progress.step) && isPageAcceptedSummary(progress.message)) {
    return activeResearchDiscoveryLabel(t, progress) ?? t.generating.steps.researchDiscovery;
  }
  return progress.message;
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
  const activePhase = progress.researchDiscovery?.records.find((record) => record.state === "active")?.phase;
  if (activePhase) return t.generating.researchDiscovery.phases[activePhase];
  const phase = researchStepFallbackPhase(progress.step);
  return phase ? t.generating.researchDiscovery.phases[phase] : null;
}

function researchStepFallbackPhase(step: DeckGenerationStep): ResearchDiscoveryProgressPhase | null {
  switch (step) {
    case "research-collection":
      return "web-collection";
    case "research-curation":
      return "web-curation";
    case "evidence-page-planning":
      return "evidence-page-planning";
    case "research-discovery":
      return "web-decision";
    default:
      return null;
  }
}
