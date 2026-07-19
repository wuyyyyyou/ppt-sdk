import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const previousHome = process.env.HOME;
const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-refinement-home-"));
process.env.HOME = homeDir;
const { commitAppDeckRefinement, prepareAppPageRefinement } = await import("../../src/app-workspace/index.ts");
const PAGE_ONE = "page-11111111-1111-4111-8111-111111111111";
const PAGE_TWO = "page-22222222-2222-4222-8222-222222222222";
after(async () => {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(homeDir, { recursive: true, force: true });
});

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createWorkspace(homeDir: string) {
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", `ppt-20260719-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`);
  await mkdir(path.join(workspaceDir, "slides"), { recursive: true });
  await writeJson(path.join(workspaceDir, "task.json"), { title: "Deck", updated_at: null });
  await writeJson(path.join(workspaceDir, "setting.json"), {});
  await writeJson(path.join(workspaceDir, "requirements.json"), {
    version: 1,
    status: "confirmed",
    source: { brief: "Build a deck" },
    candidates: { audience: [], purpose: [], desired_outcome: [], slide_count: [2], output_language: ["中文"], visual_tone: [] },
    selections: {
      audience: { label: "管理层", description: "经营管理层" },
      purpose: { label: "复盘", description: "复盘经营表现" },
      desired_outcome: { label: "决策", description: "形成下一步决策" },
      slide_count: 2,
      output_language: "中文",
      visual_tone: { label: "专业", description: "专业清晰" },
    },
    updated_at: "2026-07-19T00:00:00.000Z",
    confirmed_at: "2026-07-19T00:00:00.000Z",
  });
  const outline = {
    version: 3,
    title: "Deck",
    status: "confirmed",
    items: [
      { page_id: PAGE_ONE, title: "One", core_message: "First", required_content: "- A" },
      { page_id: PAGE_TWO, title: "Two", core_message: "Second", required_content: "- B" },
    ],
    updated_at: "2026-07-19T00:00:00.000Z",
    confirmed_at: "2026-07-19T00:00:00.000Z",
  };
  await writeJson(path.join(workspaceDir, "outline.json"), outline);
  await writeFile(path.join(workspaceDir, "style-guide.md"), "# Style\nUse blue.\n", "utf8");
  await writeFile(path.join(workspaceDir, "slides", `${PAGE_ONE}.tsx`), "export default function Page(){return <div>one</div>}\n", "utf8");
  await writeFile(path.join(workspaceDir, "slides", `${PAGE_TWO}.tsx`), "export default function Page(){return <div>two</div>}\n", "utf8");
  await writeJson(path.join(workspaceDir, "manifest.json"), { version: 1, title: "Deck", slides: [
    { id: PAGE_ONE, source: `./slides/${PAGE_ONE}.tsx` },
    { id: PAGE_TWO, source: `./slides/${PAGE_TWO}.tsx` },
  ] });
  await writeJson(path.join(workspaceDir, "page-progress.json"), {
    version: 1,
    status: "completed",
    recovery: { status: "completed", run_kind: "final-deck-render", step: "complete", target_page_ids: [], refinement_request: null, page_refinement_reasons: {}, error: null, updated_at: null },
    final_deck_render: { status: "completed", message: null, error: null, output_dir: null, deck_html_path: null, rendered_at: null, updated_at: null },
    pages: [
      { page_id: PAGE_ONE, status: "accepted", render_attempts: 1, visual_review_attempts: 1, agent_failures: 0, agent_infrastructure_failures: 0, last_html_path: "/tmp/one.html", last_screenshot_path: "/tmp/one.png", last_error: "", visual_review: null, updated_at: null },
      { page_id: PAGE_TWO, status: "accepted", render_attempts: 1, visual_review_attempts: 1, agent_failures: 0, agent_infrastructure_failures: 0, last_html_path: "/tmp/two.html", last_screenshot_path: "/tmp/two.png", last_error: "", visual_review: null, updated_at: null },
    ],
    updated_at: null,
  });
  await writeJson(path.join(workspaceDir, "pages.json"), { version: 1, status: "rendered", pages: [], updated_at: null });
  return { workspaceDir, outline };
}

test("Page Refinement resets only the target while preserving its visual baseline and deck authorities", async () => {
  {
    const { workspaceDir } = await createWorkspace(homeDir);
    const outlineBefore = await readFile(path.join(workspaceDir, "outline.json"), "utf8");
    const styleBefore = await readFile(path.join(workspaceDir, "style-guide.md"), "utf8");
    const manifestBefore = await readFile(path.join(workspaceDir, "manifest.json"), "utf8");
    const result = await prepareAppPageRefinement({ workspace_dir: workspaceDir, page_id: PAGE_ONE, refinement_request: "Make it clearer" });
    assert.equal(result.progress.pages[0]?.status, "pending");
    assert.equal(result.progress.pages[0]?.last_screenshot_path, "/tmp/one.png");
    assert.equal(result.progress.pages[1]?.status, "accepted");
    assert.equal(result.progress.recovery.refinement_request, "Make it clearer");
    assert.deepEqual(result.progress.recovery.page_refinement_reasons, { [PAGE_ONE]: "Make it clearer" });
    assert.deepEqual(JSON.parse(await readFile(path.join(workspaceDir, "outline.json"), "utf8")), JSON.parse(outlineBefore));
    assert.equal(await readFile(path.join(workspaceDir, "style-guide.md"), "utf8"), styleBefore);
    assert.equal(await readFile(path.join(workspaceDir, "manifest.json"), "utf8"), manifestBefore);
  }
});

test("Deck Refinement commits ordered keep/update/add/delete operations and targets only changed pages", async () => {
  {
    const { workspaceDir } = await createWorkspace(homeDir);
    const result = await commitAppDeckRefinement({
      workspace_dir: workspaceDir,
      refinement_request: "Reorder, update, add, and delete",
      title: "Refined Deck",
      output_language_change: { changed: false },
      style_guide_action: "preserve",
      operations: [
        { op: "update", page_id: PAGE_TWO, title: "Updated", core_message: "Updated message", required_content: ["Updated content"], reason: "Needs revision" },
        { op: "add", title: "New", core_message: "New message", required_content: ["New content"], reason: "Add support" },
        { op: "delete", page_id: PAGE_ONE, reason: "Remove it" },
      ],
    });
    assert.deepEqual(result.outline.items.map((item) => item.title), ["Updated", "New"]);
    assert.deepEqual(result.target_page_ids.sort(), [PAGE_TWO, result.added_page_ids[0]!].sort());
    assert.deepEqual(result.deleted_page_ids, [PAGE_ONE]);
    assert.equal(result.progress.pages.find((page) => page.page_id === PAGE_TWO)?.last_screenshot_path, "/tmp/two.png");
    const manifest = JSON.parse(await readFile(path.join(workspaceDir, "manifest.json"), "utf8")) as { slides: Array<{ id: string }> };
    assert.deepEqual(manifest.slides.map((slide) => slide.id), result.outline.items.map((item) => item.page_id));
  }
});

test("Deck-wide language and Style Guide changes target every retained page", async () => {
  const { workspaceDir } = await createWorkspace(homeDir);
  const replacement = Buffer.from("# New Style\nUse a dark editorial direction.\n", "utf8");
  const stagingPath = path.join(workspaceDir, "replacement-style-guide.md");
  await writeFile(stagingPath, replacement);
  const result = await commitAppDeckRefinement({
    workspace_dir: workspaceDir,
    refinement_request: "Use English and a dark editorial direction",
    title: "Deck",
    output_language_change: { changed: true, output_language: "English" },
    style_guide_action: "regenerate",
    style_guide_staging_file_path: stagingPath,
    style_guide_expected_size_bytes: replacement.length,
    operations: [
      { op: "keep", page_id: PAGE_ONE, reason: "Translate and restyle" },
      { op: "keep", page_id: PAGE_TWO, reason: "Translate and restyle" },
    ],
  });
  assert.deepEqual(new Set(result.target_page_ids), new Set([PAGE_ONE, PAGE_TWO]));
  assert.equal(await readFile(path.join(workspaceDir, "style-guide.md"), "utf8"), replacement.toString("utf8"));
  const requirements = JSON.parse(await readFile(path.join(workspaceDir, "requirements.json"), "utf8")) as { selections: { output_language: string; slide_count: number } };
  assert.equal(requirements.selections.output_language, "English");
  assert.equal(requirements.selections.slide_count, 2);
});
