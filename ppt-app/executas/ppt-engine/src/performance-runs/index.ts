import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";

export type PerformanceRunStatus =
  | "recording"
  | "finalizing"
  | "completed"
  | "finalization_failed"
  | "abandoned";

export type PerformanceDataIntegrity = "complete" | "degraded";

export interface PerformanceContext {
  run_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name?: string;
  workspace_id?: string;
}

export interface PerformanceEvent {
  schema_version: 1;
  event_id: string;
  event_type: "span.started" | "span.finished" | "button.interaction" | "data.loss";
  recorded_at: string;
  producer_id: string;
  sequence_number: number;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  operation_name?: string;
  workspace_id?: string;
  duration_ms?: number;
  interaction_delay_ms?: number;
  feedback_delay_ms?: number;
  status?: "ok" | "error" | "interrupted";
  attributes?: Record<string, string | number | boolean | null>;
}

export interface PerformanceRunRecord {
  schema_version: 1;
  run_id: string;
  status: PerformanceRunStatus;
  data_integrity: PerformanceDataIntegrity;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  report_locale: "en" | "zh" | null;
  report_status: "not_generated" | "generated" | "failed";
  report_error: string | null;
  app_version: string;
  environment: Record<string, string | number | boolean | null>;
  initial_settings: Record<string, unknown>;
  event_count: number;
  dropped_event_count: number;
}

export interface PerformanceRunSummary extends PerformanceRunRecord {
  run_dir: string;
  report_available: boolean;
}

export interface PerformanceRunPaths {
  root_dir: string;
  active_run_path: string;
  run_dir: string;
  run_path: string;
  events_path: string;
  report_path: string;
}

export interface PerformanceFinalizeResult {
  run: PerformanceRunSummary;
  requires_force: boolean;
  active_span_count: number;
}

const DEFAULT_ROOT = path.join(os.homedir(), "anna-workspace", "ppt", "performance-runs");
const RUN_ID_PATTERN = /^perf-\d{8}-\d{6}-[0-9a-f]{8}$/;
const MAX_EVENTS_PER_APPEND = 200;
const MAX_APPEND_BYTES = 256 * 1024;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_DETAIL_ROWS = 1_000;
const START_LOCK_DIRNAME = ".active-run.lock";
const START_LOCK_STALE_MS = 2 * 60 * 1000;
const START_LOCK_RETRY_MS = 10;
const START_LOCK_MAX_ATTEMPTS = 500;
const appendQueues = new Map<string, Promise<void>>();

interface StartLockOwner {
  owner_id: string;
  pid: number;
  acquired_at: string;
}

function isoNow() {
  return new Date().toISOString();
}

function formatRunId(date = new Date()) {
  const digits = date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `perf-${digits}-${randomUUID().slice(0, 8)}`;
}

function assertRunId(runId: string) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('"run_id" is invalid');
  return runId;
}

export function getPerformanceRunPaths(runId: string, rootDir = DEFAULT_ROOT): PerformanceRunPaths {
  assertRunId(runId);
  const runDir = path.join(rootDir, runId);
  return {
    root_dir: rootDir,
    active_run_path: path.join(rootDir, "active-run.json"),
    run_dir: runDir,
    run_path: path.join(runDir, "run.json"),
    events_path: path.join(runDir, "events.jsonl"),
    report_path: path.join(runDir, "report.html"),
  };
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function fileExists(filePath: string) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function processIsAlive(pid: number) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === "EPERM";
  }
}

async function acquireStartLock(rootDir: string): Promise<() => Promise<void>> {
  await mkdir(rootDir, { recursive: true });
  const lockPath = path.join(rootDir, START_LOCK_DIRNAME);
  const owner: StartLockOwner = {
    owner_id: randomUUID(),
    pid: process.pid,
    acquired_at: isoNow(),
  };
  for (let attempt = 0; attempt < START_LOCK_MAX_ATTEMPTS; attempt += 1) {
    try {
      await mkdir(lockPath);
      try {
        await writeFile(path.join(lockPath, "owner.json"), `${JSON.stringify(owner)}\n`, "utf8");
      } catch (error) {
        await rm(lockPath, { recursive: true, force: true });
        throw error;
      }
      return async () => {
        try {
          const currentOwner = await readJson<StartLockOwner>(path.join(lockPath, "owner.json"));
          if (currentOwner.owner_id === owner.owner_id) {
            await rm(lockPath, { recursive: true, force: true });
          }
        } catch (error) {
          if (!isNodeError(error) || error.code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      try {
        const lockStat = await stat(lockPath);
        let stale = false;
        try {
          const currentOwner = await readJson<StartLockOwner>(path.join(lockPath, "owner.json"));
          stale = !processIsAlive(currentOwner.pid);
        } catch {
          stale = Date.now() - lockStat.mtimeMs > START_LOCK_STALE_MS;
        }
        if (stale) {
          const stalePath = `${lockPath}.stale-${randomUUID()}`;
          await rename(lockPath, stalePath);
          await rm(stalePath, { recursive: true, force: true });
          continue;
        }
      } catch (staleError) {
        if (!isNodeError(staleError) || !["ENOENT", "EEXIST"].includes(staleError.code ?? "")) {
          throw staleError;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, START_LOCK_RETRY_MS));
    }
  }
  throw new Error("Timed out waiting to create a Performance Run");
}

async function readRun(runId: string, rootDir = DEFAULT_ROOT) {
  return readJson<PerformanceRunRecord>(getPerformanceRunPaths(runId, rootDir).run_path);
}

async function toSummary(run: PerformanceRunRecord, rootDir = DEFAULT_ROOT): Promise<PerformanceRunSummary> {
  const paths = getPerformanceRunPaths(run.run_id, rootDir);
  return {
    ...run,
    run_dir: paths.run_dir,
    report_available: await fileExists(paths.report_path),
  };
}

async function readActivePointer(rootDir = DEFAULT_ROOT): Promise<string | null> {
  try {
    const pointer = await readJson<{ run_id?: unknown }>(path.join(rootDir, "active-run.json"));
    return typeof pointer.run_id === "string" && RUN_ID_PATTERN.test(pointer.run_id)
      ? pointer.run_id
      : null;
  } catch {
    return null;
  }
}

async function recoverActiveRunId(rootDir: string) {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const candidates = (await Promise.all(entries
    .filter((entry) => entry.isDirectory() && RUN_ID_PATTERN.test(entry.name))
    .map(async (entry) => {
      try {
        const run = await readRun(entry.name, rootDir);
        return ["recording", "finalizing", "finalization_failed"].includes(run.status) ? run : null;
      } catch {
        return null;
      }
    })))
    .filter((run): run is PerformanceRunRecord => run !== null)
    .sort((left, right) => right.started_at.localeCompare(left.started_at));
  if (candidates.length !== 1) return null;
  await atomicWriteJson(path.join(rootDir, "active-run.json"), { schema_version: 1, run_id: candidates[0].run_id });
  return candidates[0].run_id;
}

export async function getActivePerformanceRun(rootDir = DEFAULT_ROOT): Promise<PerformanceRunSummary | null> {
  const runId = await readActivePointer(rootDir) ?? await recoverActiveRunId(rootDir);
  if (!runId) return null;
  try {
    const run = await readRun(runId, rootDir);
    if (run.status !== "recording" && run.status !== "finalizing" && run.status !== "finalization_failed") {
      await rm(path.join(rootDir, "active-run.json"), { force: true });
      return null;
    }
    return toSummary(run, rootDir);
  } catch {
    await rm(path.join(rootDir, "active-run.json"), { force: true });
    const recoveredRunId = await recoverActiveRunId(rootDir);
    if (!recoveredRunId || recoveredRunId === runId) return null;
    return toSummary(await readRun(recoveredRunId, rootDir), rootDir);
  }
}

export async function listPerformanceRuns(rootDir = DEFAULT_ROOT): Promise<{
  root_dir: string;
  active_run: PerformanceRunSummary | null;
  runs: PerformanceRunSummary[];
}> {
  await mkdir(rootDir, { recursive: true });
  const entries = await readdir(rootDir, { withFileTypes: true });
  const runs = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && RUN_ID_PATTERN.test(entry.name))
    .map(async (entry) => {
      try {
        return await toSummary(await readRun(entry.name, rootDir), rootDir);
      } catch {
        return null;
      }
    }));
  return {
    root_dir: rootDir,
    active_run: await getActivePerformanceRun(rootDir),
    runs: runs.filter((run): run is PerformanceRunSummary => run !== null)
      .sort((left, right) => right.started_at.localeCompare(left.started_at)),
  };
}

export async function startPerformanceRun(input: {
  app_version?: string;
  environment?: Record<string, string | number | boolean | null>;
  initial_settings?: Record<string, unknown>;
  root_dir?: string;
} = {}): Promise<PerformanceRunSummary> {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const environment = input.environment ?? {};
  const initialSettings = input.initial_settings ?? {};
  if (Buffer.byteLength(JSON.stringify(environment)) > 32 * 1024) throw new Error("Performance environment snapshot exceeds 32768 bytes");
  if (Buffer.byteLength(JSON.stringify(initialSettings)) > 64 * 1024) throw new Error("Performance initial settings snapshot exceeds 65536 bytes");
  if (Object.values(environment).some((value) => value !== null && !["string", "number", "boolean"].includes(typeof value))) {
    throw new Error("Performance environment values must be scalar");
  }
  const releaseLock = await acquireStartLock(rootDir);
  try {
    const active = await getActivePerformanceRun(rootDir);
    if (active) throw new Error(`Performance Run ${active.run_id} is already active`);
    const now = isoNow();
    const run: PerformanceRunRecord = {
      schema_version: 1,
      run_id: formatRunId(),
      status: "recording",
      data_integrity: "complete",
      started_at: now,
      updated_at: now,
      ended_at: null,
      report_locale: null,
      report_status: "not_generated",
      report_error: null,
      app_version: input.app_version?.trim() || "unknown",
      environment,
      initial_settings: initialSettings,
      event_count: 0,
      dropped_event_count: 0,
    };
    const paths = getPerformanceRunPaths(run.run_id, rootDir);
    await mkdir(paths.run_dir, { recursive: false });
    await writeFile(paths.events_path, "", "utf8");
    await atomicWriteJson(paths.run_path, run);
    await atomicWriteJson(paths.active_run_path, { schema_version: 1, run_id: run.run_id });
    return toSummary(run, rootDir);
  } finally {
    await releaseLock();
  }
}

function validateEvent(value: unknown): PerformanceEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Performance event must be an object");
  const event = value as Partial<PerformanceEvent>;
  if (event.schema_version !== 1) throw new Error("Performance event schema_version must be 1");
  if (typeof event.event_id !== "string" || event.event_id.length < 8 || event.event_id.length > 128) throw new Error("Performance event_id is invalid");
  if (!["span.started", "span.finished", "button.interaction", "data.loss"].includes(event.event_type ?? "")) throw new Error("Performance event_type is invalid");
  if (typeof event.recorded_at !== "string" || !Number.isFinite(Date.parse(event.recorded_at))) throw new Error("Performance event recorded_at is invalid");
  if (typeof event.producer_id !== "string" || event.producer_id.length === 0 || event.producer_id.length > 128) throw new Error("Performance event producer_id is invalid");
  if (!Number.isSafeInteger(event.sequence_number) || Number(event.sequence_number) < 0) throw new Error("Performance event sequence_number is invalid");
  for (const key of ["duration_ms", "interaction_delay_ms", "feedback_delay_ms"] as const) {
    const measurement = event[key];
    if (measurement !== undefined && (!Number.isFinite(measurement) || measurement < 0)) throw new Error(`Performance event ${key} is invalid`);
  }
  for (const key of ["trace_id", "span_id", "parent_span_id", "operation_name", "workspace_id"] as const) {
    const field = event[key];
    if (field !== undefined && (typeof field !== "string" || field.length === 0 || field.length > 160)) throw new Error(`Performance event ${key} is invalid`);
  }
  if (event.attributes !== undefined) {
    const entries = Object.entries(event.attributes);
    if (entries.length > 32 || entries.some(([key, attribute]) => key.length > 80 || (attribute !== null && !["string", "number", "boolean"].includes(typeof attribute)))) {
      throw new Error("Performance event attributes must contain at most 32 bounded scalar values");
    }
  }
  if (Buffer.byteLength(JSON.stringify(event)) > 16 * 1024) throw new Error("Performance event exceeds 16384 bytes");
  return event as PerformanceEvent;
}

async function serializeAppend(runId: string, task: () => Promise<void>) {
  const previous = appendQueues.get(runId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  appendQueues.set(runId, next);
  try {
    await next;
  } finally {
    if (appendQueues.get(runId) === next) appendQueues.delete(runId);
  }
}

export async function appendPerformanceEvents(input: {
  run_id: string;
  events: unknown[];
  root_dir?: string;
}): Promise<{ appended: number; run: PerformanceRunSummary }> {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > MAX_EVENTS_PER_APPEND) {
    throw new Error(`"events" must contain between 1 and ${MAX_EVENTS_PER_APPEND} items`);
  }
  const events = input.events.map(validateEvent);
  const payload = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  if (Buffer.byteLength(payload) > MAX_APPEND_BYTES) throw new Error(`Performance event batch exceeds ${MAX_APPEND_BYTES} bytes`);
  let result!: PerformanceRunSummary;
  await serializeAppend(assertRunId(input.run_id), async () => {
    const run = await readRun(input.run_id, rootDir);
    if (run.status !== "recording") throw new Error(`Performance Run ${run.run_id} is not recording`);
    const paths = getPerformanceRunPaths(run.run_id, rootDir);
    await appendFile(paths.events_path, payload, "utf8");
    const next = { ...run, event_count: run.event_count + events.length, updated_at: isoNow() };
    if (events.some((event) => event.event_type === "data.loss")) {
      next.data_integrity = "degraded";
      next.dropped_event_count += events.reduce((sum, event) => sum + Number(event.attributes?.dropped_count ?? 0), 0);
    }
    await atomicWriteJson(paths.run_path, next);
    result = await toSummary(next, rootDir);
  });
  return { appended: events.length, run: result };
}

interface ParsedEvents {
  events: PerformanceEvent[];
  corruptLineCount: number;
}

async function parseEvents(filePath: string): Promise<ParsedEvents> {
  const content = await readFile(filePath, "utf8");
  const events: PerformanceEvent[] = [];
  let corruptLineCount = 0;
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(validateEvent(JSON.parse(line)));
    } catch {
      corruptLineCount += 1;
    }
  }
  return { events, corruptLineCount };
}

function activeSpans(events: PerformanceEvent[]) {
  const active = new Map<string, PerformanceEvent>();
  for (const event of events) {
    if (!event.span_id) continue;
    if (event.event_type === "span.started") active.set(event.span_id, event);
    if (event.event_type === "span.finished") active.delete(event.span_id);
  }
  return active;
}

function hasEventIntegrityIssue(events: PerformanceEvent[]) {
  const eventIds = new Set<string>();
  const lastSequenceByProducer = new Map<string, number>();
  for (const event of events) {
    if (eventIds.has(event.event_id)) return true;
    eventIds.add(event.event_id);
    const previous = lastSequenceByProducer.get(event.producer_id);
    if (previous !== undefined && event.sequence_number !== previous + 1) return true;
    lastSequenceByProducer.set(event.producer_id, event.sequence_number);
  }
  return false;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function formatMs(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

function createReportHtml(run: PerformanceRunRecord, parsed: ParsedEvents, locale: "en" | "zh") {
  const zh = locale === "zh";
  const finished = parsed.events.filter((event) => event.event_type === "span.finished" && typeof event.duration_ms === "number");
  const groups = new Map<string, PerformanceEvent[]>();
  for (const event of finished) {
    const name = event.operation_name || "unknown";
    groups.set(name, [...(groups.get(name) ?? []), event]);
  }
  const metricRows = Array.from(groups.entries()).map(([name, events]) => {
    const durations = events.map((event) => event.duration_ms ?? 0);
    return `<tr><td>${escapeHtml(name)}</td><td>${events.length}</td><td>${formatMs(durations.reduce((a, b) => a + b, 0) / durations.length)}</td><td>${formatMs(percentile(durations, 0.5))}</td><td>${formatMs(percentile(durations, 0.95))}</td><td>${formatMs(Math.max(...durations))}</td><td>${events.filter((event) => event.status === "error").length}</td></tr>`;
  }).join("");
  const buttonGroups = new Map<string, PerformanceEvent[]>();
  for (const event of parsed.events.filter((item) => item.event_type === "button.interaction")) {
    const buttonId = String(event.attributes?.button_id ?? "unknown");
    buttonGroups.set(buttonId, [...(buttonGroups.get(buttonId) ?? []), event]);
  }
  const buttonRows = Array.from(buttonGroups.entries()).map(([buttonId, events]) => {
    const interaction = events.map((event) => event.interaction_delay_ms ?? 0);
    const feedback = events.map((event) => event.feedback_delay_ms ?? 0);
    return `<tr><td>${escapeHtml(buttonId)}</td><td>${events.length}</td><td>${formatMs(interaction.reduce((a, b) => a + b, 0) / interaction.length)}</td><td>${formatMs(percentile(interaction, 0.95))}</td><td>${formatMs(feedback.reduce((a, b) => a + b, 0) / feedback.length)}</td><td>${formatMs(percentile(feedback, 0.95))}</td></tr>`;
  }).join("");
  const detailEvents = parsed.events.slice(0, MAX_REPORT_DETAIL_ROWS);
  const detailRows = detailEvents.map((event) => `<tr><td>${escapeHtml(event.recorded_at)}</td><td>${escapeHtml(event.event_type)}</td><td>${escapeHtml(event.operation_name ?? event.attributes?.button_id ?? "")}</td><td>${event.duration_ms === undefined ? "—" : formatMs(event.duration_ms)}</td><td>${escapeHtml(event.status ?? "")}</td></tr>`).join("");
  const omitted = Math.max(0, parsed.events.length - detailEvents.length);
  const integrity = run.data_integrity === "complete" && parsed.corruptLineCount === 0 && !hasEventIntegrityIssue(parsed.events) ? "complete" : "degraded";
  const labels = zh ? {
    title: "PPT 性能测试报告", overview: "运行概览", started: "开始时间", ended: "结束时间", status: "运行状态",
    integrity: "数据完整性", events: "有效事件", corrupt: "损坏行", metrics: "操作指标", operation: "操作",
    count: "次数", average: "平均", max: "最大", errors: "错误", details: "事件明细", time: "时间", type: "类型", buttons: "按钮交互指标", button: "按钮", interaction: "交互延迟", feedback: "反馈延迟",
    duration: "耗时", omitted: `另有 ${omitted} 条原始事件未复制到报告，请查看 events.jsonl。`, noMetrics: "没有可聚合的已完成操作。",
  } : {
    title: "PPT Performance Report", overview: "Run overview", started: "Started", ended: "Ended", status: "Run status",
    integrity: "Data integrity", events: "Valid events", corrupt: "Corrupt lines", metrics: "Operation metrics", operation: "Operation",
    count: "Count", average: "Average", max: "Max", errors: "Errors", details: "Event details", time: "Time", type: "Type", buttons: "Button interaction metrics", button: "Button", interaction: "Interaction delay", feedback: "Feedback delay",
    duration: "Duration", omitted: `${omitted} additional raw events are omitted from this report. See events.jsonl.`, noMetrics: "No completed operations were available for aggregation.",
  };
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${labels.title}</title><style>body{margin:0;background:#f5f6f8;color:#1d2433;font:14px/1.5 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:28px}h1{font-size:24px;margin:0 0 20px}h2{font-size:16px;margin:28px 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:#d9dee8;border:1px solid #d9dee8}.item{background:#fff;padding:12px}.item span{display:block;color:#687083;font-size:12px}.item strong{display:block;margin-top:4px}.degraded{color:#b42318}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{text-align:left;padding:9px 10px;border:1px solid #e1e5ec}th{background:#f0f2f6}p.note{color:#687083;font-size:12px}</style></head><body><main><h1>${labels.title}</h1><section><h2>${labels.overview}</h2><div class="grid"><div class="item"><span>Run ID</span><strong>${escapeHtml(run.run_id)}</strong></div><div class="item"><span>${labels.started}</span><strong>${escapeHtml(run.started_at)}</strong></div><div class="item"><span>${labels.ended}</span><strong>${escapeHtml(run.ended_at)}</strong></div><div class="item"><span>${labels.status}</span><strong>${escapeHtml(run.status)}</strong></div><div class="item"><span>${labels.integrity}</span><strong class="${integrity}">${integrity}</strong></div><div class="item"><span>${labels.events}</span><strong>${parsed.events.length}</strong></div><div class="item"><span>${labels.corrupt}</span><strong>${parsed.corruptLineCount}</strong></div></div></section><section><h2>${labels.metrics}</h2>${metricRows ? `<table><thead><tr><th>${labels.operation}</th><th>${labels.count}</th><th>${labels.average}</th><th>P50</th><th>P95</th><th>${labels.max}</th><th>${labels.errors}</th></tr></thead><tbody>${metricRows}</tbody></table>` : `<p>${labels.noMetrics}</p>`}</section><section><h2>${labels.buttons}</h2>${buttonRows ? `<table><thead><tr><th>${labels.button}</th><th>${labels.count}</th><th>${labels.interaction} ${labels.average}</th><th>${labels.interaction} P95</th><th>${labels.feedback} ${labels.average}</th><th>${labels.feedback} P95</th></tr></thead><tbody>${buttonRows}</tbody></table>` : `<p>${labels.noMetrics}</p>`}</section><section><h2>${labels.details}</h2><table><thead><tr><th>${labels.time}</th><th>${labels.type}</th><th>${labels.operation}</th><th>${labels.duration}</th><th>${labels.status}</th></tr></thead><tbody>${detailRows}</tbody></table>${omitted ? `<p class="note">${labels.omitted}</p>` : ""}</section></main></body></html>`;
}

export async function finalizePerformanceRun(input: {
  run_id: string;
  locale: "en" | "zh";
  force?: boolean;
  root_dir?: string;
}): Promise<PerformanceFinalizeResult> {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const paths = getPerformanceRunPaths(input.run_id, rootDir);
  await appendQueues.get(input.run_id)?.catch(() => undefined);
  let run = await readRun(input.run_id, rootDir);
  if (run.status !== "recording" && run.status !== "finalization_failed") throw new Error(`Performance Run ${run.run_id} cannot be finalized from ${run.status}`);
  let parsed = await parseEvents(paths.events_path);
  const active = activeSpans(parsed.events);
  if (active.size > 0 && !input.force) {
    return { run: await toSummary(run, rootDir), requires_force: true, active_span_count: active.size };
  }
  run = { ...run, status: "finalizing", report_locale: input.locale, updated_at: isoNow(), report_error: null };
  await atomicWriteJson(paths.run_path, run);
  try {
    if (active.size > 0) {
      const interruptedAt = isoNow();
      const interruptions = Array.from(active.values()).map((started, index): PerformanceEvent => ({
        schema_version: 1,
        event_id: randomUUID(),
        event_type: "span.finished",
        recorded_at: interruptedAt,
        producer_id: "ppt-engine-finalizer",
        sequence_number: index,
        trace_id: started.trace_id,
        span_id: started.span_id,
        parent_span_id: started.parent_span_id,
        operation_name: started.operation_name,
        workspace_id: started.workspace_id,
        duration_ms: Math.max(0, Date.parse(interruptedAt) - Date.parse(started.recorded_at)),
        status: "interrupted",
        attributes: { duration_source: "estimated_wall_clock" },
      }));
      await appendFile(paths.events_path, interruptions.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
      run.event_count += interruptions.length;
      parsed = await parseEvents(paths.events_path);
    }
    if (parsed.corruptLineCount > 0 || hasEventIntegrityIssue(parsed.events)) run.data_integrity = "degraded";
    run = { ...run, status: "completed", report_status: "generated", ended_at: isoNow(), updated_at: isoNow() };
    const html = createReportHtml(run, parsed, input.locale);
    if (Buffer.byteLength(html) > MAX_REPORT_BYTES) throw new Error(`Performance report exceeds ${MAX_REPORT_BYTES} bytes`);
    await writeFile(paths.report_path, html, "utf8");
    await atomicWriteJson(paths.run_path, run);
    await rm(paths.active_run_path, { force: true });
    return { run: await toSummary(run, rootDir), requires_force: false, active_span_count: active.size };
  } catch (error) {
    run = {
      ...run,
      status: "finalization_failed",
      report_status: "failed",
      report_error: error instanceof Error ? error.message : String(error),
      updated_at: isoNow(),
    };
    await atomicWriteJson(paths.run_path, run);
    throw error;
  }
}

export async function abandonPerformanceRun(input: { run_id: string; root_dir?: string }) {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const paths = getPerformanceRunPaths(input.run_id, rootDir);
  await appendQueues.get(input.run_id)?.catch(() => undefined);
  const run = await readRun(input.run_id, rootDir);
  if (run.status === "completed" || run.status === "abandoned") throw new Error(`Performance Run ${run.run_id} is already terminal`);
  const next: PerformanceRunRecord = { ...run, status: "abandoned", ended_at: isoNow(), updated_at: isoNow() };
  await atomicWriteJson(paths.run_path, next);
  await rm(paths.active_run_path, { force: true });
  return toSummary(next, rootDir);
}

export async function deletePerformanceRun(input: { run_id: string; root_dir?: string }) {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const run = await readRun(input.run_id, rootDir);
  if (run.status !== "completed" && run.status !== "abandoned") throw new Error("Only terminal Performance Runs can be deleted");
  await rm(getPerformanceRunPaths(run.run_id, rootDir).run_dir, { recursive: true, force: true });
  return { deleted: true as const, run_id: run.run_id };
}

export async function getPerformanceReportPath(input: { run_id: string; root_dir?: string }) {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const run = await readRun(input.run_id, rootDir);
  const reportPath = getPerformanceRunPaths(run.run_id, rootDir).report_path;
  if (run.report_status !== "generated" || !(await fileExists(reportPath))) throw new Error(`Performance Run ${run.run_id} does not have a report`);
  return { run: await toSummary(run, rootDir), report_path: reportPath };
}
