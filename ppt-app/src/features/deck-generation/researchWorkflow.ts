import { AgentRunCancelledError, isAgentRunCancelledError } from "../../agent/agentClient";
import type { AiOperationLogContext } from "../../ai/interactionLog";
import { assertResearchPlanAligned } from "../../ai/researchPlanPrompt";
import type { PagePlan, PagePlanItem, ResearchCurationDraftFingerprint, ResearchEvidenceIndex, ResearchPlan, ResearchRequirement, VisualResearchCurationDraft, WebResearchCurationDraft, WorkspaceOutline } from "../../api/types";
import { generationText } from "./messages";
import { buildDeckGenerationSummary, emit as emitProgress, emitRuntime as emitRuntimeProgress } from "./progressProjection";
import { createVisualResearchCurationGapDraft, createWebResearchCurationGapDraft, mergeResearchCurationDrafts, validateVisualResearchCurationDraft, validateWebResearchCurationDraft } from "./researchCurationDrafts";
import { formatResearchCurationExhaustedGap, formatResearchCurationRetryActivity, formatResearchCurationRunError, RESEARCH_CURATION_ATTEMPT_LIMIT } from "./researchCurationRetry";
import { computeResearchQueryDelta, recordResearchCollectionLedger } from "./pageRefinementWorkflow";
import { buildAgentRunOptions, createAgentRunTracker, recordDeckRecovery, recordProgress, throwIfCancelled } from "./runtimeSupport";
import { getAttemptLimits } from "./settings";
import { ATTEMPT_LIMITS, type DeckGenerationContext, type DeckGenerationProgress, type DeckGenerationRuntime, type DeckGenerationStream, type RunDeckGenerationInput } from "./types";

function emit(
  input: Pick<DeckGenerationContext, "onProgress"> & Partial<Pick<DeckGenerationContext, "workspace">>,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: import("../../api/types").PageProgress | null,
  stream?: DeckGenerationStream | null,
  activeStreams?: Iterable<DeckGenerationStream>,
) {
  emitProgress(
    input,
    value,
    progress,
    stream,
    activeStreams,
    input.workspace ? getAttemptLimits({ workspace: input.workspace }) : ATTEMPT_LIMITS,
  );
}

function emitRuntime(
  input: DeckGenerationRuntime,
  value: Omit<DeckGenerationProgress, "pages">,
  progress: import("../../api/types").PageProgress | null,
  stream?: DeckGenerationStream | null,
) {
  emitRuntimeProgress(
    input,
    value,
    progress,
    stream,
    getAttemptLimits({ workspace: input.workspace }),
  );
}

export function createEmptyResearchPlan(input: {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  generatedBy: string;
}): ResearchPlan {
  return {
    version: 1,
    status: "planned",
    title: input.pagePlan.title,
    source: {
      outline_updated_at: input.outline.updated_at,
      page_plan_updated_at: input.pagePlan.updated_at,
      template_group: input.pagePlan.source.template_group,
      generated_by: input.generatedBy,
    },
    pages: input.pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
      image_query_intents: [],
      evidence_needs: [],
      visual_needs: [],
      gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
      reason: "Research Planning unavailable or no external research needed.",
    })),
    shared: {
      web_research_needed: false,
      image_research_needed: false,
      query_intents: [],
    },
    updated_at: new Date().toISOString(),
  };
}

export function getResearchRequirement(researchPlan: ResearchPlan | null, page: PagePlanItem): ResearchRequirement | null {
  return researchPlan?.pages.find((item) => item.page_id === page.page_id) ?? null;
}

function researchNeeded(requirement: ResearchRequirement | null): boolean {
  return Boolean(requirement?.web_research_needed || requirement?.image_research_needed);
}

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
    updated_at: typeof record?.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
}

function buildWebResearchCurationPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawWebIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  return [
    "You are a Web Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw web material, select only useful facts, source judgments, derived insights, rejected material, and gaps, then write a Web Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    `Raw web index paths: ${JSON.stringify(input.rawWebIndexPaths)}`,
    `Web draft JSON path to write: ${input.draftPath}`,
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

function buildVisualResearchCurationPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  rawImageIndexPaths: string[];
  draftPath: string;
  curationRunId: string;
  previousGateFailure?: string;
}) {
  return [
    "You are a Visual Research Curation Draft Agent for one PPT Page Generation Unit.",
    "Read Raw image material, select only useful visual assets, visual judgments, rejected material, and gaps, then write a Visual Research Curation Draft JSON file.",
    "Do not edit slide TSX, page data JSON, manifest, outline, or page-plan files.",
    "Do not edit the final evidence-index.json or current-page evidence markdown. Final Research Evidence is merged by app code after this draft.",
    "",
    `Workspace directory: ${input.workspaceDir}`,
    `Current page id: ${input.page.page_id}`,
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Research requirement: ${JSON.stringify(input.requirement)}`,
    `Curation run id: ${input.curationRunId}`,
    `Raw image index paths: ${JSON.stringify(input.rawImageIndexPaths)}`,
    `Visual draft JSON path to write: ${input.draftPath}`,
    "",
    "Image rules:",
    "- For downloaded image candidates, first use upload_local_file on the local image path, then analyze_image before selecting it.",
    "- Select an image only if it fits the current page intent and is visually usable.",
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

function createResearchCurationRunId(page: PagePlanItem, kind: "web" | "visual"): string {
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
  return dedupeNonEmptyStrings(reasons).join("\n");
}

async function getResearchCurationDraftFingerprintSafe(input: {
  flowInput: DeckGenerationRuntime;
  page: PagePlanItem;
  kind: "web" | "visual";
  draftPath: string;
}): Promise<ResearchCurationDraftFingerprint> {
  try {
    return await input.flowInput.backend.getResearchCurationDraftFingerprint({
      workspace_dir: input.flowInput.workspace.workspace_dir,
      page_id: input.page.page_id,
      draft_type: input.kind,
    });
  } catch {
    return {
      workspace_dir: input.flowInput.workspace.workspace_dir,
      page_id: input.page.page_id,
      draft_type: input.kind,
      draft_path: input.draftPath,
      exists: false,
    };
  }
}

async function appendResearchLogSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
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

async function runResearchDraftAgent(input: {
  flowInput: DeckGenerationRuntime;
  pagePlan: PagePlan;
  page: PagePlanItem;
  kind: "web" | "visual";
  curationRunId: string;
  buildPrompt: (previousGateFailure?: string) => string;
  draftPath: string;
  currentGaps: string[];
}): Promise<WebResearchCurationDraft | VisualResearchCurationDraft | null> {
  const { flowInput, page, pagePlan, kind } = input;
  const text = generationText(flowInput.locale);
  const agentKind = kind === "web" ? "web-research-curation" : "visual-research-curation";
  const curationRunId = input.curationRunId;
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
      });
      throwIfCancelled(flowInput);
      await appendResearchLogSafe(flowInput, {
        event: `ai.research.${kind}_curation.attempt`,
        schema_version: 1,
        page_id: page.page_id,
        page_index: page.index,
        draft_path: input.draftPath,
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
      });

      const rawDraft = await flowInput.backend.getResearchCurationDraft({
        workspace_dir: flowInput.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: kind,
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
      curation_run_id: curationRunId,
      error: message,
      updated_at: new Date().toISOString(),
    });
    return null;
  }
}

export async function generateAndRecordResearchPlan(
  input: RunDeckGenerationInput,
  pagePlan: PagePlan,
): Promise<ResearchPlan> {
  const text = generationText(input.locale);
  await recordDeckRecovery(input, {
    status: "running",
    run_kind: "deck-generation",
    step: "research-planning",
    target_page_ids: pagePlan.pages.map((page) => page.page_id),
    error: null,
    deck_status: "running",
  });
  emit(
    input,
    {
      step: "research-planning",
      message: text.researchPlanning,
      currentPageIndex: null,
      totalPages: pagePlan.pages.length,
    },
    null,
  );

  await input.backend.prepareResearchWorkspace({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);

  const logContext: AiOperationLogContext | undefined = input.aiLogger
    ? {
        logger: input.aiLogger,
        workspace_dir: input.workspace.workspace_dir,
        domain: "page_plan" as const,
        operation: "generate_research_plan",
        operation_id: input.aiLogger.createOperationId("page_plan", "generate_research_plan"),
        provider: "anna",
        runtime_mode: "anna",
      }
    : undefined;

  let researchPlan: ResearchPlan;
  try {
    researchPlan = assertResearchPlanAligned({
      researchPlan: await input.aiClient.generateResearchPlan({
        outline: input.confirmedOutline,
        pagePlan,
        locale: input.locale,
        logContext,
      }),
      pagePlan,
    });
    throwIfCancelled(input);
  } catch (error) {
    if (isAgentRunCancelledError(error)) throw error;
    researchPlan = createEmptyResearchPlan({
      outline: input.confirmedOutline,
      pagePlan,
      generatedBy: "fallback",
    });
    await appendResearchLogSafe(input, {
      event: "ai.research.planning.failed",
      schema_version: 1,
      status: "gap",
      error: error instanceof Error ? error.message : String(error),
      fallback: "empty_research_plan",
      updated_at: new Date().toISOString(),
    });
  }

  const recorded = await input.backend.recordResearchPlan({
    workspace_dir: input.workspace.workspace_dir,
    research_plan: researchPlan,
  });
  throwIfCancelled(input);
  await input.backend.recordResearchStatus({
    workspace_dir: input.workspace.workspace_dir,
    status: {
      version: 1,
      status: "ready",
      pages: recorded.pages.map((page) => ({
        page_id: page.page_id,
        status: researchNeeded(page) ? "planned" : "skipped",
        message: page.reason,
        updated_at: new Date().toISOString(),
      })),
      updated_at: new Date().toISOString(),
    },
  });
  throwIfCancelled(input);
  return recorded;
}

export async function collectAndCurateResearchForPage(
  input: DeckGenerationRuntime,
  pagePlan: PagePlan,
  page: PagePlanItem,
): Promise<void> {
  throwIfCancelled(input);
  const researchPlan = await input.backend.getResearchPlan({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const requirement = getResearchRequirement(researchPlan, page);
  if (!researchNeeded(requirement)) return;
  const pageRequirement = requirement as ResearchRequirement;
  const currentEvidence = normalizeResearchEvidenceIndex(
    await input.backend.getResearchEvidence({
      workspace_dir: input.workspace.workspace_dir,
    }),
  );
  throwIfCancelled(input);
  const existingEvidence = currentEvidence.pages.find((item) => item.page_id === page.page_id);
  const isPageRefinement = Boolean(input.pageRefinementRequests?.[page.page_id]?.trim());
  const initialResearchStatus = await input.backend.getResearchStatus({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  const deltaQueries = computeResearchQueryDelta({
    status: initialResearchStatus,
    pageId: page.page_id,
    requirement: pageRequirement,
  });
  if (
    existingEvidence?.status === "curated" &&
    (!isPageRefinement || (
      deltaQueries.webQueries.length === 0 &&
      deltaQueries.imageQueries.length === 0
    ))
  ) {
    await appendResearchLogSafe(input, {
      event: "ai.research.page.reused",
      schema_version: 1,
      page_id: page.page_id,
      page_index: page.index,
      evidence_path: existingEvidence.markdown_path,
      status: "curated",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const text = generationText(input.locale);
  const paths = await input.backend.prepareResearchWorkspace({
    workspace_dir: input.workspace.workspace_dir,
  });
  throwIfCancelled(input);
  let progress = await recordProgress(input, page, { status: "research_collecting" });
  input.setProgress(progress);
  emitRuntime(
    input,
    {
      step: "research-collection",
      message: text.collectingSources(page),
      currentPageIndex: page.index,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  const rawWebIndexPaths: string[] = [];
  const rawImageIndexPaths: string[] = [];
  const webCollections: Array<{ query: string; raw_index_path?: string }> = [];
  const imageCollections: Array<{ query: string; raw_index_path?: string }> = [];
  const gaps: string[] = [];

  if (pageRequirement.web_research_needed) {
    for (const query of deltaQueries.webQueries) {
      throwIfCancelled(input);
      try {
        const search = await input.backend.webSearch({
          query,
          max_results: 6,
          safesearch: "moderate",
        });
        throwIfCancelled(input);
        const urls = search.results.map((item) => item.url).filter(Boolean).slice(0, 5);
        if (urls.length === 0) {
          gaps.push(`No web search results for: ${query}`);
          webCollections.push({ query });
          continue;
        }
        const fetched = await input.backend.webFetch({
          urls,
          output_dir: paths.raw_web_dir,
          format: "text_markdown",
          max_chars: 12000,
        });
        throwIfCancelled(input);
        if (fetched.index_path) {
          rawWebIndexPaths.push(fetched.index_path);
          webCollections.push({ query, raw_index_path: fetched.index_path });
        } else {
          gaps.push(`Web fetch did not return an index path for: ${query}`);
          webCollections.push({ query });
        }
      } catch (error) {
        if (isAgentRunCancelledError(error)) throw error;
        gaps.push(`Web research failed for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (pageRequirement.image_research_needed) {
    for (const query of deltaQueries.imageQueries) {
      throwIfCancelled(input);
      try {
        const search = await input.backend.imageSearch({
          query,
          max_results: 8,
          safesearch: "moderate",
        });
        throwIfCancelled(input);
        const urls = search.results
          .filter((item) => !item.width || !item.height || (item.width >= 480 && item.height >= 270))
          .map((item) => item.image_url)
          .filter(Boolean)
          .slice(0, 4);
        if (urls.length === 0) {
          gaps.push(`No image search results for: ${query}`);
          imageCollections.push({ query });
          continue;
        }
        const fetched = await input.backend.imageFetch({
          urls,
          output_dir: paths.raw_images_dir,
        });
        throwIfCancelled(input);
        if (fetched.index_path) {
          rawImageIndexPaths.push(fetched.index_path);
          imageCollections.push({ query, raw_index_path: fetched.index_path });
        } else {
          gaps.push(`Image fetch did not return an index path for: ${query}`);
          imageCollections.push({ query });
        }
      } catch (error) {
        if (isAgentRunCancelledError(error)) throw error;
        gaps.push(`Image research failed for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const evidenceMarkdownPath = `${paths.evidence_pages_dir}/${page.page_id}.md`;
  const webDraftPath = `${paths.evidence_drafts_dir}/${page.page_id}-web.json`;
  const visualDraftPath = `${paths.evidence_drafts_dir}/${page.page_id}-visual.json`;
  if (deltaQueries.webQueries.length > 0 && rawWebIndexPaths.length === 0) {
    gaps.push("No raw web material was collected for this page.");
  }
  if (deltaQueries.imageQueries.length > 0 && rawImageIndexPaths.length === 0) {
    gaps.push("No raw image material was collected for this page.");
  }

  progress = await recordProgress(input, page, { status: "research_curating" });
  input.setProgress(progress);
  emitRuntime(
    input,
    {
      step: "research-curation",
      message: text.curatingEvidence(page),
      currentPageIndex: page.index,
      totalPages: pagePlan.pages.length,
    },
    progress,
  );

  let webDraft: WebResearchCurationDraft | null = null;
  let visualDraft: VisualResearchCurationDraft | null = null;

  if (pageRequirement.web_research_needed && deltaQueries.webQueries.length > 0) {
    if (rawWebIndexPaths.length > 0) {
      const curationRunId = createResearchCurationRunId(page, "web");
      webDraft = await runResearchDraftAgent({
        flowInput: input,
        pagePlan,
        page,
        kind: "web",
        curationRunId,
        buildPrompt: (previousGateFailure) =>
          buildWebResearchCurationPrompt({
            workspaceDir: input.workspace.workspace_dir,
            page,
            requirement: pageRequirement,
            rawWebIndexPaths,
            draftPath: webDraftPath,
            curationRunId,
            previousGateFailure,
          }),
        draftPath: webDraftPath,
        currentGaps: gaps,
      }) as WebResearchCurationDraft | null;
    } else {
      webDraft = createWebResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw web material was collected for this page."],
      });
      await input.backend.recordResearchCurationDraft({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: "web",
        draft: webDraft,
      });
      throwIfCancelled(input);
    }
  }

  if (pageRequirement.image_research_needed && deltaQueries.imageQueries.length > 0) {
    if (rawImageIndexPaths.length > 0) {
      const curationRunId = createResearchCurationRunId(page, "visual");
      visualDraft = await runResearchDraftAgent({
        flowInput: input,
        pagePlan,
        page,
        kind: "visual",
        curationRunId,
        buildPrompt: (previousGateFailure) =>
          buildVisualResearchCurationPrompt({
            workspaceDir: input.workspace.workspace_dir,
            page,
            requirement: pageRequirement,
            rawImageIndexPaths,
            draftPath: visualDraftPath,
            curationRunId,
            previousGateFailure,
          }),
        draftPath: visualDraftPath,
        currentGaps: gaps,
      }) as VisualResearchCurationDraft | null;
    } else {
      visualDraft = createVisualResearchCurationGapDraft({
        pageId: page.page_id,
        gaps: ["No raw image material was collected for this page."],
      });
      await input.backend.recordResearchCurationDraft({
        workspace_dir: input.workspace.workspace_dir,
        page_id: page.page_id,
        draft_type: "visual",
        draft: visualDraft,
      });
      throwIfCancelled(input);
    }
  }

  throwIfCancelled(input);
  const merged = mergeResearchCurationDrafts({
    currentEvidence,
    page,
    requirement: pageRequirement,
    evidenceMarkdownPath,
    webDraft,
    visualDraft,
    gaps,
  });

  await input.backend.recordResearchEvidencePageMarkdown({
    workspace_dir: input.workspace.workspace_dir,
    page_id: page.page_id,
    markdown: merged.markdown,
  });
  throwIfCancelled(input);
  await input.backend.recordResearchEvidencePage({
    workspace_dir: input.workspace.workspace_dir,
    page_evidence: merged.pageEvidence,
  });
  throwIfCancelled(input);

  await appendResearchLogSafe(input, {
    event: "ai.research.page.finished",
    schema_version: 1,
    page_id: page.page_id,
    page_index: page.index,
    raw_web_index_paths: rawWebIndexPaths,
    raw_image_index_paths: rawImageIndexPaths,
    gaps: merged.pageEvidence.gaps,
    status: merged.pageEvidence.status,
    updated_at: new Date().toISOString(),
  });
  await input.backend.recordResearchStatusPage({
    workspace_dir: input.workspace.workspace_dir,
    page_status: {
      page_id: page.page_id,
      status: merged.pageEvidence.status,
      message: merged.pageEvidence.gaps.join("\n"),
      evidence_path: evidenceMarkdownPath,
    },
  });
  throwIfCancelled(input);

  if (webCollections.length > 0 || imageCollections.length > 0) {
    const latestResearchStatus = await input.backend.getResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
    });
    throwIfCancelled(input);
    await input.backend.recordResearchStatus({
      workspace_dir: input.workspace.workspace_dir,
      status: recordResearchCollectionLedger({
        status: latestResearchStatus,
        pageId: page.page_id,
        webCollections,
        imageCollections,
        now: new Date().toISOString(),
      }),
    });
    throwIfCancelled(input);
  }
}
