import type { AgentStreamEvent } from "../../agent/agentClient";
import type { PptBackend } from "../../api/pptBackend";
import type {
  UploadedSourceAnalysisDraftFingerprint,
  UploadedSourceMaterial,
  WorkspaceResult,
} from "../../api/types";
import type { AiInteractionLogger, AiOperationLogContext } from "../../ai/interactionLog";

export type UploadedSourceAnalysisDraftType = "factual" | "visual";

export interface UploadedSourceAnalysisGateAttemptLog {
  analysis_run_id: string;
  operation_id: string;
  draft_type: UploadedSourceAnalysisDraftType;
  attempt: number;
  attempt_kind: "initial" | "retry";
  draft_path: string;
  draft_agent_file_tool_path?: string | null;
  before_fingerprint: UploadedSourceAnalysisDraftFingerprint;
  after_fingerprint?: UploadedSourceAnalysisDraftFingerprint;
  fingerprint_changed?: boolean;
  validation_gaps: string[];
  gate_passed: boolean;
  retry_prompt_reason?: string;
  will_retry: boolean;
  attempt_limit: number;
  error?: Record<string, unknown>;
}

function randomSuffix() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function nowIso() {
  return new Date().toISOString();
}

export function createUploadedSourceAnalysisRunId() {
  return `uploaded-source-analysis-${Date.now().toString(36)}-${randomSuffix()}`;
}

function fallbackOperationId(operation: string) {
  return `research-${operation}-${Date.now().toString(36)}-${randomSuffix()}`;
}

export function summarizeActiveUploadedSources(sources: UploadedSourceMaterial[]) {
  return sources.map((source) => ({
    uploaded_source_id: source.uploaded_source_id,
    display_name: source.display_name || source.original_filename,
    extension: source.extension,
    sha256: source.sha256,
    size_bytes: source.size_bytes,
    file_path: source.file_path,
  }));
}

export function summarizeUploadedSourceAnalysisCounts(input: {
  status?: unknown;
  can_continue?: unknown;
  updated_at?: unknown;
  facts?: unknown[];
  visual_assets?: unknown[];
  gaps?: unknown[];
  rejected_material?: unknown[];
}) {
  return {
    status: input.status,
    can_continue: input.can_continue,
    updated_at: input.updated_at,
    facts: Array.isArray(input.facts) ? input.facts.length : 0,
    visual_assets: Array.isArray(input.visual_assets) ? input.visual_assets.length : 0,
    gaps: Array.isArray(input.gaps) ? input.gaps.length : 0,
    rejected_material: Array.isArray(input.rejected_material)
      ? input.rejected_material.length
      : 0,
  };
}

export function readUploadedSourceAnalysisError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { message: String(error) };
}

export async function appendUploadedSourceAnalysisLog(input: {
  backend: PptBackend;
  workspace: WorkspaceResult;
  entry: Record<string, unknown>;
  payloadKeys?: string[];
}) {
  await input.backend.appendWorkspaceLog({
    workspace_dir: input.workspace.workspace_dir,
    channel: "ai-research",
    entry: {
      schema_version: 1,
      updated_at: nowIso(),
      ...input.entry,
    },
    payload_keys: input.payloadKeys,
  }).catch((error) => {
    console.warn(
      "Failed to append uploaded source analysis log",
      error instanceof Error ? error.message : error
    );
  });
}

export function createUploadedSourceAnalysisAgentRunLogger(input: {
  backend: PptBackend;
  workspace: WorkspaceResult;
  aiLogger?: AiInteractionLogger | null;
  analysisRunId: string;
  draftType: UploadedSourceAnalysisDraftType;
  operation: string;
  kind: string;
  draftPath: string;
  onStreamEvent?: (event: AgentStreamEvent) => void;
}) {
  const operationId = input.aiLogger?.createOperationId("research", input.operation)
    ?? fallbackOperationId(input.operation);
  const logContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "research",
        operation: input.operation,
        operation_id: operationId,
        kind: input.kind,
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;
  const streamEvents: Array<Record<string, unknown>> = [];
  let flushedStreamEventCount = 0;

  async function flushStreamBatch(force = false) {
    const pending = streamEvents.slice(flushedStreamEventCount);
    if (pending.length === 0) return;
    if (!force && pending.length < 10) return;
    flushedStreamEventCount = streamEvents.length;
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.stream.batch",
        analysis_run_id: input.analysisRunId,
        operation_id: operationId,
        interaction_id: logContext?.interaction_ids?.at(-1),
        draft_type: input.draftType,
        events: pending,
        emitted_at: nowIso(),
      },
      payloadKeys: ["events"],
    });
  }

  async function appendSemantic(entry: Record<string, unknown>, payloadKeys?: string[]) {
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        analysis_run_id: input.analysisRunId,
        operation_id: operationId,
        draft_type: input.draftType,
        operation: input.operation,
        kind: input.kind,
        ...entry,
      },
      payloadKeys,
    });
  }

  return {
    operationId,
    logContext,
    onStreamEvent(event: AgentStreamEvent) {
      streamEvents.push({
        timestamp: nowIso(),
        ...event,
      });
      input.onStreamEvent?.(event);
      if (streamEvents.length - flushedStreamEventCount >= 10) {
        void flushStreamBatch();
      }
    },
    flushStreamBatch,
    appendSemantic,
    async finish(status: "completed" | "failed", extra: Record<string, unknown>) {
      await flushStreamBatch(true);
      await appendSemantic({
        event: `uploaded_source.analysis.${input.draftType}.finished`,
        status,
        interaction_ids: logContext?.interaction_ids ?? [],
        ...extra,
      }, Array.isArray(extra.attempts) ? ["attempts"] : undefined);
    },
  };
}
