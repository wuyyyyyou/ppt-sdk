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
  regeneratePerformanceReport,
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
        event({ event_type: "button.interaction", sequence_number: 3, span_id: undefined, operation_name: "button.interaction", interaction_delay_ms: 3.2, feedback_delay_ms: 18.5, attributes: { button_id: "brief.create-deck" } }),
        event({ event_type: "span.finished", sequence_number: 4, span_id: "span-requirements", operation_name: "requirements.create", duration_ms: 1_250, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 5, span_id: "span-generation", operation_name: "generation.run", duration_ms: 9_500, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 6, span_id: "span-research", operation_name: "research.run", duration_ms: 2_400, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 7, span_id: "span-page", operation_name: "page.generation", duration_ms: 4_800, status: "ok", attributes: { page_id: "page-01", page_index: 0 } }),
        event({ event_type: "span.finished", sequence_number: 8, span_id: "span-authoring", operation_name: "page.authoring", duration_ms: 3_100, status: "ok", attributes: { page_id: "page-01", page_index: 0 } }),
        event({ event_type: "span.finished", sequence_number: 9, span_id: "span-research", operation_name: "research.run", duration_ms: 3_500, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 10, span_id: "span-web-decision", operation_name: "research.web.decision", duration_ms: 500, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 11, span_id: "span-web-search-1", operation_name: "web.search", recorded_at: "2026-07-29T08:00:01.000Z", duration_ms: 1_000, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 12, span_id: "span-web-search-2", operation_name: "web.search", recorded_at: "2026-07-29T08:00:01.000Z", duration_ms: 1_000, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 13, span_id: "span-image-analysis", operation_name: "research.image.analysis", duration_ms: 1_600, status: "ok" }),
        event({ event_type: "span.finished", sequence_number: 14, span_id: "span-render-fix", operation_name: "page.render_fix", duration_ms: 900, status: "ok", attributes: { page_id: "page-01", page_index: 0 } }),
        event({ event_type: "span.finished", sequence_number: 15, span_id: "span-visual-review", operation_name: "page.visual_review", duration_ms: 700, status: "ok", attributes: { page_id: "page-01", page_index: 0 } }),
        event({ event_type: "span.finished", sequence_number: 16, span_id: "span-upload-1", operation_name: "host_upload", duration_ms: 1_000, status: "ok", attributes: { size_bytes: 1024 ** 2 } }),
        event({ event_type: "span.finished", sequence_number: 17, span_id: "span-upload-2", operation_name: "host_upload", duration_ms: 3_000, status: "ok", attributes: { size_bytes: 2 * 1024 ** 2 } }),
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
    assert.match(html, /耗时前 10 按钮/);
    assert.match(html, /创建 PPT/);
    assert.match(html, /PPT 创建流程/);
    assert.match(html, /演示需求创建/);
    assert.match(html, /生成过程分解/);
    assert.match(html, /研究过程/);
    assert.match(html, /Web 搜索调用/);
    assert.match(html, /图片 Session 判断/);
    assert.match(html, /墙钟耗时/);
    assert.match(html, /Web 搜索调用<\/strong><code>web\.search<\/code><\/td><td>2<\/td><td>1\.00s<\/td><td>2\.00s/);
    assert.match(html, /页面生成明细/);
    assert.match(html, /第 1 页/);
    assert.match(html, /渲染修复/);
    assert.match(html, /视觉检查/);
    assert.match(html, /上传性能/);
    assert.match(html, /总上传数据量/);
    assert.match(html, /3\.00 MB/);
    assert.match(html, /平均上传耗时<\/span><strong>2\.00s/);
    assert.match(html, /上传耗时 P95<\/span><strong>3\.00s/);
    assert.match(html, /最大上传耗时<\/span><strong>3\.00s/);
    assert.match(html, /技术诊断数据/);
    const eventsPath = path.join(rootDir, run.run_id, "events.jsonl");
    const eventsBeforeRegeneration = await readFile(eventsPath, "utf8");
    const endedAt = result.run.ended_at;
    const regenerated = await regeneratePerformanceReport({ root_dir: rootDir, run_id: run.run_id, locale: "en" });
    assert.equal(regenerated.status, "completed");
    assert.equal(regenerated.report_locale, "en");
    assert.equal(regenerated.ended_at, endedAt);
    assert.equal(await readFile(eventsPath, "utf8"), eventsBeforeRegeneration);
    const englishHtml = await readFile(report.report_path, "utf8");
    assert.match(englishHtml, /PPT Performance Report/);
    assert.match(englishHtml, /Upload performance/);
    assert.match(englishHtml, /Total uploaded data/);
    const listed = await listPerformanceRuns(rootDir);
    assert.equal(listed.runs.length, 1);
    assert.equal(listed.runs[0]?.event_count, 17);

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
