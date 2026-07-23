import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const previousHome = process.env.HOME;
const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-generation-run-home-"));
process.env.HOME = homeDir;
const api = await import("../../src/app-workspace/index.ts");

after(async () => {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(homeDir, { recursive: true, force: true });
});

test("generation run publishes a self-contained shadow Workspace atomically", async () => {
  const created = await api.createAppWorkspace({ title: "Shadow commit" });
  const markerPath = path.join(created.workspace_dir, "marker.json");
  await writeFile(markerPath, JSON.stringify({ root: created.workspace_dir, value: "old" }), "utf8");

  const transaction = await api.beginAppGenerationRun({
    workspace_dir: created.workspace_dir,
    run_kind: "deck-refinement",
    origin_page_id: "page-origin",
  });
  const prepared = await api.prepareAppGenerationRun({ run_id: transaction.run_id });
  assert.equal(prepared.transaction.state, "active");
  assert.ok(prepared.workspace);
  const shadowMarker = path.join(transaction.shadow_workspace_dir, "marker.json");
  assert.equal((await readFile(shadowMarker, "utf8")).includes(transaction.shadow_workspace_dir), true);
  await writeFile(shadowMarker, JSON.stringify({ root: transaction.shadow_workspace_dir, value: "new" }), "utf8");

  const committed = await api.commitAppGenerationRun({ run_id: transaction.run_id });
  assert.equal(committed.transaction.state, "committed");
  const published = JSON.parse(await readFile(markerPath, "utf8")) as { root: string; value: string };
  assert.equal(published.root, created.workspace_dir);
  assert.equal(published.value, "new");
  await api.cleanupAppGenerationRun({ run_id: transaction.run_id });
});

test("abandonment leaves the official Workspace unchanged", async () => {
  const created = await api.createAppWorkspace({ title: "Shadow abandon" });
  const markerPath = path.join(created.workspace_dir, "marker.txt");
  await writeFile(markerPath, "official", "utf8");
  const transaction = await api.beginAppGenerationRun({
    workspace_dir: created.workspace_dir,
    run_kind: "page-refinement",
  });
  await api.prepareAppGenerationRun({ run_id: transaction.run_id });
  await writeFile(path.join(transaction.shadow_workspace_dir, "marker.txt"), "shadow", "utf8");
  const abandoned = await api.abandonAppGenerationRun({ run_id: transaction.run_id });
  assert.equal(abandoned.state, "abandoned");
  assert.equal(await readFile(markerPath, "utf8"), "official");
  await api.cleanupAppGenerationRun({ run_id: transaction.run_id });
});

test("Workspace Diagnostic Bundle includes every on-disk generation run, including abandoned runs", async () => {
  const created = await api.createAppWorkspace({ title: "Shadow diagnostics" });
  const abandonedTransaction = await api.beginAppGenerationRun({
    workspace_dir: created.workspace_dir,
    run_kind: "deck-generation",
  });
  await api.prepareAppGenerationRun({ run_id: abandonedTransaction.run_id });
  await writeFile(path.join(abandonedTransaction.shadow_workspace_dir, "abandoned-only.txt"), "abandoned diagnostic", "utf8");
  await api.abandonAppGenerationRun({ run_id: abandonedTransaction.run_id });

  const activeTransaction = await api.beginAppGenerationRun({
    workspace_dir: created.workspace_dir,
    run_kind: "page-refinement",
  });
  await api.prepareAppGenerationRun({ run_id: activeTransaction.run_id });
  await writeFile(path.join(activeTransaction.shadow_workspace_dir, "active-only.txt"), "active diagnostic", "utf8");

  const otherWorkspace = await api.createAppWorkspace({ title: "Other workspace" });
  const otherTransaction = await api.beginAppGenerationRun({
    workspace_dir: otherWorkspace.workspace_dir,
    run_kind: "deck-generation",
  });
  await api.prepareAppGenerationRun({ run_id: otherTransaction.run_id });
  await writeFile(path.join(otherTransaction.shadow_workspace_dir, "other-only.txt"), "other diagnostic", "utf8");

  const bundle = await api.prepareAppWorkspaceDiagnosticBundle({ workspace_dir: created.workspace_dir });
  try {
    const bytes = await readFile(bundle.archive_path);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${abandonedTransaction.run_id}/transaction.json`)), true);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${abandonedTransaction.run_id}/shadow/${created.workspace_id}/abandoned-only.txt`)), true);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${activeTransaction.run_id}/transaction.json`)), true);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${activeTransaction.run_id}/shadow/${created.workspace_id}/active-only.txt`)), true);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${otherTransaction.run_id}/transaction.json`)), false);
    assert.equal(bytes.includes(Buffer.from(`generation-runs/${otherTransaction.run_id}/shadow/${otherWorkspace.workspace_id}/other-only.txt`)), false);
  } finally {
    await unlink(bundle.archive_path).catch(() => undefined);
    await api.cleanupAppGenerationRun({ run_id: abandonedTransaction.run_id });
    await api.abandonAppGenerationRun({ run_id: activeTransaction.run_id });
    await api.cleanupAppGenerationRun({ run_id: activeTransaction.run_id });
    await api.abandonAppGenerationRun({ run_id: otherTransaction.run_id });
    await api.cleanupAppGenerationRun({ run_id: otherTransaction.run_id });
  }
});
