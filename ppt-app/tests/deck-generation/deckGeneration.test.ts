import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentInfrastructureError, type AgentClient } from "../../src/agent/agentClient.ts";
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
  runPageGenerationRetry,
  type DeckGenerationProgress,
} from "../../src/features/deck-generation/index.ts";

const outline: WorkspaceOutline = {
  version: 2,
  title: "Demo Deck",
  status: "confirmed",
  items: [
    { title: "Intro", outline: "Set context" },
    { title: "Close", outline: "Close the deck" },
  ],
  source: {
    prompt: "make a deck",
    context: [],
    setting: {},
  },
  updated_at: "2026-05-23T00:00:00.000Z",
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
  setting: {},
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
      self_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      slide_path: page.slide_path,
      data_path: page.data_path,
      last_html_path: "",
      last_screenshot_path: "",
      last_error: "",
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
  selfReviews?: Array<{ pass: boolean; score: number; revision_request?: string }>;
  authoringError?: Error;
  authoringDelayMs?: number;
} = {}) {
  let pagePlan = clone(options.pagePlan ?? makePagePlan());
  let progress = clone(options.existingProgress ?? makeProgress(pagePlan));
  let renderFailures = options.renderFailures ?? 0;
  const authoringPrompts: string[] = [];
  const selfReviewPrompts: string[] = [];
  const logs: unknown[] = [];
  const progressEvents: DeckGenerationProgress[] = [];
  let generatePagePlanCalls = 0;
  let renderCalls = 0;
  let activeAuthoringRuns = 0;
  let maxActiveAuthoringRuns = 0;
  let deckRenderCalls = 0;

  const backend: PptBackend = {
    listWorkspaces: async () => ({ workspace_root: "", has_workspaces: false, latest_workspace: null, workspaces: [] }),
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
    generateOutline: async () => ({ outline: { title: outline.title, items: outline.items }, attempts: [] }),
    generatePagePlan: async () => {
      generatePagePlanCalls += 1;
      return clone(pagePlan);
    },
    generateDeck: async () => ({ title: "", outline: [], slides: [] }),
    reviseOutline: async () => ({ outline: { title: outline.title, items: outline.items }, attempts: [] }),
    generateSlidesFromOutline: async () => [],
    refineDeck: async () => [],
    refineSlide: async () => ({ title: "", subtitle: "" }),
  };

  const reviewQueue = [...(options.selfReviews ?? [{ pass: true, score: 9 }])];
  const agentClient: AgentClient = {
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
    runSelfReviewPrompt: async (prompt) => {
      selfReviewPrompts.push(prompt);
      const next = reviewQueue.shift() ?? { pass: true, score: 9 };
      return {
        pass: next.pass,
        score: next.score,
        issues: next.pass ? [] : [{ problem: "layout issue" }],
        revision_request: next.revision_request ?? "",
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
    selfReviewPrompts,
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
    get maxActiveAuthoringRuns() {
      return maxActiveAuthoringRuns;
    },
    get progress() {
      return clone(progress);
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
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-render"));
  });

  it("uses self-review-fix authoring after a failed self-review", async () => {
    const harness = createHarness({
      selfReviews: [
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
    assert.ok(harness.progressEvents.some((progress) => progress.step === "page-review"));
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
      isCancelled: () => true,
    });

    assert.equal(completion.status, "cancelled");
    assert.equal(completion.progress?.step, "cancelled");
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

  it("runs page generation with a maximum concurrency of five", async () => {
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
    assert.equal(harness.maxActiveAuthoringRuns, 1);
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
      self_review_attempts: 5,
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
    assert.equal(harness.progress.pages[1].self_review_attempts, 0);
    assert.equal(harness.progress.pages[1].agent_failures, 0);
  });
});
