import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceOutline } from "../../src/api/types.ts";
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
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/authoring-kit\/presentation-principles\.md/);
    assert.match(prompt, /Agent file-tool absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620\/authoring-kit\/README\.md/);
    assert.match(prompt, /Current date \(Asia\/Shanghai\):/);
    assert.match(prompt, /默认演示身份是 ANNA AI/);
    assert.match(prompt, /file_path 是当前 Workspace 中已导入图片的绝对路径/);
    assert.match(prompt, /必须原样使用该 file_path/);
    assert.match(prompt, /不得改成相对路径、添加 \.\/ 或 \.\.\//);
    assert.match(prompt, /不得使用远程 image_url 或 thumbnail_url/);
    assert.match(prompt, /页面标题或副标题/);
    assert.match(prompt, /标题和副标题文字只是视觉示意/);
    assert.match(prompt, /不能复制参考文件中的示例文案/);
    assert.match(prompt, /人工页面修订/);
    assert.doesNotMatch(prompt, /Agent file-tool root:/);
    assert.doesNotMatch(prompt, /Agent file-tool path: ppt\//);
    assert.doesNotMatch(prompt, /Canonical absolute path/);
  });

  it("keeps local paths out of native-image visual review prompts", () => {
    const prompt = buildPageVisualReviewPrompt({
      page,
    });

    assert.match(prompt, /native image attachment/);
    assert.match(prompt, /title and subtitle/);
    assert.match(prompt, /foreground\/background contrast/);
    assert.match(prompt, /score of 6 or lower/);
    assert.match(prompt, /image_description/);
    assert.match(prompt, /IMAGE_UNAVAILABLE/);
    assert.doesNotMatch(prompt, /\{"pass":true/);
    assert.match(prompt, /Page id: page-02/);
    assert.doesNotMatch(prompt, /Screenshot path:/);
    assert.doesNotMatch(prompt, /Rendered HTML path:/);
    assert.doesNotMatch(prompt, /upload_local_file|analyze_image/);
  });

  it("keeps the absolute local-image contract in every page authoring round", () => {
    for (const attemptKind of ["initial", "page-refinement", "render-fix", "visual-review-fix"] as const) {
      const prompt = buildAuthoringPrompt({
        workspaceRoot,
        workspaceDir,
        page,
        authoringDeck,
        outline,
        attemptKind,
        ...(attemptKind === "render-fix" ? { renderError: "Render failed" } : {}),
      });

      assert.match(prompt, /file_path 是当前 Workspace 中已导入图片的绝对路径/);
      assert.match(prompt, /必须原样使用该 file_path/);
      assert.match(prompt, /不得改成相对路径、添加 \.\/ 或 \.\.\//);
    }
  });
});
