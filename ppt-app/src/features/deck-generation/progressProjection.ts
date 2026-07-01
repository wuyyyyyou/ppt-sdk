import type { PageProgress } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import {
  isActivePageGenerationStatus,
  isGenuinelyFailedPageGenerationStatus,
  isResumablePageGenerationStatus,
} from "./pageStatusPolicy";
import {
  ATTEMPT_LIMITS,
  type DeckGenerationContext,
  type DeckGenerationProgress,
  type DeckGenerationProgressPage,
  type DeckGenerationRuntime,
  type DeckGenerationStep,
  type DeckGenerationStream,
  type DeckGenerationStreamSnapshot,
  type ResearchDiscoveryProgress,
} from "./types";
import { generationText } from "./messages";

function cloneResearchDiscoveryProgress(
  progress?: ResearchDiscoveryProgress,
): ResearchDiscoveryProgress | undefined {
  if (!progress) return undefined;
  return {
    ...progress,
    summary: { ...progress.summary },
    records: progress.records.map((record) => ({
      ...record,
      queries: record.queries?.map((query) => ({
        ...query,
        sources: query.sources?.map((source) => ({ ...source })),
      })),
      sources: record.sources?.map((source) => ({ ...source })),
      visualAssets: record.visualAssets?.map((asset) => ({ ...asset })),
      activities: record.activities ? [...record.activities] : undefined,
      lines: record.lines ? [...record.lines] : undefined,
      gaps: record.gaps ? [...record.gaps] : undefined,
      rejectedReasons: record.rejectedReasons ? [...record.rejectedReasons] : undefined,
      counts: record.counts ? { ...record.counts } : undefined,
    })),
  };
}

export function mapProgress(
  progress: PageProgress | null,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
): DeckGenerationProgressPage[] {
  return progress?.pages.map((page) => ({
    page_id: page.page_id,
    index: page.index,
    title: page.title,
    status: page.status,
    render_attempts: page.render_attempts,
    render_attempt_limit: attemptLimits.render,
    visual_review_attempts: page.visual_review_attempts,
    visual_review_attempt_limit: attemptLimits.visualReview,
    content_review_attempts: page.content_review_attempts ?? 0,
    content_review_attempt_limit: attemptLimits.contentReview,
    agent_failures: page.agent_failures,
    agent_failure_limit: attemptLimits.agent,
    agent_infrastructure_failures: page.agent_infrastructure_failures,
    last_error: page.last_error,
    last_screenshot_path: page.last_screenshot_path,
  })) ?? [];
}

export function createProgress(
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
  researchDiscovery?: ResearchDiscoveryProgress,
): DeckGenerationProgress {
  const activeStreamList = activeStreams
    ? Array.from(activeStreams).sort((left, right) => left.page_index - right.page_index)
    : [];
  return {
    ...value,
    pages: mapProgress(progress, attemptLimits),
    stream: stream ?? undefined,
    activeStreams: activeStreamList.length > 0 ? activeStreamList.map((item) => ({
      ...item,
      lines: [...item.lines],
      activities: [...item.activities],
    })) : undefined,
    researchDiscovery: cloneResearchDiscoveryProgress(researchDiscovery),
  };
}

export function emit(
  input: Pick<DeckGenerationContext, "onProgress">,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
  researchDiscovery?: ResearchDiscoveryProgress,
) {
  input.onProgress(createProgress(
    value,
    progress,
    stream,
    activeStreams,
    attemptLimits,
    researchDiscovery,
  ));
}

export function pageProgressToDeckGenerationProgress(
  storedProgress: PageProgress,
  locale: Locale = "zh",
): DeckGenerationProgress {
  const pages = [...storedProgress.pages].sort((left, right) => left.index - right.index);
  const resumablePage = pages.find((item) => isResumablePageGenerationStatus(item.status));
  const failedPage = pages.find((item) => isGenuinelyFailedPageGenerationStatus(item.status));
  const activePageCandidate = pages.find((item) => isActivePageGenerationStatus(item.status));
  const unfinishedPage = pages.find((item) => item.status !== "accepted");
  const activePage =
    unfinishedPage ??
    resumablePage ??
    failedPage ??
    activePageCandidate ??
    [...pages].reverse().find((item) => item.status !== "pending") ??
    pages[0] ??
    null;
  const acceptedCount = pages.filter((item) => item.status === "accepted").length;
  const allAccepted = pages.length > 0 && acceptedCount === pages.length;
  const finalDeckRender = storedProgress.final_deck_render;
  const finalDeckRenderCompleted =
    !finalDeckRender || finalDeckRender.status === "completed";
  const step: DeckGenerationStep = allAccepted && finalDeckRenderCompleted
      ? "complete"
      : allAccepted
        ? "final-render"
        : unfinishedPage
        ? "interrupted"
        : "page-authoring";
  const message = step === "complete"
      ? generationText(locale).complete
      : step === "final-render"
        ? finalDeckRender?.error || finalDeckRender?.message || generationText(locale).finalRender
      : step === "interrupted"
        ? failedPage?.last_error || generationText(locale).interrupted
        : generationText(locale).resumed;

  return {
    step,
    message,
    currentPageIndex: activePage ? activePage.index : null,
    totalPages: pages.length,
    recoveryRunKind: storedProgress.recovery?.run_kind ?? (
      step === "final-render" ? "final-deck-render" : undefined
    ),
    pages: mapProgress({
      ...storedProgress,
      pages,
    }),
    researchDiscovery: cloneResearchDiscoveryProgress(storedProgress.research_discovery),
  };
}

export function createDeckGenerationStreamSnapshot(
  progress: DeckGenerationProgress,
  locale: Locale = "zh",
): DeckGenerationStreamSnapshot {
  const id = progress.stream
    ? `${progress.step}:${progress.stream.page_id}:${progress.stream.run_id ?? progress.stream.kind ?? progress.stream.status}`
    : `${progress.step}:global`;
  return {
    id,
    phase: progress.step,
    label: progress.stream
      ? generationText(locale).streamLabel(
          progress.stream.page_index,
          progress.stream.kind ?? progress.step
        )
      : progress.message || progress.step,
    kind: progress.stream?.kind,
    page_id: progress.stream?.page_id,
    page_index: progress.stream?.page_index,
    status: progress.stream?.status ?? progress.message,
    message: progress.message,
    lines: progress.stream ? [...progress.stream.lines] : [],
    activities: progress.stream ? [...progress.stream.activities] : [],
    updated_at: new Date().toISOString(),
  };
}

export function buildDeckGenerationSummary(
  input: Pick<DeckGenerationContext, "locale">,
  progress: PageProgress | null,
  totalPages: number,
) {
  const pages = progress?.pages ?? [];
  const accepted = pages.filter((page) => page.status === "accepted").length;
  const failed = pages.filter((page) => isGenuinelyFailedPageGenerationStatus(page.status)).length;
  const active = pages.filter((page) => isActivePageGenerationStatus(page.status)).length;
  return generationText(input.locale).activeSummary({
    active,
    accepted,
    failed,
    total: totalPages,
  });
}

export function emitRuntime(
  input: DeckGenerationRuntime,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: PageProgress | null,
  stream?: DeckGenerationStream | null,
  attemptLimits: typeof ATTEMPT_LIMITS = ATTEMPT_LIMITS,
) {
  emit(input, value, progress, stream, input.activeStreams.values(), attemptLimits, input.researchDiscoveryProgress);
}
