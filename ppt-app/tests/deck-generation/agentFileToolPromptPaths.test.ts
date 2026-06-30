import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PagePlan,
  PagePlanItem,
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
} from "../../src/api/types.ts";
import {
  buildAuthoringPrompt,
  buildPageContentReviewPrompt,
  buildPageVisualReviewPrompt,
} from "../../src/features/deck-generation/prompts.ts";

const workspaceRoot = "/tmp/anna-workspace/ppt";
const workspaceDir = "/tmp/anna-workspace/ppt/ppt-20260630-152620";

const outline: WorkspaceOutline = {
  version: 2,
  title: "Demo Deck",
  output_language: "English",
  status: "confirmed",
  items: [{ title: "Intro", outline: "Set context" }],
  source: {
    prompt: "make a deck",
    context: [],
    setting: { output_language: "English" },
  },
  updated_at: "2026-06-30T00:00:00.000Z",
};

const page: PagePlanItem = {
  page_id: "page-02",
  index: 1,
  title: "Market facts",
  outline: "Use evidence",
  blueprint_id: "simple",
  blueprint_source: "./blueprints/Simple.tsx",
  slide_path: "./slides/page-02.tsx",
  data_path: "./data/page-02.json",
  manifest_slide_id: "page-02",
  reason: "test",
};

const pagePlan: PagePlan = {
  version: 1,
  status: "planned",
  title: "Demo Deck",
  source: {
    outline_updated_at: outline.updated_at,
    template_group: "default",
    template_manifest_path: `${workspaceDir}/template/manifest.json`,
    generated_by: "test",
  },
  pages: [page],
  updated_at: "2026-06-30T00:00:00.000Z",
};

describe("Agent file-tool path prompt blocks", () => {
  it("adds path handling and Agent file-tool paths to authoring prompts", () => {
    const prompt = buildAuthoringPrompt({
      workspaceRoot,
      workspaceDir,
      page,
      pagePlan,
      outline,
      attemptKind: "initial",
    });

    assert.match(prompt, /Path handling for Agent tools:/);
    assert.match(prompt, /Agent file-tool root: \/tmp\/anna-workspace/);
    assert.match(prompt, /Current slide TSX Agent file-tool path: ppt\/ppt-20260630-152620\/template\/slides\/page-02\.tsx/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/research\/evidence\/pages\/page-02\.md/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/research\/evidence-index\.json/);
    assert.match(prompt, /"changed_files": \[\n    "template\/slides\/page-02\.tsx",\n    "template\/data\/page-02\.json"\n  \]/);
    assert.doesNotMatch(prompt, /"changed_files": \[\n    "ppt\/ppt-20260630-152620/);
  });

  it("adds Agent file-tool paths to content review prompts", () => {
    const prompt = buildPageContentReviewPrompt({
      workspaceRoot,
      workspaceDir,
      page,
      pagePlan,
      outline,
    });

    assert.match(prompt, /Path handling for Agent tools:/);
    assert.match(prompt, /Current data JSON:/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/template\/data\/page-02\.json/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/task\.json/);
  });

  it("adds Agent file-tool paths to visual review upload and fallback paths", () => {
    const preview: RenderWorkspacePagePreviewResult = {
      workspace_dir: workspaceDir,
      manifest_path: `${workspaceDir}/template/manifest.json`,
      page_index: 1,
      page_number: 2,
      slide_id: "page-02",
      layout_id: "simple",
      title: page.title,
      html_path: `${workspaceDir}/output/page-02.html`,
      preview_url: "http://localhost/page-02.html",
      screenshot_path: `${workspaceDir}/output/page-02.png`,
      rendered_at: "2026-06-30T00:00:00.000Z",
    };
    const prompt = buildPageVisualReviewPrompt({
      workspaceRoot,
      workspaceDir,
      page,
      screenshotPath: preview.screenshot_path,
      preview,
    });

    assert.match(prompt, /Screenshot path:/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/output\/page-02\.png/);
    assert.match(prompt, /Rendered HTML path:/);
    assert.match(prompt, /Agent file-tool path: ppt\/ppt-20260630-152620\/output\/page-02\.html/);
  });
});
