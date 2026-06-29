import {
  isAgentInfrastructureError,
  type AgentInfrastructureError,
} from "../../agent/agentClient";
import type { PageProgress } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { generationText } from "./messages";
import { createProgress } from "./progressProjection";
import {
  ATTEMPT_LIMITS,
  type DeckGenerationCompletion,
  type DeckGenerationError,
  type DeckGenerationProgress,
  type RunDeckGenerationInput,
} from "./types";

export function failedCompletion(input: {
  error: DeckGenerationError;
  progress: DeckGenerationProgress | null;
}): DeckGenerationCompletion {
  return {
    status: "failed",
    error: input.error,
    progress: input.progress,
  };
}

export function cancelledCompletion(progress: DeckGenerationProgress | null): DeckGenerationCompletion {
  return {
    status: "cancelled",
    progress,
  };
}

export function localizeAgentInfrastructureMessage(
  error: AgentInfrastructureError,
  locale: Locale,
): string {
  const text = generationText(locale);
  if (error.sessionCacheMiss) return text.agentSessionCacheMissExhausted;
  if (error.noToolsAvailable) return text.agentToolsUnavailable;
  return error.message;
}

export async function preflightAgentToolAccess(input: {
  agentClient: RunDeckGenerationInput["agentClient"];
  locale: Locale;
  onProgress: (progress: DeckGenerationProgress) => void;
  progress: PageProgress | null;
  attemptLimits?: typeof ATTEMPT_LIMITS;
  totalPages: number;
  currentPageIndex: number | null;
}): Promise<DeckGenerationCompletion | null> {
  try {
    await input.agentClient.checkToolAccess();
    return null;
  } catch (error) {
    if (!isAgentInfrastructureError(error)) throw error;
    const message = localizeAgentInfrastructureMessage(error, input.locale);
    const progress = createProgress(
      {
        step: "failed",
        message,
        currentPageIndex: input.currentPageIndex,
        totalPages: input.totalPages,
      },
      input.progress,
      undefined,
      undefined,
      input.attemptLimits,
    );
    input.onProgress(progress);
    return failedCompletion({
      progress,
      error: {
        type: "agent_infrastructure",
        message,
      },
    });
  }
}
