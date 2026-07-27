import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("shared research artifacts append batches and keep image paths workspace-relative", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-shared-research-"));
  process.env.HOME = homeDir;
  const {
    appendAppImageResearchBatch,
    appendAppWebResearchBatch,
    createAppWorkspace,
    getAppSharedResearchContext,
    importAppSharedResearchImage,
    prepareAppSharedResearchWorkspace,
    recordAppSharedResearchProgress,
  } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Shared research" });
    const prepared = await prepareAppSharedResearchWorkspace({
      workspace_dir: workspace.workspace_dir,
      reset_progress: true,
    });
    assert.match(prepared.web_summary, /^# Web Research Summary/);
    assert.deepEqual(prepared.image_catalog, { schema_version: 1, batches: [] });

    const markdown = "## Research batch: Initial generation\n\nStatus: completed\n\nUseful summary.";
    assert.equal((await appendAppWebResearchBatch({ workspace_dir: workspace.workspace_dir, markdown })).appended, true);
    assert.equal((await appendAppWebResearchBatch({ workspace_dir: workspace.workspace_dir, markdown })).appended, false);

    const progress = await recordAppSharedResearchProgress({
      workspace_dir: workspace.workspace_dir,
      progress: { status: "running", stages: { web_decision: "completed" } },
    });
    assert.equal(progress.status, "running");

    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3i8AAAAASUVORK5CYII=",
      "base64",
    );
    const stagingPath = path.join(homeDir, "candidate.png");
    await writeFile(stagingPath, imageBytes);
    const sha256 = createHash("sha256").update(imageBytes).digest("hex");
    const imported = await importAppSharedResearchImage({
      workspace_dir: workspace.workspace_dir,
      candidate_id: "candidate-1",
      staging_file_path: stagingPath,
      mime_type: "image/png",
      expected_size_bytes: imageBytes.length,
      expected_sha256: sha256,
    });
    assert.equal(imported.file_path, "research/evidence/images/candidate-1.png");
    assert.equal((await stat(path.join(workspace.workspace_dir, imported.file_path))).isFile(), true);

    const batch = {
      title: "Initial generation",
      status: "completed" as const,
      queries: [{ query: "modern office", status: "completed" as const, candidate_count: 1 }],
      candidates: [{
        candidate_id: "candidate-1",
        query: "modern office",
        image_url: "https://example.com/image.png",
        source_url: "https://example.com/page",
        use_in_ppt: true,
        description: "A modern office.",
        reason: "Matches the deck.",
        download_status: "imported" as const,
        file_path: imported.file_path,
      }],
      gaps: [],
    };
    assert.equal((await appendAppImageResearchBatch({ workspace_dir: workspace.workspace_dir, batch })).appended, true);
    assert.equal((await appendAppImageResearchBatch({ workspace_dir: workspace.workspace_dir, batch })).appended, false);

    const context = await getAppSharedResearchContext({ workspace_dir: workspace.workspace_dir });
    assert.equal((context.image_catalog as { batches: unknown[] }).batches.length, 1);
    assert.match(await readFile(context.web_summary_path, "utf8"), /Useful summary/);
  } finally {
    process.env.HOME = previousHome;
  }
});
