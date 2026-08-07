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
  getAppExportArtifactPublishStatus,
  markAppExportArtifactPublishJobInterrupted,
  startAppExportArtifactPublish,
  writeAppExportArtifactPublishJob,
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

async function recordPptxArtifact(workspaceDir: string, pptxPath: string) {
  const taskPath = path.join(workspaceDir, "task.json");
  const task = JSON.parse(await readFile(taskPath, "utf8")) as {
    artifacts?: Record<string, unknown>;
  };
  await writeFile(taskPath, `${JSON.stringify({
    ...task,
    updated_at: new Date().toISOString(),
    artifacts: {
      ...(task.artifacts ?? {}),
      pptx: {
        path: pptxPath,
        updated_at: new Date().toISOString(),
      },
    },
  }, null, 2)}\n`);
}

test("Export Artifact Mirror uses a snapshot and becomes stale when the source changes", async () => {
  const created = await createAppWorkspace({ title: "Mirror test" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  const bytes = Buffer.from("pptx-v1");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  await recordPptxArtifact(created.workspace_dir, outputPath);

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
        scope: "user",
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
    assert.equal(mirror.scope, "user");
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
  await recordPptxArtifact(created.workspace_dir, outputPath);
  const snapshot = await createAppExportArtifactSnapshot({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 2));
    await writeFile(outputPath, "pptx-v2");
    await recordPptxArtifact(created.workspace_dir, outputPath);
    await assert.rejects(
      commitAppExportArtifactMirror({
        workspace_dir: created.workspace_dir,
        artifact_type: "pptx",
        expected_updated_at: snapshot.updated_at,
        expected_sha256: snapshot.source_sha256,
        mirror: {
          provider: "aps.files",
          scope: "user",
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

test("a legacy tool-scoped mirror is treated as missing", async () => {
  const created = await createAppWorkspace({ title: "Legacy mirror" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "pptx-v1");
  await recordPptxArtifact(created.workspace_dir, outputPath);
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
      scope: "tool",
      path: snapshot.mirror_path,
      etag: "legacy-etag",
      size_bytes: snapshot.size_bytes,
      content_type: snapshot.content_type,
      content_disposition: "attachment; filename=\"Legacy mirror.pptx\"",
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

test("Export Artifact Publish status is idle when no persisted job exists", async () => {
  const workspaceDir = path.join(isolatedWorkspaceRoot, "ppt-20260807-000001");
  const status = await getAppExportArtifactPublishStatus({
    workspace_dir: workspaceDir,
    artifact_type: "pptx",
  });

  assert.equal(status.status, "idle");
  assert.equal(status.job_id, "");
  assert.equal(status.percent, 0);
  assert.equal(status.status_path, path.join(workspaceDir, "output", "export-artifact-publish-pptx.json"));
});

test("Export Artifact Publish status persists normalized artifact metadata and marks interrupted jobs", async () => {
  const created = await createAppWorkspace({ title: "Publish status" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "pptx-publish-status");
  await recordPptxArtifact(created.workspace_dir, outputPath);

  const started = await startAppExportArtifactPublish({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  assert.equal(started.status, "queued");

  const persisted = JSON.parse(await readFile(started.status_path, "utf8")) as {
    artifact?: Record<string, unknown>;
  };
  assert.equal(persisted.artifact?.path, outputPath);
  assert.equal("snapshot_path" in (persisted.artifact ?? {}), false);
  assert.equal("content_type" in (persisted.artifact ?? {}), false);

  const loaded = await getAppExportArtifactPublishStatus({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  assert.equal(loaded.job_id, started.job_id);
  assert.equal(loaded.status, "queued");

  const interrupted = await markAppExportArtifactPublishJobInterrupted(loaded);
  assert.equal(interrupted.status, "failed");
  assert.equal(interrupted.error?.interrupted, true);
  assert.equal(interrupted.percent, 100);

  const afterRestart = await getAppExportArtifactPublishStatus({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  assert.equal(afterRestart.status, "failed");
  assert.equal(afterRestart.error?.interrupted, true);
});

test("a failed publish job can be restarted with a new job id", async () => {
  const created = await createAppWorkspace({ title: "Publish retry" });
  assertWorkspaceIsIsolated(created.workspace_dir);
  const outputPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "pptx-publish-retry");
  await recordPptxArtifact(created.workspace_dir, outputPath);

  const first = await startAppExportArtifactPublish({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });
  await writeAppExportArtifactPublishJob({
    ...first,
    status: "failed",
    message: "upload failed",
    percent: 100,
    completed_at: new Date().toISOString(),
    error: { message: "upload failed" },
  });
  const second = await startAppExportArtifactPublish({
    workspace_dir: created.workspace_dir,
    artifact_type: "pptx",
  });

  assert.equal(second.status, "queued");
  assert.notEqual(second.job_id, first.job_id);
});
