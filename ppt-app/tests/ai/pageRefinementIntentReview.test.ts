import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthoringPrompt } from "../../src/features/deck-generation/prompts.ts";

test("Page Refinement sends the user request, reason, Outline, Style Guide, TSX, and visual baseline to every authoring round", () => {
  const prompt = buildAuthoringPrompt({
    workspaceDir: "/tmp/workspace",
    page: { page_id: "page-1", index: 0, title: "现状", outline: "收入增长", slide_path: "./slides/page-1.tsx" },
    authoringDeck: { title: "经营复盘", pages: [{ page_id: "page-1", index: 0, title: "现状", outline: "收入增长", slide_path: "./slides/page-1.tsx" }] },
    outline: { version: 3, title: "经营复盘", status: "confirmed", items: [], updated_at: null, confirmed_at: null },
    attemptKind: "render-fix",
    renderError: "TypeScript failed",
    refinementRequest: "改成更强的结论页",
    refinementReason: "This page needs a stronger executive conclusion.",
    refinementVisualContext: { source: "progress", screenshotPath: "/tmp/workspace/output/before.png" },
  });
  assert.match(prompt, /改成更强的结论页/);
  assert.match(prompt, /stronger executive conclusion/);
  assert.match(prompt, /outline\.json/);
  assert.match(prompt, /style-guide\.md/);
  assert.match(prompt, /slides\/page-1\.tsx/);
  assert.match(prompt, /before\.png/);
  assert.match(prompt, /TypeScript failed/);
  assert.match(prompt, /只执行用户本次要求/);
  assert.match(prompt, /不得从截图推断或补造事实/);
});
