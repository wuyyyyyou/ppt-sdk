const ANNA_RUNTIME_SDK_URLS = [
  "/static/anna-apps/_sdk/latest/index.js",
  "/static/anna-apps/_sdk/0.2.0/index.js",
  "/static/anna-apps/_sdk/0.1.0/index.js",
];
const STORAGE_KEY = "test-session-app.saved-session-ids.v1";

const els = {
  connDot: document.querySelector("#conn-dot"),
  connLabel: document.querySelector("#conn-label"),
  refreshRuntime: document.querySelector("#refresh-runtime"),
  createSession: document.querySelector("#create-session"),
  deleteSelected: document.querySelector("#delete-selected"),
  deleteAll: document.querySelector("#delete-all"),
  manualSessionId: document.querySelector("#manual-session-id"),
  attachManual: document.querySelector("#attach-manual"),
  saveSelected: document.querySelector("#save-selected"),
  clearSaved: document.querySelector("#clear-saved"),
  sessionCount: document.querySelector("#session-count"),
  savedCount: document.querySelector("#saved-count"),
  sessionList: document.querySelector("#session-list"),
  savedList: document.querySelector("#saved-list"),
  selectedSessionId: document.querySelector("#selected-session-id"),
  selectedSessionSource: document.querySelector("#selected-session-source"),
  selectedSessionState: document.querySelector("#selected-session-state"),
  runContent: document.querySelector("#run-content"),
  runSelected: document.querySelector("#run-selected"),
  runManual: document.querySelector("#run-manual"),
  copyResult: document.querySelector("#copy-result"),
  resultJson: document.querySelector("#result-json"),
  logs: document.querySelector("#logs"),
  copyLogs: document.querySelector("#copy-logs"),
  clearLogs: document.querySelector("#clear-logs"),
};

let anna = null;
let connected = false;
let selectedSessionId = "";
let sessions = [];
let savedSessionIds = [];
let logs = [];
let lastResult = null;

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
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function addLog(level, source, message, detail) {
  const entry = {
    time: nowTime(),
    level,
    source,
    message,
    detail: stringifyDetail(detail),
  };
  logs.push(entry);
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

function readSavedSessionIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim())
      : [];
  } catch {
    return [];
  }
}

function writeSavedSessionIds(ids) {
  const uniqueIds = [];
  const seen = new Set();
  for (const id of ids) {
    const cleanId = id.trim();
    if (!cleanId || seen.has(cleanId)) continue;
    seen.add(cleanId);
    uniqueIds.push(cleanId);
  }
  savedSessionIds = uniqueIds;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSessionIds));
  render();
}

function setConnection(nextConnected, label) {
  connected = nextConnected;
  els.connDot.classList.toggle("dot--on", connected);
  els.connDot.classList.toggle("dot--off", !connected);
  els.connLabel.textContent = label;
  render();
}

function isSameSession(left, right) {
  return left.app_session_uuid === right.app_session_uuid;
}

function upsertSession(session) {
  const existingIndex = sessions.findIndex((item) => isSameSession(item, session));
  if (existingIndex >= 0) {
    sessions = sessions.map((item, index) =>
      index === existingIndex ? { ...item, ...session, updated_at: new Date().toISOString() } : item
    );
  } else {
    sessions = [
      ...sessions,
      {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "held",
        last_run_at: "",
        last_error: "",
        ...session,
      },
    ];
  }
  if (!selectedSessionId) selectedSessionId = session.app_session_uuid;
  render();
}

function updateSession(id, patch) {
  sessions = sessions.map((item) =>
    item.app_session_uuid === id
      ? { ...item, ...patch, updated_at: new Date().toISOString() }
      : item
  );
  render();
}

function removeSession(id) {
  sessions = sessions.filter((item) => item.app_session_uuid !== id);
  if (selectedSessionId === id) {
    selectedSessionId = sessions[0]?.app_session_uuid || "";
  }
  render();
}

function findSelectedSession() {
  return sessions.find((item) => item.app_session_uuid === selectedSessionId) || null;
}

function getManualSessionId() {
  return els.manualSessionId.value.trim();
}

function canUseRuntime() {
  return connected && anna?.agent?.session;
}

function renderSessionList() {
  els.sessionList.innerHTML = "";
  els.sessionCount.textContent = String(sessions.length);

  if (sessions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "当前页面还没有持有 session。";
    els.sessionList.appendChild(empty);
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
    meta.textContent = [
      session.source || "created",
      session.state || "held",
      session.expires_in == null ? "" : `expires_in=${session.expires_in}s`,
    ].filter(Boolean).join(" · ");

    button.append(id, meta);
    li.appendChild(button);
    els.sessionList.appendChild(li);
  }
}

function renderSavedList() {
  els.savedList.innerHTML = "";
  els.savedCount.textContent = String(savedSessionIds.length);

  if (savedSessionIds.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "localStorage 中没有保存的 session id。";
    els.savedList.appendChild(empty);
    return;
  }

  for (const id of savedSessionIds) {
    const li = document.createElement("li");
    li.className = "saved-item";

    const text = document.createElement("span");
    text.textContent = id;

    const actions = document.createElement("span");
    actions.className = "saved-item__actions";

    const useButton = document.createElement("button");
    useButton.className = "mini-btn";
    useButton.type = "button";
    useButton.textContent = "加入";
    useButton.disabled = !canUseRuntime();
    useButton.addEventListener("click", () => {
      upsertSession({
        app_session_uuid: id,
        source: "localStorage",
        state: "restored",
      });
      selectedSessionId = id;
      els.manualSessionId.value = id;
      addLog("ok", "storage", "从 localStorage 加入持有列表", id);
    });

    const runButton = document.createElement("button");
    runButton.className = "mini-btn";
    runButton.type = "button";
    runButton.textContent = "run";
    runButton.disabled = !canUseRuntime();
    runButton.addEventListener("click", () => runSessionById(id, "saved"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "mini-btn mini-btn--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "移除";
    deleteButton.addEventListener("click", () => {
      writeSavedSessionIds(savedSessionIds.filter((item) => item !== id));
      addLog("ok", "storage", "已从 localStorage 移除 session id", id);
    });

    actions.append(useButton, runButton, deleteButton);
    li.append(text, actions);
    els.savedList.appendChild(li);
  }
}

function renderSelected() {
  const selected = findSelectedSession();
  els.selectedSessionId.textContent = selectedSessionId || "-";
  els.selectedSessionSource.textContent = selected?.source || "-";
  els.selectedSessionState.textContent = selected?.state || "-";
}

function renderResult(result) {
  lastResult = result;
  els.resultJson.textContent = JSON.stringify(result || {}, null, 2);
  els.copyResult.disabled = !result;
}

function render() {
  const hasRuntime = canUseRuntime();
  const hasSelected = Boolean(selectedSessionId);
  const manualId = getManualSessionId();
  els.createSession.disabled = !hasRuntime;
  els.deleteSelected.disabled = !hasRuntime || !hasSelected;
  els.deleteAll.disabled = !hasRuntime || sessions.length === 0;
  els.attachManual.disabled = !hasRuntime || !manualId;
  els.saveSelected.disabled = !hasSelected;
  els.runSelected.disabled = !hasRuntime || !hasSelected;
  els.runManual.disabled = !hasRuntime || !manualId;
  renderSessionList();
  renderSavedList();
  renderSelected();
}

function normalizeCreateResult(raw) {
  return {
    raw,
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
    addLog("ok", "runtime", "Anna runtime 连接成功", {
      capabilities: anna.capabilities || null,
    });
    try {
      await anna.window?.set_title?.({ title: "Session 生命周期测试" });
    } catch (error) {
      addLog("warn", "runtime", "设置窗口标题失败", String(error?.message || error));
    }
  } catch (error) {
    anna = null;
    setConnection(false, "未连接");
    addLog("error", "runtime", "Anna runtime 连接失败，操作已禁用", String(error?.message || error));
  }
}

async function createSession() {
  if (!canUseRuntime()) return;
  els.createSession.disabled = true;
  addLog("ok", "session.create", "开始创建 raw agent session", { submode: "auto" });
  try {
    const raw = await anna.agent.session.create({ submode: "auto" });
    const normalized = normalizeCreateResult(raw);
    addLog("ok", "session.create", "收到 session.create 结果", raw);
    if (!normalized.app_session_uuid) {
      throw new Error("session.create 结果缺少 app_session_uuid");
    }
    upsertSession({
      ...normalized,
      source: "created",
      state: "held",
    });
    selectedSessionId = normalized.app_session_uuid;
    writeSavedSessionIds([...savedSessionIds, normalized.app_session_uuid]);
    renderResult({
      operation: "session.create",
      session: normalized,
    });
  } catch (error) {
    addLog("error", "session.create", "创建 session 失败", String(error?.message || error));
    renderResult({
      operation: "session.create",
      error: String(error?.message || error),
    });
  } finally {
    render();
  }
}

function attachManualSession() {
  const id = getManualSessionId();
  if (!id) return;
  upsertSession({
    app_session_uuid: id,
    source: "manual",
    state: "attached",
  });
  selectedSessionId = id;
  addLog("ok", "ui", "手动 session id 已加入持有列表", id);
  render();
}

function saveSelectedSession() {
  if (!selectedSessionId) return;
  writeSavedSessionIds([...savedSessionIds, selectedSessionId]);
  addLog("ok", "storage", "已保存选中 session id 到 localStorage", selectedSessionId);
}

async function runSessionById(id, source) {
  if (!canUseRuntime() || !id) return;
  const content = els.runContent.value.trim();
  if (!content) {
    addLog("warn", "session.run", "Prompt 为空，已跳过");
    return;
  }

  selectedSessionId = id;
  updateSession(id, { state: "running", last_error: "" });
  addLog("ok", "session.run", "开始 raw session.run", {
    app_session_uuid: id,
    source,
    content,
  });

  const collector = createRawSessionRunCollector();
  collector.start(anna);
  try {
    const runResult = await anna.agent.session.run({
      app_session_uuid: id,
      content,
    });
    addLog("ok", "session.run", "收到 session.run RPC 结果", runResult);

    const streamId = runResult?.stream_id || runResult?.streamId || "";
    if (!streamId) {
      throw new Error("session.run 结果缺少 stream_id");
    }
    collector.attach(streamId);

    const collected = await collector.done;
    updateSession(id, {
      state: "held",
      last_run_at: new Date().toISOString(),
      last_error: "",
    });
    addLog("ok", "session.run", "session.run 完成", {
      app_session_uuid: id,
      stream_id: streamId,
      frame_count: collected.frames.length,
      text: collected.text,
    });
    renderResult({
      operation: "session.run",
      app_session_uuid: id,
      source,
      stream_id: streamId,
      run_id: runResult?.run_id || runResult?.runId || "",
      frame_count: collected.frames.length,
      text: collected.text,
      frames: collected.frames,
    });
  } catch (error) {
    collector.cancel(error instanceof Error ? error : new Error(String(error)));
    const message = String(error?.message || error);
    updateSession(id, {
      state: "error",
      last_error: message,
    });
    addLog("error", "session.run", "session.run 失败", {
      app_session_uuid: id,
      message,
    });
    renderResult({
      operation: "session.run",
      app_session_uuid: id,
      source,
      error: message,
    });
  }
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
        .filter((item) => typeof item === "string")
        .join("");
    }).join("");
  }
  return "";
}

function createRawSessionRunCollector() {
  const earlyFrames = [];
  const frames = [];
  const textChunks = [];
  let targetStreamId = "";
  let settled = false;
  let unsubscribe = null;
  let resolveDone;
  let rejectDone;

  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  function consumePayload(payload) {
    if (settled || !payload || typeof payload !== "object") return;
    if (!targetStreamId) {
      earlyFrames.push(payload);
      return;
    }
    if (payload.stream_id !== targetStreamId) return;

    const frame = payload.payload;
    if (frame != null) {
      frames.push(frame);
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

    if (payload.done) {
      settled = true;
      cleanup();
      resolveDone({
        frames,
        text: textChunks.join(""),
      });
    }
  }

  function cleanup() {
    if (typeof unsubscribe === "function") {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    start(runtime) {
      unsubscribe = runtime.on("rpc.stream", consumePayload);
    },
    attach(streamId) {
      targetStreamId = streamId;
      const pending = earlyFrames.splice(0, earlyFrames.length);
      for (const payload of pending) {
        consumePayload(payload);
      }
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

async function deleteSessionById(id, source = "session.delete") {
  if (!canUseRuntime() || !id) return false;
  addLog("ok", source, "开始 raw session.delete", { app_session_uuid: id });
  try {
    const result = await anna.agent.session.delete({ app_session_uuid: id });
    addLog("ok", source, "session.delete 完成", result);
    removeSession(id);
    renderResult({
      operation: "session.delete",
      app_session_uuid: id,
      result,
    });
    return true;
  } catch (error) {
    const message = String(error?.message || error);
    updateSession(id, {
      state: "delete_error",
      last_error: message,
    });
    addLog("error", source, "session.delete 失败", {
      app_session_uuid: id,
      message,
    });
    renderResult({
      operation: "session.delete",
      app_session_uuid: id,
      error: message,
    });
    return false;
  }
}

async function deleteSelectedSession() {
  if (!selectedSessionId) return;
  const id = selectedSessionId;
  const deleted = await deleteSessionById(id);
  if (deleted) {
    writeSavedSessionIds(savedSessionIds.filter((item) => item !== id));
  }
}

async function deleteAllSessions() {
  const ids = sessions.map((session) => session.app_session_uuid);
  addLog("warn", "cleanup", "开始清理当前持有的全部 sessions", { count: ids.length });
  for (const id of ids) {
    await deleteSessionById(id, "cleanup");
  }
  writeSavedSessionIds(savedSessionIds.filter((id) => !ids.includes(id)));
  addLog("ok", "cleanup", "全部清理流程结束");
}

function clearSavedSessions() {
  writeSavedSessionIds([]);
  addLog("ok", "storage", "已清空 localStorage session id 列表");
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    addLog("ok", "clipboard", `${label}已复制`);
  } catch (error) {
    addLog("error", "clipboard", `${label}复制失败`, String(error?.message || error));
  }
}

function bindEvents() {
  els.refreshRuntime.addEventListener("click", connectAnna);
  els.createSession.addEventListener("click", createSession);
  els.attachManual.addEventListener("click", attachManualSession);
  els.saveSelected.addEventListener("click", saveSelectedSession);
  els.clearSaved.addEventListener("click", clearSavedSessions);
  els.deleteSelected.addEventListener("click", deleteSelectedSession);
  els.deleteAll.addEventListener("click", deleteAllSessions);
  els.runSelected.addEventListener("click", () => runSessionById(selectedSessionId, "selected"));
  els.runManual.addEventListener("click", () => runSessionById(getManualSessionId(), "manual"));
  els.manualSessionId.addEventListener("input", render);
  els.copyResult.addEventListener("click", () =>
    copyText(JSON.stringify(lastResult || {}, null, 2), "最近结果")
  );
  els.copyLogs.addEventListener("click", () =>
    copyText(logs.map((item) =>
      `[${item.time}] ${item.level} ${item.source} ${item.message}${item.detail ? ` ${item.detail}` : ""}`
    ).join("\n"), "日志")
  );
  els.clearLogs.addEventListener("click", () => {
    logs = [];
    renderLogs();
  });
}

function restoreSavedSessions() {
  savedSessionIds = readSavedSessionIds();
  if (savedSessionIds.length > 0) {
    addLog("ok", "storage", "从 localStorage 读取到持久化 session id", savedSessionIds);
    for (const id of savedSessionIds) {
      upsertSession({
        app_session_uuid: id,
        source: "localStorage",
        state: "restored",
      });
    }
    selectedSessionId = savedSessionIds[0];
    els.manualSessionId.value = savedSessionIds[0];
  } else {
    addLog("ok", "storage", "localStorage 中没有持久化 session id");
  }
  render();
}

bindEvents();
restoreSavedSessions();
renderResult(null);
void connectAnna();
