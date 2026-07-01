import { AgentRunCancelledError, isAgentRunCancelledError } from "../../agent/agentClient";
import type { PagePlan, PagePlanItem, ResearchCurationDraftFingerprint, ResearchEvidenceIndex, ResearchRequirement, VisualResearchCurationDraft, WebResearchCurationDraft } from "../../api/types";
import { generationText } from "./messages";
import { createVisualResearchCurationGapDraft, createWebResearchCurationGapDraft, validateVisualResearchCurationDraft, validateWebResearchCurationDraft } from "./researchCurationDrafts";
import { formatResearchCurationExhaustedGap, formatResearchCurationRetryActivity, formatResearchCurationRunError, RESEARCH_CURATION_ATTEMPT_LIMIT } from "./researchCurationRetry";
import { buildAgentRunOptions, createAgentRunTracker, throwIfCancelled } from "./runtimeSupport";
import { getAttemptLimits } from "./settings";
import { type DeckGenerationRuntime } from "./types";
import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  type AgentFileToolPathContext,
  toAgentFileToolPath,
} from "./agentFileToolPaths";

export function normalizeResearchEvidenceIndex(value: ResearchEvidenceIndex | null | undefined): ResearchEvidenceIndex {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
  const shared = record?.shared && typeof record.shared === "object" && !Array.isArray(record.shared)
    ? record.shared
    : null;
  return {
    version: 1,
    status:
      record?.status === "partial" || record?.status === "curated"
        ? record.status
        : "empty",
    pages: Array.isArray(record?.pages) ? record.pages : [],
    shared: {
      facts: Array.isArray(shared?.facts) ? shared.facts : [],
      visual_assets: Array.isArray(shared?.visual_assets) ? shared.visual_assets : [],
      gaps: Array.isArray(shared?.gaps) ? shared.gaps : [],
    },
    ...(record?.discovery_pool ? { discovery_pool: record.discovery_pool as ResearchEvidenceIndex["discovery_pool"] } : {}),
    updated_at: typeof record?.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

export function buildWebResearchCurationPrompt(input: {
  workspaceRoot?: string;
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawWebIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  const agentPathContext = createAgentFileToolPathContext({
    workspaceRoot: input.workspaceRoot,
    workspaceDir: input.workspaceDir,
  });
  const rawWebIndexPathBlocks = input.rawWebIndexPaths.map((path, index) =>
    formatAgentFileToolPathBlock({
      label: `Raw web index path ${index + 1}`,
      path: toAgentFileToolPath(agentPathContext, path),
    })
  );
  return [
    "You are a Web Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw web material, select only useful facts, source judgments, derived insights, rejected material, and gaps, then write a Web Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    describeAgentFileToolPathContext(agentPathContext),
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    "Raw web index paths to read:",
    rawWebIndexPathBlocks.length > 0 ? rawWebIndexPathBlocks.join("\n") : "- None",
    formatAgentFileToolPathBlock({
      label: "Web draft JSON path to write",
      path: toAgentFileToolPath(agentPathContext, input.draftPath),
    }),
    "",
    "Source quality rules:",
    "- Prefer official websites, company reports, government/regulatory sources, industry associations, recognized research institutions, authoritative media, and documentation.",
    "- Reject obvious SEO, source-less, low-quality, forum-like, or unrelated material as factual evidence.",
    "- If sources conflict, record the conflict instead of guessing.",
    "- Material without a publication date must not be presented as latest.",
    "",
    "Tool boundary:",
    "- Do not call search, browser, or network tools during Web Research Curation.",
    "- Do not use nats_ddg_search, browser_create_instance, web search, image search, or ad-hoc network access.",
    "- Curate only from the Raw web index paths listed above and existing workspace/user-provided artifacts.",
    "- If the listed raw index paths are empty, missing, or insufficient, write a Research Evidence Gap instead of searching yourself.",
    "",
    input.previousGateFailure
      ? [
          "Previous Research Curation attempt failure:",
          input.previousGateFailure,
          "Rerun Web Research Curation from the same Raw web index paths and write a valid current draft.",
          "When writing the draft with fs_write_file, use the Web draft JSON Agent file-tool path above.",
        ].join("\n")
      : "",
    "",
    "Write exactly one JSON object to the Web draft JSON path. Draft JSON shape:",
    '{"version":1,"page_id":"...","curation_run_id":"...","draft_type":"web","status":"curated","facts":[{"id":"fact-1","claim":"...","source_type":"web_source","source_title":"...","source_url":"...","source_file":"...","excerpt":"...","confidence":"medium"}],"derived_insights":[{"id":"insight-1","insight":"...","supporting_fact_ids":["fact-1"]}],"gaps":["..."],"rejected_material":[{"source":"...","reason":"..."}],"source_summary":"...","updated_at":"..."}',
    "Fact source_type must be exactly one of: user_provided, web_source, image_source.",
    "Do not include visual_assets in this draft.",
    "If factual evidence is insufficient, write status gap and explain gaps. Page Generation will continue.",
    "Final response must be a short JSON object: {\"status\":\"curated\",\"summary\":\"...\",\"gaps\":[\"...\"]}",
  ].join("\n");
}

export function buildVisualResearchCurationPrompt(input: {
  workspaceRoot?: string;
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawImageIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  const agentPathContext = createAgentFileToolPathContext({
    workspaceRoot: input.workspaceRoot,
    workspaceDir: input.workspaceDir,
  });
  const rawImageIndexPathBlocks = input.rawImageIndexPaths.map((path, index) =>
    formatAgentFileToolPathBlock({
      label: `Raw image index path ${index + 1}`,
      path: toAgentFileToolPath(agentPathContext, path),
    })
  );
  return [
    "You are a Visual Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw image material, select only useful visual assets, visual judgments, rejected material, and gaps, then write a Visual Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    describeAgentFileToolPathContext(agentPathContext),
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    "Raw image index paths to read:",
    rawImageIndexPathBlocks.length > 0 ? rawImageIndexPathBlocks.join("\n") : "- None",
    formatAgentFileToolPathBlock({
      label: "Visual draft JSON path to write",
      path: toAgentFileToolPath(agentPathContext, input.draftPath),
    }),
    "",
    "Image rules:",
    "- For downloaded image candidates, first use upload_local_file on the local image path, then analyze_image before selecting it.",
    "- Select an image only if it fits the current page intent and is visually usable.",
    "- Agent file-tool paths are only for fs_* tool calls and upload_local_file; they are not valid visual_assets path values.",
    "- In visual_assets, copy the exact file_path value from the selected raw image index result into original_raw_path. Because file_path is required by the draft schema, write that same raw index file_path there too.",
    "- Do not write Agent file-tool paths into visual_assets file_path or original_raw_path, and do not write PPT-task-relative paths such as ppt/<workspace>/research/raw/images/...",
    "- If a raw image index result has no usable local file_path, do not select it as visual_assets; record a gap or rejected material instead.",
    "- Do not copy images into research/evidence/images and do not invent a final evidence image path. App code will finalize selected raw images into Visual Research Evidence after this draft passes validation.",
    "- Text, chart data, rankings, or claims visible inside a selected image are not grounded facts.",
    "- Do not emit facts or derived_insights in this draft.",
    "",
    "Tool boundary:",
    "- Do not call search, browser, or network tools during Visual Research Curation.",
    "- Do not use nats_ddg_search, browser_create_instance, web search, image search, or ad-hoc network access.",
    "- Curate only from the Raw image index paths listed above and existing workspace/user-provided artifacts.",
    "- If the listed raw index paths are empty, missing, or insufficient, write a Research Evidence Gap instead of searching yourself.",
    "",
    input.previousGateFailure
      ? [
          "Previous Research Curation attempt failure:",
          input.previousGateFailure,
          "Rerun Visual Research Curation from the same Raw image index paths and write a valid current draft.",
          "When writing the draft with fs_write_file, use the Visual draft JSON Agent file-tool path above.",
          "If the previous failure says outside research image directories, rewrite visual_assets paths by copying the selected raw image index result's file_path, not the Agent file-tool path.",
        ].join("\n")
      : "",
    "",
    "Write exactly one JSON object to the Visual draft JSON path. Draft JSON shape:",
    '{"version":1,"page_id":"...","curation_run_id":"...","draft_type":"visual","status":"curated","visual_assets":[{"id":"image-1","file_path":"...","original_raw_path":"...","image_url":"...","page_url":"...","sha256":"...","reason":"...","visual_summary":"..."}],"gaps":["..."],"rejected_material":[{"source":"...","reason":"..."}],"visual_summary":"...","updated_at":"..."}',
    "Image analysis may support visual_assets.reason or visual_assets.visual_summary, but it is not a valid fact source_type.",
    "If visual evidence is insufficient, write status gap and explain gaps. Page Generation will continue.",
    "Final response must be a short JSON object: {\"status\":\"curated\",\"summary\":\"...\",\"gaps\":[\"...\"]}",
  ].join("\n");
}

export function createResearchCurationRunId(page: PagePlanItem, kind: "web" | "visual"): string {
  return `research-${kind}-${page.page_id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeNonEmptyStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleanValue = value.trim();
    if (!cleanValue || seen.has(cleanValue)) continue;
    seen.add(cleanValue);
    result.push(cleanValue);
  }
  return result;
}

function researchDraftFingerprintChanged(
  before: ResearchCurationDraftFingerprint,
  after: ResearchCurationDraftFingerprint,
): boolean {
  if (!after.exists) return false;
  if (!before.exists) return true;
  return before.sha256 !== after.sha256 || before.size_bytes !== after.size_bytes;
}

function summarizeResearchDraftGateFailure(input: {
  kind: "web" | "visual";
  curationRunId: string;
  draftPath: string;
  draftAgentFileToolPath?: string | null;
  beforeFingerprint: ResearchCurationDraftFingerprint;
  afterFingerprint: ResearchCurationDraftFingerprint;
  validationGaps: string[];
}): string {
  const label = input.kind === "web" ? "Web" : "Visual";
  const reasons: string[] = [];
  if (!input.afterFingerprint.exists) {
    reasons.push(`${label} Research Curation draft was not written.`);
  } else if (!researchDraftFingerprintChanged(input.beforeFingerprint, input.afterFingerprint)) {
    reasons.push(`${label} Research Curation draft fingerprint did not change.`);
  }
  for (const gap of input.validationGaps) {
    reasons.push(gap);
  }
  if (reasons.length === 0) {
    reasons.push(`${label} Research Curation draft did not pass deterministic validation.`);
  }
  const actualRunIdGap = input.validationGaps.find((gap) => gap.includes("curation_run_id"));
  return [
    dedupeNonEmptyStrings(reasons).join("\n"),
    "",
    "Canonical Research Curation draft gate details:",
    `Expected canonical draft path: ${input.draftPath}`,
    `Expected curation_run_id: ${input.curationRunId}`,
    `Actual curation_run_id: ${actualRunIdGap ? "mismatched or missing in canonical draft" : input.afterFingerprint.exists ? "not inspected by gate failure summary" : "unavailable because canonical draft was not written"}`,
    `Before fingerprint: ${input.beforeFingerprint.exists ? `${input.beforeFingerprint.sha256 ?? "unknown"} (${input.beforeFingerprint.size_bytes ?? "unknown"} bytes)` : "missing"}`,
    `After fingerprint: ${input.afterFingerprint.exists ? `${input.afterFingerprint.sha256 ?? "unknown"} (${input.afterFingerprint.size_bytes ?? "unknown"} bytes)` : "missing"}`,
    "",
    "You may have written to the wrong path.",
    input.draftAgentFileToolPath
      ? `Use this Agent file-tool draft path with fs_write_file: ${input.draftAgentFileToolPath}`
      : "Use the canonical absolute draft path exactly as provided; if rejected, list \".\" and locate the matching task directory before writing.",
    `Do not write task-relative path: research/evidence/drafts/<page-id>-${input.kind}.json`,
  ].join("\n");
}

async function getResearchCurationDraftFingerprintSafe(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  kind: "web" | "visual";
  draftPath: string;
  draftId?: string;
}): Promise<ResearchCurationDraftFingerprint> {
  try {
    return await input.flowInput.backend.getResearchCurationDraftFingerprint({
      workspace_dir: input.flowInput.workspace.workspace_dir,
      page_id: input.page.page_id,
      draft_type: input.kind,
      draft_id: input.draftId,
    });
  } catch {
    return {
      workspace_dir: input.flowInput.workspace.workspace_dir,
      page_id: input.page.page_id,
      draft_type: input.kind,
      draft_id: input.draftId,
      draft_path: input.draftPath,
      exists: false,
    };
  }
}

export async function appendResearchLogSafe(
  input: Pick<DeckGenerationRuntime, "backend" | "workspace">,
  entry: Record<string, unknown>,
) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspace.workspace_dir,
      channel: "ai-research",
      entry,
    });
  } catch {
    // Research logging must never fail Deck Generation.
  }
}

async function recordResearchGapForPage(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  evidenceMarkdownPath: string;
  gaps: string[];
}) {
  await input.flowInput.backend.recordResearchEvidencePage({
    workspace_dir: input.flowInput.workspace.workspace_dir,
    page_evidence: {
      page_id: input.page.page_id,
      status: "gap",
      facts: [],
      visual_assets: [],
      derived_insights: [],
      gaps: input.gaps,
      rejected_material: [],
      markdown_path: input.evidenceMarkdownPath,
    },
  });
  await input.flowInput.backend.recordResearchStatusPage({
    workspace_dir: input.flowInput.workspace.workspace_dir,
    page_status: {
      page_id: input.page.page_id,
      status: "gap",
      message: input.gaps.join("\n"),
      evidence_path: input.evidenceMarkdownPath,
    },
  });
}

export async function runResearchDraftAgent(input: {
  flowInput: DeckGenerationRuntime;
  pagePlan: PagePlan;
  page: PagePlanItem;
  kind: "web" | "visual";
  curationRunId: string;
  buildPrompt: (previousGateFailure?: string) => string;
  draftPath: string;
  draftId?: string;
  agentPathContext: AgentFileToolPathContext;
  currentGaps: string[];
}): Promise<WebResearchCurationDraft | VisualResearchCurationDraft | null> {
  const { flowInput, page, pagePlan, kind } = input;
  const text = generationText(flowInput.locale);
  const agentKind = kind === "web" ? "web-research-curation" : "visual-research-curation";
  const curationRunId = input.curationRunId;
  const draftAgentFileToolPath = toAgentFileToolPath(input.agentPathContext, input.draftPath).agentFileToolPath;
  const initialPrompt = input.buildPrompt();
  const tracker = createAgentRunTracker({
    flowInput,
    page,
    kind: agentKind,
    step: "research-curation",
    message: kind === "web" ? text.curatingFacts(page) : text.curatingImages(page),
    prompt: initialPrompt,
    totalPages: pagePlan.pages.length,
    progress: flowInput.getProgress,
    attemptLimits: getAttemptLimits(flowInput),
  });
  const attemptLog: Array<{
    attempt: number;
    prompt_kind: "initial" | "retry";
    before_fingerprint: ResearchCurationDraftFingerprint;
    after_fingerprint?: ResearchCurationDraftFingerprint;
    validation_gaps?: string[];
    gate_passed: boolean;
    error?: string;
    retry_prompt_reason?: string;
  }> = [];
  let attempt = 0;
  let previousGateFailure: string | undefined;
  let lastFailure = "";

  try {
    while (!flowInput.isCancelled()) {
      attempt += 1;
      const logPrompt = attempt === 1 ? initialPrompt : input.buildPrompt(previousGateFailure);
      const attemptKind = attempt === 1 ? "initial" : "retry";
      if (attempt > 1) {
        tracker.onStreamEvent({
          type: "activity",
          message: formatResearchCurationRetryActivity({
            kind,
            nextAttempt: attempt,
            attemptLimit: RESEARCH_CURATION_ATTEMPT_LIMIT,
          }),
        });
      }
      const beforeFingerprint = await getResearchCurationDraftFingerprintSafe({
        flowInput,
        page,
        kind,
        draftPath: input.draftPath,
        draftId: input.draftId,
      });
      throwIfCancelled(flowInput);
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.attempt`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        draft_agent_file_tool_path: draftAgentFileToolPath,
        agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
        agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
        curation_run_id: curationRunId,
        attempt,
        attempt_kind: attemptKind,
        updated_at: new Date().toISOString(),
      });
      try {
        await flowInput.agentClient.runAuthoringPrompt(
          logPrompt,
          buildAgentRunOptions(flowInput, tracker.onStreamEvent, tracker.logContext),
        );
        throwIfCancelled(flowInput);
      } catch (error) {
        if (isAgentRunCancelledError(error)) throw error;
        const failureSummary = formatResearchCurationRunError({ kind, error });
        lastFailure = failureSummary;
        previousGateFailure = failureSummary;
        attemptLog.push({
          attempt,
          prompt_kind: attemptKind,
          before_fingerprint: beforeFingerprint,
          gate_passed: false,
          error: failureSummary,
          retry_prompt_reason: failureSummary,
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.failed_attempt`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          draft_agent_file_tool_path: draftAgentFileToolPath,
          agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
          agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
          curation_run_id: curationRunId,
          attempt,
          error: failureSummary,
          will_retry: attempt < RESEARCH_CURATION_ATTEMPT_LIMIT,
          updated_at: new Date().toISOString(),
        });
        if (attempt < RESEARCH_CURATION_ATTEMPT_LIMIT) {
          throwIfCancelled(flowInput);
          continue;
        }
        const finalGap = formatResearchCurationExhaustedGap({
          kind,
          attemptLimit: RESEARCH_CURATION_ATTEMPT_LIMIT,
          lastFailure: failureSummary,
        });
        const gapDraft = kind === "web"
          ? createWebResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: [finalGap],
              curationRunId,
            })
          : createVisualResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: [finalGap],
              curationRunId,
            });
        await flowInput.backend.recordResearchCurationDraft({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft_id: input.draftId,
          draft: gapDraft as never,
        });
        await tracker.flush("completed", {
          draft_type: kind,
          curation_run_id: curationRunId,
          attempts: attemptLog,
          final_gate: "gap",
          final_gap_count: gapDraft.gaps.length,
          attempt_limit: RESEARCH_CURATION_ATTEMPT_LIMIT,
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.gap`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          curation_run_id: curationRunId,
          gaps: gapDraft.gaps,
          attempts_exhausted: true,
          updated_at: new Date().toISOString(),
        });
        return gapDraft;
      }

      const afterFingerprint = await getResearchCurationDraftFingerprintSafe({
        flowInput,
        page,
        kind,
        draftPath: input.draftPath,
        draftId: input.draftId,
      });

      const rawDraft = await flowInput.backend.getResearchCurationDraft({
        workspace_dir: flowInput.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: kind,
        draft_id: input.draftId,
      });
      throwIfCancelled(flowInput);
      const validation = kind === "web"
        ? validateWebResearchCurationDraft(rawDraft, page.page_id, {
            curationRunId,
            draftType: kind,
          })
        : validateVisualResearchCurationDraft(rawDraft, page.page_id, {
            curationRunId,
            draftType: kind,
          });
      const fingerprintChanged = researchDraftFingerprintChanged(beforeFingerprint, afterFingerprint);
      const gatePassed = Boolean(validation.draft) && afterFingerprint.exists && fingerprintChanged;
      const failureSummary = summarizeResearchDraftGateFailure({
        kind,
        curationRunId,
        draftPath: input.draftPath,
        draftAgentFileToolPath,
        beforeFingerprint,
        afterFingerprint,
        validationGaps: validation.gaps,
      });
      attemptLog.push({
        attempt,
        prompt_kind: attemptKind,
        before_fingerprint: beforeFingerprint,
        after_fingerprint: afterFingerprint,
        validation_gaps: validation.gaps,
        gate_passed: gatePassed,
        retry_prompt_reason: gatePassed ? undefined : failureSummary,
      });

      if (gatePassed && validation.draft) {
        await flowInput.backend.recordResearchCurationDraft({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft_id: input.draftId,
          draft: validation.draft as never,
        });
        throwIfCancelled(flowInput);
        await tracker.flush("completed", {
          draft_type: kind,
          curation_run_id: curationRunId,
          attempts: attemptLog,
          final_gate: "passed",
          attempt_limit: RESEARCH_CURATION_ATTEMPT_LIMIT,
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.finished`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          draft_agent_file_tool_path: draftAgentFileToolPath,
          agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
          agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
          curation_run_id: curationRunId,
          status: validation.draft.status,
          gaps: validation.draft.gaps,
          updated_at: new Date().toISOString(),
        });
        return validation.draft;
      }

      lastFailure = failureSummary;
      previousGateFailure = failureSummary;
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.invalid`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        draft_agent_file_tool_path: draftAgentFileToolPath,
        agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
        agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
        curation_run_id: curationRunId,
        attempt,
        gaps: validation.gaps,
        fingerprint_changed: fingerprintChanged,
        updated_at: new Date().toISOString(),
      });

      if (attempt >= RESEARCH_CURATION_ATTEMPT_LIMIT) {
        const finalGap = formatResearchCurationExhaustedGap({
          kind,
          attemptLimit: RESEARCH_CURATION_ATTEMPT_LIMIT,
          lastFailure: lastFailure || failureSummary,
        });
        const gapDraft = kind === "web"
          ? createWebResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: [finalGap],
              curationRunId,
            })
          : createVisualResearchCurationGapDraft({
              pageId: page.page_id,
              gaps: [finalGap],
              curationRunId,
            });
        await flowInput.backend.recordResearchCurationDraft({
          workspace_dir: flowInput.workspace.workspace_dir,
          page_id: page.page_id,
          draft_type: kind,
          draft_id: input.draftId,
          draft: gapDraft as never,
        });
        await tracker.flush("completed", {
          draft_type: kind,
          curation_run_id: curationRunId,
          attempts: attemptLog,
          final_gate: "gap",
          final_gap_count: gapDraft.gaps.length,
          attempt_limit: RESEARCH_CURATION_ATTEMPT_LIMIT,
        });
        await appendResearchLogSafe(flowInput, {
          event: `ai.research.${kind}_curation.gap`,
          schema_version: 1,
          page_id: page.page_id,
          page_index: page.index,
          draft_path: input.draftPath,
          draft_agent_file_tool_path: draftAgentFileToolPath,
          agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
          agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
          curation_run_id: curationRunId,
          gaps: gapDraft.gaps,
          attempts_exhausted: true,
          updated_at: new Date().toISOString(),
        });
        return gapDraft;
      }

      throwIfCancelled(flowInput);
    }

    throw new AgentRunCancelledError();
  } catch (error) {
    if (isAgentRunCancelledError(error)) {
      await tracker.flush("error", { draft_type: kind, cancelled: true, curation_run_id: curationRunId, attempts: attemptLog });
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.cancelled`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
        draft_agent_file_tool_path: draftAgentFileToolPath,
        agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
        agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
        curation_run_id: curationRunId,
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
    await tracker.flush("error", { draft_type: kind, error: error instanceof Error ? error.message : String(error), curation_run_id: curationRunId, attempts: attemptLog });
    const message = formatResearchCurationRunError({ kind, error });
    input.currentGaps.push(message);
    await appendResearchLogSafe(flowInput, {
      event: `ai.research.${kind}_curation.failed`,
      schema_version: 1,
      page_id: page.page_id,
      page_index: page.index,
      draft_path: input.draftPath,
      draft_agent_file_tool_path: draftAgentFileToolPath,
      agent_file_tool_root: input.agentPathContext.agentFileToolRoot,
      agent_file_tool_root_inference_failed: input.agentPathContext.inferenceFailedReason,
      curation_run_id: curationRunId,
      error: message,
      updated_at: new Date().toISOString(),
    });
    return null;
  }
}
