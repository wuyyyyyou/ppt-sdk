import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AppendWorkspaceLogInput, UploadedSourceIndex } from "../../src/api/types.ts";
import type { PptBackend } from "../../src/api/pptBackend.ts";
import type { AgentClient, AgentRunOptions } from "../../src/agent/agentClient.ts";
import { createAiInteractionLogger } from "../../src/ai/interactionLog.ts";
import {
  compactUploadedSourceAnalysisForPrompt,
  createSkippedUploadedSourceVisualAnalysisDraft,
  createUploadedSourceAnalysisDependency,
  mergeUploadedSourceAnalysis,
  uploadedSourceAnalysisMatchesActiveSet,
  uploadedSourceDependencyMatchesAnalysis,
  validateUploadedSourceFactualAnalysisDraft,
  validateUploadedSourceVisualAnalysisDraft,
} from "../../src/features/deck-generation/uploadedSourceAnalysis.ts";
import { ensureFreshUploadedSourceAnalysis } from "../../src/features/deck-generation/uploadedSourceAnalysisWorkflow.ts";
import { runResearchDiscoveryForPagePlan } from "../../src/features/deck-generation/researchDiscoveryWorkflow.ts";

const uploadedSourceIndex: UploadedSourceIndex = {
  workspace_dir: "/tmp/workspace",
  materials: [
    {
      uploaded_source_id: "uploaded-source-1",
      original_filename: "metrics.md",
      display_name: "metrics.md",
      extension: ".md",
      mime_type: "text/markdown",
      size_bytes: 12,
      sha256: "sha-1",
      file_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/metrics.md",
      status: "active",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  active_total_size_bytes: 12,
  updated_at: "2026-07-01T00:00:00.000Z",
  limits: {
    single_file_max_bytes: 1,
    active_total_max_bytes: 1,
  },
};

describe("Uploaded Source Analysis contracts", () => {
  it("separates factual and visual draft responsibilities", () => {
    const factual = validateUploadedSourceFactualAnalysisDraft({
      version: 1,
      draft_type: "factual",
      status: "ready",
      continuation_decision: { can_continue: true, reason: "ok", blocking: false },
      facts: [{
        id: "fact-1",
        claim: "Revenue grew 12%.",
        uploaded_source_id: "uploaded-source-1",
        source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/metrics.md",
        confidence: "high",
      }],
      gaps: [],
      rejected_material: [],
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(factual.gaps.length, 0);
    assert.equal(factual.draft?.facts[0]?.confidence, "high");

    const factualWithVisualAssets = validateUploadedSourceFactualAnalysisDraft({
      ...factual.draft,
      visual_assets: [{ id: "bad" }],
    });
    assert.equal(factualWithVisualAssets.draft, null);
    assert.ok(factualWithVisualAssets.gaps.some((gap) => gap.includes("must not contain visual_assets")));

    const visualWithFacts = validateUploadedSourceVisualAnalysisDraft({
      version: 1,
      draft_type: "visual",
      status: "ready",
      continuation_decision: { can_continue: true, reason: "ok", blocking: false },
      facts: [{ id: "bad", claim: "Bad" }],
      visual_assets: [],
      gaps: [],
      rejected_material: [],
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(visualWithFacts.draft, null);
    assert.ok(visualWithFacts.gaps.some((gap) => gap.includes("must not contain factual evidence")));
  });

  it("rejects malformed selected evidence instead of silently dropping it", () => {
    const factualWithMalformedFact = validateUploadedSourceFactualAnalysisDraft({
      version: 1,
      draft_type: "factual",
      status: "ready",
      continuation_decision: { can_continue: true, reason: "ok", blocking: false },
      facts: [{
        id: "fact-1",
        claim: "Revenue grew 12%.",
        uploaded_source_id: "uploaded-source-1",
      }],
      gaps: [],
      rejected_material: [],
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(factualWithMalformedFact.draft, null);
    assert.ok(factualWithMalformedFact.gaps.some((gap) => gap.includes("fact at index 0 is invalid")));

    const visualWithMalformedAsset = validateUploadedSourceVisualAnalysisDraft({
      version: 1,
      draft_type: "visual",
      status: "ready",
      continuation_decision: { can_continue: true, reason: "ok", blocking: false },
      visual_assets: [{
        id: "visual-1",
        uploaded_source_id: "uploaded-source-1",
        source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/chart.png",
        use_constraint: "usable_visual_asset",
        reason: "Useful chart.",
      }],
      gaps: [],
      rejected_material: [],
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(visualWithMalformedAsset.draft, null);
    assert.ok(visualWithMalformedAsset.gaps.some((gap) => gap.includes("visual asset at index 0 is invalid")));
  });

  it("merges drafts with source fingerprints and detects stale active sets", () => {
    const factual = validateUploadedSourceFactualAnalysisDraft({
      version: 1,
      draft_type: "factual",
      status: "ready",
      continuation_decision: { can_continue: true, reason: "ok", blocking: false },
      facts: [{
        id: "fact-1",
        claim: "Revenue grew 12%.",
        uploaded_source_id: "uploaded-source-1",
        source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/metrics.md",
      }],
      gaps: [],
      rejected_material: [],
      source_summary: "One source.",
      updated_at: "2026-07-01T00:00:00.000Z",
    }).draft;
    assert.ok(factual);
    const analysis = mergeUploadedSourceAnalysis({
      uploadedSourceIndex,
      factualDraft: factual,
      visualDraft: createSkippedUploadedSourceVisualAnalysisDraft("No images."),
      now: "2026-07-01T00:01:00.000Z",
    });

    assert.equal(analysis.status, "ready");
    assert.equal(uploadedSourceAnalysisMatchesActiveSet({ analysis, uploadedSourceIndex }), true);
    assert.equal(uploadedSourceAnalysisMatchesActiveSet({
      analysis,
      uploadedSourceIndex: {
        ...uploadedSourceIndex,
        materials: uploadedSourceIndex.materials.map((material) => ({ ...material, sha256: "changed" })),
      },
    }), false);

    const dependency = createUploadedSourceAnalysisDependency(analysis);
    assert.equal(uploadedSourceDependencyMatchesAnalysis({ dependency, analysis }), true);
    assert.equal(uploadedSourceDependencyMatchesAnalysis({
      dependency: { ...dependency, updated_at: "2026-07-01T00:01:00.005Z" },
      analysis,
    }), true);
    assert.equal(uploadedSourceDependencyMatchesAnalysis({
      dependency: {
        ...dependency,
        active_uploaded_sources: dependency.active_uploaded_sources.map((source) => ({
          ...source,
          sha256: "changed",
        })),
      },
      analysis,
    }), false);
    assert.equal(compactUploadedSourceAnalysisForPrompt(analysis)?.facts[0]?.id, "fact-1");
  });
});

describe("Uploaded Source Analysis workflow gates", () => {
  function createWorkflowHarness(options: {
    firstAttempt: "no-write" | "invalid-schema";
    uploadedSourceIndex?: UploadedSourceIndex;
  }) {
    let factualAttempt = 0;
    let visualAttempt = 0;
    let factualFingerprint = "before";
    let visualFingerprint = "visual-before";
    let finalAnalysis: Record<string, unknown> | null = null;
    const sourceIndex = options.uploadedSourceIndex ?? uploadedSourceIndex;
    const logs: Array<{
      channel: AppendWorkspaceLogInput["channel"];
      entry: Record<string, unknown>;
      payload_keys?: string[];
    }> = [];
    const prompts: string[] = [];
    const logContexts: Array<AgentRunOptions["logContext"]> = [];
    const workspace = {
      workspace_root: "/tmp",
      task_root: "/tmp",
      workspace_dir: "/tmp/workspace",
      task_dir: "/tmp/workspace",
      workspace_id: "workspace",
      task_id: "task",
      initialized: true,
      created_files: [],
      missing_files: [],
      files: {},
      task: {},
      setting: {},
      outline: {},
      page_plan: {},
      page_progress: {},
      pages: {},
      template: {},
    };
    const backend = {
      prepareUploadedSourceAnalysisWorkspace: async () => ({
        workspace_dir: workspace.workspace_dir,
        root_dir: "/tmp/workspace/uploaded-sources/analysis",
        drafts_dir: "/tmp/workspace/uploaded-sources/analysis/drafts",
        factual_draft_path: "/tmp/workspace/uploaded-sources/analysis/drafts/uploaded-source-factual.json",
        visual_draft_path: "/tmp/workspace/uploaded-sources/analysis/drafts/uploaded-source-visual.json",
        analysis_path: "/tmp/workspace/uploaded-sources/analysis/uploaded-source-analysis.json",
        uploaded_source_index: sourceIndex,
        prepared_at: "2026-07-01T00:00:00.000Z",
      }),
      appendWorkspaceLog: async (input: AppendWorkspaceLogInput) => {
        logs.push({
          channel: input.channel,
          entry: input.entry,
          payload_keys: input.payload_keys,
        });
        return { workspace_dir: workspace.workspace_dir, log_path: "", entry: input.entry };
      },
      getUploadedSourceAnalysis: async () => ({ version: 1, status: "empty" }),
      getUploadedSourceAnalysisDraftFingerprint: async ({ draft_type }: { draft_type: "factual" | "visual" }) => {
        if (draft_type === "visual") {
          return {
            workspace_dir: workspace.workspace_dir,
            draft_type,
            draft_path: "/tmp/visual.json",
            exists: true,
            sha256: visualFingerprint,
            size_bytes: 10,
          };
        }
        return {
          workspace_dir: workspace.workspace_dir,
          draft_type,
          draft_path: "/tmp/factual.json",
          exists: true,
          sha256: factualFingerprint,
          size_bytes: 10,
        };
      },
      getUploadedSourceAnalysisDraft: async ({ draft_type }: { draft_type: "factual" | "visual" }) => {
        if (draft_type === "visual") {
          return {
            version: 1,
            draft_type: "visual",
            status: "ready",
            continuation_decision: { can_continue: true, reason: "ok", blocking: false },
            visual_assets: [{
              id: "visual-1",
              uploaded_source_id: "uploaded-source-image",
              source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-image/chart.png",
              use_constraint: "usable_visual_asset",
              reason: "Useful chart.",
              visual_summary: "Chart image.",
            }],
            gaps: [],
            rejected_material: [],
            updated_at: "2026-07-01T00:00:00.000Z",
          };
        }
        if (options.firstAttempt === "invalid-schema" && factualAttempt === 1) {
          return { version: 1, draft_type: "factual", status: "ready", facts: [] };
        }
        return {
          version: 1,
          draft_type: "factual",
          status: "ready",
          continuation_decision: { can_continue: true, reason: "ok", blocking: false },
          facts: [{
            id: "fact-1",
            claim: "Revenue grew 12%.",
            uploaded_source_id: "uploaded-source-1",
            source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/metrics.md",
          }],
          gaps: [],
          rejected_material: [],
          updated_at: "2026-07-01T00:00:00.000Z",
        };
      },
      recordUploadedSourceAnalysisDraft: async (input: { draft: Record<string, unknown> }) => input.draft,
      recordUploadedSourceAnalysis: async (input: { analysis: Record<string, unknown> }) => {
        finalAnalysis = input.analysis;
        return input.analysis;
      },
    } as unknown as PptBackend;
    const agentClient = {
      runAuthoringPrompt: async (prompt: string, runOptions?: AgentRunOptions) => {
        prompts.push(prompt);
        logContexts.push(runOptions?.logContext);
        const isVisual = prompt.includes("Uploaded Source Visual Analysis Draft Agent");
        if (isVisual) {
          visualAttempt += 1;
          visualFingerprint = `visual-after-${visualAttempt}`;
          runOptions?.onStreamEvent?.({ type: "content", text: `visual draft attempt ${visualAttempt}` });
          return {
            status: "ready_for_render",
            changed_files: ["/tmp/visual.json"],
            summary: "wrote visual draft",
            needs_render: false,
            notes: [],
          };
        }
        factualAttempt += 1;
        if (options.firstAttempt === "no-write" && factualAttempt === 1) return {
          status: "ready_for_render",
          changed_files: [],
          summary: "no write",
          needs_render: false,
          notes: [],
        };
        factualFingerprint = `after-${factualAttempt}`;
        runOptions?.onStreamEvent?.({ type: "content", text: `draft attempt ${factualAttempt}` });
        return {
          status: "ready_for_render",
          changed_files: ["/tmp/factual.json"],
          summary: "wrote draft",
          needs_render: false,
          notes: [],
        };
      },
    } as unknown as AgentClient;
    return {
      workspace,
      backend,
      agentClient,
      prompts,
      logs,
      logContexts,
      getFinalAnalysis: () => finalAnalysis,
    };
  }

  function logEvents(logs: Array<{ entry: Record<string, unknown> }>) {
    return logs.map((log) => log.entry.event);
  }

  it("retries a no-write draft gate failure and then merges a valid analysis", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "no-write" });
    const analysis = await ensureFreshUploadedSourceAnalysis(harness);

    assert.equal(analysis?.facts[0]?.id, "fact-1");
    assert.equal(harness.prompts.length, 2);
    assert.match(harness.prompts[1], /Previous gate failure/);
    assert.equal(harness.getFinalAnalysis()?.status, "ready");
    assert.ok(logEvents(harness.logs).includes("uploaded_source.analysis.factual.invalid"));
    assert.ok(logEvents(harness.logs).includes("uploaded_source.analysis.factual.finished"));
    const finished = harness.logs.find((log) => log.entry.event === "uploaded_source.analysis.factual.finished");
    assert.equal(Array.isArray(finished?.entry.attempts), true);
  });

  it("retries an invalid draft schema and then accepts the repaired draft", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "invalid-schema" });
    const analysis = await ensureFreshUploadedSourceAnalysis(harness);

    assert.equal(analysis?.facts[0]?.claim, "Revenue grew 12%.");
    assert.equal(harness.prompts.length, 2);
    assert.match(harness.prompts[1], /continuation_decision/);
    const invalid = harness.logs.find((log) => log.entry.event === "uploaded_source.analysis.factual.invalid");
    assert.equal(invalid?.entry.gate_passed, false);
    assert.equal(invalid?.entry.will_retry, true);
    assert.ok(Array.isArray(invalid?.entry.validation_gaps));
  });

  it("emits factual Agent stream events during analysis", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "invalid-schema" });
    const events: Array<{ phase: string; text: string }> = [];
    await ensureFreshUploadedSourceAnalysis({
      backend: harness.backend,
      agentClient: harness.agentClient,
      workspace: harness.workspace,
      onProgress: (event) => {
        if (event.type === "stream" && event.event.type === "content") {
          events.push({ phase: event.phase, text: event.event.text });
        }
      },
    });

    assert.deepEqual(events, [
      { phase: "factual", text: "draft attempt 1" },
      { phase: "factual", text: "draft attempt 2" },
    ]);
    const streamBatch = harness.logs.find((log) => log.entry.event === "uploaded_source.analysis.stream.batch");
    assert.equal(streamBatch?.channel, "ai-research");
    assert.deepEqual(streamBatch?.payload_keys, ["events"]);
    assert.equal(Array.isArray(streamBatch?.entry.events), true);
  });

  it("logs fresh reuse without synthetic Agent operations", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "invalid-schema" });
    const freshAnalysis = mergeUploadedSourceAnalysis({
      uploadedSourceIndex,
      factualDraft: validateUploadedSourceFactualAnalysisDraft({
        version: 1,
        draft_type: "factual",
        status: "ready",
        continuation_decision: { can_continue: true, reason: "ok", blocking: false },
        facts: [{
          id: "fact-1",
          claim: "Revenue grew 12%.",
          uploaded_source_id: "uploaded-source-1",
          source_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-1/metrics.md",
        }],
        gaps: [],
        rejected_material: [],
        updated_at: "2026-07-01T00:00:00.000Z",
      }).draft!,
      visualDraft: createSkippedUploadedSourceVisualAnalysisDraft("No images."),
    });
    (harness.backend as PptBackend & { getUploadedSourceAnalysis: PptBackend["getUploadedSourceAnalysis"] })
      .getUploadedSourceAnalysis = async () => freshAnalysis as unknown as Record<string, unknown>;

    const reused = await ensureFreshUploadedSourceAnalysis(harness);

    assert.equal(reused?.status, "ready");
    assert.deepEqual(logEvents(harness.logs), [
      "uploaded_source.analysis.started",
      "uploaded_source.analysis.reused",
    ]);
    assert.equal(harness.prompts.length, 0);
  });

  it("logs no-active-source skip without running an Agent", async () => {
    const emptyIndex: UploadedSourceIndex = {
      ...uploadedSourceIndex,
      materials: [],
      active_total_size_bytes: 0,
    };
    const harness = createWorkflowHarness({
      firstAttempt: "invalid-schema",
      uploadedSourceIndex: emptyIndex,
    });

    const analysis = await ensureFreshUploadedSourceAnalysis(harness);

    assert.equal(analysis, null);
    assert.deepEqual(logEvents(harness.logs), ["uploaded_source.analysis.skipped"]);
    assert.equal(harness.prompts.length, 0);
  });

  it("passes research log context to factual and visual Agents and logs merged operation ids", async () => {
    const imageIndex: UploadedSourceIndex = {
      ...uploadedSourceIndex,
      materials: [
        uploadedSourceIndex.materials[0],
        {
          uploaded_source_id: "uploaded-source-image",
          original_filename: "chart.png",
          display_name: "chart.png",
          extension: ".png",
          mime_type: "image/png",
          size_bytes: 34,
          sha256: "sha-image",
          file_path: "/tmp/workspace/uploaded-sources/files/uploaded-source-image/chart.png",
          status: "active",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      active_total_size_bytes: 46,
    };
    const harness = createWorkflowHarness({
      firstAttempt: "invalid-schema",
      uploadedSourceIndex: imageIndex,
    });
    const aiLogger = createAiInteractionLogger(harness.backend);

    const analysis = await ensureFreshUploadedSourceAnalysis({
      ...harness,
      aiLogger,
    });

    assert.equal(analysis?.visual_assets[0]?.id, "visual-1");
    const factualContext = harness.logContexts.find((context) =>
      context?.operation === "uploaded_source_analysis_factual"
    );
    const visualContext = harness.logContexts.find((context) =>
      context?.operation === "uploaded_source_analysis_visual"
    );
    assert.equal(factualContext?.domain, "research");
    assert.equal(factualContext?.kind, "uploaded-source-factual-analysis");
    assert.equal(visualContext?.domain, "research");
    assert.equal(visualContext?.kind, "uploaded-source-visual-analysis");
    const merged = harness.logs.find((log) => log.entry.event === "uploaded_source.analysis.merged");
    assert.ok(merged?.entry.analysis_run_id);
    assert.equal(typeof merged?.entry.factual_operation_id, "string");
    assert.equal(typeof merged?.entry.visual_operation_id, "string");
  });

  it("logs deterministic visual skip without creating a visual Agent operation", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "invalid-schema" });

    await ensureFreshUploadedSourceAnalysis({
      ...harness,
      aiLogger: createAiInteractionLogger(harness.backend),
    });

    const visualSkipped = harness.logs.find((log) => log.entry.event === "uploaded_source.analysis.visual.skipped");
    assert.equal(visualSkipped?.entry.reason, "no_uploaded_image_source_material");
    assert.equal(
      harness.logContexts.some((context) => context?.operation === "uploaded_source_analysis_visual"),
      false,
    );
  });

  it("force-refreshes instead of reusing a fresh blocked analysis", async () => {
    const harness = createWorkflowHarness({ firstAttempt: "invalid-schema" });
    const blockedAnalysis = {
      version: 1,
      status: "blocked",
      source: {
        active_uploaded_sources: uploadedSourceIndex.materials.map((source) => ({
          uploaded_source_id: source.uploaded_source_id,
          sha256: source.sha256,
          size_bytes: source.size_bytes,
          file_path: source.file_path,
        })),
        active_total_size_bytes: uploadedSourceIndex.active_total_size_bytes,
      },
      continuation_decision: { can_continue: false, reason: "old blocked result", blocking: true },
      facts: [],
      visual_assets: [],
      gaps: [],
      rejected_material: [],
      source_summaries: [],
      updated_at: "2026-07-01T00:00:00.000Z",
    };
    (harness.backend as PptBackend & { getUploadedSourceAnalysis: PptBackend["getUploadedSourceAnalysis"] })
      .getUploadedSourceAnalysis = async () => blockedAnalysis;

    const reused = await ensureFreshUploadedSourceAnalysis({
      backend: harness.backend,
      agentClient: harness.agentClient,
      workspace: harness.workspace,
    });
    assert.equal(reused?.status, "blocked");
    assert.equal(harness.prompts.length, 0);

    const refreshed = await ensureFreshUploadedSourceAnalysis({
      backend: harness.backend,
      agentClient: harness.agentClient,
      workspace: harness.workspace,
      forceRefresh: true,
    });
    assert.equal(refreshed?.status, "ready");
    assert.equal(harness.prompts.length, 2);
  });
});

describe("Uploaded Source Analysis research discovery freshness", () => {
  it("does not use stale uploaded-source analysis when active uploads are empty", async () => {
    const outline = {
      version: 2,
      title: "Uploaded Source Deck",
      output_language: "English",
      status: "confirmed",
      items: [{ title: "Metrics", outline: "Use only current active sources." }],
      source: {
        prompt: "Build from uploaded source material",
        context: [],
        setting: { output_language: "English" },
      },
      updated_at: "2026-07-01T00:00:00.000Z",
    };
    const pagePlan = {
      version: 1,
      status: "planned",
      title: outline.title,
      source: {
        outline_updated_at: outline.updated_at,
        template_group: "default",
        template_manifest_path: "/tmp/template/manifest.json",
        generated_by: "test",
      },
      pages: [{
        page_id: "page-01",
        index: 0,
        title: "Metrics",
        outline: "Use only current active sources.",
        blueprint_id: "simple",
        blueprint_source: "./blueprints/Simple.tsx",
        slide_path: "./slides/page-01.tsx",
        data_path: "./data/page-01.json",
        manifest_slide_id: "page-01",
        reason: "test",
      }],
      updated_at: "2026-07-01T00:00:00.000Z",
    };
    let discoveryContext: unknown = "unset";
    let planningContext: unknown = "unset";
    let recordedPageEvidence: { facts: Array<{ id: string }>; gaps: string[] } | null = null;
    const backend = {
      prepareResearchWorkspace: async () => ({
        workspace_dir: "/tmp/workspace",
        root_dir: "/tmp/workspace/research",
        raw_dir: "/tmp/workspace/research/raw",
        raw_web_dir: "/tmp/workspace/research/raw/web",
        raw_images_dir: "/tmp/workspace/research/raw/images",
        evidence_dir: "/tmp/workspace/research/evidence",
        evidence_pages_dir: "/tmp/workspace/research/evidence/pages",
        evidence_images_dir: "/tmp/workspace/research/evidence/images",
        evidence_drafts_dir: "/tmp/workspace/research/evidence/drafts",
        research_plan_path: "/tmp/workspace/research/research-plan.json",
        research_evidence_path: "/tmp/workspace/research/evidence-index.json",
        research_status_path: "/tmp/workspace/research/research-status.json",
        prepared_at: "2026-07-01T00:00:00.000Z",
      }),
      recordPageProgress: async () => ({}),
      appendWorkspaceLog: async () => ({}),
      getResearchEvidence: async () => ({
        version: 1,
        status: "empty",
        discovery_pool: null,
        pages: [],
        updated_at: "2026-07-01T00:00:00.000Z",
      }),
      listUploadedSources: async () => ({
        workspace_dir: "/tmp/workspace",
        index: { ...uploadedSourceIndex, materials: [], active_total_size_bytes: 0 },
        active: [],
        removed: [],
        limits: { single_file_max_bytes: 1, active_total_max_bytes: 1 },
      }),
      getUploadedSourceAnalysis: async () => ({
        version: 1,
        status: "ready",
        source: uploadedSourceIndex,
        continuation_decision: { can_continue: true, reason: "old", blocking: false },
        facts: [{ id: "old-fact", claim: "Old removed source fact." }],
        visual_assets: [],
        gaps: [],
        rejected_material: [],
        source_summaries: [],
        updated_at: "2026-07-01T00:00:00.000Z",
      }),
      getResearchStatus: async () => ({ version: 1, status: "empty", pages: [], updated_at: null }),
      recordPagePlan: async (input: { page_plan: typeof pagePlan }) => input.page_plan,
      recordResearchEvidencePageMarkdown: async () => ({}),
      recordResearchEvidencePage: async (input: { page_evidence: { facts: Array<{ id: string }>; gaps: string[] } }) => {
        recordedPageEvidence = input.page_evidence;
        return {
          workspace_dir: "/tmp/workspace",
          page_id: "page-01",
          status: "gap",
          evidence_index_path: "/tmp/workspace/research/evidence-index.json",
          page_count: 1,
          updated_at: "now",
        };
      },
      recordResearchStatusPage: async () => ({}),
      recordResearchEvidence: async (input: { evidence: unknown }) => input.evidence,
      recordResearchStatus: async (input: { status: unknown }) => input.status,
    };
    const runtime = {
      locale: "en",
      workspace: {
        workspace_root: "/tmp",
        workspace_dir: "/tmp/workspace",
      },
      confirmedOutline: outline,
      backend,
      aiClient: {
        generateResearchDiscoveryDecision: async (input: { uploadedSourceAnalysisContext?: unknown; phase: "web" | "visual" }) => {
          discoveryContext = input.uploadedSourceAnalysisContext;
          return {
            action: "stop",
            phase: input.phase,
            queries: [],
            rationale: "No research.",
            evidence_needs: [],
            visual_needs: [],
            gaps: [],
          };
        },
        generateEvidenceAwarePagePlan: async (input: { uploadedSourceAnalysisContext?: unknown }) => {
          planningContext = input.uploadedSourceAnalysisContext;
          return {
            ...pagePlan,
            pages: [{
              ...pagePlan.pages[0],
              content_plan: {
                main_message: "Metrics",
                content_points: ["Do not materialize old uploaded facts."],
                evidence_fact_ids: [],
                derived_insight_ids: [],
                visual_asset_ids: [],
                uploaded_source_fact_ids: ["old-fact"],
                uploaded_source_visual_asset_ids: [],
                gaps: [],
                authoring_notes: [],
              },
            }],
          };
        },
      },
      researchDiscoveryProgress: null,
      setProgress: () => undefined,
      onProgress: () => undefined,
      getProgress: () => null,
      activeStreams: new Map(),
      isCancelled: () => false,
      refinementRunKind: "deck-generation",
    };

    await runResearchDiscoveryForPagePlan({
      runtime: runtime as never,
      pagePlan: pagePlan as never,
    });

    assert.equal(discoveryContext, null);
    assert.equal(planningContext, null);
    assert.deepEqual(recordedPageEvidence?.facts, []);
    assert.ok(recordedPageEvidence?.gaps.some((gap) => gap.includes("Missing assigned Uploaded Source fact id: old-fact")));
  });
});
