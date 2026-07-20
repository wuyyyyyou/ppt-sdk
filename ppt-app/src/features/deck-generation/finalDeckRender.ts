import type { PageProgress } from "../../api/types";
import { generationText } from "./messages";
import { createProgress, emit as emitProgress } from "./progressProjection";
import { recordDeckRecovery } from "./runtimeSupport";
import { getAttemptLimits } from "./settings";
import type {
  DeckGenerationCompletion,
  AuthoringDeck,
  DeckGenerationContext,
  DeckGenerationError,
  DeckGenerationProgress,
  DeckGenerationResult,
  DeckGenerationStream,
  ResearchDiscoveryProgress,
} from "./types";

function failedCompletion(input: {
  error: DeckGenerationError;
  progress: DeckGenerationProgress | null;
}): DeckGenerationCompletion {
  return {
    status: "failed",
    error: input.error,
    progress: input.progress,
  };
}

function emit(
  input: Pick<DeckGenerationContext, "onProgress" | "workspace">,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
  researchDiscovery?: ResearchDiscoveryProgress,
) {
  emitProgress(
    input,
    value,
    progress,
    stream,
    activeStreams,
    getAttemptLimits({ workspace: input.workspace }),
    researchDiscovery,
  );
}

export async function runFinalDeckRender(input: {
  flowInput: DeckGenerationContext;
  authoringDeck: AuthoringDeck;
  progress: PageProgress;
  activeStreams?: Iterable<DeckGenerationStream>;
  researchDiscoveryProgress?: ResearchDiscoveryProgress;
}): Promise<DeckGenerationCompletion> {
  const { flowInput, authoringDeck, activeStreams, researchDiscoveryProgress } = input;
  const text = generationText(flowInput.locale);
  const attemptLimits = getAttemptLimits(flowInput);
  let progress = await recordDeckRecovery(flowInput, {
    status: "running",
    run_kind: "final-deck-render",
    step: "final-render",
    target_page_ids: [],
    error: null,
    final_deck_render: {
      status: "running",
      message: text.finalRender,
      error: null,
    },
    deck_status: "running",
  });
  emit(
    flowInput,
    {
      step: "final-render",
      message: text.finalRender,
      currentPageIndex: null,
      totalPages: authoringDeck.pages.length,
    },
    progress,
    null,
    activeStreams,
    researchDiscoveryProgress,
  );

  let rendered: DeckGenerationResult["rendered"];
  try {
    rendered = await flowInput.backend.renderDeckHtml({
      workspace_dir: flowInput.workspace.workspace_dir,
    });
    if (flowInput.isCancelled()) {
      progress = await recordDeckRecovery(flowInput, {
        status: "interrupted",
        run_kind: "final-deck-render",
        step: "final-render",
        error: null,
        final_deck_render: {
          status: "interrupted",
          message: text.finalRender,
          error: null,
        },
        deck_status: "interrupted",
      });
      const cancelledProgress = createProgress(
        {
          step: "cancelled",
          message: text.cancelled,
          currentPageIndex: null,
          totalPages: authoringDeck.pages.length,
        },
        progress,
        null,
        activeStreams,
        attemptLimits,
        researchDiscoveryProgress,
      );
      flowInput.onProgress(cancelledProgress);
      return {
        status: "cancelled",
        progress: cancelledProgress,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress = await recordDeckRecovery(flowInput, {
      status: "failed",
      run_kind: "final-deck-render",
      step: "final-render",
      error: message,
      final_deck_render: {
        status: "failed",
        message,
        error: message,
      },
      deck_status: "failed",
    });
    const failedProgress = createProgress(
      {
        step: "final-render",
        message,
        currentPageIndex: null,
        totalPages: authoringDeck.pages.length,
      },
      progress,
      null,
      activeStreams,
      attemptLimits,
      researchDiscoveryProgress,
    );
    flowInput.onProgress(failedProgress);
    return failedCompletion({
      progress: failedProgress,
      error: {
        type: "final_render_failed",
        message,
      },
    });
  }

  progress = await flowInput.backend.getPageProgress({
    workspace_dir: flowInput.workspace.workspace_dir,
  });
  progress = await recordDeckRecovery(flowInput, {
    status: "completed",
    run_kind: "final-deck-render",
    step: "complete",
    target_page_ids: [],
    refinement_request: null,
    page_refinement_reasons: {},
    error: null,
    final_deck_render: {
      status: "completed",
      message: text.deckReady,
      error: null,
      output_dir: rendered.output_dir,
      // Keep the aggregate Deck HTML path; the first slide path is only a page artifact.
      deck_html_path: rendered.deck_html_path ?? null,
      rendered_at: rendered.rendered_at,
    },
    deck_status: "completed",
  });
  emit(
    flowInput,
    {
      step: "complete",
      message: text.deckReady,
      currentPageIndex: null,
      totalPages: authoringDeck.pages.length,
    },
    progress,
    null,
    activeStreams,
    researchDiscoveryProgress,
  );

  return {
    status: "completed",
    result: {
      outline: flowInput.confirmedOutline,
      authoringDeck,
      progress,
      rendered,
    },
  };
}
