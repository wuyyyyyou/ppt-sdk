// Host Upload Demo — drives the host/uploadFile reverse-RPC (inline /
// negotiate / confirm) through a bundled Executa.
//
//   iframe ── tools.invoke(make_sample) ──▶ Executa ── writes scratch file ─▶ local disk
//   iframe ── tools.invoke(host_upload_path) ──▶ Executa ── host/uploadFile ─▶ host ─▶ R2
//                                                    │ inline (≤8 MiB) OR
//                                                    │ negotiate → PUT (plugin→R2) → confirm
//                                                    ▼
//                                              short-lived download URL (~30 min TTL)
//
// The crucial design point: the iframe never ships file bytes. It only sends
// small control messages (a size, or a local path). The Executa sources the
// bytes locally and — in negotiate mode — streams them straight to R2, so the
// payload never crosses the JSON-RPC stdio channel. That is what lets
// host/uploadFile scale past the stdio line limit.
//
// Loaded as a native ES module, so it imports the Anna App Runtime SDK below.
// The SDK (@anna-ai/app-runtime >= 0.5.0) is a named ESM export.

import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

// Bundled-executa handle → concrete tool_id resolution.
//
// The manifest references `bundled:file-upload-via-executa` (a stable handle).
// At publish time the server mints a real tool_id and writes it to
// `bundle/anna-tool-ids.js`. `anna-app dev` does the same with the local dev
// tool_id. We read the resolved id from the sidecar and only fall back to the
// hard-coded dev id (which must match executas/.../executa.json "tool_id")
// when the sidecar is absent.
const DEV_FALLBACK_TOOL_ID = "tool-test-file-upload-12345678";
const EXECUTA_TOOL_ID =
  (typeof window !== "undefined"
    && window.__ANNA_TOOL_IDS__
    && window.__ANNA_TOOL_IDS__["file-upload-via-executa"])
  || DEV_FALLBACK_TOOL_ID;

const MIB = 1024 * 1024;
const DIAGNOSTIC_PAGE_BYTES = 24 * 1024;
const DIAGNOSTIC_MAX_PAGES = 1000;
const RACE_SAMPLE_BYTES = 256 * 1024;

const I18N = {
  zh: {
    languageLabel: "语言",
    raceTitle: "2. 并发 invoke 竞态复现",
    pathTitle: "3. 按本地路径上传文件",
    raceDescription: "强制让小文件执行 negotiate → PUT → confirm，并发发起多个独立 tools.invoke 调用。",
    concurrencyLabel: "并发数",
    totalCallsLabel: "总调用数",
    delayLabel: "confirm 前延迟",
    jitterLabel: "随机抖动",
    raceNote: "建议先用并发数 1 建立基线，再用 4 或 8 重复测试。测试复用一个 256 KiB 本地文件，但每次上传使用唯一文件名。",
    startRace: "开始压测",
    stopRace: "停止调度",
    clearLogs: "清空日志",
    downloadLogs: "下载 JSONL",
    successLabel: "成功",
    failedLabel: "失败",
    invalidRequestLabel: "归属错误",
    activeLabel: "进行中",
    preparingSample: "正在准备测试文件…",
    runningRace: "正在执行并发上传…",
    raceFinished: "测试完成",
    raceStopped: "已停止继续调度",
  },
  en: {
    languageLabel: "Language",
    raceTitle: "2. Concurrent invoke race reproducer",
    pathTitle: "3. Upload a local file by path",
    raceDescription: "Force small files through negotiate → PUT → confirm and issue several independent tools.invoke calls concurrently.",
    concurrencyLabel: "Concurrency",
    totalCallsLabel: "Total calls",
    delayLabel: "Delay before confirm",
    jitterLabel: "Random jitter",
    raceNote: "Start with concurrency 1 as the baseline, then repeat with 4 or 8. The test reuses one 256 KiB local sample but gives every upload a unique filename.",
    startRace: "Start stress test",
    stopRace: "Stop scheduling",
    clearLogs: "Clear logs",
    downloadLogs: "Download JSONL",
    successLabel: "Succeeded",
    failedLabel: "Failed",
    invalidRequestLabel: "Invalid request",
    activeLabel: "Active",
    preparingSample: "Preparing the test file…",
    runningRace: "Running concurrent uploads…",
    raceFinished: "Test completed",
    raceStopped: "Stopped scheduling new calls",
  },
};

let locale = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";

function t(key) {
  return I18N[locale][key] || I18N.en[key] || key;
}

function applyLocale() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $("language-select").value = locale;
}

// The host validates the upload MIME against the user's upload_grant
// allowedMimeTypes whitelist. The dev grant whitelists image/*, text/plain,
// text/markdown, application/json and application/pdf — but NOT
// application/octet-stream. Synthetic samples are therefore labelled as a
// whitelisted type (the host checks the MIME string, not the bytes).
const SAMPLE_MIME = "application/pdf";

// Extension → whitelisted MIME for the upload-by-path field.
const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};

function guessMime(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

// Preset payload sizes chosen to straddle the two thresholds:
//   - 8 MiB  — the host/uploadFile inline cap (inline → negotiate)
//   - per-file upload_grant quota (dev = 25 MiB) → success vs UPLOAD_TOO_LARGE
const PRESETS = [
  { label: "1 MiB", bytes: 1 * MIB, hint: "inline" },
  { label: "6 MiB", bytes: 6 * MIB, hint: "inline" },
  { label: "12 MiB", bytes: 12 * MIB, hint: "negotiate" },
  { label: "18 MiB", bytes: 18 * MIB, hint: "negotiate" },
  { label: "30 MiB", bytes: 30 * MIB, hint: "quota ✗" },
];

const $ = (id) => document.getElementById(id);
const statusBox = $("status");
const rawBox = $("raw");

const annaReady = (async () => {
  const anna = await AnnaAppRuntime.connect();
  window.anna = anna;
  return anna;
})().catch((err) => {
  showStatus("runtime.connect", err, true);
  throw err;
});

function showStatus(label, payload, isError) {
  const msg = isError
    ? `${(payload && (payload.code || payload.error?.code)) || "error"}: ${
        (payload && (payload.message || payload.error?.message)) || String(payload)
      }`
    : payload;
  statusBox.textContent = `[${label}] ${msg}`;
  statusBox.classList.toggle("err", !!isError);
  statusBox.classList.toggle("ok", !isError);
}

// matrix host unwraps the plugin's {success, tool, data} envelope before
// forwarding to the iframe, so `reply` IS the bare tool payload. Fall back to
// reply.data for forward-compat in case a host stops unwrapping.
function unwrap(reply) {
  if (reply && typeof reply === "object" && reply.data && reply.tool) {
    return reply.data;
  }
  return reply ?? {};
}

async function invoke(method, args) {
  const anna = await annaReady;
  return anna.tools.invoke({ tool_id: EXECUTA_TOOL_ID, method, args });
}

function formatSize(n) {
  if (n == null) return "?";
  if (n < 1024) return `${n} B`;
  if (n < MIB) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / MIB).toFixed(2)} MiB`;
}

// ─── host/uploadFile orchestration ──────────────────────────────────────────

// Ask the Executa to persist a local file via host/uploadFile.
// Returns the unwrapped tool payload: { ok, mode, filename, size_bytes,
// mime_type, download_url, r2_key, expires_at }.
async function uploadPath(path, { filename, mime_type, purpose } = {}) {
  const reply = await invoke("host_upload_path", {
    path,
    filename: filename || "",
    mime_type: mime_type || "application/octet-stream",
    purpose: purpose || "user_artifact",
  });
  rawBox.textContent = JSON.stringify(reply, null, 2);
  return unwrap(reply);
}

// ─── Concurrent Host Upload race reproducer ────────────────────────────────

let raceEvents = [];
let executaRaceEvents = [];
let currentRace = null;
let stopRaceScheduling = false;

function createRunId() {
  const suffix = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `host-upload-race-${Date.now()}-${suffix}`;
}

function redactDiagnosticValue(value) {
  if (Array.isArray(value)) return value.map(redactDiagnosticValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/(authorization|token|signature|signed[_-]?url|put[_-]?url|download[_-]?url)/i.test(key) || key.toLowerCase() === "url") {
      return [key, "[REDACTED]"];
    }
    return [key, redactDiagnosticValue(child)];
  }));
}

function normalizeError(error) {
  if (!error) return { name: "Error", message: "Unknown error" };
  return {
    name: error.name || "Error",
    message: error.message || error.error?.message || String(error),
    code: error.code ?? error.error?.code ?? null,
    data: redactDiagnosticValue(error.data ?? error.error?.data ?? null),
  };
}

function summarizeUploadResult(result) {
  return {
    ok: result.ok,
    mode: result.mode,
    run_id: result.run_id,
    call_id: result.call_id,
    filename: result.filename,
    size_bytes: result.size_bytes,
    mime_type: result.mime_type,
    r2_key: result.r2_key,
    expires_at: result.expires_at,
  };
}

function appendRaceEvent(event, render = true) {
  const entry = {
    timestamp: new Date().toISOString(),
    source: "browser",
    ...event,
  };
  raceEvents.push(entry);
  if (render) renderRaceLog();
  return entry;
}

function renderRaceLog() {
  const log = $("race-log");
  const visible = raceEvents.slice(-120).map((event) => {
    const time = event.timestamp.slice(11, 23);
    const id = event.call_id ? ` ${event.call_id}` : "";
    const detail = event.error?.message || event.r2_key || event.message || "";
    return `${time} ${event.event}${id}${detail ? ` · ${detail}` : ""}`;
  });
  log.textContent = visible.length ? visible.join("\n") : "(idle)";
  log.scrollTop = log.scrollHeight;
}

function updateRaceSummary() {
  if (!currentRace) {
    $("race-success").textContent = "0";
    $("race-failed").textContent = "0";
    $("race-invalid").textContent = "0";
    $("race-active").textContent = "0";
    return;
  }
  $("race-success").textContent = String(currentRace.succeeded);
  $("race-failed").textContent = String(currentRace.failed);
  $("race-invalid").textContent = String(currentRace.invalidRequest);
  $("race-active").textContent = String(currentRace.active);
}

async function runRaceCall(sample, index, config) {
  const callId = `call-${String(index + 1).padStart(3, "0")}`;
  const filename = `${config.runId}-${callId}.png`;
  const started = performance.now();
  currentRace.active += 1;
  updateRaceSummary();
  appendRaceEvent({
    event: "browser.invoke.started",
    run_id: config.runId,
    call_id: callId,
    index,
  });
  try {
    const reply = await invoke("host_upload_path", {
      path: sample.path,
      filename,
      mime_type: "image/png",
      purpose: "user_artifact",
      mode: "negotiate",
      run_id: config.runId,
      call_id: callId,
      delay_before_confirm_ms: config.delayMs,
      jitter_ms: config.jitterMs,
    });
    const result = unwrap(reply);
    currentRace.succeeded += 1;
    appendRaceEvent({
      event: "browser.invoke.succeeded",
      run_id: config.runId,
      call_id: callId,
      duration_ms: Math.round(performance.now() - started),
      r2_key: result.r2_key || null,
      result: summarizeUploadResult(result),
    });
  } catch (error) {
    const normalized = normalizeError(error);
    currentRace.failed += 1;
    if (
      normalized.data?.errorCode === "UPLOAD_INVALID_REQUEST"
      || /r2_key does not belong to this invoke/i.test(normalized.message)
    ) {
      currentRace.invalidRequest += 1;
    }
    appendRaceEvent({
      event: "browser.invoke.failed",
      run_id: config.runId,
      call_id: callId,
      duration_ms: Math.round(performance.now() - started),
      error: normalized,
    });
  } finally {
    currentRace.active -= 1;
    currentRace.completed += 1;
    updateRaceSummary();
  }
}

async function fetchExecutaRaceEvents(runId) {
  try {
    const events = [];
    let cursor = 0;
    let pageCount = 0;
    let done = false;
    while (pageCount < DIAGNOSTIC_MAX_PAGES) {
      const reply = await invoke("get_diagnostic_log", {
        run_id: runId,
        cursor,
        max_bytes: DIAGNOSTIC_PAGE_BYTES,
      });
      const page = unwrap(reply);
      const pageEvents = Array.isArray(page.events) ? page.events : [];
      events.push(...pageEvents);
      pageCount += 1;
      if (page.done) {
        done = true;
        break;
      }
      if (!Number.isInteger(page.next_cursor) || page.next_cursor <= cursor) {
        throw new Error("get_diagnostic_log returned an invalid next_cursor");
      }
      cursor = page.next_cursor;
    }
    if (!done) {
      throw new Error("get_diagnostic_log exceeded the pagination safety limit");
    }
    executaRaceEvents = events;
    appendRaceEvent({
      event: "browser.executa-log.loaded",
      run_id: runId,
      event_count: executaRaceEvents.length,
      page_count: pageCount,
    });
  } catch (error) {
    appendRaceEvent({
      event: "browser.executa-log.failed",
      run_id: runId,
      error: normalizeError(error),
    });
  }
}

async function startRace() {
  if (currentRace?.running) return;
  stopRaceScheduling = false;
  raceEvents = [];
  executaRaceEvents = [];
  const config = {
    runId: createRunId(),
    concurrency: Number($("race-concurrency").value),
    total: Number($("race-total").value),
    delayMs: Number($("race-delay").value),
    jitterMs: Number($("race-jitter").value),
  };
  currentRace = {
    ...config,
    running: true,
    active: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    invalidRequest: 0,
    started_at: new Date().toISOString(),
  };
  updateRaceSummary();
  $("race-start-btn").disabled = true;
  $("race-stop-btn").disabled = false;
  $("race-download-btn").disabled = true;
  showStatus("race", t("preparingSample"), false);
  appendRaceEvent({ event: "browser.run.started", run_id: config.runId, config });

  try {
    const sampleReply = await invoke("make_sample", {
      size_bytes: RACE_SAMPLE_BYTES,
      filename: "host-upload-race-sample.png",
    });
    const sample = unwrap(sampleReply);
    if (!sample.path) throw new Error("make_sample returned no path");
    showStatus("race", t("runningRace"), false);

    let nextIndex = 0;
    async function worker() {
      while (!stopRaceScheduling) {
        const index = nextIndex++;
        if (index >= config.total) return;
        await runRaceCall(sample, index, config);
      }
    }
    await Promise.all(Array.from({ length: config.concurrency }, () => worker()));
  } catch (error) {
    appendRaceEvent({
      event: "browser.run.setup-failed",
      run_id: config.runId,
      error: normalizeError(error),
    });
  } finally {
    currentRace.running = false;
    currentRace.ended_at = new Date().toISOString();
    await fetchExecutaRaceEvents(config.runId);
    appendRaceEvent({
      event: "browser.run.finished",
      run_id: config.runId,
      stopped: stopRaceScheduling,
      summary: {
        completed: currentRace.completed,
        succeeded: currentRace.succeeded,
        failed: currentRace.failed,
        invalid_request: currentRace.invalidRequest,
      },
    });
    showStatus("race", stopRaceScheduling ? t("raceStopped") : t("raceFinished"), false);
    $("race-start-btn").disabled = false;
    $("race-stop-btn").disabled = true;
    $("race-download-btn").disabled = false;
    updateRaceSummary();
  }
}

function downloadRaceLog() {
  if (!currentRace) return;
  const metadata = {
    timestamp: new Date().toISOString(),
    source: "diagnostic",
    event: "diagnostic.metadata",
    run: currentRace,
    tool_id: EXECUTA_TOOL_ID,
    user_agent: navigator.userAgent,
  };
  const lines = [metadata, ...raceEvents, ...executaRaceEvents.map((event) => ({ source: "executa", ...event }))]
    .sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)))
    .map((event) => JSON.stringify(event));
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentRace.runId}.jsonl`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Generate a scratch payload of `bytes` on the Executa host, then upload it.
async function runPreset(preset) {
  const filename = `sample-${preset.label.replace(/\s+/g, "")}.pdf`;
  const entry = addResult(`${preset.label} sample`, "uploading", "make_sample…");
  try {
    const sampleReply = await invoke("make_sample", {
      size_bytes: preset.bytes,
      filename,
    });
    const sample = unwrap(sampleReply); // { ok, path, filename, size_bytes }
    if (!sample.path) throw new Error("make_sample returned no path");

    entry.detail = "host/uploadFile…";
    renderResults();

    const res = await uploadPath(sample.path, {
      filename: sample.filename,
      mime_type: SAMPLE_MIME,
      purpose: "user_artifact",
    });
    entry.status = "done";
    entry.url = res.download_url || null;
    entry.expires_at = res.expires_at || null;
    entry.detail = `✓ ${formatSize(res.size_bytes)} · ${res.mode || "?"}`;
    showStatus("host_upload_path", `${preset.label} → ${res.mode} ✓`, false);
  } catch (err) {
    entry.status = "error";
    entry.detail = `✗ ${(err && (err.code || err.message)) || err}`;
    showStatus("host_upload_path", err, true);
  }
  renderResults();
}

// ─── Result list rendering ───────────────────────────────────────────────────

/** @type {{ title: string, status: string, detail: string, url?: string|null, expires_at?: string|null }[]} */
let results = [];

function addResult(title, status, detail) {
  const entry = { title, status, detail };
  results.unshift(entry); // newest first
  renderResults();
  return entry;
}

function renderResults() {
  const list = $("result-list");
  list.innerHTML = "";
  for (const entry of results) {
    const li = document.createElement("li");
    li.className = `file-item ${entry.status}`;

    const meta = document.createElement("div");
    meta.className = "fi-meta";
    const name = document.createElement("span");
    name.className = "fi-name";
    name.textContent = entry.title;
    meta.appendChild(name);

    const state = document.createElement("span");
    state.className = "fi-state";
    state.textContent = entry.detail || entry.status;

    li.appendChild(meta);
    li.appendChild(state);
    // Host Upload objects are transient and never listed, so the returned
    // short-lived link is the only deliverable — surface it inline.
    if (entry.url) {
      const a = document.createElement("a");
      a.className = "fi-link";
      a.href = entry.url;
      a.textContent = "open ↗";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      if (entry.expires_at) a.title = `expires ${entry.expires_at}`;
      li.appendChild(a);
    }
    list.appendChild(li);
  }
}

// ─── Wiring: preset buttons ──────────────────────────────────────────────────

const presetRow = $("preset-row");
for (const preset of PRESETS) {
  const btn = document.createElement("button");
  btn.className = "secondary";
  btn.innerHTML = `${preset.label}<span class="muted preset-hint"> · ${preset.hint}</span>`;
  btn.addEventListener("click", async () => {
    presetRow.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await runPreset(preset);
    } finally {
      presetRow.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  });
  presetRow.appendChild(btn);
}

// ─── Wiring: upload by local path ────────────────────────────────────────────

$("path-upload-btn").addEventListener("click", async () => {
  const path = $("path-input").value.trim();
  if (!path) {
    showStatus("host_upload_path", "enter an absolute local path", true);
    return;
  }
  const purpose = $("purpose-select").value;
  const filename = path.split("/").pop() || path;
  const entry = addResult(filename, "uploading", "host/uploadFile…");
  $("path-upload-btn").disabled = true;
  try {
    const res = await uploadPath(path, {
      filename,
      mime_type: guessMime(filename),
      purpose,
    });
    entry.status = "done";
    entry.url = res.download_url || null;
    entry.expires_at = res.expires_at || null;
    entry.detail = `✓ ${formatSize(res.size_bytes)} · ${res.mode || "?"}`;
    showStatus("host_upload_path", `${filename} → ${res.mode} ✓`, false);
  } catch (err) {
    entry.status = "error";
    entry.detail = `✗ ${(err && (err.code || err.message)) || err}`;
    showStatus("host_upload_path", err, true);
  } finally {
    $("path-upload-btn").disabled = false;
    renderResults();
  }
});

$("language-select").addEventListener("change", (event) => {
  locale = event.target.value === "zh" ? "zh" : "en";
  applyLocale();
});

$("race-start-btn").addEventListener("click", startRace);
$("race-stop-btn").addEventListener("click", () => {
  stopRaceScheduling = true;
  appendRaceEvent({ event: "browser.run.stop-requested", run_id: currentRace?.runId });
});
$("race-clear-btn").addEventListener("click", () => {
  if (currentRace?.running) return;
  raceEvents = [];
  executaRaceEvents = [];
  currentRace = null;
  renderRaceLog();
  updateRaceSummary();
  $("race-download-btn").disabled = true;
});
$("race-download-btn").addEventListener("click", downloadRaceLog);

applyLocale();
renderResults();
