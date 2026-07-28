import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("shared research artifacts retain only reusable imported image assets", async () => {
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
    assert.deepEqual(prepared.image_catalog, { schema_version: 2, assets: [] });

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
    assert.equal(imported.file_path, path.join(workspace.workspace_dir, "research/evidence/images/candidate-1.png"));
    assert.equal(path.isAbsolute(imported.file_path), true);
    assert.equal((await stat(imported.file_path)).isFile(), true);

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
        sha256,
        mime_type: "image/png",
        bytes_size: imageBytes.length,
      }, {
        candidate_id: "candidate-rejected",
        query: "modern office",
        image_url: "https://example.com/rejected.png",
        source_url: "https://example.com/rejected",
        use_in_ppt: false,
        description: "An unrelated image.",
        reason: "Does not match the deck.",
        download_status: "pending" as const,
      }, {
        candidate_id: "candidate-import-failed",
        query: "modern office",
        image_url: "https://example.com/failed.png",
        source_url: "https://example.com/failed",
        use_in_ppt: true,
        description: "A selected image that could not be imported.",
        reason: "Matches the deck but is not locally reusable.",
        download_status: "failed" as const,
      }],
      gaps: [],
    };
    assert.equal((await appendAppImageResearchBatch({ workspace_dir: workspace.workspace_dir, batch })).appended, true);
    assert.equal((await appendAppImageResearchBatch({ workspace_dir: workspace.workspace_dir, batch })).appended, false);
    assert.equal((await appendAppImageResearchBatch({
      workspace_dir: workspace.workspace_dir,
      batch: {
        ...batch,
        title: "Refinement",
        candidates: [{
          ...batch.candidates[0],
          candidate_id: "candidate-same-content",
          query: "office interior",
          matched_queries: ["office interior"],
        }],
      },
    })).appended, true);

    const context = await getAppSharedResearchContext({ workspace_dir: workspace.workspace_dir });
    assert.deepEqual(context.image_catalog, {
      schema_version: 2,
      assets: [{
        asset_id: "candidate-1",
        file_path: imported.file_path,
        sha256,
        mime_type: "image/png",
        bytes_size: imageBytes.length,
        description: "A modern office.",
        reason: "Matches the deck.",
        matched_queries: ["modern office", "office interior"],
        source_url: "https://example.com/page",
      }],
    });
    assert.match(await readFile(context.web_summary_path, "utf8"), /Useful summary/);
  } finally {
    process.env.HOME = previousHome;
  }
});
