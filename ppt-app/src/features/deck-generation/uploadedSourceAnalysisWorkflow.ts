import { isAgentRunCancelledError, type AgentClient, type AgentStreamEvent } from "../../agent/agentClient";
import type { PptBackend } from "../../api/pptBackend";
import type {
  UploadedSourceAnalysisDraftFingerprint,
  UploadedSourceMaterial,
  WorkspaceResult,
} from "../../api/types";
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
  sources: UploadedSourceMaterial[];
  draftType: "factual" | "visual";
  draftPath: string;
  buildPrompt: (previousGateFailure?: string) => string;
  validateDraft: (value: unknown) => UploadedSourceDraftValidationResult<TDraft>;
  onStreamEvent?: (event: AgentStreamEvent) => void;
}): Promise<TDraft> {
  let previousGateFailure: string | undefined;
  for (let attempt = 1; attempt <= LOCAL_GATE_REPAIR_LIMIT; attempt += 1) {
    const before = await input.backend.getUploadedSourceAnalysisDraftFingerprint({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: input.draftType,
    });
    try {
      await input.agentClient.runAuthoringPrompt(
        input.buildPrompt(previousGateFailure),
        { onStreamEvent: input.onStreamEvent },
      );
    } catch (error) {
      if (isAgentRunCancelledError(error)) throw error;
      previousGateFailure = summarizeDraftGateFailure({
        draftType: input.draftType,
        before,
        error,
      });
      if (attempt >= LOCAL_GATE_REPAIR_LIMIT) {
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
    if (after.exists && fingerprintChanged(before, after) && validation.draft) {
      return validation.draft;
    }
    previousGateFailure = summarizeDraftGateFailure({
      draftType: input.draftType,
      before,
      after,
      validationGaps: validation.gaps,
    });
    if (attempt >= LOCAL_GATE_REPAIR_LIMIT) {
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

async function appendUploadedSourceAnalysisLog(input: {
  backend: PptBackend;
  workspace: WorkspaceResult;
  entry: Record<string, unknown>;
}) {
  await input.backend.appendWorkspaceLog({
    workspace_dir: input.workspace.workspace_dir,
    channel: "ai-research",
    entry: {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      ...input.entry,
    },
  }).catch((error) => {
    console.warn("Failed to append uploaded source analysis log", error);
  });
}

export async function ensureFreshUploadedSourceAnalysis(input: {
  backend: PptBackend;
  agentClient: AgentClient;
  workspace: WorkspaceResult;
  forceRefresh?: boolean;
  onProgress?: (event: UploadedSourceAnalysisWorkflowEvent) => void;
}): Promise<UploadedSourceAnalysis | null> {
  input.onProgress?.({
    type: "phase",
    phase: "prepare",
    state: "active",
  });
  const prepared = await input.backend.prepareUploadedSourceAnalysisWorkspace({
    workspace_dir: input.workspace.workspace_dir,
  });
  const activeSources = prepared.uploaded_source_index.materials.filter((source) => source.status === "active");
  if (activeSources.length === 0) {
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
      active_count: activeSources.length,
      active_total_size_bytes: prepared.uploaded_source_index.active_total_size_bytes,
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
    await appendUploadedSourceAnalysisLog({
      backend: input.backend,
      workspace: input.workspace,
      entry: {
        event: "uploaded_source.analysis.reused",
        status: existing.status,
        active_count: activeSources.length,
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
  const factualDraft = await runDraftAgent<UploadedSourceFactualAnalysisDraft>({
    backend: input.backend,
    agentClient: input.agentClient,
    workspace: input.workspace,
    sources: activeSources,
    draftType: "factual",
    draftPath: prepared.factual_draft_path,
    buildPrompt: (previousGateFailure) => buildFactualPrompt({
      workspace: input.workspace,
      sources: activeSources,
      draftPath: prepared.factual_draft_path,
      previousGateFailure,
    }),
    validateDraft: validateUploadedSourceFactualAnalysisDraft,
    onStreamEvent: (event) => input.onProgress?.({ type: "stream", phase: "factual", event }),
  });
  input.onProgress?.({
    type: "phase",
    phase: "factual",
    state: "completed",
    sourceCount: activeSources.length,
  });

  let visualDraft: UploadedSourceVisualAnalysisDraft;
  if (!hasVisualCandidate(activeSources)) {
    visualDraft = createSkippedUploadedSourceVisualAnalysisDraft("No uploaded image source material requires visual analysis.");
    await input.backend.recordUploadedSourceAnalysisDraft({
      workspace_dir: input.workspace.workspace_dir,
      draft_type: "visual",
      draft: visualDraft as unknown as Record<string, unknown>,
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
    visualDraft = await runDraftAgent<UploadedSourceVisualAnalysisDraft>({
      backend: input.backend,
      agentClient: input.agentClient,
      workspace: input.workspace,
      sources: activeSources,
      draftType: "visual",
      draftPath: prepared.visual_draft_path,
      buildPrompt: (previousGateFailure) => buildVisualPrompt({
        workspace: input.workspace,
        sources: activeSources,
        draftPath: prepared.visual_draft_path,
        previousGateFailure,
      }),
      validateDraft: validateUploadedSourceVisualAnalysisDraft,
      onStreamEvent: (event) => input.onProgress?.({ type: "stream", phase: "visual", event }),
    });
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
      status: analysis.status,
      can_continue: analysis.continuation_decision.can_continue,
      facts: analysis.facts.length,
      visual_assets: analysis.visual_assets.length,
      gaps: analysis.gaps.length,
      rejected_material: analysis.rejected_material.length,
    },
  });
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
}
