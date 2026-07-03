import { isAgentRunCancelledError, type AgentClient, type AgentStreamEvent } from "../../agent/agentClient";
import type { PptBackend } from "../../api/pptBackend";
import type {
  UploadedSourceAnalysisDraftFingerprint,
  UploadedSourceMaterial,
  WorkspaceResult,
} from "../../api/types";
import type { AiInteractionLogger } from "../../ai/interactionLog";
import { LOCAL_GATE_REPAIR_LIMIT } from "./types";
import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  toAgentFileToolPath,
} from "./agentFileToolPaths";
import {
  createSkippedUploadedSourceVisualAnalysisDraft,
  mergeUploadedSourceAnalysis,
  uploadedSourceAnalysisMatchesActiveSet,
  validateUploadedSourceFactualAnalysisDraft,
  validateUploadedSourceVisualAnalysisDraft,
  type UploadedSourceAnalysis,
  type UploadedSourceDraftValidationResult,
  type UploadedSourceFactualAnalysisDraft,
  type UploadedSourceVisualAnalysisDraft,
} from "./uploadedSourceAnalysis";
import {
  appendUploadedSourceAnalysisLog,
  createUploadedSourceAnalysisAgentRunLogger,
  createUploadedSourceAnalysisRunId,
  readUploadedSourceAnalysisError,
  summarizeActiveUploadedSources,
  summarizeUploadedSourceAnalysisCounts,
  type UploadedSourceAnalysisGateAttemptLog,
} from "./uploadedSourceAnalysisLogging";

export type UploadedSourceAnalysisWorkflowPhase = "prepare" | "factual" | "visual" | "merge";

export type UploadedSourceAnalysisWorkflowEvent =
  | {
      type: "phase";
      phase: UploadedSourceAnalysisWorkflowPhase;
      state: "active" | "completed" | "skipped" | "failed";
      message?: string;
      sourceCount?: number;
      analysis?: UploadedSourceAnalysis;
      error?: string;
    }
  | {
      type: "stream";
      phase: "factual" | "visual";
      event: AgentStreamEvent;
    };

function fingerprintChanged(
  before: UploadedSourceAnalysisDraftFingerprint,
  after: UploadedSourceAnalysisDraftFingerprint,
) {
  if (!after.exists) return false;
  if (!before.exists) return true;
  return before.sha256 !== after.sha256 || before.size_bytes !== after.size_bytes;
}

function sourceListForPrompt(input: {
  workspace: WorkspaceResult;
  sources: UploadedSourceMaterial[];
}) {
  const context = createAgentFileToolPathContext({
    workspaceRoot: input.workspace.workspace_root,
    workspaceDir: input.workspace.workspace_dir,
  });
  return input.sources.map((source, index) => [
    `Uploaded Source ${index + 1}:`,
    `- uploaded_source_id: ${source.uploaded_source_id}`,
    `- display_name: ${source.display_name || source.original_filename}`,
    `- mime_type: ${source.mime_type || "unknown"}`,
    `- extension: ${source.extension}`,
    `- sha256: ${source.sha256}`,
    formatAgentFileToolPathBlock({
      label: "Source file path",
      path: toAgentFileToolPath(context, source.file_path),
    }),
  ].join("\n")).join("\n\n");
}

function buildFactualPrompt(input: {
  workspace: WorkspaceResult;
  sources: UploadedSourceMaterial[];
  draftPath: string;
  previousGateFailure?: string;
}) {
  const context = createAgentFileToolPathContext({
    workspaceRoot: input.workspace.workspace_root,
    workspaceDir: input.workspace.workspace_dir,
  });
  return [
    "You are an Uploaded Source Factual Analysis Draft Agent for a PPT Workspace.",
    "Inspect the uploaded source files and write one Uploaded Source Factual Analysis Draft JSON file.",
    "Do not edit final Uploaded Source Analysis, Research Evidence, outline, page plan, template, slide, or data files.",
    "Do not select visual assets. Do not promote image text, chart values, or screenshot text into facts unless the factual analysis can independently capture and cite it from the source material.",
    "",
    describeAgentFileToolPathContext(context),
    "",
    `Workspace directory: ${input.workspace.workspace_dir}`,
    "Uploaded source files:",
    sourceListForPrompt({ workspace: input.workspace, sources: input.sources }) || "- None",
    formatAgentFileToolPathBlock({
      label: "Factual draft JSON path to write",
      path: toAgentFileToolPath(context, input.draftPath),
    }),
    "",
    "Write exactly one JSON object to the factual draft path. JSON shape:",
    '{"version":1,"draft_type":"factual","status":"ready","continuation_decision":{"can_continue":true,"reason":"...","blocking":false},"facts":[{"id":"fact-1","claim":"...","uploaded_source_id":"...","source_path":"...","source_label":"...","excerpt":"...","confidence":"medium"}],"gaps":[{"uploaded_source_id":"...","source_path":"...","reason":"..."}],"rejected_material":[{"uploaded_source_id":"...","source_path":"...","reason":"..."}],"source_summary":"...","updated_at":"..."}',
    "If some files, sheets, tables, or sections cannot be parsed, record structured gaps and decide can_continue from the remaining usable material.",
    "If factual analysis cannot safely continue, write a valid draft with can_continue false and a clear reason.",
    input.previousGateFailure
      ? `Previous gate failure to repair in this attempt: ${input.previousGateFailure}`
      : "",
    "Final response must be short JSON: {\"status\":\"ready_for_render\",\"changed_files\":[\"...\"],\"summary\":\"...\",\"needs_render\":false,\"notes\":[]}",
  ].filter(Boolean).join("\n");
}

function buildVisualPrompt(input: {
  workspace: WorkspaceResult;
  sources: UploadedSourceMaterial[];
  draftPath: string;
  previousGateFailure?: string;
}) {
  const context = createAgentFileToolPathContext({
    workspaceRoot: input.workspace.workspace_root,
    workspaceDir: input.workspace.workspace_dir,
  });
  return [
    "You are an Uploaded Source Visual Analysis Draft Agent for a PPT Workspace.",
    "Inspect uploaded images, screenshots, charts, diagrams, and embedded visual material, then write one Uploaded Source Visual Analysis Draft JSON file.",
    "Do not edit final Uploaded Source Analysis, Research Evidence, outline, page plan, template, slide, or data files.",
    "Do not emit facts, derived insights, metrics, or factual claims. Text, numbers, and chart values visible inside an image are not grounded facts.",
    "",
    describeAgentFileToolPathContext(context),
    "",
    `Workspace directory: ${input.workspace.workspace_dir}`,
    "Uploaded source files:",
    sourceListForPrompt({ workspace: input.workspace, sources: input.sources }) || "- None",
    formatAgentFileToolPathBlock({
      label: "Visual draft JSON path to write",
      path: toAgentFileToolPath(context, input.draftPath),
    }),
    "",
    "Write exactly one JSON object to the visual draft path. JSON shape:",
    '{"version":1,"draft_type":"visual","status":"ready","continuation_decision":{"can_continue":true,"reason":"...","blocking":false},"visual_assets":[{"id":"visual-1","uploaded_source_id":"...","source_path":"...","use_constraint":"usable_visual_asset","reason":"...","visual_summary":"..."}],"gaps":[{"uploaded_source_id":"...","source_path":"...","reason":"..."}],"rejected_material":[{"uploaded_source_id":"...","source_path":"...","reason":"..."}],"visual_summary":"...","updated_at":"..."}',
    "use_constraint must be one of usable_visual_asset, reference_only, must_use, do_not_use, needs_confirmation, rejected.",
    "If no visual material is applicable, write status skipped with can_continue true.",
    input.previousGateFailure
      ? `Previous gate failure to repair in this attempt: ${input.previousGateFailure}`
      : "",
    "Final response must be short JSON: {\"status\":\"ready_for_render\",\"changed_files\":[\"...\"],\"summary\":\"...\",\"needs_render\":false,\"notes\":[]}",
  ].filter(Boolean).join("\n");
}

function summarizeDraftGateFailure(input: {
  draftType: "factual" | "visual";
  before: UploadedSourceAnalysisDraftFingerprint;
  after?: UploadedSourceAnalysisDraftFingerprint;
  validationGaps?: string[];
  error?: unknown;
}) {
  if (input.error) {
    return `Uploaded Source ${input.draftType} analysis Agent failed: ${input.error instanceof Error ? input.error.message : String(input.error)}`;
  }
  if (!input.after?.exists) {
    return `Uploaded Source ${input.draftType} analysis draft is missing.`;
  }
  if (!fingerprintChanged(input.before, input.after)) {
    return `Uploaded Source ${input.draftType} analysis draft was not written or did not change.`;
  }
  if (input.validationGaps && input.validationGaps.length > 0) {
    return `Uploaded Source ${input.draftType} analysis draft failed validation: ${input.validationGaps.join("\n")}`;
  }
  return `Uploaded Source ${input.draftType} analysis draft failed the local gate.`;
}

async function runDraftAgent<TDraft>(input: {
  backend: PptBackend;
  agentClient: AgentClient;
  workspace: WorkspaceResult;
  analysisRunId: string;
  draftType: "factual" | "visual";
  draftPath: string;
  draftAgentFileToolPath?: string | null;
  buildPrompt: (previousGateFailure?: string) => string;
  validateDraft: (value: unknown) => UploadedSourceDraftValidationResult<TDraft>;
  runLogger: ReturnType<typeof createUploadedSourceAnalysisAgentRunLogger>;
}): Promise<{ draft: TDraft; attempts: UploadedSourceAnalysisGateAttemptLog[] }> {
  let previousGateFailure: string | undefined;
  const attempts: UploadedSourceAnalysisGateAttemptLog[] = [];
  for (let attempt = 1; attempt <= LOCAL_GATE_REPAIR_LIMIT; attempt += 1) {
    const attemptKind = attempt === 1 ? "initial" : "retry";
    const before = await input.backend.getUploadedSourceAnalysisDraftFingerprint({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: input.draftType,
    });
    await input.runLogger.appendSemantic({
      event: `uploaded_source.analysis.${input.draftType}.attempt`,
      attempt,
      attempt_kind: attemptKind,
      draft_path: input.draftPath,
      draft_agent_file_tool_path: input.draftAgentFileToolPath,
      before_fingerprint: before,
      validation_gaps: [],
      gate_passed: false,
      retry_prompt_reason: previousGateFailure,
      will_retry: false,
      attempt_limit: LOCAL_GATE_REPAIR_LIMIT,
    });
    try {
      await input.agentClient.runAuthoringPrompt(
        input.buildPrompt(previousGateFailure),
        {
          onStreamEvent: input.runLogger.onStreamEvent,
          logContext: input.runLogger.logContext,
        },
      );
    } catch (error) {
      if (isAgentRunCancelledError(error)) throw error;
      previousGateFailure = summarizeDraftGateFailure({
        draftType: input.draftType,
        before,
        error,
      });
      const willRetry = attempt < LOCAL_GATE_REPAIR_LIMIT;
      const attemptLog: UploadedSourceAnalysisGateAttemptLog = {
        analysis_run_id: input.analysisRunId,
        operation_id: input.runLogger.operationId,
        draft_type: input.draftType,
        attempt,
        attempt_kind: attemptKind,
        draft_path: input.draftPath,
        draft_agent_file_tool_path: input.draftAgentFileToolPath,
        before_fingerprint: before,
        validation_gaps: [],
        gate_passed: false,
        retry_prompt_reason: previousGateFailure,
        will_retry: willRetry,
        attempt_limit: LOCAL_GATE_REPAIR_LIMIT,
        error: readUploadedSourceAnalysisError(error),
      };
      attempts.push(attemptLog);
      await input.runLogger.appendSemantic({
        event: `uploaded_source.analysis.${input.draftType}.failed_attempt`,
        ...attemptLog,
      });
      if (attempt >= LOCAL_GATE_REPAIR_LIMIT) {
        await input.runLogger.finish("failed", {
          attempts,
          error: readUploadedSourceAnalysisError(error),
        });
        throw new Error(previousGateFailure);
      }
      continue;
    }
    const after = await input.backend.getUploadedSourceAnalysisDraftFingerprint({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: input.draftType,
    });
    const rawDraft = await input.backend.getUploadedSourceAnalysisDraft({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: input.draftType,
    });
    const validation = input.validateDraft(rawDraft);
    const gatePassed = after.exists && fingerprintChanged(before, after) && Boolean(validation.draft);
    previousGateFailure = summarizeDraftGateFailure({
      draftType: input.draftType,
      before,
      after,
      validationGaps: validation.gaps,
    });
    const attemptLog: UploadedSourceAnalysisGateAttemptLog = {
      analysis_run_id: input.analysisRunId,
      operation_id: input.runLogger.operationId,
      draft_type: input.draftType,
      attempt,
      attempt_kind: attemptKind,
      draft_path: input.draftPath,
      draft_agent_file_tool_path: input.draftAgentFileToolPath,
      before_fingerprint: before,
      after_fingerprint: after,
      fingerprint_changed: fingerprintChanged(before, after),
      validation_gaps: validation.gaps,
      gate_passed: gatePassed,
      retry_prompt_reason: gatePassed ? undefined : previousGateFailure,
      will_retry: !gatePassed && attempt < LOCAL_GATE_REPAIR_LIMIT,
      attempt_limit: LOCAL_GATE_REPAIR_LIMIT,
    };
    attempts.push(attemptLog);
    if (gatePassed && validation.draft) {
      await input.runLogger.finish("completed", { ...attemptLog, attempts });
      return { draft: validation.draft, attempts };
    }
    await input.runLogger.appendSemantic({
      event: `uploaded_source.analysis.${input.draftType}.invalid`,
      ...attemptLog,
    });
    if (attempt >= LOCAL_GATE_REPAIR_LIMIT) {
      await input.runLogger.finish("failed", {
        attempts,
        error: { message: previousGateFailure },
      });
      throw new Error(previousGateFailure);
    }
  }
  throw new Error(`Uploaded Source ${input.draftType} analysis draft failed after ${LOCAL_GATE_REPAIR_LIMIT} attempts.`);
}

function hasVisualCandidate(sources: UploadedSourceMaterial[]) {
  return sources.some((source) =>
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(source.extension.toLowerCase())
  );
}

export async function ensureFreshUploadedSourceAnalysis(input: {
  backend: PptBackend;
  agentClient: AgentClient;
  aiLogger?: AiInteractionLogger | null;
  workspace: WorkspaceResult;
  forceRefresh?: boolean;
  onProgress?: (event: UploadedSourceAnalysisWorkflowEvent) => void;
}): Promise<UploadedSourceAnalysis | null> {
  const analysisRunId = createUploadedSourceAnalysisRunId();
  let activeSources: UploadedSourceMaterial[] = [];
  let activeTotalSizeBytes = 0;
  let prepared: Awaited<ReturnType<PptBackend["prepareUploadedSourceAnalysisWorkspace"]>> | null = null;
  let failedPhase: UploadedSourceAnalysisWorkflowPhase = "prepare";
  let factualOperationId: string | undefined;
  let visualOperationId: string | undefined;
  let factualAttempts: UploadedSourceAnalysisGateAttemptLog[] = [];
  let visualAttempts: UploadedSourceAnalysisGateAttemptLog[] = [];
  input.onProgress?.({
    type: "phase",
    phase: "prepare",
    state: "active",
  });
  try {
    prepared = await input.backend.prepareUploadedSourceAnalysisWorkspace({
      workspace_dir: input.workspace.workspace_dir,
    });
    activeSources = prepared.uploaded_source_index.materials.filter((source) => source.status === "active");
    activeTotalSizeBytes = prepared.uploaded_source_index.active_total_size_bytes;
  if (activeSources.length === 0) {
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.skipped",
        analysis_run_id: analysisRunId,
        reason: "no_active_uploaded_sources",
        active_count: 0,
        active_total_size_bytes: 0,
        active_uploaded_sources: [],
        mode: "auto-skip",
        updated_at: prepared.uploaded_source_index.updated_at,
      },
    });
    input.onProgress?.({
      type: "phase",
      phase: "prepare",
      state: "skipped",
      sourceCount: 0,
      message: "No active uploaded source material.",
    });
    return null;
  }
  input.onProgress?.({
    type: "phase",
    phase: "prepare",
    state: "completed",
    sourceCount: activeSources.length,
  });
  await appendUploadedSourceAnalysisLog({
    backend: input.backend,
    workspace: input.workspace,
    entry: {
      event: "uploaded_source.analysis.started",
      analysis_run_id: analysisRunId,
      mode: input.forceRefresh ? "force-refresh" : "reuse-check",
      active_count: activeSources.length,
      active_total_size_bytes: activeTotalSizeBytes,
      active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
    },
  });

  const existing = await input.backend.getUploadedSourceAnalysis({
    workspace_dir: input.workspace.workspace_dir,
  });
  if (
    !input.forceRefresh &&
    existing &&
    (existing.status === "ready" || existing.status === "gap" || existing.status === "blocked") &&
    uploadedSourceAnalysisMatchesActiveSet({
      analysis: existing,
      uploadedSourceIndex: prepared.uploaded_source_index,
    })
  ) {
    const existingAnalysis = existing as Partial<UploadedSourceAnalysis>;
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.reused",
        analysis_run_id: analysisRunId,
        ...summarizeUploadedSourceAnalysisCounts({
          status: existingAnalysis.status,
          can_continue: existingAnalysis.continuation_decision?.can_continue,
          updated_at: existingAnalysis.updated_at,
          facts: existingAnalysis.facts,
          visual_assets: existingAnalysis.visual_assets,
          gaps: existingAnalysis.gaps,
          rejected_material: existingAnalysis.rejected_material,
        }),
        reused_analysis_updated_at: existingAnalysis.updated_at,
        active_count: activeSources.length,
        active_total_size_bytes: activeTotalSizeBytes,
        active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
      },
    });
    const reused = existing as unknown as UploadedSourceAnalysis;
    input.onProgress?.({
      type: "phase",
      phase: "factual",
      state: "completed",
      sourceCount: activeSources.length,
      message: "Reused fresh Uploaded Source Analysis.",
    });
    input.onProgress?.({
      type: "phase",
      phase: "visual",
      state: "completed",
      sourceCount: activeSources.length,
      message: "Reused fresh Uploaded Source Analysis.",
    });
    input.onProgress?.({
      type: "phase",
      phase: "merge",
      state: "completed",
      sourceCount: activeSources.length,
      analysis: reused,
    });
    return reused;
  }

  input.onProgress?.({
    type: "phase",
    phase: "factual",
    state: "active",
    sourceCount: activeSources.length,
  });
  failedPhase = "factual";
  const agentPathContext = createAgentFileToolPathContext({
    workspaceRoot: input.workspace.workspace_root,
    workspaceDir: input.workspace.workspace_dir,
  });
  const factualDraftPath = prepared.factual_draft_path;
  const visualDraftPath = prepared.visual_draft_path;
  const factualDraftAgentPath = toAgentFileToolPath(
    agentPathContext,
    factualDraftPath,
  ).agentFileToolPath;
  const factualLogger = createUploadedSourceAnalysisAgentRunLogger({
    backend: input.backend,
    workspace: input.workspace,
    aiLogger: input.aiLogger,
    analysisRunId,
    draftType: "factual",
    operation: "uploaded_source_analysis_factual",
    kind: "uploaded-source-factual-analysis",
    draftPath: factualDraftPath,
    onStreamEvent: (event) => input.onProgress?.({ type: "stream", phase: "factual", event }),
  });
  factualOperationId = factualLogger.operationId;
  const factualResult = await runDraftAgent<UploadedSourceFactualAnalysisDraft>({
    backend: input.backend,
    agentClient: input.agentClient,
    workspace: input.workspace,
    analysisRunId,
    draftType: "factual",
    draftPath: factualDraftPath,
    draftAgentFileToolPath: factualDraftAgentPath,
    buildPrompt: (previousGateFailure) => buildFactualPrompt({
      workspace: input.workspace,
      sources: activeSources,
      draftPath: factualDraftPath,
      previousGateFailure,
    }),
    validateDraft: validateUploadedSourceFactualAnalysisDraft,
    runLogger: factualLogger,
  });
  const factualDraft = factualResult.draft;
  factualAttempts = factualResult.attempts;
  input.onProgress?.({
    type: "phase",
    phase: "factual",
    state: "completed",
    sourceCount: activeSources.length,
  });

  let visualDraft: UploadedSourceVisualAnalysisDraft;
  if (!hasVisualCandidate(activeSources)) {
    failedPhase = "visual";
    visualDraft = createSkippedUploadedSourceVisualAnalysisDraft("No uploaded image source material requires visual analysis.");
    await input.backend.recordUploadedSourceAnalysisDraft({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: "visual",
      draft: visualDraft as unknown as Record<string, unknown>,
    });
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.visual.skipped",
        analysis_run_id: analysisRunId,
        draft_type: "visual",
        reason: "no_uploaded_image_source_material",
        active_count: activeSources.length,
        active_total_size_bytes: activeTotalSizeBytes,
        active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
        draft_path: visualDraftPath,
        status: "skipped",
        can_continue: true,
        updated_at: visualDraft.updated_at,
      },
    });
    input.onProgress?.({
      type: "phase",
      phase: "visual",
      state: "skipped",
      sourceCount: activeSources.length,
      message: "No uploaded image source material requires visual analysis.",
    });
  } else {
    input.onProgress?.({
      type: "phase",
      phase: "visual",
      state: "active",
      sourceCount: activeSources.length,
    });
    failedPhase = "visual";
    const visualLogger = createUploadedSourceAnalysisAgentRunLogger({
      backend: input.backend,
      workspace: input.workspace,
      aiLogger: input.aiLogger,
      analysisRunId,
      draftType: "visual",
      operation: "uploaded_source_analysis_visual",
      kind: "uploaded-source-visual-analysis",
      draftPath: visualDraftPath,
      onStreamEvent: (event) => input.onProgress?.({ type: "stream", phase: "visual", event }),
    });
    visualOperationId = visualLogger.operationId;
    const visualDraftAgentPath = toAgentFileToolPath(
      agentPathContext,
      visualDraftPath,
    ).agentFileToolPath;
    const visualResult = await runDraftAgent<UploadedSourceVisualAnalysisDraft>({
      backend: input.backend,
      agentClient: input.agentClient,
      workspace: input.workspace,
      analysisRunId,
      draftType: "visual",
      draftPath: visualDraftPath,
      draftAgentFileToolPath: visualDraftAgentPath,
      buildPrompt: (previousGateFailure) => buildVisualPrompt({
        workspace: input.workspace,
        sources: activeSources,
        draftPath: visualDraftPath,
        previousGateFailure,
      }),
      validateDraft: validateUploadedSourceVisualAnalysisDraft,
      runLogger: visualLogger,
    });
    visualDraft = visualResult.draft;
    visualAttempts = visualResult.attempts;
    input.onProgress?.({
      type: "phase",
      phase: "visual",
      state: "completed",
      sourceCount: activeSources.length,
    });
  }

  input.onProgress?.({
    type: "phase",
    phase: "merge",
    state: "active",
    sourceCount: activeSources.length,
  });
  failedPhase = "merge";
  const analysis = mergeUploadedSourceAnalysis({
    uploadedSourceIndex: prepared.uploaded_source_index,
    factualDraft,
    visualDraft,
  });
  await input.backend.recordUploadedSourceAnalysis({
    workspace_dir: input.workspace.workspace_dir,
    analysis: analysis as unknown as Record<string, unknown>,
  });
  await appendUploadedSourceAnalysisLog({
    backend: input.backend,
    workspace: input.workspace,
    entry: {
      event: "uploaded_source.analysis.merged",
      analysis_run_id: analysisRunId,
      analysis_path: prepared.analysis_path,
      status: analysis.status,
      can_continue: analysis.continuation_decision.can_continue,
      reason: analysis.continuation_decision.reason,
      facts: analysis.facts.length,
      visual_assets: analysis.visual_assets.length,
      gaps: analysis.gaps.length,
      rejected_material: analysis.rejected_material.length,
      factual_operation_id: factualOperationId,
      visual_operation_id: visualOperationId,
      factual_status: factualDraft.status,
      visual_status: visualDraft.status,
      active_count: activeSources.length,
      active_total_size_bytes: activeTotalSizeBytes,
      active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
    },
  });
  if (analysis.status === "blocked" || !analysis.continuation_decision.can_continue) {
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.blocked",
        analysis_run_id: analysisRunId,
        analysis_status: analysis.status,
        can_continue: false,
        reason: analysis.continuation_decision.reason,
        analysis_path: prepared.analysis_path,
        facts: analysis.facts.length,
        visual_assets: analysis.visual_assets.length,
        gaps: analysis.gaps.length,
        rejected_material: analysis.rejected_material.length,
        factual_operation_id: factualOperationId,
        visual_operation_id: visualOperationId,
        active_count: activeSources.length,
        active_total_size_bytes: activeTotalSizeBytes,
        active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
      },
    });
  }
  input.onProgress?.({
    type: "phase",
    phase: "merge",
    state: analysis.status === "blocked" || !analysis.continuation_decision.can_continue
      ? "failed"
      : "completed",
    sourceCount: activeSources.length,
    analysis,
    message: analysis.continuation_decision.reason,
  });
  return analysis;
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    input.onProgress?.({
      type: "phase",
      phase: failedPhase,
      state: "failed",
      sourceCount: activeSources.length,
      error: error instanceof Error ? error.message : String(error),
    });
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.failed",
        analysis_run_id: analysisRunId,
        failed_phase: failedPhase,
        error: readUploadedSourceAnalysisError(error),
        factual_operation_id: factualOperationId,
        visual_operation_id: visualOperationId,
        attempts: [...factualAttempts, ...visualAttempts],
        active_count: activeSources.length,
        active_total_size_bytes: activeTotalSizeBytes,
        active_uploaded_sources: summarizeActiveUploadedSources(activeSources),
        analysis_path: prepared?.analysis_path,
      },
      payloadKeys: ["attempts"],
    });
    throw error;
  }
}
