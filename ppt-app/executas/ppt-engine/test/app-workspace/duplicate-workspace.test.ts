import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("duplicating a workspace produces an independent copy with its own identity", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-duplicate-home-"));
  process.env.HOME = homeDir;
  const api = await import("../../src/app-workspace/index.ts");
  try {
    const source = await api.createAppWorkspace({ title: "季度复盘" });

    // Export artifact, log and progress state all belong to the source and must
    // survive the copy, with recorded paths pointing at the new Workspace.
    const pptxPath = path.join(source.workspace_dir, "output", "deck.pptx");
    await mkdir(path.dirname(pptxPath), { recursive: true });
    await writeFile(pptxPath, "pptx-bytes", "utf8");
    const logPath = path.join(source.workspace_dir, "logs", "run.log");
    await mkdir(path.dirname(logPath), { recursive: true });
    await writeFile(logPath, `run recorded in ${source.workspace_dir}\n`, "utf8");

    const progressPath = path.join(source.workspace_dir, "page-progress.json");
    const progress = JSON.parse(await readFile(progressPath, "utf8"));
    progress.final_deck_render = {
      ...progress.final_deck_render,
      status: "completed",
      deck_html_path: path.join(source.workspace_dir, "output", "deck.html"),
    };
    await writeFile(progressPath, JSON.stringify(progress), "utf8");

    const copy = await api.duplicateAppWorkspace({
      workspace_dir: source.workspace_dir,
      title: "季度复盘 副本",
    });

    assert.notEqual(copy.workspace_id, source.workspace_id);
    assert.notEqual(copy.workspace_dir, source.workspace_dir);
    assert.equal(copy.source_workspace_id, source.workspace_id);
    assert.equal(copy.title, "季度复盘 副本");

    const copiedTask = JSON.parse(await readFile(path.join(copy.workspace_dir, "task.json"), "utf8"));
    assert.equal(copiedTask.id, copy.workspace_id);
    assert.equal(copiedTask.task_id, copy.workspace_id);
    assert.equal(copiedTask.title, "季度复盘 副本");
    assert.equal(copiedTask.workspace_dir, copy.workspace_dir);
    assert.equal(copiedTask.duplicated_from, source.workspace_id);

    const copiedPptx = await readFile(path.join(copy.workspace_dir, "output", "deck.pptx"), "utf8");
    assert.equal(copiedPptx, "pptx-bytes");

    const copiedLog = await readFile(path.join(copy.workspace_dir, "logs", "run.log"), "utf8");
    assert.ok(copiedLog.includes(copy.workspace_dir));

    const copiedProgress = await readFile(path.join(copy.workspace_dir, "page-progress.json"), "utf8");
    assert.ok(copiedProgress.includes(copy.workspace_dir));
    assert.ok(!copiedProgress.includes(source.workspace_dir));

    const listed = await api.listAppWorkspaces();
    const ids = listed.workspaces.map((workspace) => workspace.workspace_id);
    assert.ok(ids.includes(source.workspace_id));
    assert.ok(ids.includes(copy.workspace_id));

    // Independence: editing the copy must not reach back into the source.
    await api.updateAppWorkspaceTitle({ workspace_dir: copy.workspace_dir, title: "只改副本" });
    const sourceTask = JSON.parse(await readFile(path.join(source.workspace_dir, "task.json"), "utf8"));
    assert.equal(sourceTask.title, "季度复盘");
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("duplicating falls back to a copy suffix and refuses an active generation run", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-duplicate-guard-home-"));
  process.env.HOME = homeDir;
  const api = await import("../../src/app-workspace/index.ts");
  try {
    const source = await api.createAppWorkspace({ title: "Quarterly review" });

    const copy = await api.duplicateAppWorkspace({ workspace_dir: source.workspace_dir });
    assert.equal(copy.title, "Quarterly review (Copy)");

    const run = await api.beginAppGenerationRun({
      workspace_dir: source.workspace_dir,
      run_kind: "deck-generation",
    });
    await api.prepareAppGenerationRun({ run_id: run.run_id });

    await assert.rejects(
      api.duplicateAppWorkspace({ workspace_dir: source.workspace_dir }),
      /active generation run/i,
    );
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});
