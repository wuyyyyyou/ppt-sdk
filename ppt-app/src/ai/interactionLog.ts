import type { AppendWorkspaceLogInput } from "../api/types";

export type AiLogDomain = "requirements" | "outline" | "style_guide" | "page_plan" | "page_agent" | "research" | "theme";
export type AiInteractionStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface WorkspaceLogAppender {
  appendWorkspaceLog(input: AppendWorkspaceLogInput): Promise<unknown>;
}

export interface AiOperationLogContext {
  logger?: AiInteractionLogger;
  workspace_dir: string;
  domain: AiLogDomain;
  operation: string;
  operation_id?: string;
  page_id?: string;
  page_index?: number;
  kind?: string;
  provider?: string;
  runtime_mode?: string;
  interaction_ids?: string[];
}

export interface AiInteractionHandle {
  operation_id: string;
  interaction_id: string;
  context: AiOperationLogContext;
  started_at: string;
}

export interface FinishInteractionInput {
  status: Exclude<AiInteractionStatus, "started">;
  response?: unknown;
  output?: unknown;
  error?: unknown;
  usage?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  session_history?: unknown;
  extra?: Record<string, unknown>;
}

const SCHEMA_VERSION = 1;

const INTERACTION_CHANNELS = {
  requirements: "ai-requirements-interactions",
  outline: "ai-outline-interactions",
  style_guide: "ai-style-guide-interactions",
  page_plan: "ai-page-plan-interactions",
  page_agent: "ai-page-agent-interactions",
  research: "ai-research-interactions",
  theme: "ai-theme-interactions",
} as const satisfies Record<AiLogDomain, AppendWorkspaceLogInput["channel"]>;

const SEMANTIC_CHANNELS = {
  requirements: "ai-requirements",
  outline: "ai-outline",
  style_guide: "ai-style-guide",
  page_plan: "ai-page-plan",
  page_agent: "ai-page-agent",
  research: "ai-research",
  theme: "ai-theme",
} as const satisfies Record<AiLogDomain, AppendWorkspaceLogInput["channel"]>;

function nowIso() {
  return new Date().toISOString();
}

function randomPart() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      unserializable: true,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function shortLogHash(value: unknown): string {
  const text = typeof value === "string" ? value : safeJsonStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createOperationId(domain: AiLogDomain, operation: string) {
  return `${domain}-${operation}-${Date.now().toString(36)}-${randomPart()}`;
}

function createInteractionId(domain: AiLogDomain, operation: string) {
  return `${domain}-${operation}-interaction-${Date.now().toString(36)}-${randomPart()}`;
}

function domainEventPrefix(domain: AiLogDomain) {
  if (domain === "requirements") return "ai.requirements";
  if (domain === "research") return "ai.research";
  if (domain === "page_plan") return "ai.page_plan";
  if (domain === "page_agent") return "ai.page_agent";
  if (domain === "theme") return "ai.theme";
  return "ai.outline";
}

function readErrorRecord(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: String(error) };
}

function readTopLevelResponseMetadata(value: unknown): Record<string, unknown> {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    model: record.model,
    usage: record.usage ?? record.token_usage,
    stop_reason: record.stopReason ?? record.stop_reason,
  };
}

export function createAiInteractionLogger(appender: WorkspaceLogAppender) {
  async function append(input: AppendWorkspaceLogInput) {
    try {
      await appender.appendWorkspaceLog(input);
    } catch (error) {
      console.warn(
        "Failed to append AI interaction log",
        error instanceof Error ? error.message : error
      );
    }
  }

  function buildBaseEntry(
    context: AiOperationLogContext,
    operationId: string,
    interactionId?: string
  ) {
    return {
      schema_version: SCHEMA_VERSION,
      operation_id: operationId,
      ...(interactionId ? { interaction_id: interactionId } : {}),
      operation: context.operation,
      ...(context.kind ? { kind: context.kind } : {}),
      ...(context.page_id ? { page_id: context.page_id } : {}),
      ...(typeof context.page_index === "number" ? { page_index: context.page_index } : {}),
      ...(context.provider ? { provider: context.provider } : {}),
      ...(context.runtime_mode ? { runtime_mode: context.runtime_mode } : {}),
    };
  }

  return {
    createOperationId,

    async startInteraction(
      context: AiOperationLogContext,
      payload: { request?: unknown; prompt?: unknown; extra?: Record<string, unknown> }
    ): Promise<AiInteractionHandle> {
      const operation_id = context.operation_id ?? createOperationId(context.domain, context.operation);
      context.operation_id = operation_id;
      const interaction_id = createInteractionId(context.domain, context.operation);
      context.interaction_ids = [...(context.interaction_ids ?? []), interaction_id];
      const started_at = nowIso();
      const entry = {
        event: `${domainEventPrefix(context.domain)}.interaction.started`,
        ...buildBaseEntry(context, operation_id, interaction_id),
        status: "started",
        started_at,
        request: payload.request,
        prompt: payload.prompt,
        request_hash:
          payload.request === undefined ? undefined : shortLogHash(payload.request),
        prompt_hash:
          payload.prompt === undefined ? undefined : shortLogHash(payload.prompt),
        ...payload.extra,
      };
      await append({
        workspace_dir: context.workspace_dir,
        channel: INTERACTION_CHANNELS[context.domain],
        entry,
        payload_keys: ["request", "prompt"],
      });

      return {
        operation_id,
        interaction_id,
        context: { ...context, operation_id },
        started_at,
      };
    },

    async finishInteraction(handle: AiInteractionHandle, input: FinishInteractionInput) {
      const ended_at = nowIso();
      const metadata = readTopLevelResponseMetadata(input.response);
      const entry = {
        event: `${domainEventPrefix(handle.context.domain)}.interaction.finished`,
        ...buildBaseEntry(handle.context, handle.operation_id, handle.interaction_id),
        status: input.status,
        started_at: handle.started_at,
        ended_at,
        duration_ms: Math.max(
          0,
          new Date(ended_at).getTime() - new Date(handle.started_at).getTime()
        ),
        response: input.response,
        output: input.output,
        error: input.error === undefined ? undefined : readErrorRecord(input.error),
        response_hash:
          input.response === undefined ? undefined : shortLogHash(input.response),
        output_hash: input.output === undefined ? undefined : shortLogHash(input.output),
        model: input.model ?? metadata.model,
        usage: input.usage ?? metadata.usage,
        stop_reason: input.stop_reason ?? metadata.stop_reason,
        session_history: input.session_history,
        ...input.extra,
      };
      await append({
        workspace_dir: handle.context.workspace_dir,
        channel: INTERACTION_CHANNELS[handle.context.domain],
        entry,
        payload_keys: ["response", "output", "session_history"],
      });
    },

    async appendSemanticLog(
      context: AiOperationLogContext,
      entry: Record<string, unknown>,
      payloadKeys: string[] = []
    ) {
      const operation_id = context.operation_id ?? createOperationId(context.domain, context.operation);
      await append({
        workspace_dir: context.workspace_dir,
        channel: SEMANTIC_CHANNELS[context.domain],
        entry: {
          ...buildBaseEntry(context, operation_id),
          ...entry,
        },
        payload_keys: payloadKeys,
      });
    },

    async appendStreamBatch(
      context: AiOperationLogContext,
      input: {
        operation_id: string;
        interaction_id?: string;
        events: unknown[];
      }
    ) {
      await append({
        workspace_dir: context.workspace_dir,
        channel: "ai-page-agent-stream",
        entry: {
          event: "ai.page_agent.stream.batch",
          ...buildBaseEntry(context, input.operation_id, input.interaction_id),
          status: "succeeded",
          events: input.events,
          emitted_at: nowIso(),
        },
        payload_keys: ["events"],
      });
    },
  };
}

export type AiInteractionLogger = ReturnType<typeof createAiInteractionLogger>;
