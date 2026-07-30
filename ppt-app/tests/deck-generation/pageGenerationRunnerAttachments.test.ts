import assert from "node:assert/strict";
import test from "node:test";

import type { PageProgress } from "../../src/api/types.ts";
import { runPageGeneration } from "../../src/features/deck-generation/pageGenerationRunner.ts";
import type {
  AuthoringDeck,
  AuthoringPage,
  DeckGenerationRuntime,
} from "../../src/features/deck-generation/types.ts";

const visualReview = {
  pass: false,
  score: 5,
  image_description: "A slide with an overlapping content block.",
  issues: [{ problem: "overlap" }],
  revision_request: "Fix the overlap.",
  confidence: "high" as const,
};

const page: AuthoringPage = {
  page_id: "page-01",
  index: 0,
  title: "Title",
  outline: "Show the key point.",
  slide_path: "./slides/page-01.tsx",
};

const deck: AuthoringDeck = { title: "Deck", pages: [page] };

function createProgress(): PageProgress {
  return {
    version: 1,
    status: "active",
    pages: [{
      page_id: page.page_id,
      status: "visual_review_fixing",
      render_attempts: 0,
      visual_review_attempts: 1,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_html_path: "/tmp/workspace/output/page-01.html",
      last_screenshot_path: "/tmp/workspace/output/page-01.png",
      last_error: visualReview.revision_request,
      visual_review: visualReview,
      updated_at: "2026-07-27T00:00:00.000Z",
    }],
    updated_at: "2026-07-27T00:00:00.000Z",
  };
}

function createRuntime(input: {
  getPageEditContext?: () => Promise<unknown>;
} = {}) {
  let progress = createProgress();
  let agentRuns = 0;
  const backend = {
    uploadCurrentPageScreenshot: async () => {
      throw new Error("temporary upload failure");
    },
    getPageEditContext: input.getPageEditContext,
    recordPageProgress: async ({ page_id, patch }: { page_id?: string; patch: Record<string, unknown> }) => {
      progress = {
        ...progress,
        pages: progress.pages.map((item) => item.page_id === page_id ? { ...item, ...patch } : item),
      };
      return progress;
    },
  };
  const runtime = {
    backend,
    agentClient: {
      runAuthoringPrompt: async () => {
        agentRuns += 1;
        throw new Error("must not run");
      },
    },
    workspace: {
      workspace_dir: "/tmp/workspace",
      workspace_root: "/tmp",
      setting: {},
    },
    confirmedOutline: {
      title: "Deck",
      items: [{
        page_id: page.page_id,
        title: page.title,
        core_message: page.outline,
        required_content: page.outline,
      }],
    },
    locale: "zh",
    onProgress: () => undefined,
    isCancelled: () => false,
    activeStreams: new Map(),
    getProgress: () => progress,
    setProgress: (next: PageProgress) => {
      progress = next;
    },
  } as unknown as DeckGenerationRuntime;
  return { runtime, getProgress: () => progress, getAgentRuns: () => agentRuns };
}

test("visual-review-fix accepts the page when its existing screenshot cannot be uploaded", async () => {
  const harness = createRuntime();
  const result = await runPageGeneration(harness.runtime, deck, page);

  assert.equal(result.reason, "accepted");
  assert.equal(harness.getProgress().pages[0]?.status, "accepted");
  assert.deepEqual(harness.getProgress().pages[0]?.visual_review, visualReview);
  assert.match(harness.getProgress().pages[0]?.last_error ?? "", /temporary upload failure/);
  assert.equal(harness.getAgentRuns(), 0);
});

test("visual-review-fix accepts the page when refreshing a near-expiry screenshot fails", async () => {
  const harness = createRuntime({
    getPageEditContext: async () => ({
      manifest: null,
      screenshot_upload: {
        transport: "host_upload",
        r2_key: "uploads/page-01.png",
        url: "https://uploads.example/page-01.png",
        mime_type: "image/png",
        size_bytes: 1024,
        filename: "page-01.png",
        expires_in: 30,
      },
    }),
  });
  harness.runtime.refinementRequest = "Improve this page.";
  harness.runtime.pageRefinementReasons = { [page.page_id]: "Improve this page." };
  harness.runtime.pageRefinementVisualContexts = {
    [page.page_id]: { source: "progress", screenshotPath: "/tmp/workspace/output/page-01.png" },
  };

  const result = await runPageGeneration(harness.runtime, deck, page);

  assert.equal(result.reason, "accepted");
  assert.equal(harness.getProgress().pages[0]?.status, "accepted");
  assert.deepEqual(harness.getProgress().pages[0]?.visual_review, visualReview);
  assert.match(harness.getProgress().pages[0]?.last_error ?? "", /temporary upload failure/);
  assert.equal(harness.getAgentRuns(), 0);
});

test("page visual review accepts the rendered page without rewriting when the image is unavailable", async () => {
  let progress: PageProgress = {
    version: 1,
    status: "active",
    pages: [{
      page_id: page.page_id,
      status: "pending",
      render_attempts: 0,
      visual_review_attempts: 0,
      agent_failures: 0,
      agent_infrastructure_failures: 0,
      last_error: "",
      updated_at: "2026-07-27T00:00:00.000Z",
    }],
    updated_at: "2026-07-27T00:00:00.000Z",
  };
  let fingerprintReads = 0;
  let pageAuthoringRuns = 0;
  const runtime = {
    backend: {
      getWorkspacePageSourceFingerprint: async () => ({
        sha256: fingerprintReads++ === 0 ? "before" : "after",
        size_bytes: 1024,
      }),
      recordPageProgress: async ({ page_id, patch }: { page_id?: string; patch: Record<string, unknown> }) => {
        progress = {
          ...progress,
          pages: progress.pages.map((item) => item.page_id === page_id ? { ...item, ...patch } : item),
        };
        return progress;
      },
      renderWorkspacePagePreview: async () => ({
        html_path: "/tmp/workspace/output/page-01.html",
        screenshot_path: "/tmp/workspace/output/page-01.png",
      }),
      uploadCurrentPageScreenshot: async () => ({
        transport: "host_upload",
        r2_key: "uploads/page-01.png",
        url: "https://uploads.example/page-01.png",
        mime_type: "image/png",
        size_bytes: 1024,
        filename: "page-01.png",
        expires_in: 600,
      }),
    },
    agentClient: {
      runAuthoringPrompt: async () => {
        pageAuthoringRuns += 1;
        return {
          status: "ready_for_render",
          changed_files: [],
          files_read: [],
          authoring_kit_sources_read: [],
          summary: "authored",
          needs_render: true,
          notes: [],
        };
      },
      runPageVisualReviewPrompt: async () => ({
        pass: false,
        score: 0,
        image_description: "IMAGE_UNAVAILABLE",
        issues: [],
        revision_request: "",
        confidence: "low" as const,
      }),
    },
    workspace: {
      workspace_dir: "/tmp/workspace",
      workspace_root: "/tmp",
      setting: { visual_review_enabled: true },
    },
    confirmedOutline: {
      title: "Deck",
      items: [{
        page_id: page.page_id,
        title: page.title,
        core_message: page.outline,
        required_content: page.outline,
      }],
    },
    locale: "zh",
    onProgress: () => undefined,
    isCancelled: () => false,
    activeStreams: new Map(),
    getProgress: () => progress,
    setProgress: (next: PageProgress) => {
      progress = next;
    },
  } as unknown as DeckGenerationRuntime;

  const result = await runPageGeneration(runtime, deck, page);

  assert.equal(result.reason, "accepted");
  assert.equal(pageAuthoringRuns, 1);
  assert.equal(progress.pages[0]?.status, "accepted");
  assert.equal(
    (progress.pages[0]?.visual_review as { image_description?: string } | null)?.image_description,
    "IMAGE_UNAVAILABLE",
  );
  assert.match(progress.pages[0]?.last_error ?? "", /无法读取截图附件/);
});
