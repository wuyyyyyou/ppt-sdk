import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import {
  appendPerformanceEvents,
  deletePerformanceRun,
  finalizePerformanceRun,
  getActivePerformanceRun,
  getPerformanceReportPath,
  listPerformanceRuns,
  startPerformanceRun,
  type PerformanceEvent,
} from "../../src/performance-runs/index.ts";

function event(input: Partial<PerformanceEvent> & Pick<PerformanceEvent, "event_type" | "sequence_number">): PerformanceEvent {
  return {
    schema_version: 1,
    event_id: crypto.randomUUID(),
    recorded_at: new Date().toISOString(),
    producer_id: "test-producer",
    trace_id: "trace-12345678",
    span_id: "span-12345678",
    operation_name: "workspace.create",
    ...input,
  };
}

test("Performance Run persists append-only events and generates a report", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ppt-performance-runs-"));
  try {
    const run = await startPerformanceRun({ root_dir: rootDir, app_version: "test", initial_settings: { concurrency: 2 } });
    assert.equal(run.status, "recording");
    assert.equal((await getActivePerformanceRun(rootDir))?.run_id, run.run_id);
    await rm(path.join(rootDir, "active-run.json"), { force: true });
    assert.equal((await getActivePerformanceRun(rootDir))?.run_id, run.run_id, "the sole active run should recover its pointer");
    await assert.rejects(() => startPerformanceRun({ root_dir: rootDir }), /already active/);

    await appendPerformanceEvents({
      root_dir: rootDir,
      run_id: run.run_id,
      events: [
        event({ event_type: "span.started", sequence_number: 1 }),
        event({ event_type: "span.finished", sequence_number: 2, duration_ms: 42.5, status: "ok" }),
      ],
    });
    const result = await finalizePerformanceRun({ root_dir: rootDir, run_id: run.run_id, locale: "zh" });
    assert.equal(result.requires_force, false);
    assert.equal(result.run.status, "completed");
    assert.equal(result.run.report_locale, "zh");
    assert.equal(await getActivePerformanceRun(rootDir), null);

    const report = await getPerformanceReportPath({ root_dir: rootDir, run_id: run.run_id });
    const html = await readFile(report.report_path, "utf8");
    assert.match(html, /PPT 性能测试报告/);
    assert.match(html, /workspace\.create/);
    const listed = await listPerformanceRuns(rootDir);
    assert.equal(listed.runs.length, 1);
    assert.equal(listed.runs[0]?.event_count, 2);

    assert.deepEqual(await deletePerformanceRun({ root_dir: rootDir, run_id: run.run_id }), {
      deleted: true,
      run_id: run.run_id,
    });
    assert.equal((await listPerformanceRuns(rootDir)).runs.length, 0);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("concurrent starts create exactly one active Performance Run", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ppt-performance-concurrent-start-"));
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => startPerformanceRun({ root_dir: rootDir })),
    );
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 7);
    for (const result of rejected) {
      assert.match(String(result.reason), /already active/);
    }

    const listed = await listPerformanceRuns(rootDir);
    assert.equal(listed.runs.length, 1);
    assert.equal(listed.active_run?.run_id, fulfilled[0]?.value.run_id);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("a lock left by a dead process does not block a new Performance Run", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ppt-performance-stale-lock-"));
  try {
    const lockDir = path.join(rootDir, ".active-run.lock");
    await mkdir(lockDir);
    await writeFile(path.join(lockDir, "owner.json"), `${JSON.stringify({
      owner_id: crypto.randomUUID(),
      pid: 2_147_483_647,
      acquired_at: new Date().toISOString(),
    })}\n`, "utf8");

    const run = await startPerformanceRun({ root_dir: rootDir });
    assert.equal(run.status, "recording");
    assert.equal((await getActivePerformanceRun(rootDir))?.run_id, run.run_id);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("unfinished spans require explicit force and are reported as interrupted", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ppt-performance-force-"));
  try {
    const run = await startPerformanceRun({ root_dir: rootDir });
    await appendPerformanceEvents({
      root_dir: rootDir,
      run_id: run.run_id,
      events: [event({ event_type: "span.started", sequence_number: 1 })],
    });
    const warning = await finalizePerformanceRun({ root_dir: rootDir, run_id: run.run_id, locale: "en" });
    assert.equal(warning.requires_force, true);
    assert.equal(warning.active_span_count, 1);
    assert.equal(warning.run.status, "recording");

    const forced = await finalizePerformanceRun({ root_dir: rootDir, run_id: run.run_id, locale: "en", force: true });
    assert.equal(forced.run.status, "completed");
    const eventsPath = path.join(rootDir, run.run_id, "events.jsonl");
    assert.match(await readFile(eventsPath, "utf8"), /"status":"interrupted"/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
