import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
} from "../../src/api/types.ts";
import type { AuthoringDeck, AuthoringPage } from "../../src/features/deck-generation/types.ts";
import {
  buildAuthoringPrompt,
  buildPageVisualReviewPrompt,
} from "../../src/features/deck-generation/prompts.ts";

const workspaceRoot = "/tmp/anna-workspace/ppt";
const workspaceDir = "/tmp/anna-workspace/ppt/ppt-20260630-152620";

const outline: WorkspaceOutline = {
  version: 3,
  title: "Demo Deck",
  output_language: "English",
  status: "confirmed",
  items: [{ title: "Intro", core_message: "Set context", required_content: "- Establish the context." }],
  source: {
    prompt: "make a deck",
    context: [],
    setting: { output_language: "English" },
  },
  updated_at: "2026-06-30T00:00:00.000Z",
  confirmed_at: "2026-06-30T00:00:00.000Z",
};

const page: AuthoringPage = {
  page_id: "page-02",
  index: 1,
  title: "Market facts",
  outline: "Use evidence",
  slide_path: "./slides/page-02.tsx",
};

const authoringDeck: AuthoringDeck = {
  title: "Demo Deck",
  pages: [page],
};

describe("Agent file-tool path prompt blocks", () => {
  it("adds absolute Agent file-tool paths to authoring prompts", () => {
    const prompt = buildAuthoringPrompt({
      workspaceRoot,
      workspaceDir,
      page,
      authoringDeck,
      outline,
      attemptKind: "initial",
    });

    assert.match(prompt, /Path handling for Agent tools:/);
    assert.match(prompt, /PPT task directory \(absolute\): \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/slides\/page-02\.tsx/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/requirements\.json/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/outline\.json/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/style-guide\.md/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/authoring-kit\/README\.md/);
    assert.doesNotMatch(prompt, /Agent file-tool root:/);
    assert.doesNotMatch(prompt, /Agent file-tool path: ppt\//);
    assert.doesNotMatch(prompt, /Canonical absolute path/);
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
      screenshot_path: `${workspaceDir}/output/page-02.png`,
      screenshot_upload: {
        transport: "host_upload",
        r2_key: "uploads/page-02.png",
        url: "https://upload.example/page-02.png",
        mime_type: "image/png",
        size_bytes: 1024,
        filename: "page-02.png",
        mode: "negotiate+confirm",
      },
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
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/output\/page-02\.png/);
    assert.match(prompt, /Rendered HTML path:/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/output\/page-02\.html/);
    assert.doesNotMatch(prompt, /Agent file-tool path: ppt\//);
  });
});
