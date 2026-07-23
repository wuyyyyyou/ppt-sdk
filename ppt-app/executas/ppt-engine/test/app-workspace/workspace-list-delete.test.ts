import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("workspace summaries expose current Deck HTML availability and workspaces can be deleted", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-list-home-"));
  process.env.HOME = homeDir;
  const api = await import("../../src/app-workspace/index.ts");
  try {
    const created = await api.createAppWorkspace({ title: "List project" });
    await assert.rejects(access(path.join(created.workspace_dir, "setting.json")));

    let listed = await api.listAppWorkspaces();
    assert.equal(listed.workspaces[0]?.has_deck_html, false);

    const deckHtmlPath = path.join(created.workspace_dir, "output", "deck.html");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(deckHtmlPath), { recursive: true }));
    await writeFile(deckHtmlPath, "<!doctype html><title>Deck</title>", "utf8");
    const progressPath = path.join(created.workspace_dir, "page-progress.json");
    const progress = JSON.parse(await readFile(progressPath, "utf8"));
    progress.final_deck_render = {
      ...progress.final_deck_render,
      status: "completed",
      deck_html_path: deckHtmlPath,
      rendered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await writeFile(progressPath, JSON.stringify(progress), "utf8");

    listed = await api.listAppWorkspaces();
    assert.equal(listed.workspaces[0]?.has_deck_html, true);

    const deleted = await api.deleteAppWorkspace({ workspace_dir: created.workspace_dir });
    assert.equal(deleted.deleted, true);
    await assert.rejects(access(created.workspace_dir));
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});
