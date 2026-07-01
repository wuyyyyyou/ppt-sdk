import { AgentRunCancelledError, type AgentPageContentReviewResult, type AgentPageVisualReviewResult, type AgentStreamEvent } from "../../agent/agentClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import type { PagePlanItem, PageProgress } from "../../api/types";
import type { DeckRefinementIntentReviewResult } from "../../ai/types";
import { buildDeckGenerationSummary, emitRuntime } from "./progressProjection";
import { updateResearchDiscoveryCurationStream } from "./researchDiscoveryProgress";
import { ATTEMPT_LIMITS, type DeckGenerationContext, type DeckGenerationRuntime, type DeckGenerationStep, type DeckGenerationStream, type ResearchDiscoveryProgress } from "./types";

function isResearchAgentKind(kind: string) {
  return kind === "research-curation"
    || kind === "web-research-curation"
    || kind === "visual-research-curation";
}

function isDeckLevelResearchDiscoveryStream(stream: DeckGenerationStream) {
  return stream.page_id.startsWith("discovery-") && (
    stream.kind === "web-research-curation" ||
    stream.kind === "visual-research-curation"
  );
}

export async function recordProgress(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  page: PagePlanItem,
  patch: Record<string, unknown>,
) {
  return input.backend.recordPageProgress({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
    patch,
  });
}

export async function recordDeckRecovery(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  patch: {
    status?: NonNullable<PageProgress["recovery"]>["status"];
    run_kind?: NonNullable<PageProgress["recovery"]>["run_kind"];
    step?: string | null;
    target_page_ids?: string[];
    page_refinement_request?: string | null;
    page_refinement_requests?: Record<string, string>;
    deck_refinement_review?: DeckRefinementIntentReviewResult | null;
    error?: string | null;
    final_deck_render?: Partial<NonNullable<PageProgress["final_deck_render"]>>;
    research_discovery?: ResearchDiscoveryProgress;
    deck_status?: string;
  },
) {
  const { final_deck_render: finalDeckRender, research_discovery: researchDiscovery, deck_status: deckStatus, ...recovery } = patch;
  return input.backend.recordPageProgress({
    workspace_dir: input.workspace.workspace_dir,
    patch: {
      ...(deckStatus ? { deck_status: deckStatus } : {}),
      recovery,
      ...(finalDeckRender ? { final_deck_render: finalDeckRender } : {}),
      ...(researchDiscovery ? { research_discovery: researchDiscovery } : {}),
    },
  });
}

export function throwIfCancelled(input: Pick<DeckGenerationContext, "isCancelled">): void {
  if (input.isCancelled()) {
    throw new AgentRunCancelledError();
  }
}

export function getProgressPage(progress: PageProgress | null, pageId: string) {
  return progress?.pages.find((page) => page.page_id === pageId) ?? null;
}

export function getStoredVisualReview(
  page: PageProgress["pages"][number] | null | undefined,
): AgentPageVisualReviewResult | null {
  return (page?.visual_review ?? page?.review ?? null) as AgentPageVisualReviewResult | null;
}

export function getStoredContentReview(
  page: PageProgress["pages"][number] | null | undefined,
): AgentPageContentReviewResult | null {
  return (page?.content_review ?? page?.review ?? null) as AgentPageContentReviewResult | null;
}

export function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function pushBounded(list: string[], value: string, limit: number) {
  const cleanValue = value.trim();
  if (!cleanValue) return;
  list.push(cleanValue);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

export function appendTextToLines(lines: string[], chunk: string, limit: number) {
  if (!chunk) return;
  const parts = chunk.split(/\n/);
  if (lines.length === 0) lines.push("");
  lines[lines.length - 1] += parts[0];
  for (const part of parts.slice(1)) {
    lines.push(part);
  }
  if (lines.length > limit) {
    lines.splice(0, lines.length - limit);
  }
}


export function createAgentRunTracker(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  step: DeckGenerationStep;
  message: string;
  totalPages: number;
  progress: () => PageProgress | null;
  prompt: string;
  kind: string;
  operationId?: string;
  logContext?: AiOperationLogContext;
  attemptLimits?: typeof ATTEMPT_LIMITS;
}) {
  const startedAt = new Date().toISOString();
  const isResearchOperation = isResearchAgentKind(input.kind);
  const operationId = input.logContext?.operation_id ?? input.operationId ?? (
    input.flowInput.aiLogger
      ? input.flowInput.aiLogger.createOperationId(
          isResearchOperation ? "research" : "page_agent",
          input.kind,
        )
      : `${input.page.page_id}-${input.kind}-${Date.now().toString(36)}`
  );
  const logContext: AiOperationLogContext | undefined = input.flowInput.aiLogger
    ? input.logContext ?? {
        logger: input.flowInput.aiLogger,
        workspace_dir: input.flowInput.workspace.workspace_dir,
        domain: (isResearchOperation ? "research" : "page_agent") as AiOperationLogContext["domain"],
        operation: input.kind,
        operation_id: operationId,
        page_id: input.page.page_id,
        page_index: input.page.index,
        kind: input.kind,
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
  const stream: DeckGenerationStream = {
    run_id: operationId,
    kind: input.kind,
    page_id: input.page.page_id,
    page_index: input.page.index,
    status: input.message,
    lines: [],
    activities: [],
    started_at: startedAt,
    updated_at: startedAt,
  };
  const activities: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  const streamEvents: Array<Record<string, unknown>> = [];
  let flushedStreamEventCount = 0;
  let usage: unknown = null;

  function emitStream() {
    stream.updated_at = new Date().toISOString();
    input.flowInput.activeStreams.set(operationId, stream);
    emitRuntime(
      input.flowInput,
      {
        step: input.step,
        message: buildDeckGenerationSummary(input.flowInput, input.progress(), input.totalPages),
        currentPageIndex: input.page.index,
        totalPages: input.totalPages,
      },
      input.progress(),
      stream,
      input.attemptLimits ?? ATTEMPT_LIMITS,
    );
  }

  async function flushStreamBatch(force = false) {
    if (!input.flowInput.aiLogger || !logContext) return;
    const pending = streamEvents.slice(flushedStreamEventCount);
    if (pending.length === 0) return;
    if (!force && pending.length < 10) return;
    flushedStreamEventCount = streamEvents.length;
    await input.flowInput.aiLogger.appendStreamBatch(logContext, {
      operation_id: operationId,
      interaction_id: logContext.interaction_ids?.at(-1),
      events: pending,
    });
  }

  function recordStreamEvent(event: AgentStreamEvent) {
    streamEvents.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    if (streamEvents.length - flushedStreamEventCount >= 10) {
      void flushStreamBatch();
    }
  }

  return {
    onStreamEvent(event: AgentStreamEvent) {
      recordStreamEvent(event);
      if (event.type === "content") {
        appendTextToLines(stream.lines, event.text, 30);
      } else if (event.type === "activity") {
        activities.push(event);
        pushBounded(stream.activities, event.message, 12);
      } else if (event.type === "error") {
        errors.push(event);
        pushBounded(stream.activities, event.message, 12);
      } else if (event.type === "complete") {
        usage = event.usage ?? usage;
        pushBounded(stream.activities, "Agent run completed", 12);
      }
      emitStream();
    },
    logContext,
    operationId,
    async flush(status: "completed" | "error", extra: Record<string, unknown>) {
      const endedAt = new Date().toISOString();
      const baseEntry = {
        event: isResearchOperation
          ? "ai.research.curation.operation.finished"
          : "ai.page_agent.operation.finished",
        schema_version: 1,
        operation_id: operationId,
        interaction_ids: logContext?.interaction_ids ?? [],
        page_id: input.page.page_id,
        page_index: input.page.index,
        kind: input.kind,
        status,
        prompt_hash: shortHash(input.prompt),
        started_at: startedAt,
        ended_at: endedAt,
        usage,
        ...extra,
      };
      try {
        await input.flowInput.backend.appendWorkspaceLog({
          workspace_dir: input.flowInput.workspace.workspace_dir,
          channel: isResearchOperation ? "ai-research" : "ai-page-agent",
          entry: baseEntry,
        });
        await flushStreamBatch(true);
      } catch {
        // Logging must never fail Deck Generation.
      } finally {
        stream.status = status;
        stream.updated_at = endedAt;
        if (isDeckLevelResearchDiscoveryStream(stream)) {
          input.flowInput.researchDiscoveryProgress = updateResearchDiscoveryCurationStream(
            input.flowInput.researchDiscoveryProgress,
            stream.kind === "web-research-curation" ? "web" : "visual",
            stream,
            endedAt,
          );
        }
        emitStream();
        input.flowInput.activeStreams.delete(operationId);
        emitRuntime(
          input.flowInput,
          {
            step: input.step,
            message: buildDeckGenerationSummary(input.flowInput, input.progress(), input.totalPages),
            currentPageIndex: input.page.index,
            totalPages: input.totalPages,
          },
          input.progress(),
          null,
          input.attemptLimits ?? ATTEMPT_LIMITS,
        );
      }
    },
  };
}

export async function appendWorkspaceLogSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
  channel: "ai-page-plan" | "ai-page-agent" | "ai-page-agent-stream",
  entry: Record<string, unknown>,
) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspace.workspace_dir,
      channel,
      entry,
    });
  } catch {
    // Logging must never fail Deck Generation.
  }
}


export function buildAgentRunOptions(
  input: DeckGenerationRuntime,
  onStreamEvent: (event: AgentStreamEvent) => void,
  logContext?: AiOperationLogContext,
) {
  return {
    onStreamEvent,
    signal: input.cancelSignal,
    isCancelled: input.isCancelled,
    logContext,
  };
}
