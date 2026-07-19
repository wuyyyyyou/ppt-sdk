import type { PageProgress } from "../../api/types";
import { createProgress } from "./progressProjection";
import { failedCompletion } from "./deckGenerationCompletion";
import { authoringDeckFromConfirmedOutline } from "./deckGenerationStartArtifacts";
import { runDeckGeneration } from "./deckGenerationWorkflow";
import { getAttemptLimits } from "./settings";
import type { DeckGenerationCompletion, PageRefinementVisualContext, RunDeckRefinementInput } from "./types";

function visualContext(progress: PageProgress, pageId: string): PageRefinementVisualContext {
  const page = progress.pages.find((item) => item.page_id === pageId);
  return page?.last_screenshot_path?.trim()
    ? { source: "progress", screenshotPath: page.last_screenshot_path.trim() }
    : { source: "unavailable", unavailableReason: "No previous successful screenshot is available." };
}

export async function runPageRefinement(input: RunDeckRefinementInput, instruction: string): Promise<DeckGenerationCompletion> {
  const attemptLimits = getAttemptLimits(input);
  const authoringDeck = authoringDeckFromConfirmedOutline(input.confirmedOutline);
  const pageId = input.pageId ?? input.resumePageIds?.[0];
  const page = authoringDeck.pages.find((item) => item.page_id === pageId);
  if (!page) {
    const progress = createProgress({
      step: "failed",
      message: input.locale === "zh" ? "没有找到要优化的页面。" : "Could not find the page to refine.",
      currentPageIndex: null,
      totalPages: authoringDeck.pages.length,
    }, null, undefined, undefined, attemptLimits);
    input.onProgress(progress);
    return failedCompletion({ progress, error: { type: "page_failed", message: progress.message } });
  }

  let progress: PageProgress;
  let reason = instruction;
  if (input.skipIntentReview) {
    progress = await input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir });
    reason = progress.recovery?.page_refinement_reasons?.[page.page_id] || progress.recovery?.refinement_request || instruction;
  } else {
    input.onProgress(createProgress({
      step: "page-refinement-prepare",
      message: input.locale === "zh" ? "正在准备当前页优化" : "Preparing current-page refinement",
      currentPageIndex: page.index,
      totalPages: authoringDeck.pages.length,
    }, await input.backend.getPageProgress({ workspace_dir: input.workspace.workspace_dir }), undefined, undefined, attemptLimits));
    const prepared = await input.backend.preparePageRefinement({
      workspace_dir: input.workspace.workspace_dir,
      page_id: page.page_id,
      refinement_request: instruction,
    });
    progress = prepared.progress;
  }

  return runDeckGeneration({
    backend: input.backend,
    aiClient: input.aiClient,
    agentClient: input.agentClient,
    hostUploadClient: input.hostUploadClient,
    aiLogger: input.aiLogger,
    workspace: input.workspace,
    confirmedOutline: input.confirmedOutline,
    locale: input.locale,
    startMode: "resume",
    onProgress: input.onProgress,
    isCancelled: input.isCancelled,
    cancelSignal: input.cancelSignal,
    refinementRequest: instruction,
    pageRefinementReasons: { [page.page_id]: reason },
    pageRefinementVisualContexts: { [page.page_id]: visualContext(progress, page.page_id) },
    refinementRunKind: "page-refinement",
  });
}
