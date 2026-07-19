import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const previousHome = process.env.HOME;
const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-export-mirror-home-"));
process.env.HOME = homeDir;
const {
  commitAppExportArtifactMirror,
  createAppExportArtifactSnapshot,
  createAppWorkspace,
  getAppExportArtifactMirrorStatus,
  recordAppPptxExport,
} = await import("../../src/app-workspace/index.js");
const isolatedWorkspaceRoot = path.join(homeDir, "anna-workspace", "ppt");

after(async () => {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(homeDir, { recursive: true, force: true });
});

function assertWorkspaceIsIsolated(workspaceDir: string) {
  const relativePath = path.relative(isolatedWorkspaceRoot, workspaceDir);
  assert.ok(
    relativePath.length > 0 &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath),
    `Expected test Workspace under ${isolatedWorkspaceRoot}, received ${workspaceDir}`,
  );
}

test("Export Artifact Mirror uses a snapshot and becomes stale when the source changes", async () => {
  const created = await createAppWorkspace({ title: "Mirror test" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  const bytes = Buffer.from("pptx-v1");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  await recordAppPptxExport({
    workspace_dir: created.workspace_dir,
    pptx_path: outputPath,
  });

  assert.equal((await getAppExportArtifactMirrorStatus({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  })).status, "missing");

  const snapshot = await createAppExportArtifactSnapshot({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  try {
    assert.equal(snapshot.source_sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(snapshot.mirror_path, `workspaces/${created.workspace_id}/exports/current.pptx`);

    const mirror = await commitAppExportArtifactMirror({
      workspace_dir: created.workspace_dir,
      artifact_type: "pptx",
      expected_updated_at: snapshot.updated_at,
      expected_sha256: snapshot.source_sha256,
      mirror: {
        provider: "aps.files",
        scope: "app",
        path: snapshot.mirror_path,
        etag: "etag-1",
        size_bytes: snapshot.size_bytes,
        content_type: snapshot.content_type,
        content_disposition: "attachment; filename=\"Mirror test.pptx\"",
        source_updated_at: snapshot.updated_at,
        source_sha256: snapshot.source_sha256,
        published_at: new Date().toISOString(),
      },
    });
    assert.equal(mirror.scope, "app");
    assert.equal((await getAppExportArtifactMirrorStatus({
      workspace_dir: created.workspace_dir,
      artifact_type: "pptx",
    })).status, "ready");

    await writeFile(outputPath, "pptx-v2");
    const stale = await getAppExportArtifactMirrorStatus({
      workspace_dir: created.workspace_dir,
      artifact_type: "pptx",
    });
    assert.equal(stale.status, "stale");
    assert.equal(stale.reason, "source_hash_changed");
  } finally {
    await unlink(snapshot.snapshot_path).catch(() => undefined);
  }
});

test("an older snapshot cannot be committed after a newer export is recorded", async () => {
  const created = await createAppWorkspace({ title: "Mirror conflict" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "pptx-v1");
  await recordAppPptxExport({ workspace_dir: created.workspace_dir, pptx_path: outputPath });
  const snapshot = await createAppExportArtifactSnapshot({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 2));
    await writeFile(outputPath, "pptx-v2");
    await recordAppPptxExport({ workspace_dir: created.workspace_dir, pptx_path: outputPath });
    await assert.rejects(
      commitAppExportArtifactMirror({
        workspace_dir: created.workspace_dir,
        artifact_type: "pptx",
        expected_updated_at: snapshot.updated_at,
        expected_sha256: snapshot.source_sha256,
        mirror: {
          provider: "aps.files",
          scope: "app",
          path: snapshot.mirror_path,
          etag: "old-etag",
          size_bytes: snapshot.size_bytes,
          content_type: snapshot.content_type,
          content_disposition: "attachment; filename=\"Mirror conflict.pptx\"",
          source_updated_at: snapshot.updated_at,
          source_sha256: snapshot.source_sha256,
          published_at: new Date().toISOString(),
        },
      }),
      /Export artifact changed/,
    );
  } finally {
    await unlink(snapshot.snapshot_path).catch(() => undefined);
  }
});

test("a legacy mirror without attachment disposition is treated as missing", async () => {
  const created = await createAppWorkspace({ title: "Legacy mirror" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "pptx-v1");
  await recordAppPptxExport({ workspace_dir: created.workspace_dir, pptx_path: outputPath });
  const snapshot = await createAppExportArtifactSnapshot({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  try {
    const taskPath = path.join(created.workspace_dir, "task.json");
    const task = JSON.parse(await readFile(taskPath, "utf8")) as {
      artifacts: { pptx: Record<string, unknown> };
    };
    task.artifacts.pptx.mirror = {
      provider: "aps.files",
      scope: "app",
      path: snapshot.mirror_path,
      etag: "legacy-etag",
      size_bytes: snapshot.size_bytes,
      content_type: snapshot.content_type,
      source_updated_at: snapshot.updated_at,
      source_sha256: snapshot.source_sha256,
      published_at: new Date().toISOString(),
    };
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`);

    const status = await getAppExportArtifactMirrorStatus({
      workspace_dir: created.workspace_dir,
      artifact_type: "pptx",
    });
    assert.equal(status.status, "missing");
    assert.equal(status.reason, "mirror_missing");
  } finally {
    await unlink(snapshot.snapshot_path).catch(() => undefined);
  }
});
