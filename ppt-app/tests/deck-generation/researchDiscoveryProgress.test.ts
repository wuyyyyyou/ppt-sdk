import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createEmptyResearchDiscoveryProgress,
  summarizeDecision,
  summarizeImageFetchResult,
  summarizeQueries,
  summarizeWebFetchResult,
  summarizeVisualDraft,
  summarizeWebDraft,
  updateResearchDiscoveryPhase,
} from "../../src/features/deck-generation/researchDiscoveryProgress.ts";
import { createProgress, pageProgressToDeckGenerationProgress } from "../../src/features/deck-generation/progressProjection.ts";
import { createAgentRunTracker } from "../../src/features/deck-generation/runtimeSupport.ts";

describe("Research Discovery Progress projection", () => {
  it("summarizes web decisions and queries without raw prompt or JSON", () => {
    const decision = summarizeDecision({
      action: "search",
      phase: "web",
      queries: ["2026 EV battery market share"],
      rationale: "Need recent market data for page claims.",
      evidence_needs: ["recent market share"],
      visual_needs: [],
      gaps: [],
    });
    const queries = summarizeQueries([
      {
        kind: "web",
        query: "2026 EV battery market share",
        status: "collected",
        result_count: 6,
        fetch_count: 4,
      },
      {
        kind: "web",
        query: "2026 EV battery market share",
        status: "skipped_duplicate",
      },
    ]);

    assert.equal(decision.rationale, "Need recent market data for page claims.");
    assert.equal(JSON.stringify(decision).includes("prompt"), false);
    assert.equal(JSON.stringify(decision).includes("{\"action\""), false);
    assert.equal(queries[0].resultCount, 6);
    assert.equal(queries[0].fetchCount, 4);
    assert.equal(queries[0].sources, undefined);
    assert.equal(queries[1].status, "skipped_duplicate");
  });

  it("projects web fetch partial failure from successful fetched records only", () => {
    const query = summarizeWebFetchResult({
      query: "2026 EV battery market share",
      resultCount: 3,
      fetched: {
        output_dir: "/tmp/raw/web",
        index_path: "/tmp/raw/web/index.json",
        format: "text_markdown",
        max_chars: 12000,
        count: 3,
        results: [
          {
            title: "Fetched IEA report",
            url: "https://example.com/iea",
            file_path: "/tmp/raw/web/iea.md",
          },
          {
            title: "Broken source",
            url: "https://example.com/broken",
            error: "timeout",
          },
          {
            url: "https://example.com/no-file",
          },
        ],
      },
    });

    assert.equal(query.status, "collected");
    assert.equal(query.fetchCount, 1);
    assert.deepEqual(query.sources, [
      { title: "Fetched IEA report", url: "https://example.com/iea" },
    ]);
    assert.match(query.message ?? "", /1 fetch failed/);
  });

  it("marks web query as gap when no fetch records succeeded and falls back to evidence-backed sources only after success", () => {
    const noSuccess = summarizeWebFetchResult({
      query: "market share",
      resultCount: 2,
      fetched: {
        output_dir: "/tmp/raw/web",
        index_path: "/tmp/raw/web/index.json",
        format: "text_markdown",
        max_chars: 12000,
        count: 2,
        results: [
          { url: "https://example.com/a", error: "404" },
          { url: "https://example.com/b" },
        ],
      },
      fallbackSources: [
        {
          id: "fact-1",
          claim: "A sourced fact",
          source_type: "web_source",
          source_title: "Curated source",
          source_url: "https://example.com/curated",
        },
      ],
    });
    const successWithoutUrl = summarizeWebFetchResult({
      query: "market share",
      resultCount: 1,
      fetched: {
        output_dir: "/tmp/raw/web",
        index_path: "/tmp/raw/web/index.json",
        format: "text_markdown",
        max_chars: 12000,
        count: 1,
        results: [{ file_path: "/tmp/raw/web/source.md" }],
      },
      fallbackSources: [
        {
          id: "fact-1",
          claim: "A sourced fact",
          source_type: "web_source",
          source_title: "Curated source",
          source_url: "https://example.com/curated",
        },
      ],
    });

    assert.equal(noSuccess.status, "gap");
    assert.equal(noSuccess.fetchCount, 0);
    assert.equal(noSuccess.sources, undefined);
    assert.equal(successWithoutUrl.status, "collected");
    assert.deepEqual(successWithoutUrl.sources, [
      { title: "Curated source", url: "https://example.com/curated" },
    ]);
  });

  it("projects image download partial failure from successful downloaded records only", () => {
    const partial = summarizeImageFetchResult({
      query: "factory image",
      resultCount: 3,
      fetched: {
        output_dir: "/tmp/raw/images",
        index_path: "/tmp/raw/images/index.json",
        max_bytes: 0,
        count: 3,
        results: [
          { url: "https://example.com/ok.jpg", file_path: "/tmp/raw/images/ok.jpg" },
          { url: "https://example.com/broken.jpg", error: "download failed" },
        ],
      },
    });
    const gap = summarizeImageFetchResult({
      query: "factory image",
      resultCount: 1,
      fetched: {
        output_dir: "/tmp/raw/images",
        index_path: "/tmp/raw/images/index.json",
        max_bytes: 0,
        count: 1,
        results: [{ url: "https://example.com/broken.jpg", error: "download failed" }],
      },
    });

    assert.equal(partial.status, "collected");
    assert.equal(partial.downloadCount, 1);
    assert.match(partial.message ?? "", /1 image download failed/);
    assert.equal(gap.status, "gap");
    assert.equal(gap.downloadCount, 0);
  });

  it("summarizes web curation facts, rejected material, and gaps without crawl body text", () => {
    const summary = summarizeWebDraft({
      version: 1,
      page_id: "discovery-web-1",
      draft_type: "web",
      status: "curated",
      facts: [
        {
          id: "fact-1",
          claim: "Market grew.",
          source_type: "web_source",
          source_title: "Analyst note",
          source_url: "https://example.com/source",
          excerpt: "Long crawl body should not be copied into the UI source summary.",
        },
      ],
      derived_insights: [{ id: "insight-1", insight: "Growth is accelerating.", supporting_fact_ids: ["fact-1"] }],
      gaps: ["No current regional split."],
      rejected_material: [{ source: "SEO page", reason: "No citations." }],
      source_summary: "Curated from fetched sources.",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    assert.deepEqual(summary.sources, [{ title: "Analyst note", url: "https://example.com/source" }]);
    assert.deepEqual(summary.gaps, ["No current regional split."]);
    assert.deepEqual(summary.rejectedReasons, ["SEO page: No citations."]);
    assert.equal(summary.counts?.facts, 1);
    assert.equal(JSON.stringify(summary).includes("Long crawl body"), false);
  });

  it("summarizes visual assets as visual evidence with source references", () => {
    const summary = summarizeVisualDraft({
      version: 1,
      page_id: "discovery-visual-1",
      draft_type: "visual",
      status: "curated",
      visual_assets: [
        {
          id: "image-1",
          file_path: "/tmp/evidence/image-1.png",
          image_url: "https://images.example.com/image-1.png",
          page_url: "https://example.com/source-page",
          reason: "Matches the page intent.",
          visual_summary: "Factory line photo.",
        },
      ],
      gaps: [],
      rejected_material: [],
      visual_summary: "One useful image.",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(summary.visualAssets?.[0].thumbnailUrl, "https://images.example.com/image-1.png");
    assert.equal(summary.visualAssets?.[0].pageUrl, "https://example.com/source-page");
    assert.equal(summary.counts?.visualAssets, 1);
  });

  it("keeps gap states as diagnostic warning without making incomplete discovery terminal", () => {
    const progress = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-curation",
      state: "warning",
      gaps: ["Could not verify latest pricing."],
      counts: { facts: 2, gaps: 1, rejectedMaterial: 3 },
    });

    assert.equal(progress.status, "active");
    assert.equal(progress.records.find((record) => record.phase === "web-curation")?.state, "warning");
  });

  it("keeps completed discovery with gaps as diagnostic warning after all phases finish", () => {
    const progress = [
      "web-decision",
      "web-collection",
      "web-curation",
      "visual-decision",
      "visual-collection",
      "visual-curation",
      "evidence-page-planning",
    ].reduce(
      (current, phase) => updateResearchDiscoveryPhase(current, {
        phase: phase as Parameters<typeof updateResearchDiscoveryPhase>[1]["phase"],
        state: phase === "web-curation" ? "warning" : "completed",
        gaps: phase === "web-curation" ? ["Could not verify latest pricing."] : undefined,
      }),
      createEmptyResearchDiscoveryProgress(),
    );

    assert.equal(progress.status, "warning");
    assert.equal(progress.records.find((record) => record.phase === "web-curation")?.state, "warning");
  });

  it("keeps aggregate status active while later Research Discovery phases are still running", () => {
    const withGap = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-curation",
      state: "warning",
      gaps: ["Could not verify latest pricing."],
    });
    const activeAfterGap = updateResearchDiscoveryPhase(withGap, {
      phase: "visual-decision",
      state: "active",
    });
    const completedOnePhase = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-decision",
      state: "completed",
    });

    assert.equal(activeAfterGap.status, "active");
    assert.equal(completedOnePhase.status, "active");
  });

  it("retains same-phase details across Research Discovery iterations", () => {
    const firstIteration = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-collection",
      state: "completed",
      iteration: 1,
      queries: [
        {
          kind: "web",
          query: "EV market share 2026",
          status: "collected",
          resultCount: 4,
          fetchCount: 2,
        },
      ],
      gaps: ["First gap"],
      counts: { gaps: 1 },
    });
    const secondIterationActive = updateResearchDiscoveryPhase(firstIteration, {
      phase: "web-collection",
      state: "active",
      iteration: 2,
    });
    const secondIteration = updateResearchDiscoveryPhase(secondIterationActive, {
      phase: "web-collection",
      state: "warning",
      iteration: 2,
      queries: [
        {
          kind: "web",
          query: "EV battery makers 2026",
          status: "gap",
          resultCount: 0,
          fetchCount: 0,
        },
      ],
      gaps: ["Second gap"],
      counts: { gaps: 1 },
    });

    const collection = secondIteration.records.find((record) => record.phase === "web-collection");
    assert.deepEqual(
      collection?.queries?.map((query) => query.query),
      ["EV market share 2026", "EV battery makers 2026"],
    );
    assert.deepEqual(collection?.gaps, ["First gap", "Second gap"]);
    assert.equal(collection?.counts?.gaps, 2);
  });

  it("merges completed deck-level curation stream snapshot into current-run Research Discovery progress", async () => {
    const progressEvents: unknown[] = [];
    const runtime = {
      locale: "en",
      workspace: { workspace_dir: "/tmp/workspace" },
      backend: {
        appendWorkspaceLog: async () => ({ workspace_dir: "/tmp/workspace", log_file: "log.jsonl", appended: true }),
      },
      aiLogger: null,
      activeStreams: new Map(),
      researchDiscoveryProgress: updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
        phase: "web-curation",
        state: "active",
      }),
      onProgress: (progress: unknown) => progressEvents.push(progress),
      getProgress: () => ({
        pages: [],
      }),
    };
    const tracker = createAgentRunTracker({
      flowInput: runtime as never,
      page: {
        page_id: "discovery-web-1",
        index: 0,
        title: "Discovery batch",
        outline: "",
        blueprint_id: "research-discovery",
        blueprint_source: "",
        slide_path: "",
        data_path: "",
        manifest_slide_id: "discovery-web-1",
        reason: "",
      },
      step: "research-curation",
      message: "Curating",
      totalPages: 2,
      progress: () => null,
      prompt: "prompt",
      kind: "web-research-curation",
    });

    for (let index = 0; index < 35; index += 1) {
      tracker.onStreamEvent({ type: "content", text: `line-${index}\n` });
    }
    for (let index = 0; index < 15; index += 1) {
      tracker.onStreamEvent({ type: "activity", message: `activity-${index}` });
    }
    await tracker.flush("completed", {});

    const curation = runtime.researchDiscoveryProgress.records.find((record) => record.phase === "web-curation");
    assert.equal(curation?.state, "completed");
    assert.equal(curation?.lines?.length, 30);
    assert.equal(curation?.activities?.length, 12);
    assert.equal(curation?.lines?.at(0), "line-6");
    assert.equal(curation?.activities?.at(0), "activity-3");
    assert.equal(progressEvents.some((event) => JSON.stringify(event).includes("researchDiscovery")), true);
  });

  it("restores Research Discovery details from durable page progress", () => {
    const researchDiscovery = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-curation",
      state: "completed",
      counts: { facts: 2 },
    });
    const projected = pageProgressToDeckGenerationProgress({
      status: "interrupted",
      research_discovery: researchDiscovery,
      pages: [
        {
          page_id: "page-01",
          index: 0,
          title: "Page",
          status: "interrupted",
          render_attempts: 0,
          visual_review_attempts: 0,
          content_review_attempts: 0,
          agent_failures: 0,
          agent_infrastructure_failures: 0,
          slide_path: "",
          data_path: "",
          last_html_path: "",
          last_screenshot_path: "",
          last_error: "",
          review: null,
          updated_at: null,
        },
      ],
      updated_at: null,
      recovery: {
        status: "interrupted",
        run_kind: "deck-generation",
        step: "research-discovery",
        target_page_ids: ["page-01"],
        page_refinement_request: null,
        page_refinement_requests: {},
        error: null,
        updated_at: null,
      },
    });

    assert.equal(projected.researchDiscovery?.records.find((record) => record.phase === "web-curation")?.counts?.facts, 2);
  });

  it("keeps current-run Research Discovery progress on terminal and final render progress events", () => {
    const researchDiscovery = updateResearchDiscoveryPhase(createEmptyResearchDiscoveryProgress(), {
      phase: "web-curation",
      state: "completed",
      counts: { facts: 1 },
    });
    const pageProgress = {
      status: "running",
      pages: [],
      updated_at: null,
    };

    for (const step of ["final-render", "complete", "failed", "cancelled"] as const) {
      const progress = createProgress(
        {
          step,
          message: step,
          currentPageIndex: null,
          totalPages: 0,
        },
        pageProgress,
        null,
        [],
        undefined,
        researchDiscovery,
      );

      assert.equal(progress.researchDiscovery?.records.find((record) => record.phase === "web-curation")?.counts?.facts, 1);
    }
  });
});
