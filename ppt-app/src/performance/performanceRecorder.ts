import type { PerformanceContext, PerformanceEvent } from "../api/types";

type EventSink = (runId: string, events: PerformanceEvent[]) => Promise<void>;

const MAX_QUEUE_SIZE = 1_000;
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 750;
const producerId = `ppt-app-${crypto.randomUUID()}`;
let activeRunId: string | null = null;
let sequenceNumber = 0;
let sink: EventSink | null = null;
let queue: PerformanceEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let droppedCount = 0;
let lastFlushError: unknown = null;
let recentInteraction: { traceId: string; recordedAt: number } | null = null;
const activeWorkflowSpans: Array<{ traceId: string; spanId: string }> = [];

export function configurePerformanceEventSink(nextSink: EventSink) {
  sink = nextSink;
}

export function setActivePerformanceRun(runId: string | null) {
  activeRunId = runId;
  if (runId) scheduleFlush();
  if (!runId && flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export function getActivePerformanceRunId() {
  return activeRunId;
}

export function createPerformanceId() {
  return crypto.randomUUID();
}

function baseEvent(eventType: PerformanceEvent["event_type"]): Pick<PerformanceEvent, "schema_version" | "event_id" | "event_type" | "recorded_at" | "producer_id" | "sequence_number"> {
  return {
    schema_version: 1,
    event_id: createPerformanceId(),
    event_type: eventType,
    recorded_at: new Date().toISOString(),
    producer_id: producerId,
    sequence_number: sequenceNumber++,
  };
}

function scheduleFlush() {
  if (flushTimer || !activeRunId || queue.length === 0) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPerformanceEvents();
  }, FLUSH_INTERVAL_MS);
}

export function recordPerformanceEvent(event: Omit<PerformanceEvent, "schema_version" | "event_id" | "recorded_at" | "producer_id" | "sequence_number">) {
  if (!activeRunId) return;
  if (queue.length >= MAX_QUEUE_SIZE) {
    droppedCount += 1;
    return;
  }
  queue.push({ ...baseEvent(event.event_type), ...event });
  if (queue.length >= BATCH_SIZE) void flushPerformanceEvents();
  else scheduleFlush();
}

function enqueueLossEvent() {
  if (droppedCount <= 0 || queue.length >= MAX_QUEUE_SIZE) return;
  const count = droppedCount;
  droppedCount = 0;
  queue.push({
    ...baseEvent("data.loss"),
    event_type: "data.loss",
    attributes: { dropped_count: count, reason: "frontend_queue_overflow" },
  });
}

export async function flushPerformanceEvents(options: { throwOnError?: boolean } = {}) {
  if (flushing) {
    await flushing;
    if (options.throwOnError && lastFlushError) throw lastFlushError;
    return;
  }
  const runId = activeRunId;
  if (!runId || !sink) return;
  flushing = (async () => {
    enqueueLossEvent();
    while (activeRunId === runId && queue.length > 0) {
      const batch = queue.splice(0, BATCH_SIZE);
      try {
        await sink(runId, batch);
        lastFlushError = null;
      } catch {
        const restored = [...batch, ...queue];
        droppedCount += Math.max(0, restored.length - MAX_QUEUE_SIZE);
        queue = restored.slice(0, MAX_QUEUE_SIZE);
        lastFlushError = new Error("Failed to persist the Performance Event batch.");
        break;
      }
    }
  })().finally(() => {
    flushing = null;
    if (queue.length > 0) scheduleFlush();
  });
  await flushing;
  if (options.throwOnError && lastFlushError) throw lastFlushError;
}

export function beginPerformanceSpan(input: {
  operationName: string;
  traceId?: string;
  parentSpanId?: string;
  workspaceId?: string;
  attributes?: PerformanceEvent["attributes"];
}) {
  if (!activeRunId) return null;
  const isWorkflow = input.attributes?.layer === "workflow";
  const workflowParent = isWorkflow ? undefined : activeWorkflowSpans.at(-1);
  const interactionTraceId = recentInteraction && performance.now() - recentInteraction.recordedAt <= 1_500
    ? recentInteraction.traceId
    : undefined;
  const traceId = input.traceId ?? workflowParent?.traceId ?? interactionTraceId ?? createPerformanceId();
  const spanId = createPerformanceId();
  const parentSpanId = input.parentSpanId ?? workflowParent?.spanId;
  const startedAt = performance.now();
  recordPerformanceEvent({
    event_type: "span.started",
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: parentSpanId,
    operation_name: input.operationName,
    workspace_id: input.workspaceId,
    attributes: input.attributes,
  });
  if (isWorkflow) activeWorkflowSpans.push({ traceId, spanId });
  let finished = false;
  return {
    runId: activeRunId,
    traceId,
    spanId,
    finish(status: "ok" | "error" | "interrupted" = "ok", attributes?: PerformanceEvent["attributes"]) {
      if (finished) return;
      finished = true;
      recordPerformanceEvent({
        event_type: "span.finished",
        trace_id: traceId,
        span_id: spanId,
        parent_span_id: parentSpanId,
        operation_name: input.operationName,
        workspace_id: input.workspaceId,
        duration_ms: performance.now() - startedAt,
        status,
        attributes: { duration_source: "monotonic", ...input.attributes, ...attributes },
      });
      if (isWorkflow) {
        const index = activeWorkflowSpans.findIndex((item) => item.spanId === spanId);
        if (index >= 0) activeWorkflowSpans.splice(index, 1);
      }
    },
    childContext(operationName: string): PerformanceContext {
      return {
        run_id: activeRunId!,
        trace_id: traceId,
        span_id: createPerformanceId(),
        parent_span_id: spanId,
        operation_name: operationName,
        workspace_id: input.workspaceId,
      };
    },
  };
}

export function installPerformanceButtonCollector() {
  const onClick = (event: MouseEvent) => {
    if (!activeRunId) return;
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || button.dataset.performanceExclude === "true" || button.closest("[data-performance-control='true']")) return;
    const buttonId = button.dataset.performanceId;
    if (!buttonId) {
      if (import.meta.env.DEV) console.warn("[performance] Ignoring button without data-performance-id", button);
      return;
    }
    const delay = Math.max(0, performance.now() - event.timeStamp);
    const traceId = createPerformanceId();
    recentInteraction = { traceId, recordedAt: performance.now() };
    requestAnimationFrame(() => {
      recordPerformanceEvent({
        event_type: "button.interaction",
        trace_id: traceId,
        interaction_delay_ms: delay,
        feedback_delay_ms: Math.max(delay, performance.now() - event.timeStamp),
        operation_name: "button.interaction",
        attributes: { button_id: buttonId, disabled: button.disabled },
      });
    });
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => document.removeEventListener("click", onClick, { capture: true });
}
