import {
  clearCallRecords,
  deleteCallRecord,
  listCallRecords,
  markUnfinishedRecordsInterrupted,
  putCallRecord,
} from "./record-store.js";
import {
  RECORD_SCHEMA_VERSION,
  createRecordId,
  elapsedMs,
  extractCompletionText,
  isTimeoutError,
  nowIso,
  toSerializable,
} from "./record-utils.js";
import { buildLlmInput, invokeAnnaLlm, selectLlmInvocationPath } from "./anna-llm.js";

const ANNA_RUNTIME_SDK_URLS = [
  "/static/anna-apps/_sdk/latest/index.js",
  "/static/anna-apps/_sdk/0.2.0/index.js",
  "/static/anna-apps/_sdk/0.1.0/index.js",
];
const SESSION_STORAGE_KEY = "test-session-app.saved-session-ids.v1";
const SETTINGS_STORAGE_KEY = "test-session-app.settings.v1";

const els = Object.fromEntries(
  [
    "conn-dot", "conn-label", "background-count", "record-count", "refresh-runtime",
    "create-session", "delete-selected", "delete-all", "stop-session-wait",
    "manual-session-id", "attach-manual", "save-selected", "clear-saved",
    "session-count", "saved-count", "session-list", "saved-list",
    "selected-session-id", "selected-session-source", "selected-session-state",
    "active-session-record", "run-content", "run-selected", "run-manual",
    "copy-result", "result-json", "llm-system-prompt", "llm-user-prompt",
    "llm-timeout-seconds", "run-llm", "stop-llm-wait", "copy-llm-result",
    "active-llm-record", "llm-invocation-path", "llm-duration", "llm-result-json",
    "record-category-filter", "record-status-filter", "refresh-records",
    "copy-all-records", "clear-records", "record-list", "record-json",
    "copy-record", "delete-record", "logs", "copy-logs", "clear-logs",
  ].map((id) => [id.replaceAll("-", "_"), document.querySelector(`#${id}`)])
);

let anna = null;
let connected = false;
let selectedSessionId = "";
let sessions = [];
let savedSessionIds = [];
let logs = [];
let lastSessionResult = null;
let lastLlmResult = null;
let callRecords = [];
let selectedRecordId = "";
let activeSessionRecordId = "";
let activeLlmRecordId = "";

const liveOperations = new Map();
const saveQueues = new Map();

function getAnnaAppRuntime() {
  return globalThis.AnnaAppRuntime || null;
}

async function loadAnnaRuntimeSdk() {
  const existingRuntime = getAnnaAppRuntime();
  if (existingRuntime) return existingRuntime;
  for (const sdkUrl of ANNA_RUNTIME_SDK_URLS) {
    try {
      const runtimeModule = await import(sdkUrl);
      const runtime = runtimeModule?.AnnaAppRuntime || runtimeModule?.default || getAnnaAppRuntime();
      if (runtime) {
        globalThis.AnnaAppRuntime = runtime;
        return runtime;
      }
    } catch {
      // Try the next SDK path; production staging currently serves `latest`.
    }
  }
  return null;
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function stringifyDetail(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(toSerializable(detail));
  } catch {
    return String(detail);
  }
}

function addLog(level, source, message, detail) {
  logs.push({ time: nowTime(), level, source, message, detail: stringifyDetail(detail) });
  if (logs.length > 800) logs = logs.slice(-800);
  renderLogs();
}

function renderLogs() {
  els.logs.innerHTML = "";
  for (const item of logs) {
    const li = document.createElement("li");
    li.className = `log log--${item.level}`;
    const time = document.createElement("span");
    time.className = "log__time";
    time.textContent = item.time;
    const source = document.createElement("span");
    source.className = "log__source";
    source.textContent = item.source;
    const message = document.createElement("span");
    message.className = "log__message";
    message.textContent = item.detail ? `${item.message} ${item.detail}` : item.message;
    li.append(time, source, message);
    els.logs.appendChild(li);
  }
  els.logs.scrollTop = els.logs.scrollHeight;
}

function queueRecordSave(record) {
  const snapshot = toSerializable(record);
  const previous = saveQueues.get(record.record_id) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => putCallRecord(snapshot))
    .catch((error) => {
      addLog("error", "IndexedDB", "保存调用记录失败，当前页面中的结果仍然保留", error);
    });
  saveQueues.set(record.record_id, next);
  void next.finally(() => {
    if (saveQueues.get(record.record_id) === next) saveQueues.delete(record.record_id);
  });
  return next;
}

function appendRecordEvent(entry, event, detail = {}) {
  entry.record.events.push({
    event,
    at: nowIso(),
    elapsed_ms: elapsedMs(entry.startedPerf),
    ...toSerializable(detail),
  });
}

function beginOperation(category, operation, request) {
  const recordId = createRecordId(category);
  const startedAt = nowIso();
  const record = {
    schema_version: RECORD_SCHEMA_VERSION,
    record_id: recordId,
    category,
    operation,
    status: "running",
    started_at: startedAt,
    ended_at: null,
    duration_ms: null,
    request: toSerializable(request),
    response: null,
    error: null,
    events: [{ event: `${operation}.started`, at: startedAt, elapsed_ms: 0 }],
  };
  const entry = { record, startedPerf: performance.now(), background: false };
  liveOperations.set(recordId, entry);
  if (category === "session") activeSessionRecordId = recordId;
  if (category === "llm") activeLlmRecordId = recordId;
  void queueRecordSave(record);
  void loadRecords();
  render();
  return entry;
}

async function finishOperation(entry, status, patch = {}) {
  const { record } = entry;
  Object.assign(record, toSerializable(patch));
  record.status = status;
  record.ended_at = nowIso();
  record.duration_ms = elapsedMs(entry.startedPerf);
  appendRecordEvent(entry, `${record.operation}.${status}`, { duration_ms: record.duration_ms });
  liveOperations.delete(record.record_id);
  if (activeSessionRecordId === record.record_id) activeSessionRecordId = "";
  if (activeLlmRecordId === record.record_id) activeLlmRecordId = "";
  await queueRecordSave(record);
  await loadRecords();
  render();
  return record;
}

function stopWaiting(category) {
  const recordId = category === "session" ? activeSessionRecordId : activeLlmRecordId;
  const entry = liveOperations.get(recordId);
  if (!entry) return;
  entry.background = true;
  entry.record.status = "waiting_stopped";
  appendRecordEvent(entry, "ui.waiting_stopped", {
    message: "用户停止前端等待；平台请求和后台记录继续运行",
  });
  if (category === "session") activeSessionRecordId = "";
  if (category === "llm") activeLlmRecordId = "";
  void queueRecordSave(entry.record);
  addLog("warn", entry.record.operation, "已停止前端等待，后台仍会记录最终返回", entry.record.record_id);
  void loadRecords();
  render();
}

function readJsonStorage(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readSavedSessionIds() {
  const parsed = readJsonStorage(SESSION_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
}

function writeSavedSessionIds(ids) {
  savedSessionIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(savedSessionIds));
  render();
}

function saveSettings() {
  const settings = {
    run_content: els.run_content.value,
    llm_system_prompt: els.llm_system_prompt.value,
    llm_user_prompt: els.llm_user_prompt.value,
    llm_timeout_seconds: els.llm_timeout_seconds.value,
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function restoreSettings() {
  const settings = readJsonStorage(SETTINGS_STORAGE_KEY, {});
  if (typeof settings.run_content === "string") els.run_content.value = settings.run_content;
  if (typeof settings.llm_system_prompt === "string") els.llm_system_prompt.value = settings.llm_system_prompt;
  if (typeof settings.llm_user_prompt === "string") els.llm_user_prompt.value = settings.llm_user_prompt;
  if (typeof settings.llm_timeout_seconds === "string") els.llm_timeout_seconds.value = settings.llm_timeout_seconds;
}

function setConnection(nextConnected, label) {
  connected = nextConnected;
  els.conn_dot.classList.toggle("dot--on", connected);
  els.conn_dot.classList.toggle("dot--off", !connected);
  els.conn_label.textContent = label;
  render();
}

function upsertSession(session) {
  const index = sessions.findIndex((item) => item.app_session_uuid === session.app_session_uuid);
  const next = {
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    state: "held", last_run_at: "", last_error: "", ...session,
  };
  if (index >= 0) sessions = sessions.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item);
  else sessions = [...sessions, next];
  if (!selectedSessionId) selectedSessionId = session.app_session_uuid;
  render();
}

function updateSession(id, patch) {
  sessions = sessions.map((item) => item.app_session_uuid === id
    ? { ...item, ...patch, updated_at: new Date().toISOString() }
    : item);
  render();
}

function removeSession(id) {
  sessions = sessions.filter((item) => item.app_session_uuid !== id);
  if (selectedSessionId === id) selectedSessionId = sessions[0]?.app_session_uuid || "";
  render();
}

function findSelectedSession() {
  return sessions.find((item) => item.app_session_uuid === selectedSessionId) || null;
}

function getManualSessionId() {
  return els.manual_session_id.value.trim();
}

function canUseSession() {
  return connected && anna?.agent?.session;
}

function canUseLlm() {
  return connected && selectLlmInvocationPath(anna) !== "unavailable";
}

function renderSessionList() {
  els.session_list.innerHTML = "";
  els.session_count.textContent = String(sessions.length);
  if (sessions.length === 0) {
    els.session_list.innerHTML = '<li class="empty">当前页面还没有持有 session。</li>';
    return;
  }
  for (const session of sessions) {
    const li = document.createElement("li");
    li.className = `session-item${session.app_session_uuid === selectedSessionId ? " session-item--active" : ""}`;
    const button = document.createElement("button");
    button.className = "session-item__button";
    button.type = "button";
    button.addEventListener("click", () => {
      selectedSessionId = session.app_session_uuid;
      render();
      addLog("ok", "ui", "已选中 session", session.app_session_uuid);
    });
    const id = document.createElement("span");
    id.className = "session-item__id";
    id.textContent = session.app_session_uuid;
    const meta = document.createElement("span");
    meta.className = "session-item__meta";
    meta.textContent = [session.source || "created", session.state || "held",
      session.expires_in == null ? "" : `expires_in=${session.expires_in}s`].filter(Boolean).join(" · ");
    button.append(id, meta);
    li.appendChild(button);
    els.session_list.appendChild(li);
  }
}

function renderSavedList() {
  els.saved_list.innerHTML = "";
  els.saved_count.textContent = String(savedSessionIds.length);
  if (savedSessionIds.length === 0) {
    els.saved_list.innerHTML = '<li class="empty">localStorage 中没有保存的 session id。</li>';
    return;
  }
  for (const id of savedSessionIds) {
    const li = document.createElement("li");
    li.className = "saved-item";
    const text = document.createElement("span");
    text.textContent = id;
    const actions = document.createElement("span");
    actions.className = "saved-item__actions";
    const useButton = createMiniButton("加入", () => {
      upsertSession({ app_session_uuid: id, source: "localStorage", state: "restored" });
      selectedSessionId = id;
      els.manual_session_id.value = id;
    });
    const runButton = createMiniButton("run", () => runSessionById(id, "saved"));
    useButton.disabled = !canUseSession();
    runButton.disabled = !canUseSession() || Boolean(activeSessionRecordId);
    const deleteButton = createMiniButton("移除", () => {
      writeSavedSessionIds(savedSessionIds.filter((item) => item !== id));
    }, "mini-btn mini-btn--danger");
    actions.append(useButton, runButton, deleteButton);
    li.append(text, actions);
    els.saved_list.appendChild(li);
  }
}

function createMiniButton(label, handler, className = "mini-btn") {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function renderResult(element, result) {
  element.textContent = JSON.stringify(toSerializable(result || {}), null, 2);
}

function render() {
  const sessionReady = canUseSession();
  const sessionBusy = Boolean(activeSessionRecordId);
  const manualId = getManualSessionId();
  els.create_session.disabled = !sessionReady || sessionBusy;
  els.delete_selected.disabled = !sessionReady || !selectedSessionId || sessionBusy;
  els.delete_all.disabled = !sessionReady || sessions.length === 0 || sessionBusy;
  els.stop_session_wait.disabled = !sessionBusy;
  els.attach_manual.disabled = !sessionReady || !manualId || sessionBusy;
  els.save_selected.disabled = !selectedSessionId;
  els.run_selected.disabled = !sessionReady || !selectedSessionId || sessionBusy;
  els.run_manual.disabled = !sessionReady || !manualId || sessionBusy;
  els.run_llm.disabled = !canUseLlm() || Boolean(activeLlmRecordId);
  els.stop_llm_wait.disabled = !activeLlmRecordId;
  els.copy_result.disabled = !lastSessionResult;
  els.copy_llm_result.disabled = !lastLlmResult;
  els.clear_records.disabled = liveOperations.size > 0;
  els.background_count.textContent = String([...liveOperations.values()].filter((entry) => entry.background).length);
  els.active_session_record.textContent = activeSessionRecordId || "-";
  els.active_llm_record.textContent = activeLlmRecordId || "-";
  const selected = findSelectedSession();
  els.selected_session_id.textContent = selectedSessionId || "-";
  els.selected_session_source.textContent = selected?.source || "-";
  els.selected_session_state.textContent = selected?.state || "-";
  renderSessionList();
  renderSavedList();
}

function normalizeCreateResult(raw) {
  return {
    app_session_uuid: raw?.app_session_uuid || raw?.appSessionUuid || "",
    expires_in: raw?.expires_in ?? raw?.expiresIn ?? null,
    submode: raw?.submode || "",
    fixed_client_id: raw?.fixed_client_id || raw?.fixedClientId || "",
    granted_tools: Array.isArray(raw?.granted_tools) ? raw.granted_tools : [],
  };
}

async function connectAnna() {
  setConnection(false, "连接中...");
  try {
    const runtime = await loadAnnaRuntimeSdk();
    if (!runtime) throw new Error("AnnaAppRuntime SDK 未加载。请通过 anna-app dev 打开。");
    anna = await runtime.connect();
    setConnection(true, "已连接 Anna");
    addLog("ok", "runtime", "Anna runtime 连接成功");
    try {
      await anna.window?.set_title?.({ title: "Session 生命周期测试" });
    } catch (error) {
      addLog("warn", "runtime", "设置窗口标题失败", error);
    }
  } catch (error) {
    anna = null;
    setConnection(false, "未连接");
    addLog("error", "runtime", "Anna runtime 连接失败，操作已禁用", error);
  }
}

async function createSession() {
  if (!canUseSession()) return;
  const entry = beginOperation("session", "session.create", { submode: "auto" });
  addLog("ok", "session.create", "开始创建 raw agent session", entry.record.record_id);
  try {
    const raw = await anna.agent.session.create({ submode: "auto" });
    appendRecordEvent(entry, "session.create.response_received");
    const normalized = normalizeCreateResult(raw);
    if (!normalized.app_session_uuid) throw new Error("session.create 结果缺少 app_session_uuid");
    upsertSession({ ...normalized, source: "created", state: "held" });
    selectedSessionId = normalized.app_session_uuid;
    writeSavedSessionIds([...savedSessionIds, normalized.app_session_uuid]);
    const record = await finishOperation(entry, "succeeded", { response: raw, session: normalized });
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("ok", "session.create", "session.create 完成", { record_id: record.record_id, duration_ms: record.duration_ms });
  } catch (error) {
    const record = await finishOperation(entry, "failed", { error, timed_out: isTimeoutError(error) });
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("error", "session.create", "创建 session 失败", error);
  }
}

function attachManualSession() {
  const id = getManualSessionId();
  if (!id) return;
  upsertSession({ app_session_uuid: id, source: "manual", state: "attached" });
  selectedSessionId = id;
  addLog("ok", "ui", "手动 session id 已加入持有列表", id);
  render();
}

function saveSelectedSession() {
  if (!selectedSessionId) return;
  writeSavedSessionIds([...savedSessionIds, selectedSessionId]);
  addLog("ok", "storage", "已保存选中 session id 到 localStorage", selectedSessionId);
}

function extractFrameText(frame) {
  if (!frame || typeof frame !== "object") return "";
  if (typeof frame.text === "string") return frame.text;
  if (typeof frame.content === "string") return frame.content;
  if (typeof frame.delta === "string") return frame.delta;
  if (Array.isArray(frame.choices)) {
    return frame.choices.map((choice) => {
      const delta = choice?.delta || {};
      const message = choice?.message || {};
      return [delta.content, delta.text, message.content]
        .filter((item) => typeof item === "string").join("");
    }).join("");
  }
  return "";
}

function createRawSessionRunCollector(entry) {
  const earlyFrames = [];
  const textChunks = [];
  let targetStreamId = "";
  let settled = false;
  let unsubscribe = null;
  let resolveDone;
  let rejectDone;
  let lastFramePerf = null;
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  void done.catch(() => undefined);

  function cleanup() {
    if (typeof unsubscribe === "function") unsubscribe();
    unsubscribe = null;
  }

  function consumeCaptured(captured) {
    const { payload, receivedAt, receivedPerf } = captured;
    if (settled || !payload || typeof payload !== "object") return;
    if (!targetStreamId) {
      earlyFrames.push(captured);
      return;
    }
    if (payload.stream_id !== targetStreamId) return;
    const frame = payload.payload;
    const frameElapsed = elapsedMs(entry.startedPerf, receivedPerf);
    const gap = lastFramePerf == null ? null : elapsedMs(lastFramePerf, receivedPerf);
    lastFramePerf = receivedPerf;
    const frameEntry = {
      index: entry.record.stream_frames.length,
      received_at: receivedAt,
      elapsed_ms: frameElapsed,
      gap_ms: gap,
      envelope: payload,
    };
    entry.record.stream_frames.push(toSerializable(frameEntry));
    entry.record.metrics.frame_count = entry.record.stream_frames.length;
    if (frame != null && entry.record.metrics.first_frame_ms == null) {
      entry.record.metrics.first_frame_ms = frameElapsed;
      entry.record.metrics.first_frame_at = receivedAt;
    }
    if (gap != null) entry.record.metrics.max_frame_gap_ms = Math.max(entry.record.metrics.max_frame_gap_ms || 0, gap);
    appendRecordEvent(entry, "session.run.stream_frame", {
      frame_index: frameEntry.index, stream_id: targetStreamId, done: payload.done === true,
    });
    if (frame != null) {
      addLog("ok", "stream", "收到 stream frame", frame);
      const text = extractFrameText(frame);
      if (text) textChunks.push(text);
      if (frame?.event === "error") {
        settled = true;
        cleanup();
        rejectDone(new Error(frame.message || "session.run stream error"));
        return;
      }
    }
    void queueRecordSave(entry.record);
    if (payload.done) {
      settled = true;
      cleanup();
      resolveDone({ frames: entry.record.stream_frames, text: textChunks.join("") });
    }
  }

  return {
    start(runtime) {
      unsubscribe = runtime.on("rpc.stream", (payload) => consumeCaptured({
        payload, receivedAt: nowIso(), receivedPerf: performance.now(),
      }));
    },
    attach(streamId) {
      targetStreamId = streamId;
      for (const captured of earlyFrames.splice(0)) consumeCaptured(captured);
    },
    cancel(error) {
      if (settled) return;
      settled = true;
      cleanup();
      rejectDone(error);
    },
    done,
  };
}

async function runSessionById(id, source) {
  if (!canUseSession() || !id) return;
  const content = els.run_content.value.trim();
  if (!content) {
    addLog("warn", "session.run", "Prompt 为空，已跳过");
    return;
  }
  saveSettings();
  const entry = beginOperation("session", "session.run", { app_session_uuid: id, source, content });
  entry.record.stream_id = "";
  entry.record.run_id = "";
  entry.record.stream_frames = [];
  entry.record.output_text = "";
  entry.record.metrics = {
    run_rpc_ms: null, first_frame_ms: null, first_frame_at: null,
    stream_complete_ms: null, frame_count: 0, max_frame_gap_ms: 0,
  };
  selectedSessionId = id;
  updateSession(id, { state: "running", last_error: "" });
  addLog("ok", "session.run", "开始 raw session.run", { record_id: entry.record.record_id, app_session_uuid: id });
  const collector = createRawSessionRunCollector(entry);
  try {
    collector.start(anna);
    const runResult = await anna.agent.session.run({ app_session_uuid: id, content });
    entry.record.metrics.run_rpc_ms = elapsedMs(entry.startedPerf);
    entry.record.response = { rpc_response: toSerializable(runResult) };
    appendRecordEvent(entry, "session.run.rpc_response", { duration_ms: entry.record.metrics.run_rpc_ms });
    const streamId = runResult?.stream_id || runResult?.streamId || "";
    if (!streamId) throw new Error("session.run 结果缺少 stream_id");
    entry.record.stream_id = streamId;
    entry.record.run_id = runResult?.run_id || runResult?.runId || "";
    collector.attach(streamId);
    void queueRecordSave(entry.record);
    const collected = await collector.done;
    entry.record.metrics.stream_complete_ms = elapsedMs(entry.startedPerf);
    entry.record.output_text = collected.text;
    updateSession(id, { state: "held", last_run_at: new Date().toISOString(), last_error: "" });
    const record = await finishOperation(entry, "succeeded");
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("ok", "session.run", "session.run 完成", {
      record_id: record.record_id, stream_id: streamId, duration_ms: record.duration_ms,
      first_frame_ms: record.metrics.first_frame_ms, frame_count: record.metrics.frame_count,
    });
  } catch (error) {
    collector.cancel(error instanceof Error ? error : new Error(String(error)));
    updateSession(id, { state: "error", last_error: String(error?.message || error) });
    const record = await finishOperation(entry, "failed", { error, timed_out: isTimeoutError(error) });
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("error", "session.run", "session.run 失败", { record_id: record.record_id, error });
  }
}

async function deleteSessionById(id, source = "session.delete") {
  if (!canUseSession() || !id) return false;
  const entry = beginOperation("session", "session.delete", { app_session_uuid: id, source });
  addLog("ok", source, "开始 raw session.delete", { record_id: entry.record.record_id, app_session_uuid: id });
  try {
    const result = await anna.agent.session.delete({ app_session_uuid: id });
    removeSession(id);
    const record = await finishOperation(entry, "succeeded", { response: result });
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("ok", source, "session.delete 完成", { record_id: record.record_id, duration_ms: record.duration_ms });
    return true;
  } catch (error) {
    updateSession(id, { state: "delete_error", last_error: String(error?.message || error) });
    const record = await finishOperation(entry, "failed", { error, timed_out: isTimeoutError(error) });
    lastSessionResult = record;
    if (!activeSessionRecordId) renderResult(els.result_json, record);
    addLog("error", source, "session.delete 失败", error);
    return false;
  }
}

async function deleteSelectedSession() {
  const id = selectedSessionId;
  if (!id) return;
  if (await deleteSessionById(id)) writeSavedSessionIds(savedSessionIds.filter((item) => item !== id));
}

async function deleteAllSessions() {
  const ids = sessions.map((session) => session.app_session_uuid);
  addLog("warn", "cleanup", "开始清理当前持有的全部 sessions", { count: ids.length });
  for (const id of ids) await deleteSessionById(id, "cleanup");
  writeSavedSessionIds(savedSessionIds.filter((id) => !ids.includes(id)));
  addLog("ok", "cleanup", "全部清理流程结束");
}

async function runLlm() {
  if (!canUseLlm()) return;
  const systemPrompt = els.llm_system_prompt.value.trim();
  const userPrompt = els.llm_user_prompt.value.trim();
  const timeoutSeconds = Number(els.llm_timeout_seconds.value);
  if (!userPrompt) {
    addLog("warn", "llm.complete", "User prompt 不能为空");
    els.llm_user_prompt.focus();
    return;
  }
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 600) {
    addLog("warn", "llm.complete", "超时时间必须在 10～600 秒之间");
    els.llm_timeout_seconds.focus();
    return;
  }
  saveSettings();
  const input = buildLlmInput(systemPrompt, userPrompt);
  const invocationPath = selectLlmInvocationPath(anna);
  const timeoutMs = Math.round(timeoutSeconds * 1000);
  const entry = beginOperation("llm", "llm.complete", {
    input, timeout_ms: timeoutMs, invocation_path: invocationPath,
    timeout_applied_by_runtime: invocationPath === "runtime.call",
  });
  entry.record.invocation_path = invocationPath;
  entry.record.timeout_ms = timeoutMs;
  els.llm_invocation_path.textContent = invocationPath;
  els.llm_duration.textContent = "等待返回中...";
  addLog("ok", "llm.complete", "开始 LLM 调用", { record_id: entry.record.record_id, invocation_path: invocationPath });
  try {
    const invocation = await invokeAnnaLlm(anna, input, timeoutMs);
    const result = invocation.result;
    const output = extractCompletionText(result);
    const record = await finishOperation(entry, "succeeded", {
      response: result,
      output_text: output,
      response_metadata: {
        model: result?.model ?? null,
        usage: result?.usage ?? result?.token_usage ?? null,
        stop_reason: result?.stopReason ?? result?.stop_reason ?? null,
      },
      timed_out: false,
    });
    lastLlmResult = record;
    if (!activeLlmRecordId) {
      renderResult(els.llm_result_json, record);
      els.llm_duration.textContent = `${record.duration_ms} ms`;
    }
    addLog("ok", "llm.complete", "LLM 调用完成", { record_id: record.record_id, duration_ms: record.duration_ms });
  } catch (error) {
    const record = await finishOperation(entry, "failed", { error, timed_out: isTimeoutError(error) });
    lastLlmResult = record;
    if (!activeLlmRecordId) {
      renderResult(els.llm_result_json, record);
      els.llm_duration.textContent = `${record.duration_ms} ms（失败）`;
    }
    addLog("error", "llm.complete", "LLM 调用失败", { record_id: record.record_id, error });
  }
}

async function loadRecords() {
  try {
    callRecords = await listCallRecords();
    if (selectedRecordId && !callRecords.some((record) => record.record_id === selectedRecordId)) selectedRecordId = "";
    renderRecords();
  } catch (error) {
    addLog("error", "IndexedDB", "读取调用记录失败", error);
  }
}

function filteredRecords() {
  const category = els.record_category_filter.value;
  const status = els.record_status_filter.value;
  return callRecords.filter((record) =>
    (category === "all" || record.category === category) &&
    (status === "all" || record.status === status));
}

function renderRecords() {
  els.record_count.textContent = String(callRecords.length);
  els.record_list.innerHTML = "";
  const records = filteredRecords();
  if (records.length === 0) {
    els.record_list.innerHTML = '<li class="empty">当前筛选条件下没有调用记录。</li>';
  } else {
    for (const record of records) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `record-item${record.record_id === selectedRecordId ? " record-item--active" : ""}`;
      const title = document.createElement("span");
      title.className = "record-item__title";
      title.textContent = `${record.operation} · ${record.status}`;
      const meta = document.createElement("span");
      meta.className = "record-item__meta";
      meta.textContent = `${record.started_at || "-"} · ${record.duration_ms ?? "-"} ms`;
      const id = document.createElement("span");
      id.className = "record-item__id";
      id.textContent = record.stream_id ? `${record.record_id} · stream=${record.stream_id}` : record.record_id;
      button.append(title, meta, id);
      button.addEventListener("click", () => {
        selectedRecordId = record.record_id;
        renderRecords();
      });
      li.appendChild(button);
      els.record_list.appendChild(li);
    }
  }
  const selected = callRecords.find((record) => record.record_id === selectedRecordId) || null;
  renderResult(els.record_json, selected);
  els.copy_record.disabled = !selected;
  els.delete_record.disabled = !selected || liveOperations.has(selected.record_id);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    addLog("ok", "clipboard", `${label}已复制`);
  } catch (error) {
    addLog("error", "clipboard", `${label}复制失败`, error);
  }
}

function switchTab(name) {
  for (const button of document.querySelectorAll("[data-tab]")) {
    button.classList.toggle("tab--active", button.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.classList.toggle("tab-panel--active", panel.id === `tab-${name}`);
  }
  if (name === "records") void loadRecords();
}

function bindEvents() {
  for (const button of document.querySelectorAll("[data-tab]")) {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  }
  els.refresh_runtime.addEventListener("click", connectAnna);
  els.create_session.addEventListener("click", createSession);
  els.attach_manual.addEventListener("click", attachManualSession);
  els.save_selected.addEventListener("click", saveSelectedSession);
  els.clear_saved.addEventListener("click", () => writeSavedSessionIds([]));
  els.delete_selected.addEventListener("click", deleteSelectedSession);
  els.delete_all.addEventListener("click", deleteAllSessions);
  els.stop_session_wait.addEventListener("click", () => stopWaiting("session"));
  els.run_selected.addEventListener("click", () => runSessionById(selectedSessionId, "selected"));
  els.run_manual.addEventListener("click", () => runSessionById(getManualSessionId(), "manual"));
  els.manual_session_id.addEventListener("input", render);
  els.run_content.addEventListener("change", saveSettings);
  els.copy_result.addEventListener("click", () => copyText(JSON.stringify(toSerializable(lastSessionResult), null, 2), "最近结果"));
  els.run_llm.addEventListener("click", runLlm);
  els.stop_llm_wait.addEventListener("click", () => stopWaiting("llm"));
  els.copy_llm_result.addEventListener("click", () => copyText(JSON.stringify(toSerializable(lastLlmResult), null, 2), "LLM 结果"));
  for (const input of [els.llm_system_prompt, els.llm_user_prompt, els.llm_timeout_seconds]) {
    input.addEventListener("change", saveSettings);
  }
  els.record_category_filter.addEventListener("change", renderRecords);
  els.record_status_filter.addEventListener("change", renderRecords);
  els.refresh_records.addEventListener("click", loadRecords);
  els.copy_all_records.addEventListener("click", async () => {
    await loadRecords();
    await copyText(JSON.stringify(callRecords, null, 2), "全部调用记录");
  });
  els.clear_records.addEventListener("click", async () => {
    if (!globalThis.confirm("确定清空全部 IndexedDB 调用记录吗？此操作不可撤销。")) return;
    await clearCallRecords();
    selectedRecordId = "";
    await loadRecords();
    addLog("ok", "IndexedDB", "已清空全部调用记录");
  });
  els.copy_record.addEventListener("click", () => {
    const record = callRecords.find((item) => item.record_id === selectedRecordId);
    if (record) void copyText(JSON.stringify(record, null, 2), "当前调用记录");
  });
  els.delete_record.addEventListener("click", async () => {
    if (!selectedRecordId) return;
    await deleteCallRecord(selectedRecordId);
    selectedRecordId = "";
    await loadRecords();
    addLog("ok", "IndexedDB", "已删除当前调用记录");
  });
  els.copy_logs.addEventListener("click", () => copyText(logs.map((item) =>
    `[${item.time}] ${item.level} ${item.source} ${item.message}${item.detail ? ` ${item.detail}` : ""}`).join("\n"), "日志"));
  els.clear_logs.addEventListener("click", () => { logs = []; renderLogs(); });
}

function restoreSavedSessions() {
  savedSessionIds = readSavedSessionIds();
  for (const id of savedSessionIds) {
    upsertSession({ app_session_uuid: id, source: "localStorage", state: "restored" });
  }
  if (savedSessionIds.length > 0) {
    selectedSessionId = savedSessionIds[0];
    els.manual_session_id.value = savedSessionIds[0];
    addLog("ok", "storage", "从 localStorage 读取到持久化 session id", savedSessionIds);
  } else {
    addLog("ok", "storage", "localStorage 中没有持久化 session id");
  }
}

async function initialize() {
  bindEvents();
  restoreSettings();
  restoreSavedSessions();
  renderResult(els.result_json, null);
  renderResult(els.llm_result_json, null);
  renderResult(els.record_json, null);
  try {
    const interrupted = await markUnfinishedRecordsInterrupted();
    if (interrupted > 0) addLog("warn", "IndexedDB", "已将上次页面遗留的未完成记录标记为 interrupted", { count: interrupted });
  } catch (error) {
    addLog("error", "IndexedDB", "初始化调用记录存储失败", error);
  }
  await loadRecords();
  render();
  await connectAnna();
}

void initialize();
