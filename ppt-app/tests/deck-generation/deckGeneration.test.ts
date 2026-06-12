import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AgentInfrastructureError,
  AgentRunCancelledError,
  type AgentClient,
} from "../../src/agent/agentClient.ts";
import type { AiClient } from "../../src/ai/aiClient.ts";
import type { PptBackend } from "../../src/api/pptBackend.ts";
import type {
  PagePlan,
  PageProgress,
  RenderWorkspacePagePreviewResult,
  TemplatePlanningContext,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../src/api/types.ts";
import {
  runDeckGeneration,
  runDeckRefinement,
  runPageGenerationRetry,
  type DeckGenerationProgress,
} from "../../src/features/deck-generation/index.ts";

const outline: WorkspaceOutline = {
  version: 2,
  title: "Demo Deck",
  output_language: "English",
  status: "confirmed",
  items: [
    { title: "Intro", outline: "Set context" },
    { title: "Close", outline: "Close the deck" },
  ],
  source: {
    prompt: "make a deck",
    context: [],
    setting: { output_language: "English" },
  },
  updated_at: "2026-05-23T00:00:00.000Z",
};

const STRICT_REVIEW_SETTING = {
  content_review_enabled: true,
  visual_review_enabled: true,
};

const workspace: WorkspaceResult = {
  workspace_root: "/tmp/workspaces",
  workspace_dir: "/tmp/workspaces/demo",
  workspace_id: "demo",
  initialized: true,
  created_files: [],
  missing_files: [],
  files: {
    task: "task.json",
    setting: "setting.json",
    outline: "outline.json",
    page_plan: "page-plan.json",
    page_progress: "page-progress.json",
    pages: "pages.json",
    template: "template",
  },
  task: { title: "Demo Deck" },
  setting: STRICT_REVIEW_SETTING,
  outline,
  page_plan: null,
  page_progress: null,
  pages: null,
  template: {
    selected_template_group: "default",
    manifest_path: "/tmp/workspaces/demo/template/manifest.json",
  },
};

const planningContext: TemplatePlanningContext = {
  template_group: "default",
  template_group_name: "Default",
  template_dir: "/tmp/workspaces/demo/template",
  manifest_path: "/tmp/workspaces/demo/template/manifest.json",
  catalog_path: "/tmp/workspaces/demo/template/catalog.json",
  blueprints: [
    {
      id: "simple",
      name: "Simple",
      blueprint_source: "./blueprints/Simple.tsx",
      layout_family: "content",
      content_intents: ["content"],
      suitable_for: ["content"],
      avoid_for: [],
    },
  ],
  rules: [],
};

function makePagePlan(overrides: Partial<PagePlan> = {}): PagePlan {
  const items = Array.from(
    { length: overrides.pages?.length ?? outline.items.length },
    (_, index) => outline.items[index] ?? {
      title: `Page ${index + 1}`,
      outline: `Outline ${index + 1}`,
    },
  );
  return {
    version: 1,
    status: "planned",
    title: "Demo Deck",
    source: {
      outline_updated_at: outline.updated_at,
      template_group: "default",
      template_manifest_path: "/tmp/workspaces/demo/template/manifest.json",
      generated_by: "test",
    },
    pages: items.map((item, index) => {
      const pageNumber = String(index + 1).padStart(2, "0");
      return {
        page_id: `page-${pageNumber}`,
        index,
        title: item.title,
        outline: item.outline,
        blueprint_id: "simple",
        blueprint_source: "./blueprints/Simple.tsx",
        slide_path: `./slides/page-${pageNumber}.tsx`,
        data_path: `./data/page-${pageNumber}.json`,
        manifest_slide_id: `page-${pageNumber}`,
        reason: "test",
      };
    }),
    updated_at: "2026-05-23T00:00:00.000Z",
    ...overrides,
  };
}

function makePagePlanWithCount(count: number): PagePlan {
  return makePagePlan({
    pages: Array.from({ length: count }, (_, index) => {
      const pageNumber = String(index + 1).padStart(2, "0");
      return {
        page_id: `page-${pageNumber}`,
        index,
        title: `Page ${index + 1}`,
        outline: `Outline ${index + 1}`,
        blueprint_id: "simple",
        blueprint_source: "./blueprints/Simple.tsx",
        slide_path: `./slides/page-${pageNumber}.tsx`,
        data_path: `./data/page-${pageNumber}.json`,
        manifest_slide_id: `page-${pageNumber}`,
        reason: "test",
      };
    }),
  });
}

function makeProgress(pagePlan: PagePlan, status = "pending"): PageProgress {
  return {
    version: 1,
    status: "prepared",
    pages: pagePlan.pages.map((page) => ({
      page_id: page.page_id,
      index: page.index,
      title: page.title,
      status,
      render_attempts: 0,
      visual_review_attempts: 0,
      content_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      slide_path: page.slide_path,
      data_path: page.data_path,
      last_html_path: "",
      last_screenshot_path: "",
      last_error: "",
      content_review: null,
      visual_review: null,
      review: null,
      updated_at: null,
    })),
    updated_at: null,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createPreview(pageIndex: number): RenderWorkspacePagePreviewResult {
  return {
    workspace_dir: workspace.workspace_dir,
    manifest_path: "/tmp/workspaces/demo/template/manifest.json",
    html_path: `/tmp/workspaces/demo/output/page-${pageIndex + 1}.html`,
    preview_url: `file:///tmp/workspaces/demo/output/page-${pageIndex + 1}.html`,
    screenshot_path: `/tmp/workspaces/demo/output/page-${pageIndex + 1}.png`,
    page_index: pageIndex,
    page_number: pageIndex + 1,
    slide_id: `page-${String(pageIndex + 1).padStart(2, "0")}`,
    layout_id: "simple",
    title: outline.items[pageIndex]?.title ?? "Slide",
    rendered_at: "2026-05-23T00:00:00.000Z",
  };
}

function createHarness(options: {
  pagePlan?: PagePlan;
  existingProgress?: PageProgress;
  renderFailures?: number;
  deckRenderError?: Error;
  visualReviews?: Array<{ pass: boolean; score: number; revision_request?: string }>;
  contentReviews?: Array<{
    pass: boolean;
    score: number;
    rewrite_request?: string;
    issues?: Array<{
      type: "language" | "outline_alignment" | "grounding" | "placeholder_quality";
      severity?: string;
      evidence: string;
      reason: string;
      fix_hint?: string;
    }>;
  }>;
  authoringError?: Error;
  toolAccessError?: Error;
  authoringDelayMs?: number;
} = {}) {
  let pagePlan = clone(options.pagePlan ?? makePagePlan());
  let progress = clone(options.existingProgress ?? makeProgress(pagePlan));
  let renderFailures = options.renderFailures ?? 0;
  const authoringPrompts: string[] = [];
  const visualReviewPrompts: string[] = [];
  const contentReviewPrompts: string[] = [];
  const recordPageProgressInputs: Array<{ page_id: string; patch: Record<string, unknown> }> = [];
  const logs: unknown[] = [];
  const progressEvents: DeckGenerationProgress[] = [];
  let generatePagePlanCalls = 0;
  let renderCalls = 0;
  let activeAuthoringRuns = 0;
  let maxActiveAuthoringRuns = 0;
  let deckRenderCalls = 0;
  let checkToolAccessCalls = 0;

  const backend: PptBackend = {
    listWorkspaces: async () => ({ workspace_root: "", has_workspaces: false, latest_workspace: null, workspaces: [] }),
    getWorkspaceDefaults: async () => ({ workspace_root: workspace.workspace_root, setting: {} }),
    createWorkspace: async () => workspace,
    openWorkspace: async () => workspace,
    appendWorkspaceLog: async (input) => {
      logs.push(input);
      return { workspace_dir: input.workspace_dir, log_file: "log.jsonl", appended: true };
    },
    getWorkspaceOutline: async () => outline,
    updateWorkspaceOutline: async () => workspace,
    updateWorkspaceSettings: async () => workspace,
    updateWorkspaceTitle: async () => workspace,
    createProject: async () => ({ projectDir: "", state: {} }),
    getProject: async () => ({ projectDir: "", state: {} }),
    recordRequirements: async () => ({ projectDir: "", state: {} }),
    listTemplates: async () => ({ templates: [], count: 0 }),
    selectTemplate: async () => ({ workspace, selection: {} as never }),
    getTemplatePlanningContext: async () => planningContext,
    recordPagePlan: async (input) => {
      pagePlan = clone(input.page_plan);
      progress = makeProgress(pagePlan);
      return clone(pagePlan);
    },
    getPagePlan: async () => clone(pagePlan),
    preparePageFiles: async () => ({
      workspace_dir: workspace.workspace_dir,
      manifest_path: "/tmp/workspaces/demo/template/manifest.json",
      page_plan_path: "/tmp/workspaces/demo/page-plan.json",
      prepared_at: "2026-05-23T00:00:00.000Z",
      pages: pagePlan.pages.map((page) => ({
        page_id: page.page_id,
        index: page.index,
        title: page.title,
        slide_path: page.slide_path,
        data_path: page.data_path,
        blueprint_id: page.blueprint_id,
        manifest_slide_id: page.manifest_slide_id,
      })),
    }),
    getPageProgress: async () => clone(progress),
    recordPageProgress: async (input) => {
      recordPageProgressInputs.push({
        page_id: input.page_id,
        patch: clone(input.patch),
      });
      progress = {
        ...progress,
        pages: progress.pages.map((page) =>
          page.page_id === input.page_id ? { ...page, ...input.patch } : page,
        ),
        updated_at: "2026-05-23T00:00:00.000Z",
      };
      return clone(progress);
    },
    renderWorkspacePagePreview: async (input) => {
      renderCalls += 1;
      if (renderFailures > 0) {
        renderFailures -= 1;
        throw new Error("render broke");
      }
      return createPreview(input.page_index);
    },
    recordOutline: async () => ({ projectDir: "", state: {} }),
    renderDeckHtml: async () => {
      deckRenderCalls += 1;
      if (options.deckRenderError) {
        throw options.deckRenderError;
      }
      return {
        workspace_dir: workspace.workspace_dir,
        manifest_path: "/tmp/workspaces/demo/template/manifest.json",
        output_dir: "/tmp/workspaces/demo/output",
        preview_url: "file:///tmp/workspaces/demo/output/deck.html",
        slides: pagePlan.pages.map((page) => ({
          slide_id: page.manifest_slide_id,
          layout_id: page.blueprint_id,
          title: page.title,
          html_path: `/tmp/workspaces/demo/output/${page.page_id}.html`,
          preview_url: `file:///tmp/workspaces/demo/output/${page.page_id}.html`,
          speaker_note: page.outline,
        })),
        slide_count: pagePlan.pages.length,
        title: pagePlan.title,
        rendered_at: "2026-05-23T00:00:00.000Z",
      };
    },
    recordDeckReview: async () => ({ projectDir: "", state: {} }),
    prepareExportModel: async () => ({ modelPath: "", htmlPath: "", outputDir: "" }),
    generatePptx: async () => ({ pptxPath: "" }),
    exportPdf: async () => ({ pdfPath: "", htmlPath: "" }),
    recordPptxExport: async () => ({ projectDir: "", state: {} }),
    recordPdfExport: async () => ({ projectDir: "", state: {} }),
  };

  const aiClient: AiClient = {
    generateOutline: async () => ({ outline: { title: outline.title, output_language: "English", items: outline.items }, attempts: [] }),
    detectOutputLanguage: async () => ({ output_language: "English" }),
    generatePagePlan: async () => {
      generatePagePlanCalls += 1;
      return clone(pagePlan);
    },
    generateDeck: async () => ({ title: "", outline: [], slides: [] }),
    reviseOutline: async () => ({ outline: { title: outline.title, output_language: "English", items: outline.items }, attempts: [] }),
    generateSlidesFromOutline: async () => [],
    refineDeck: async () => [],
    refineSlide: async () => ({ title: "", subtitle: "" }),
  };

  const visualReviewQueue = [...(options.visualReviews ?? [{ pass: true, score: 9 }])];
  const contentReviewQueue = [...(options.contentReviews ?? [{ pass: true, score: 9 }])];
  const agentClient: AgentClient = {
    checkToolAccess: async () => {
      checkToolAccessCalls += 1;
      if (options.toolAccessError) throw options.toolAccessError;
    },
    runAuthoringPrompt: async (prompt, runOptions) => {
      authoringPrompts.push(prompt);
      activeAuthoringRuns += 1;
      maxActiveAuthoringRuns = Math.max(maxActiveAuthoringRuns, activeAuthoringRuns);
      runOptions?.onStreamEvent?.({ type: "activity", message: "authoring started" });
      if (options.authoringDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.authoringDelayMs));
      }
      activeAuthoringRuns -= 1;
      if (options.authoringError) throw options.authoringError;
      runOptions?.onStreamEvent?.({ type: "complete" });
      return {
        status: "ready_for_render",
        changed_files: [],
        summary: "ok",
        needs_render: true,
        notes: [],
        parsed_json: true,
      };
    },
    runPageVisualReviewPrompt: async (prompt) => {
      visualReviewPrompts.push(prompt);
      const next = visualReviewQueue.shift() ?? { pass: true, score: 9 };
      return {
        pass: next.pass,
        score: next.score,
        issues: next.pass ? [] : [{ problem: "layout issue" }],
        revision_request: next.revision_request ?? "",
        confidence: "medium",
      };
    },
    runPageContentReviewPrompt: async (prompt) => {
      contentReviewPrompts.push(prompt);
      const next = contentReviewQueue.shift() ?? { pass: true, score: 9 };
      return {
        pass: next.pass,
        score: next.score,
        issues: next.issues ?? [],
        rewrite_request: next.rewrite_request ?? "",
        confidence: "medium",
      };
    },
    close: async () => undefined,
  };

  return {
    backend,
    aiClient,
    agentClient,
    authoringPrompts,
    visualReviewPrompts,
    contentReviewPrompts,
    recordPageProgressInputs,
    logs,
    progressEvents,
    get generatePagePlanCalls() {
      return generatePagePlanCalls;
    },
    get renderCalls() {
      return renderCalls;
    },
    get deckRenderCalls() {
      return deckRenderCalls;
    },
    get checkToolAccessCalls() {
      return checkToolAccessCalls;
    },
    get maxActiveAuthoringRuns() {
      return maxActiveAuthoringRuns;
    },
    get progress() {
      return clone(progress);
    },
    get pagePlan() {
      return clone(pagePlan);
    },
  };
}

describe("Deck Generation Flow Module", () => {
  it("completes the Confirmed Outline success path", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(completion.result.rendered.slide_count, 2);
    assert.equal(harness.generatePagePlanCalls, 1);
    assert.equal(harness.progressEvents[0]?.step, "page-plan");
    assert.equal(harness.progressEvents.at(-1)?.step, "complete");
    assert.ok(!harness.progressEvents.some((progress) => progress.step === "failed"));
  });

  it("keeps confirmed outline text when the LLM rewrites page plan text", async () => {
    const rewrittenPlan = makePagePlan({
      title: "LLM Rewritten Deck Title",
      source: {
        outline_updated_at: null,
        template_group: "default",
        template_manifest_path: "/tmp/workspaces/demo/template/manifest.json",
        generated_by: "test",
      },
      pages: makePagePlan().pages.map((page, index) => ({
        ...page,
        title: `LLM Rewritten Page ${index + 1}`,
        outline: `LLM rewritten outline ${index + 1}`,
      })),
    });
    const harness = createHarness({ pagePlan: rewrittenPlan });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.pagePlan.title, outline.title);
    assert.equal(harness.pagePlan.source.outline_updated_at, outline.updated_at);
    assert.deepEqual(
      harness.pagePlan.pages.map((page) => ({ title: page.title, outline: page.outline })),
      outline.items,
    );
    assert.deepEqual(
      completion.result.pagePlan.pages.map((page) => ({ title: page.title, outline: page.outline })),
      outline.items,
    );
    const pagePlanLog = harness.logs.find((entry) =>
      (entry as { entry?: { event?: string } }).entry?.event === "ai.page_plan.operation.finished"
    ) as { entry?: { title?: string; page_count?: number; plan?: PagePlan } } | undefined;
    assert.equal(pagePlanLog?.entry?.title, outline.title);
    assert.equal(pagePlanLog?.entry?.page_count, outline.items.length);
    assert.equal(pagePlanLog?.entry?.plan, undefined);
  });

  it("uses render-fix authoring after a render failure", async () => {
    const harness = createHarness({ renderFailures: 1 });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.authoringPrompts.some((prompt) => prompt.includes("Render error to fix")));
    assert.ok(harness.authoringPrompts.some((prompt) =>
      prompt.includes("Read the component source file, not only components/README.md")
    ));
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-render"));
  });

  it("includes consecutive render failure history in repeated render-fix prompts", async () => {
    const harness = createHarness({
      pagePlan: makePagePlanWithCount(1),
      renderFailures: 2,
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const historyPrompts = harness.authoringPrompts.filter((prompt) =>
      prompt.includes("Consecutive render failure history")
    );
    const promptWithHistory = historyPrompts.at(-1);
    assert.ok(promptWithHistory);
    assert.match(promptWithHistory, /Each item is one failed render or pre-render check attempt/);
    assert.match(promptWithHistory, /"attempt": 1/);
    assert.match(promptWithHistory, /"attempt": 2/);
    assert.match(promptWithHistory, /"phase": "render"/);
    assert.match(promptWithHistory, /render broke/);
  });

  it("uses visual-review-fix authoring after a failed visual review", async () => {
    const harness = createHarness({
      visualReviews: [
        { pass: false, score: 4, revision_request: "Fix overlap" },
        { pass: true, score: 9 },
      ],
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.authoringPrompts.some((prompt) => prompt.includes("Visual review failed")));
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-visual-review"));
  });

  it("uses content-review-fix authoring after a failed page content review", async () => {
    const harness = createHarness({
      contentReviews: [
        {
          pass: false,
          score: 4,
          rewrite_request: "Rewrite this page in English and remove unsupported metrics.",
          issues: [
            {
              type: "language",
              severity: "high",
              evidence: "中文标题",
              reason: "The confirmed outline requires English.",
              fix_hint: "Rewrite the visible text in English.",
            },
          ],
        },
        { pass: true, score: 9 },
      ],
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.authoringPrompts.some((prompt) => prompt.includes("Page Content Review failed")));
    assert.ok(harness.authoringPrompts.some((prompt) => prompt.includes("content-review-fix")));
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-content-review"));
  });

  it("skips content and visual reviews when review settings are disabled", async () => {
    const harness = createHarness();
    const reviewDisabledWorkspace: WorkspaceResult = {
      ...workspace,
      setting: {
        content_review_enabled: false,
        visual_review_enabled: false,
      },
    };
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace: reviewDisabledWorkspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.contentReviewPrompts.length, 0);
    assert.equal(harness.visualReviewPrompts.length, 0);
    assert.equal(harness.renderCalls, 2);
    assert.ok(harness.progress.pages.every((page) => page.status === "accepted"));
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-render"));
    assert.ok(!harness.progressEvents.some((progress) => progress.step === "page-content-review"));
    assert.ok(!harness.progressEvents.some((progress) => progress.step === "page-visual-review"));
  });

  it("skips content and visual reviews when review settings are missing", async () => {
    const harness = createHarness();
    const defaultWorkspace: WorkspaceResult = {
      ...workspace,
      setting: {},
    };
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace: defaultWorkspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.contentReviewPrompts.length, 0);
    assert.equal(harness.visualReviewPrompts.length, 0);
    assert.ok(harness.progress.pages.every((page) => page.status === "accepted"));
  });

  it("honors configured visual review failure limit", async () => {
    const pagePlan = makePagePlanWithCount(1);
    const harness = createHarness({
      pagePlan,
      visualReviews: [{ pass: false, score: 4, revision_request: "Fix overlap" }],
    });
    const limitedWorkspace: WorkspaceResult = {
      ...workspace,
      setting: {
        ...STRICT_REVIEW_SETTING,
        visual_review_failure_limit: 1,
      },
    };
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace: limitedWorkspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(harness.visualReviewPrompts.length, 1);
    assert.equal(harness.authoringPrompts.filter((prompt) => prompt.includes("Authoring mode: visual-review-fix")).length, 0);
    assert.equal(harness.progress.pages[0]?.status, "needs_user_review");
    assert.equal(harness.progressEvents.at(-1)?.pages[0]?.visual_review_attempt_limit, 1);
  });

  it("honors configured content review failure limit", async () => {
    const pagePlan = makePagePlanWithCount(1);
    const harness = createHarness({
      pagePlan,
      contentReviews: [
        {
          pass: false,
          score: 4,
          rewrite_request: "Fix unsupported claim",
          issues: [
            {
              type: "grounding",
              severity: "high",
              evidence: "Unsupported claim",
              reason: "No supporting source was provided.",
            },
          ],
        },
      ],
    });
    const limitedWorkspace: WorkspaceResult = {
      ...workspace,
      setting: {
        ...STRICT_REVIEW_SETTING,
        content_review_failure_limit: 1,
      },
    };
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace: limitedWorkspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(harness.contentReviewPrompts.length, 1);
    assert.equal(harness.authoringPrompts.filter((prompt) => prompt.includes("Authoring mode: content-review-fix")).length, 0);
    assert.equal(harness.renderCalls, 0);
    assert.equal(harness.progress.pages[0]?.status, "needs_user_review");
    assert.equal(harness.progressEvents.at(-1)?.pages[0]?.content_review_attempt_limit, 1);
  });

  it("treats explicit TBD placeholders as grounded review targets", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const prompt = harness.contentReviewPrompts.join("\n");
    assert.match(prompt, /Do not report them as grounding issues solely because the page openly marks a fact or chart as pending/);
    assert.match(prompt, /use type placeholder_quality with low severity/);
    assert.match(prompt, /Never ask the authoring agent to replace placeholders with real facts/);
  });

  it("prevents authoring from inventing unsupported chart and KPI numbers", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const prompt = harness.authoringPrompts[0] ?? "";
    assert.match(prompt, /Authoring composition strategy/);
    assert.match(prompt, /current slide TSX\/data you receive is based on the selected blueprint/);
    assert.match(prompt, /starting canvas, not a finished slide/);
    assert.match(prompt, /Build the page primarily by composing existing template components/);
    assert.match(prompt, /Do not hand-code bespoke page sections, cards, KPI blocks, charts, or decorative structures/);
    assert.match(prompt, /Add, remove, reorder, resize, or reconfigure components/);
    assert.match(prompt, /Avoid mechanically cloning the selected blueprint structure across pages/);
    assert.match(prompt, /Authoring grounding source rules/);
    assert.match(prompt, /current slide TSX and current data JSON as editable draft content, not as sources of truth/);
    assert.match(prompt, /must not be used as evidence for new factual claims, numbers, dates, chart data, KPIs/);
    assert.match(prompt, /Analytical conclusions must be clearly derived from provided facts/);
    assert.match(prompt, /requires external knowledge and no source material is available/);
    assert.doesNotMatch(prompt, /Content grounding and anti-hallucination rules/);
    assert.doesNotMatch(prompt, /generated slide data already present in the workspace/);
    assert.doesNotMatch(prompt, /edit only the current data JSON by default/);
    assert.match(prompt, /Numeric and chart authoring rules/);
    assert.match(prompt, /Do not invent, estimate, approximate, or make up plausible-looking numbers/);
    assert.match(prompt, /set chart series values to all zeros/);
    assert.match(prompt, /数据待补充 \/ 示意 \/ 待确认/);
    assert.match(prompt, /do not use real-looking time labels such as FY20-FY23/);
  });

  it("keeps authored page content out of content-review grounding evidence sources", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const prompt = harness.contentReviewPrompts.join("\n");
    assert.match(prompt, /Outline alignment check is intentionally disabled/);
    assert.match(prompt, /Do not return outline_alignment issues/);
    assert.doesNotMatch(prompt, /"type":"outline_alignment"/);
    assert.match(prompt, /Review targets: current data JSON and current slide TSX visible content/);
    assert.match(prompt, /Not evidence sources: current page data JSON, current page slide TSX/);
    assert.match(prompt, /The fact that a value appears in current data JSON or current slide TSX never makes it grounded by itself/);
  });

  it("requires content review to scrutinize chart and KPI numbers as factual claims", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const prompt = harness.contentReviewPrompts.join("\n");
    assert.match(prompt, /Numeric and chart data rules/);
    assert.match(prompt, /series\[\]\.values/);
    assert.match(prompt, /KPI values/);
    assert.match(prompt, /revenue, cash flow, ROE/);
    assert.match(prompt, /Chart data is not grounded merely because the selected blueprint expects a chart/);
    assert.match(prompt, /Chart ticks, minValue, and maxValue can be treated as visual scale controls only when they do not assert a real value range/);
  });

  it("uses Page Refinement authoring instead of fake visual review failure", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan, "accepted");
    const harness = createHarness({ pagePlan, existingProgress });
    const instruction = "Use FY23 revenue of $36.0B and operating cash flow of $6.0B.";

    const completion = await runDeckRefinement({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      instruction,
      scope: "slide",
      pageIndex: 0,
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.authoringPrompts.length, 1);
    const authoringPrompt = harness.authoringPrompts[0] ?? "";
    assert.match(authoringPrompt, /page-refinement/);
    assert.match(authoringPrompt, /Page Refinement Request/);
    assert.match(authoringPrompt, /\$36\.0B/);
    assert.match(authoringPrompt, /\$6\.0B/);
    assert.match(authoringPrompt, /not a Page Visual Review failure/);
    assert.match(authoringPrompt, /You may adjust page structure/);
    assert.doesNotMatch(authoringPrompt, /Visual review failed\. Fix request/);
    assert.equal(harness.progress.pages[0]?.status, "accepted");
    assert.equal(harness.progress.pages[1]?.status, "accepted");
  });

  it("carries Page Refinement Request into content-review evidence sources", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan, "accepted");
    const harness = createHarness({ pagePlan, existingProgress });
    const instruction = "Replace placeholders with FY23 revenue of $36.0B; do not add FY20-FY22.";

    const completion = await runDeckRefinement({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      instruction,
      scope: "slide",
      pageIndex: 0,
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const prompt = harness.contentReviewPrompts[0] ?? "";
    assert.match(prompt, /Current Page Refinement Request evidence/);
    assert.match(prompt, /FY23 revenue of \$36\.0B/);
    assert.match(prompt, /only facts, numbers, dates, names, and claims explicitly stated/);
    assert.match(prompt, /Do not treat the Page Refinement Request as permission to infer adjacent facts/);
    assert.match(prompt, /complete missing time series/);
    assert.match(prompt, /A vague request such as 'use real data'/);
    assert.match(prompt, /Review targets: current data JSON and current slide TSX visible content/);
    assert.match(prompt, /Not evidence sources: current page data JSON, current page slide TSX/);
  });

  it("keeps Page Refinement Request run-scoped without page-progress schema changes", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan, "accepted");
    const harness = createHarness({ pagePlan, existingProgress });

    const completion = await runDeckRefinement({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      instruction: "Use FY23 revenue of $36.0B.",
      scope: "slide",
      pageIndex: 0,
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const refinementReset = harness.recordPageProgressInputs.find(
      (input) => input.page_id === "page-01" && input.patch.status === "pending",
    );
    assert.ok(refinementReset);
    assert.equal(Object.hasOwn(refinementReset.patch, "pageRefinementRequest"), false);
    assert.equal(Object.hasOwn(refinementReset.patch, "refinement_request"), false);
    assert.equal(refinementReset.patch.visual_review, null);
    assert.equal(refinementReset.patch.review, null);
    assert.equal(
      harness.recordPageProgressInputs.some((input) =>
        Object.hasOwn(input.patch, "refinement_request") ||
        Object.hasOwn(input.patch, "pageRefinementRequest")
      ),
      false,
    );
  });

  it("routes quick slide refinement instructions through Page Refinement semantics", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan, "accepted");
    const harness = createHarness({ pagePlan, existingProgress });
    const instruction = [
      "Change only the current slide layout direction while preserving its factual content and key message.",
      "Make the slide better for an executive report: emphasize conclusion-first structure, concise evidence, and decision-ready framing.",
      "You may restructure the current slide TSX and data, and you may reference available blueprints/components for layout ideas.",
      "Do not modify page-plan.json, manifest slide ids, other pages, or unrelated shared files.",
      "Do not add unsupported facts, numbers, dates, names, citations, examples, or claims.",
      "If content does not fit the requested layout, prioritize truthful omission or TBD over invention.",
    ].join("\n");

    const completion = await runDeckRefinement({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      instruction,
      scope: "slide",
      pageIndex: 0,
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const authoringPrompt = harness.authoringPrompts[0] ?? "";
    assert.match(authoringPrompt, /Authoring mode: page-refinement/);
    assert.match(authoringPrompt, /Page Refinement Request/);
    assert.match(authoringPrompt, /preserving its factual content and key message/);
    assert.match(authoringPrompt, /Do not add unsupported facts, numbers, dates, names, citations, examples, or claims/);
    assert.doesNotMatch(authoringPrompt, /Visual review failed\. Fix request/);
    assert.ok(harness.contentReviewPrompts.length > 0);
    assert.ok(harness.visualReviewPrompts.length > 0);
    assert.equal(harness.deckRenderCalls, 1);
  });

  it("guards content-review-fix against unsupported real-data requests", async () => {
    const harness = createHarness({
      contentReviews: [
        {
          pass: false,
          score: 4,
          rewrite_request: "请使用真实的星巴克中国门店增长数值替换目前的零值占位符。",
          issues: [
            {
              type: "grounding",
              severity: "high",
              evidence: "data.series[0].values: [0, 0, 0]",
              reason: "数据待补充。",
              fix_hint: "不要编造数据。",
            },
          ],
        },
        { pass: true, score: 9 },
      ],
    });

    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const fixPrompt = harness.authoringPrompts.find((prompt) =>
      prompt.includes("Page Content Review failed")
    );
    assert.ok(fixPrompt);
    assert.match(fixPrompt, /Do not perform broad page-structure redesigns during render-fix, visual-review-fix, or content-review-fix/);
    assert.match(fixPrompt, /Never satisfy a rewrite request by inventing or approximating real-world numbers/);
    assert.match(fixPrompt, /TBD \/ 待补充/);
  });

  it("stores content and visual reviews separately while keeping review compatible", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    const firstPage = harness.progress.pages[0];
    assert.ok(firstPage);
    assert.equal((firstPage.content_review as { pass?: boolean } | null)?.pass, true);
    assert.equal((firstPage.visual_review as { pass?: boolean } | null)?.pass, true);
    assert.equal((firstPage.review as { revision_request?: string } | null)?.revision_request, "");
  });

  it("blocks low-severity grounding issues when they describe unsupported concrete data", async () => {
    const harness = createHarness({
      contentReviews: [
        {
          pass: true,
          score: 9,
          issues: [
            {
              type: "grounding",
              severity: "low",
              evidence: "series[0].values: [33833, 35711, 38038, 40000]",
              reason: "页面数据中包含具体门店数量，而工作区工件仅提供定性描述，严格意义上属于外部知识。",
              fix_hint: "移除具体数字或标注为待补充。",
            },
          ],
        },
        { pass: true, score: 9 },
      ],
    });

    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.authoringPrompts.some((prompt) => prompt.includes("Page Content Review failed")));
    assert.equal(harness.progress.pages[0]?.content_review_attempts, 1);
  });

  it("allows placeholder-quality issues for explicit placeholder data", async () => {
    const harness = createHarness({
      contentReviews: [
        {
          pass: true,
          score: 9,
          issues: [
            {
              type: "placeholder_quality",
              severity: "low",
              evidence: "chartTitle: 数据待补充; series[0].values: [0, 0, 0]",
              reason: "图表明确标注为待补充，占位数据没有伪装为真实事实。",
              fix_hint: "可在获得原始素材后补充。",
            },
          ],
        },
      ],
    });

    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.authoringPrompts.some((prompt) => prompt.includes("Page Content Review failed")), false);
    assert.equal(harness.progress.pages[0]?.content_review_attempts, 0);
  });

  it("uses setting output language for content review when outline language is auto", async () => {
    const autoOutline: WorkspaceOutline = {
      ...outline,
      output_language: "auto",
      source: {
        ...outline.source,
        setting: { output_language: "中文" },
      },
    };
    const harness = createHarness();

    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: autoOutline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.contentReviewPrompts.some((prompt) => prompt.includes("Expected output language: 中文")));
  });

  it("passes language checking by default when outline and setting languages are auto", async () => {
    const autoOutline: WorkspaceOutline = {
      ...outline,
      output_language: "auto",
      source: {
        ...outline.source,
        setting: { output_language: "auto" },
      },
    };
    const harness = createHarness();

    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: autoOutline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.ok(harness.contentReviewPrompts.some((prompt) => prompt.includes("Language check passes by default")));
  });

  it("returns cancelled completion without throwing", async () => {
    const harness = createHarness();
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => harness.authoringPrompts.length > 0,
    });

    assert.equal(completion.status, "cancelled");
    assert.equal(completion.progress?.step, "cancelled");
  });

  it("does not count cancelled Agent runs as Agent failures", async () => {
    const harness = createHarness({
      authoringError: new AgentRunCancelledError(),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => true,
    });

    assert.equal(completion.status, "cancelled");
    assert.equal(harness.progress.pages.some((page) => page.status === "agent_failed"), false);
    assert.deepEqual(
      harness.progress.pages.map((page) => page.agent_failures),
      [0, 0],
    );
  });

  it("returns failed completion when render retry is exhausted", async () => {
    const harness = createHarness({ renderFailures: 20 });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "page_failed");
    assert.equal(completion.error.page_status, "render_failed");
    assert.equal(completion.progress?.step, "failed");
  });

  it("returns distinct failed completion for Agent infrastructure failure", async () => {
    const harness = createHarness({
      authoringError: new AgentInfrastructureError("session limit", "http", true),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "agent_infrastructure");
    assert.equal(completion.progress?.step, "failed");
  });

  it("fails before restart artifacts when Agent tools are not granted", async () => {
    const harness = createHarness({
      toolAccessError: new AgentInfrastructureError(
        "Agent sessions cannot use executable tools.",
        "NO_TOOLS_AVAILABLE",
        false,
        false,
        0,
        "host reported no tools",
        true,
      ),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "agent_infrastructure");
    assert.match(completion.error.message, /Agent 会话没有可执行工具权限/);
    assert.equal(completion.progress?.step, "failed");
    assert.equal(harness.checkToolAccessCalls, 1);
    assert.equal(harness.generatePagePlanCalls, 0);
    assert.equal(harness.progress.pages.every((page) => page.status === "pending"), true);
  });

  it("uses Agent infrastructure failure UX when cache miss retries are exhausted", async () => {
    const harness = createHarness({
      authoringError: new AgentInfrastructureError(
        "Agent session failed after retrying. Please retry this page.",
        undefined,
        false,
        true,
        12,
        "no cached app_session token; create a new session",
      ),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "restart",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "agent_infrastructure");
    assert.equal(completion.error.message, "Agent 会话重试后仍失败，请重跑这一页。");
    assert.equal(completion.progress?.pages[0].status, "agent_infrastructure_failed");
    assert.equal(
      completion.progress?.pages[0].last_error,
      "Agent 会话重试后仍失败，请重跑这一页。",
    );
    assert.equal(completion.progress?.pages[0].agent_infrastructure_failures, 1);
    const agentLog = harness.logs.find((entry) => {
      const record = entry as { channel?: string };
      return record.channel === "ai-page-agent";
    }) as { entry?: Record<string, unknown> } | undefined;
    assert.equal(agentLog?.entry?.session_cache_miss_retries, 12);
    assert.equal(agentLog?.entry?.agent_session_cache_miss, true);
    assert.equal(agentLog?.entry?.final_text, undefined);
  });

  it("runs page generation with a maximum concurrency of three", async () => {
    const pagePlan = makePagePlanWithCount(7);
    const harness = createHarness({
      pagePlan,
      existingProgress: makeProgress(pagePlan),
      authoringDelayMs: 25,
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: {
        ...outline,
        items: pagePlan.pages.map((page) => ({ title: page.title, outline: page.outline })),
      },
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.authoringPrompts.length, 7);
    assert.equal(harness.maxActiveAuthoringRuns, 3);
    assert.ok(harness.progressEvents.some((progress) => (progress.activeStreams?.length ?? 0) > 1));
  });

  it("does not render the final deck until every page is accepted", async () => {
    const pagePlan = makePagePlan();
    const harness = createHarness({
      pagePlan,
      existingProgress: makeProgress(pagePlan),
      renderFailures: 20,
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(harness.deckRenderCalls, 0);
  });

  it("resumes matching progress and skips accepted pages", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan);
    existingProgress.pages[0] = {
      ...existingProgress.pages[0],
      status: "accepted",
    };
    const harness = createHarness({ pagePlan, existingProgress });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.generatePagePlanCalls, 0);
    assert.equal(harness.authoringPrompts.length, 1);
    assert.ok(harness.progressEvents.some((progress) => progress.message.includes("已通过")));
  });

  it("resumes all unfinished pages and skips only accepted pages", async () => {
    const pagePlan = makePagePlanWithCount(5);
    const existingProgress = makeProgress(pagePlan);
    existingProgress.pages[0] = { ...existingProgress.pages[0], status: "accepted" };
    existingProgress.pages[1] = {
      ...existingProgress.pages[1],
      status: "render_failed",
      render_attempts: 10,
      visual_review_attempts: 5,
      content_review_attempts: 5,
      agent_failures: 4,
      last_error: "render broke",
      review: { pass: false },
    };
    existingProgress.pages[2] = { ...existingProgress.pages[2], status: "interrupted" };
    existingProgress.pages[3] = { ...existingProgress.pages[3], status: "pending" };
    existingProgress.pages[4] = { ...existingProgress.pages[4], status: "agent_infrastructure_failed" };
    const harness = createHarness({ pagePlan, existingProgress });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: {
        ...outline,
        items: pagePlan.pages.map((page) => ({ title: page.title, outline: page.outline })),
      },
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.authoringPrompts.length, 4);
    assert.equal(harness.progress.pages[0].status, "accepted");
    assert.equal(harness.progress.pages[1].status, "accepted");
    assert.equal(harness.progress.pages[2].status, "accepted");
    assert.equal(harness.progress.pages[3].status, "accepted");
    assert.equal(harness.progress.pages[4].status, "accepted");
    assert.equal(harness.progress.pages[1].render_attempts, 0);
    assert.equal(harness.progress.pages[1].visual_review_attempts, 0);
    assert.equal(harness.progress.pages[1].content_review_attempts, 0);
    assert.equal(harness.progress.pages[1].agent_failures, 0);
    assert.equal(harness.deckRenderCalls, 1);
  });

  it("resets existing visual review fixing pages to a fresh authoring attempt on resume", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan);
    existingProgress.pages[0] = { ...existingProgress.pages[0], status: "accepted" };
    existingProgress.pages[1] = {
      ...existingProgress.pages[1],
      status: "visual_review_fixing",
      review: {
        pass: false,
        score: 0,
        issues: [{ problem: "user refinement" }],
        revision_request: "Make the slide clearer.",
        confidence: "high",
      },
    };
    const harness = createHarness({ pagePlan, existingProgress });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.authoringPrompts.length, 1);
    assert.ok(harness.authoringPrompts[0]?.includes("Authoring mode: initial"));
    assert.equal(harness.authoringPrompts[0]?.includes("Visual review failed"), false);
    assert.equal(harness.progress.pages[1].visual_review_attempts, 0);
  });

  it("fails resume when artifacts are stale", async () => {
    const stalePlan = makePagePlan({
      source: {
        outline_updated_at: "2026-05-22T00:00:00.000Z",
        template_group: "default",
        template_manifest_path: "/tmp/workspaces/demo/template/manifest.json",
        generated_by: "test",
      },
    });
    stalePlan.pages[0] = {
      ...stalePlan.pages[0],
      title: "Old Intro",
    };
    const harness = createHarness({
      pagePlan: stalePlan,
      existingProgress: makeProgress(stalePlan),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "stale_artifacts");
    assert.equal(harness.generatePagePlanCalls, 0);
  });

  it("retries one failed page and renders the final deck when all pages are accepted", async () => {
    const pagePlan = makePagePlan();
    const existingProgress = makeProgress(pagePlan);
    existingProgress.pages[0] = {
      ...existingProgress.pages[0],
      status: "accepted",
    };
    existingProgress.pages[1] = {
      ...existingProgress.pages[1],
      status: "render_failed",
      render_attempts: 10,
      visual_review_attempts: 5,
      content_review_attempts: 5,
      agent_failures: 3,
      last_error: "render broke",
    };
    const harness = createHarness({ pagePlan, existingProgress });

    const completion = await runPageGenerationRetry({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      pageId: "page-02",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "completed");
    assert.equal(harness.generatePagePlanCalls, 0);
    assert.equal(harness.authoringPrompts.length, 1);
    assert.equal(harness.deckRenderCalls, 1);
    assert.equal(harness.progress.pages[0].status, "accepted");
    assert.equal(harness.progress.pages[1].status, "accepted");
    assert.equal(harness.progress.pages[1].render_attempts, 0);
    assert.equal(harness.progress.pages[1].visual_review_attempts, 0);
    assert.equal(harness.progress.pages[1].content_review_attempts, 0);
    assert.equal(harness.progress.pages[1].agent_failures, 0);
  });

  it("returns a recoverable final-render failure after all pages are accepted", async () => {
    const pagePlan = makePagePlan();
    const harness = createHarness({
      pagePlan,
      existingProgress: makeProgress(pagePlan, "accepted"),
      deckRenderError: new Error("deck render broke"),
    });
    const completion = await runDeckGeneration({
      backend: harness.backend,
      aiClient: harness.aiClient,
      agentClient: harness.agentClient,
      workspace,
      confirmedOutline: outline,
      locale: "zh",
      startMode: "resume",
      onProgress: (progress) => harness.progressEvents.push(progress),
      isCancelled: () => false,
    });

    assert.equal(completion.status, "failed");
    assert.equal(completion.error.type, "final_render_failed");
    assert.equal(completion.progress?.step, "final-render");
    assert.equal(harness.authoringPrompts.length, 0);
    assert.equal(harness.deckRenderCalls, 1);
    assert.equal(harness.progress.pages.every((page) => page.status === "accepted"), true);
  });
});
