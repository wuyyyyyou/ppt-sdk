import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function createWorkspaceDir(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return path.join(homeDir, "anna-workspace", "ppt", "tasks", `ppt-20260601-${suffix}`);
}

test("PPTX export status reads fixed status file and fails an interrupted job", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-pptx-status-home-"));
  process.env.HOME = homeDir;

  const {
    getAppExportArtifact,
    getAppPptxExportStatus,
    startAppPptxExport,
  } = await import("../../src/app-workspace/index.ts");
  const idleWorkspaceDir = createWorkspaceDir(homeDir);
  const runningWorkspaceDir = createWorkspaceDir(homeDir);
  const statusPath = path.join(runningWorkspaceDir, "output", "pptx-export.json");
  const artifactWorkspaceDir = createWorkspaceDir(homeDir);
  const artifactPath = path.join(artifactWorkspaceDir, "output", "deck.pptx");

  try {
    const idleStatus = await getAppPptxExportStatus({
      workspace_dir: idleWorkspaceDir,
    });

    assert.equal(idleStatus.status, "idle");
    assert.equal(idleStatus.job_id, "");
    assert.equal(idleStatus.status_path, path.join(idleWorkspaceDir, "output", "pptx-export.json"));
    assert.equal(idleStatus.pptx_path, path.join(idleWorkspaceDir, "output", "deck.pptx"));

    await assert.rejects(
      readFile(path.join(idleWorkspaceDir, "task.json"), "utf8"),
      /ENOENT/,
    );

    await writeJson(statusPath, {
      version: 2,
      job_id: "existing-job",
      status: "queued",
      message: "Already running",
      percent: 25,
      workspace_dir: runningWorkspaceDir,
      status_path: statusPath,
      output_dir: path.join(runningWorkspaceDir, "output"),
      deck_html_path: "",
      pptx_path: path.join(runningWorkspaceDir, "output", "deck.pptx"),
      started_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:01.000Z",
      completed_at: null,
      error: null,
      warning_count: 0,
    });

    const runningStatus = await startAppPptxExport({
      workspace_dir: runningWorkspaceDir,
    });

    assert.equal(runningStatus.status, "queued");
    assert.notEqual(runningStatus.job_id, "existing-job");

    const persisted = await readJson<{ job_id: string; status: string }>(statusPath);
    assert.equal(persisted.job_id, runningStatus.job_id);
    assert.equal(persisted.status, "queued");

    await writeJson(path.join(artifactWorkspaceDir, "task.json"), {
      title: '数字人民币 / 行业:报告?',
      updated_at: "2026-06-01T00:00:00.000Z",
      artifacts: {
        pptx: {
          path: artifactPath,
          updated_at: "2026-06-01T00:01:00.000Z",
        },
      },
    });
    await writeJson(path.join(artifactWorkspaceDir, "setting.json"), {});
    await writeJson(path.join(artifactWorkspaceDir, "outline.json"), {
      version: 2,
      title: "Fixture",
      status: "confirmed",
      items: [],
      source: { prompt: "", context: [], setting: {} },
      updated_at: null,
    });
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, "pptx-bytes", "utf8");

    const artifact = await getAppExportArtifact({
      workspace_dir: artifactWorkspaceDir,
      artifact_type: "pptx",
    });

    assert.equal(artifact.path, artifactPath);
    assert.equal(artifact.artifact_type, "pptx");
    assert.equal(artifact.filename, "数字人民币 行业 报告.pptx");
    assert.equal(artifact.updated_at, "2026-06-01T00:01:00.000Z");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
