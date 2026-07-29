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

async function atomicWriteText(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
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

function formatDuration(value: number) {
  if (value >= 60_000) return `${Math.floor(value / 60_000)}m ${((value % 60_000) / 1_000).toFixed(1)}s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 1 : 2)}s`;
  return `${value.toFixed(value >= 100 ? 0 : 1)}ms`;
}

interface PerformanceMetric {
  name: string;
  events: PerformanceEvent[];
  durations: number[];
  total: number;
  wall_clock: number;
  average: number;
  p95: number;
  max: number;
  errors: number;
  interrupted: number;
}

function mergedWallClockDuration(events: PerformanceEvent[]) {
  const intervals = events.map((event) => {
    const end = Date.parse(event.recorded_at);
    const duration = event.duration_ms ?? 0;
    return { start: end - duration, end };
  }).filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end))
    .sort((left, right) => left.start - right.start);
  if (intervals.length === 0) return 0;
  let total = 0;
  let start = intervals[0].start;
  let end = intervals[0].end;
  for (const interval of intervals.slice(1)) {
    if (interval.start <= end) {
      end = Math.max(end, interval.end);
      continue;
    }
    total += end - start;
    start = interval.start;
    end = interval.end;
  }
  return total + end - start;
}

function metric(name: string, events: PerformanceEvent[]): PerformanceMetric | null {
  const measured = events.filter((event) => typeof event.duration_ms === "number");
  if (measured.length === 0) return null;
  const durations = measured.map((event) => event.duration_ms ?? 0);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return {
    name,
    events: measured,
    durations,
    total,
    wall_clock: mergedWallClockDuration(measured),
    average: total / durations.length,
    p95: percentile(durations, 0.95),
    max: Math.max(...durations),
    errors: measured.filter((event) => event.status === "error").length,
    interrupted: measured.filter((event) => event.status === "interrupted").length,
  };
}

function preferredOperationMetric(finished: PerformanceEvent[], name: string) {
  for (const candidate of [name, `${name}.roundtrip`, `${name}.backend`]) {
    const result = metric(name, finished.filter((event) => event.operation_name === candidate));
    if (result) return result;
  }
  return null;
}

function operationLabel(name: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    "requirements.create": ["演示需求创建", "Requirements creation"],
    "outline.create": ["大纲创建", "Outline creation"],
    "outline.rewrite": ["大纲重写", "Outline rewrite"],
    "generation.run": ["整套生成", "Deck generation"],
    "authoring_kit.install": ["安装 Authoring Kit", "Install Authoring Kit"],
    "style_guide.create": ["创建艺术指导", "Create style guide"],
    "page_sources.prepare": ["准备页面源码", "Prepare page sources"],
    "research.run": ["研究", "Research"],
    "research.web.decision": ["判断是否需要 Web 资料", "Decide whether web research is needed"],
    "research.web.search": ["Web 搜索阶段", "Web search stage"],
    "web.search": ["Web 搜索调用", "Web search calls"],
    "research.web.fetch_selection": ["判断需要读取的网页", "Select pages to fetch"],
    "research.web.fetch": ["Web 正文抓取阶段", "Web fetch stage"],
    "web.fetch": ["Web 抓取调用", "Web fetch calls"],
    "research.web.synthesis": ["Web 信息整理", "Web information synthesis"],
    "research.web.publish": ["发布 Web 研究结果", "Publish web research"],
    "research.image.decision": ["判断是否需要图片", "Decide whether images are needed"],
    "research.image.search": ["图片搜索阶段", "Image search stage"],
    "image.search": ["图片搜索调用", "Image search calls"],
    "research.image.analysis": ["图片 Session 判断", "Image session assessment"],
    "image.fetch": ["获取图片下载地址", "Resolve image downloads"],
    "research.image.download": ["下载图片", "Download images"],
    "research.image.import": ["上传并导入图片", "Upload and import images"],
    "research.image.publish": ["发布图片研究结果", "Publish image research"],
    "page.generation": ["页面生成", "Page generation"],
    "page.research": ["页面研究", "Page research"],
    "page.authoring": ["页面创作", "Page authoring"],
    "page.render": ["页面渲染", "Page render"],
    "page.render_fix": ["渲染修复", "Render fix"],
    "page.visual_review": ["视觉检查", "Visual review"],
    "page.visual_review_fix": ["视觉修复", "Visual review fix"],
    "final_deck_render": ["最终 Deck 渲染", "Final deck render"],
    "generation.commit": ["提交生成结果", "Commit generation"],
    "ai.interaction": ["AI 调用", "AI interaction"],
    "agent.session": ["Agent 会话", "Agent session"],
    "host_upload": ["Host Upload", "Host Upload"],
  };
  return labels[name]?.[zh ? 0 : 1] ?? name;
}

function buttonLabel(buttonId: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    "brief.create-deck": ["创建 PPT", "Create deck"],
    "requirements.create.retry": ["重试创建演示需求", "Retry requirements creation"],
    "requirements.save": ["保存演示需求", "Save requirements"],
    "requirements.confirm": ["确认演示需求", "Confirm requirements"],
    "outline.create.retry": ["重试创建大纲", "Retry outline creation"],
    "outline.rewrite": ["重写大纲", "Rewrite outline"],
    "outline.save": ["保存大纲", "Save outline"],
    "outline.confirm": ["确认大纲", "Confirm outline"],
    "generation.resume": ["继续生成", "Resume generation"],
    "deck.refine-page": ["修改当前页", "Refine page"],
    "deck.refine-deck": ["修改整套 PPT", "Refine deck"],
    "deck.preview": ["预览 PPT", "Preview deck"],
    "deck.export": ["打开导出", "Open export"],
    "export.pptx.start": ["导出 PPTX", "Export PPTX"],
    "export.pdf.start": ["导出 PDF", "Export PDF"],
    "workspace.create": ["新建工作区", "Create workspace"],
    "workspace.open-latest": ["打开最近工作区", "Open latest workspace"],
    "my-work.workspace.open": ["打开 PPT", "Open presentation"],
    "my-work.new-presentation": ["新建 PPT", "New presentation"],
    "settings.preferences.save": ["保存设置", "Save settings"],
  };
  if (labels[buttonId]) return labels[buttonId][zh ? 0 : 1];
  return buttonId.split(".").map((part) => part.replaceAll("-", " ")).join(" / ");
}

function createReportHtml(run: PerformanceRunRecord, parsed: ParsedEvents, locale: "en" | "zh") {
  const zh = locale === "zh";
  const finished = parsed.events.filter((event) => event.event_type === "span.finished" && typeof event.duration_ms === "number");
  const integrity = run.data_integrity === "complete" && parsed.corruptLineCount === 0 && !hasEventIntegrityIssue(parsed.events) ? "complete" : "degraded";
  const runDuration = run.ended_at ? Math.max(0, Date.parse(run.ended_at) - Date.parse(run.started_at)) : 0;
  const failures = finished.filter((event) => event.status === "error" || event.status === "interrupted");

  const buttonGroups = new Map<string, PerformanceEvent[]>();
  for (const event of parsed.events.filter((item) => item.event_type === "button.interaction")) {
    const buttonId = String(event.attributes?.button_id ?? "unknown");
    buttonGroups.set(buttonId, [...(buttonGroups.get(buttonId) ?? []), event]);
  }
  const buttonMetrics = Array.from(buttonGroups.entries()).map(([buttonId, events]) => {
    const interaction = events.map((event) => event.interaction_delay_ms ?? 0);
    const feedback = events.map((event) => event.feedback_delay_ms ?? 0);
    return {
      buttonId,
      count: events.length,
      interactionAverage: interaction.reduce((sum, value) => sum + value, 0) / interaction.length,
      feedbackAverage: feedback.reduce((sum, value) => sum + value, 0) / feedback.length,
      feedbackP95: percentile(feedback, 0.95),
      feedbackMax: Math.max(...feedback),
    };
  }).sort((left, right) => right.feedbackP95 - left.feedbackP95);
  const topButtons = buttonMetrics.slice(0, 10);
  const topButtonRows = topButtons.map((item, index) => `<tr><td class="rank">${index + 1}</td><td><strong>${escapeHtml(buttonLabel(item.buttonId, zh))}</strong><code>${escapeHtml(item.buttonId)}</code></td><td>${item.count}</td><td>${formatDuration(item.interactionAverage)}</td><td>${formatDuration(item.feedbackAverage)}</td><td>${formatDuration(item.feedbackP95)}</td><td>${formatDuration(item.feedbackMax)}</td></tr>`).join("");

  const primaryStages = ["requirements.create", "outline.create", "outline.rewrite", "generation.run"];
  const primaryMetrics = primaryStages.map((name) => ({ name, value: preferredOperationMetric(finished, name) }));
  const maxPrimaryDuration = Math.max(1, ...primaryMetrics.map((item) => item.value?.wall_clock ?? 0));
  const stageRows = primaryMetrics.map(({ name, value }) => `<div class="stage-row"><div class="stage-name"><strong>${escapeHtml(operationLabel(name, zh))}</strong><code>${name}</code></div><div class="stage-track"><i style="width:${value ? Math.max(2, value.wall_clock / maxPrimaryDuration * 100) : 0}%"></i></div><div class="stage-value">${value ? `<strong>${formatDuration(value.wall_clock)}</strong><span>${value.events.length}${zh ? " 次" : " runs"}${value.errors + value.interrupted ? ` · ${value.errors + value.interrupted} ${zh ? "异常" : "issues"}` : ""}</span>` : `<span>${zh ? "未记录" : "Not recorded"}</span>`}</div></div>`).join("");

  const pageGroups = new Map<string, PerformanceEvent[]>();
  for (const event of finished) {
    const pageId = event.attributes?.page_id;
    if (typeof pageId !== "string" || !pageId) continue;
    pageGroups.set(pageId, [...(pageGroups.get(pageId) ?? []), event]);
  }
  const pageRows = Array.from(pageGroups.entries()).map(([pageId, events]) => {
    const pageIndex = Math.min(...events.map((event) => Number(event.attributes?.page_index ?? Number.MAX_SAFE_INTEGER)));
    const stageFor = (...names: string[]) => {
      const matching = events.filter((event) => names.includes(event.operation_name ?? ""));
      return { duration: matching.reduce((sum, event) => sum + (event.duration_ms ?? 0), 0), count: matching.length };
    };
    const total = stageFor("page.generation");
    const issues = events.filter((event) => event.status === "error" || event.status === "interrupted").length;
    return { pageId, pageIndex, total, authoring: stageFor("page.authoring"), render: stageFor("page.render"), renderFix: stageFor("page.render_fix"), review: stageFor("page.visual_review"), reviewFix: stageFor("page.visual_review_fix"), issues };
  }).sort((left, right) => left.pageIndex - right.pageIndex);
  const stageCell = (stage: { duration: number; count: number }) => stage.count > 0
    ? `${formatDuration(stage.duration)}<small>${stage.count}${zh ? " 次" : " runs"}</small>`
    : "—";
  const pageDetailRows = pageRows.map((item) => `<tr><td><strong>${zh ? `第 ${item.pageIndex + 1} 页` : `Page ${item.pageIndex + 1}`}</strong><code>${escapeHtml(item.pageId)}</code></td><td>${stageCell(item.total)}</td><td>${stageCell(item.authoring)}</td><td>${stageCell(item.render)}</td><td>${stageCell(item.renderFix)}</td><td>${stageCell(item.review)}</td><td>${stageCell(item.reviewFix)}</td><td>${item.issues}</td></tr>`).join("");

  const operationGroups = new Map<string, PerformanceEvent[]>();
  for (const event of finished) {
    const name = event.operation_name || "unknown";
    operationGroups.set(name, [...(operationGroups.get(name) ?? []), event]);
  }
  const operationMetrics = Array.from(operationGroups.entries()).map(([name, events]) => metric(name, events)).filter((item): item is PerformanceMetric => item !== null);
  const slowOperations = operationMetrics.filter((item) => !item.name.endsWith(".backend") && !item.name.endsWith(".roundtrip") && !item.name.startsWith("tool.")).sort((left, right) => right.max - left.max).slice(0, 10);
  const slowRows = slowOperations.map((item, index) => `<tr><td class="rank">${index + 1}</td><td><strong>${escapeHtml(operationLabel(item.name, zh))}</strong><code>${escapeHtml(item.name)}</code></td><td>${item.events.length}</td><td>${formatDuration(item.average)}</td><td>${formatDuration(item.p95)}</td><td>${formatDuration(item.max)}</td><td>${item.errors + item.interrupted}</td></tr>`).join("");

  const diagnosticRows = operationMetrics.sort((left, right) => right.max - left.max).map((item) => `<tr><td><code>${escapeHtml(item.name)}</code></td><td>${item.events.length}</td><td>${formatDuration(item.average)}</td><td>${formatDuration(item.p95)}</td><td>${formatDuration(item.max)}</td><td>${item.errors + item.interrupted}</td></tr>`).join("");
  const issueEvents = parsed.events.filter((event) => event.event_type === "data.loss" || event.status === "error" || event.status === "interrupted").slice(0, MAX_REPORT_DETAIL_ROWS);
  const issueRows = issueEvents.map((event) => `<tr><td>${escapeHtml(event.recorded_at)}</td><td>${escapeHtml(event.event_type)}</td><td><code>${escapeHtml(event.operation_name ?? event.attributes?.button_id ?? "")}</code></td><td>${event.duration_ms === undefined ? "—" : formatDuration(event.duration_ms)}</td><td>${escapeHtml(event.status ?? event.attributes?.reason ?? "")}</td></tr>`).join("");

  const labels = zh ? {
    title: "PPT 性能测试报告", subtitle: "面向测试人员的业务流程耗时与交互反馈摘要", overview: "运行摘要", total: "测试总时长", generation: "整套生成耗时", clicks: "按钮点击", slowestButton: "最慢按钮反馈", issues: "异常操作", integrity: "数据完整性", slowButtons: "耗时前 10 按钮", buttonNote: "按钮耗时表示浏览器收到点击后到下一帧反馈的 UI 延迟，不代表后台任务完成时间。", rank: "排名", button: "按钮名称", count: "次数", interaction: "平均交互", feedbackAverage: "平均反馈", feedbackP95: "反馈 P95", maximum: "最大", workflow: "PPT 创建流程", workflowNote: "业务阶段显示系统处理时间，不包含测试人员阅读、编辑和确认时的停留时间。", generationBreakdown: "生成过程分解", generationNote: "墙钟耗时合并了并行区间，表示实际等待；累计耗时表示全部调用工作量。父子阶段可能相互包含，不能直接相加。", preparation: "生成准备", research: "研究过程", pages: "逐页生成", completion: "生成收尾", pageBreakdown: "页面生成明细", page: "页面", authoring: "创作", render: "渲染", renderFix: "渲染修复", visualReview: "视觉检查", visualReviewFix: "视觉修复", stage: "阶段", wallClock: "墙钟耗时", totalWork: "累计耗时", average: "平均", errors: "异常", slowOperations: "最慢业务操作", diagnostics: "技术诊断数据", diagnosticsNote: "用于开发排查的底层 Tool、backend 和 roundtrip 指标。", issueDetails: "错误、中断与数据丢失", noData: "本次运行没有相应数据。", events: "个事件", started: "开始", ended: "结束",
  } : {
    title: "PPT Performance Report", subtitle: "Business workflow timing and interaction feedback for testers", overview: "Run summary", total: "Run duration", generation: "Deck generation", clicks: "Button clicks", slowestButton: "Slowest button feedback", issues: "Operation issues", integrity: "Data integrity", slowButtons: "Top 10 slowest buttons", buttonNote: "Button timing measures browser UI feedback from click receipt to the next frame. It is not backend task completion time.", rank: "Rank", button: "Button", count: "Count", interaction: "Avg interaction", feedbackAverage: "Avg feedback", feedbackP95: "Feedback P95", maximum: "Max", workflow: "PPT creation workflow", workflowNote: "Business stages show system processing time and exclude time spent by the tester reading, editing, or confirming.", generationBreakdown: "Generation breakdown", generationNote: "Wall-clock time merges overlapping intervals and represents actual waiting time. Cumulative time represents total work. Parent and child stages may overlap and must not be added together.", preparation: "Generation preparation", research: "Research", pages: "Page generation", completion: "Generation completion", pageBreakdown: "Page generation details", page: "Page", authoring: "Authoring", render: "Render", renderFix: "Render fixes", visualReview: "Visual review", visualReviewFix: "Visual fixes", stage: "Stage", wallClock: "Wall clock", totalWork: "Cumulative", average: "Average", errors: "Issues", slowOperations: "Slowest business operations", diagnostics: "Technical diagnostics", diagnosticsNote: "Low-level Tool, backend, and roundtrip metrics for engineering diagnosis.", issueDetails: "Errors, interruptions, and data loss", noData: "No corresponding data was recorded in this run.", events: "events", started: "Started", ended: "Ended",
  };
  const generationGroups = [
    { title: labels.preparation, stages: ["authoring_kit.install", "style_guide.create", "page_sources.prepare"] },
    { title: labels.research, stages: ["research.run", "research.web.decision", "research.web.search", "web.search", "research.web.fetch_selection", "research.web.fetch", "web.fetch", "research.web.synthesis", "research.web.publish", "research.image.decision", "research.image.search", "image.search", "research.image.analysis", "image.fetch", "research.image.download", "research.image.import", "research.image.publish"] },
    { title: labels.pages, stages: ["page.generation", "page.authoring", "page.render", "page.render_fix", "page.visual_review", "page.visual_review_fix"] },
    { title: labels.completion, stages: ["final_deck_render", "generation.commit"] },
  ];
  const generationGroupHtml = generationGroups.map((group) => {
    const rows = group.stages
      .map((name) => preferredOperationMetric(finished, name))
      .filter((item): item is PerformanceMetric => item !== null)
      .map((item) => `<tr><td><strong>${escapeHtml(operationLabel(item.name, zh))}</strong><code>${item.name}</code></td><td>${item.events.length}</td><td>${formatDuration(item.wall_clock)}</td><td>${formatDuration(item.total)}</td><td>${formatDuration(item.average)}</td><td>${formatDuration(item.p95)}</td><td>${formatDuration(item.max)}</td><td>${item.errors + item.interrupted}</td></tr>`)
      .join("");
    return `<div class="generation-group"><h3>${escapeHtml(group.title)}</h3>${rows ? `<div class="table-wrap"><table><thead><tr><th>${labels.stage}</th><th>${labels.count}</th><th>${labels.wallClock}</th><th>${labels.totalWork}</th><th>${labels.average}</th><th>P95</th><th>${labels.maximum}</th><th>${labels.errors}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${labels.noData}</div>`}</div>`;
  }).join("");
  const generationMetric = preferredOperationMetric(finished, "generation.run");
  const slowestButton = topButtons[0];
  const summaryItems = [
    [labels.total, formatDuration(runDuration)],
    [labels.generation, generationMetric ? formatDuration(generationMetric.wall_clock) : "—"],
    [labels.clicks, String(parsed.events.filter((event) => event.event_type === "button.interaction").length)],
    [labels.slowestButton, slowestButton ? formatDuration(slowestButton.feedbackP95) : "—"],
    [labels.issues, String(failures.length)],
    [zh ? "事件文件完整性" : "Event file integrity", integrity],
  ].map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong class="${value === "degraded" ? "danger" : ""}">${escapeHtml(value)}</strong></div>`).join("");

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${labels.title}</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#202737;font:14px/1.5 system-ui,-apple-system,sans-serif}main{max-width:1180px;margin:auto;padding:32px 24px 56px}header.report-header{padding:0 0 24px;border-bottom:1px solid #dce1e8}h1{font-size:28px;line-height:1.2;margin:0}header p{margin:7px 0 0;color:#657084}header small{display:block;margin-top:15px;color:#7b8495}h2{font-size:19px;margin:32px 0 6px}h3{font-size:14px;margin:20px 0 8px}.generation-group:first-of-type h3{margin-top:14px}section>p.note{margin:0 0 14px;color:#687386;font-size:13px}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #dce1e8;background:#dce1e8;gap:1px}.summary-item{background:#fff;padding:16px 18px;min-height:82px}.summary-item span{display:block;color:#687386;font-size:12px}.summary-item strong{display:block;margin-top:7px;font-size:21px}.danger{color:#b42318}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dce1e8;font-size:13px}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid #e3e7ed;vertical-align:middle}th{background:#edf0f4;color:#4f5b6d;font-size:12px}tbody tr:last-child td{border-bottom:0}td.rank{width:52px;color:#7b8495}td strong{display:block;font-weight:600}td small{display:block;margin-top:2px;color:#778195;font-size:11px}code{display:block;margin-top:2px;color:#778195;font:11px/1.35 ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere}.stage-list{background:#fff;border:1px solid #dce1e8}.stage-row{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(180px,2fr) minmax(115px,.7fr);gap:18px;align-items:center;padding:15px 18px;border-bottom:1px solid #e3e7ed}.stage-row:last-child{border-bottom:0}.stage-name strong,.stage-value strong,.stage-value span{display:block}.stage-track{height:8px;background:#e8ebf0;overflow:hidden}.stage-track i{display:block;height:100%;background:#267a5b}.stage-value{text-align:right}.stage-value span{color:#778195;font-size:11px}.empty{padding:18px;background:#fff;border:1px solid #dce1e8;color:#778195}details{margin-top:16px;border:1px solid #dce1e8;background:#fff}summary{cursor:pointer;padding:14px 16px;font-weight:600}details .details-body{padding:0 16px 16px;overflow:auto}.table-wrap{overflow:auto;border:1px solid #dce1e8}.table-wrap table{border:0;min-width:860px}@media(max-width:720px){main{padding:22px 14px 40px}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stage-row{grid-template-columns:1fr}.stage-value{text-align:left}h1{font-size:24px}}@media(max-width:430px){.summary-grid{grid-template-columns:1fr}}</style></head><body><main><header class="report-header"><h1>${labels.title}</h1><p>${labels.subtitle}</p><small>Run ID: ${escapeHtml(run.run_id)} · ${labels.started}: ${escapeHtml(run.started_at)} · ${labels.ended}: ${escapeHtml(run.ended_at)} · ${parsed.events.length} ${labels.events}</small></header><section><h2>${labels.overview}</h2><div class="summary-grid">${summaryItems}</div></section><section><h2>${labels.slowButtons}</h2><p class="note">${labels.buttonNote}</p>${topButtonRows ? `<div class="table-wrap"><table><thead><tr><th>${labels.rank}</th><th>${labels.button}</th><th>${labels.count}</th><th>${labels.interaction}</th><th>${labels.feedbackAverage}</th><th>${labels.feedbackP95}</th><th>${labels.maximum}</th></tr></thead><tbody>${topButtonRows}</tbody></table></div>` : `<div class="empty">${labels.noData}</div>`}</section><section><h2>${labels.workflow}</h2><p class="note">${labels.workflowNote}</p><div class="stage-list">${stageRows}</div></section><section><h2>${labels.generationBreakdown}</h2><p class="note">${labels.generationNote}</p>${generationGroupHtml}</section><section><h2>${labels.pageBreakdown}</h2>${pageDetailRows ? `<div class="table-wrap"><table><thead><tr><th>${labels.page}</th><th>${labels.total}</th><th>${labels.authoring}</th><th>${labels.render}</th><th>${labels.renderFix}</th><th>${labels.visualReview}</th><th>${labels.visualReviewFix}</th><th>${labels.errors}</th></tr></thead><tbody>${pageDetailRows}</tbody></table></div>` : `<div class="empty">${labels.noData}</div>`}</section><section><h2>${labels.slowOperations}</h2>${slowRows ? `<div class="table-wrap"><table><thead><tr><th>${labels.rank}</th><th>${labels.stage}</th><th>${labels.count}</th><th>${labels.average}</th><th>P95</th><th>${labels.maximum}</th><th>${labels.errors}</th></tr></thead><tbody>${slowRows}</tbody></table></div>` : `<div class="empty">${labels.noData}</div>`}</section><section><h2>${labels.diagnostics}</h2><p class="note">${labels.diagnosticsNote}</p><details><summary>${labels.diagnostics}</summary><div class="details-body"><div class="table-wrap"><table><thead><tr><th>${labels.stage}</th><th>${labels.count}</th><th>${labels.average}</th><th>P95</th><th>${labels.maximum}</th><th>${labels.errors}</th></tr></thead><tbody>${diagnosticRows}</tbody></table></div></div></details><details><summary>${labels.issueDetails} (${issueEvents.length})</summary><div class="details-body">${issueRows ? `<div class="table-wrap"><table><thead><tr><th>${zh ? "时间" : "Time"}</th><th>${zh ? "类型" : "Type"}</th><th>${labels.stage}</th><th>${zh ? "耗时" : "Duration"}</th><th>${zh ? "状态" : "Status"}</th></tr></thead><tbody>${issueRows}</tbody></table></div>` : `<div class="empty">${labels.noData}</div>`}</div></details></section></main></body></html>`;
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
    await atomicWriteText(paths.report_path, html);
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

export async function regeneratePerformanceReport(input: {
  run_id: string;
  locale: "en" | "zh";
  root_dir?: string;
}): Promise<PerformanceRunSummary> {
  const rootDir = input.root_dir ?? DEFAULT_ROOT;
  const paths = getPerformanceRunPaths(input.run_id, rootDir);
  let run = await readRun(input.run_id, rootDir);
  if (run.status !== "completed") {
    throw new Error(`Performance Run ${run.run_id} cannot regenerate a report from ${run.status}`);
  }
  try {
    const parsed = await parseEvents(paths.events_path);
    const dataIntegrity = parsed.corruptLineCount > 0 || hasEventIntegrityIssue(parsed.events)
      ? "degraded"
      : "complete";
    run = {
      ...run,
      data_integrity: dataIntegrity,
      report_locale: input.locale,
      report_status: "generated",
      report_error: null,
      updated_at: isoNow(),
    };
    const html = createReportHtml(run, parsed, input.locale);
    if (Buffer.byteLength(html) > MAX_REPORT_BYTES) {
      throw new Error(`Performance report exceeds ${MAX_REPORT_BYTES} bytes`);
    }
    await atomicWriteText(paths.report_path, html);
    await atomicWriteJson(paths.run_path, run);
    return toSummary(run, rootDir);
  } catch (error) {
    run = {
      ...run,
      report_locale: input.locale,
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
