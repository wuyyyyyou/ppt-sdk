const TOOL_ID = "tool-lightvoss-test-aps-8kvasxsg";
const TOOL_METHOD_HOST_UPLOAD = "upload_test_file";

const els = {
  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: Array.from(document.querySelectorAll(".tab-panel")),
  connDot: document.querySelector("#conn-dot"),
  connLabel: document.querySelector("#conn-label"),

  hostForm: document.querySelector("#host-upload-form"),
  mode: document.querySelector("#mode"),
  filename: document.querySelector("#filename"),
  mimeType: document.querySelector("#mime-type"),
  purpose: document.querySelector("#purpose"),
  repeat: document.querySelector("#repeat"),
  content: document.querySelector("#content"),
  uploadBtn: document.querySelector("#upload-btn"),
  downloadBtn: document.querySelector("#download-btn"),
  openBtn: document.querySelector("#open-btn"),
  resetForm: document.querySelector("#reset-form"),
  resultUrl: document.querySelector("#result-url"),
  resultKey: document.querySelector("#result-key"),
  resultBytes: document.querySelector("#result-bytes"),
  resultExpiry: document.querySelector("#result-expiry"),
  resultJson: document.querySelector("#result-json"),
  copyResult: document.querySelector("#copy-result"),

  apsForm: document.querySelector("#aps-files-form"),
  apsPath: document.querySelector("#aps-path"),
  apsScope: document.querySelector("#aps-scope"),
  apsContentType: document.querySelector("#aps-content-type"),
  apsRepeat: document.querySelector("#aps-repeat"),
  apsExpiresIn: document.querySelector("#aps-expires-in"),
  apsPrefix: document.querySelector("#aps-prefix"),
  apsContent: document.querySelector("#aps-content"),
  apsUploadBtn: document.querySelector("#aps-upload-btn"),
  apsDownloadUrlBtn: document.querySelector("#aps-download-url-btn"),
  apsListBtn: document.querySelector("#aps-list-btn"),
  apsDeleteBtn: document.querySelector("#aps-delete-btn"),
  apsDownloadBtn: document.querySelector("#aps-download-btn"),
  apsOpenBtn: document.querySelector("#aps-open-btn"),
  apsCopyResult: document.querySelector("#aps-copy-result"),
  apsResultPath: document.querySelector("#aps-result-path"),
  apsResultUrl: document.querySelector("#aps-result-url"),
  apsResultEtag: document.querySelector("#aps-result-etag"),
  apsResultBytes: document.querySelector("#aps-result-bytes"),
  apsResultJson: document.querySelector("#aps-result-json"),

  kvForm: document.querySelector("#aps-kv-form"),
  kvKey: document.querySelector("#kv-key"),
  kvScope: document.querySelector("#kv-scope"),
  kvTtl: document.querySelector("#kv-ttl"),
  kvIfMatch: document.querySelector("#kv-if-match"),
  kvPrefix: document.querySelector("#kv-prefix"),
  kvLimit: document.querySelector("#kv-limit"),
  kvValue: document.querySelector("#kv-value"),
  kvSetBtn: document.querySelector("#kv-set-btn"),
  kvGetBtn: document.querySelector("#kv-get-btn"),
  kvListBtn: document.querySelector("#kv-list-btn"),
  kvDeleteBtn: document.querySelector("#kv-delete-btn"),
  kvCopyResult: document.querySelector("#kv-copy-result"),
  kvResultKey: document.querySelector("#kv-result-key"),
  kvResultExists: document.querySelector("#kv-result-exists"),
  kvResultEtag: document.querySelector("#kv-result-etag"),
  kvResultBytes: document.querySelector("#kv-result-bytes"),
  kvResultJson: document.querySelector("#kv-result-json"),

  logs: document.querySelector("#logs"),
  clearLogs: document.querySelector("#clear-logs"),
  copyLogs: document.querySelector("#copy-logs"),
};

let anna = null;
let lastResult = null;
let lastApsResult = null;
let lastKvResult = null;
let logs = [];

function nowTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function addLog(level, source, message, detail) {
  const entry = {
    time: nowTime(),
    level,
    source,
    message,
    detail: detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail),
  };
  logs.push(entry);
  if (logs.length > 400) logs = logs.slice(-400);
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

    const msg = document.createElement("span");
    msg.textContent = item.detail ? `${item.message} ${item.detail}` : item.message;

    li.append(time, source, msg);
    els.logs.appendChild(li);
  }
  els.logs.scrollTop = els.logs.scrollHeight;
}

function setConnection(connected, label) {
  els.connDot.classList.toggle("dot--on", connected);
  els.connDot.classList.toggle("dot--off", !connected);
  els.connLabel.textContent = label;
}

function setHostBusy(busy) {
  els.uploadBtn.disabled = busy;
  els.uploadBtn.textContent = busy ? "上传中..." : "调用后端上传";
}

function setApsBusy(busy, label = "处理中...") {
  for (const btn of [els.apsUploadBtn, els.apsDownloadUrlBtn, els.apsListBtn, els.apsDeleteBtn]) {
    btn.disabled = busy;
  }
  if (busy) {
    els.apsUploadBtn.dataset.oldText = els.apsUploadBtn.textContent;
    els.apsUploadBtn.textContent = label;
  } else if (els.apsUploadBtn.dataset.oldText) {
    els.apsUploadBtn.textContent = els.apsUploadBtn.dataset.oldText;
    delete els.apsUploadBtn.dataset.oldText;
  }
}

function setKvBusy(busy, label = "处理中...") {
  for (const btn of [els.kvSetBtn, els.kvGetBtn, els.kvListBtn, els.kvDeleteBtn]) {
    btn.disabled = busy;
  }
  if (busy) {
    els.kvSetBtn.dataset.oldText = els.kvSetBtn.textContent;
    els.kvSetBtn.textContent = label;
  } else if (els.kvSetBtn.dataset.oldText) {
    els.kvSetBtn.textContent = els.kvSetBtn.dataset.oldText;
    delete els.kvSetBtn.dataset.oldText;
  }
}

function unwrapToolResult(raw) {
  if (raw && raw.success === false) {
    const dataLogs = raw.data?.backend_logs || [];
    for (const line of dataLogs) addLog("error", "backend", line);
    throw new Error(typeof raw.error === "string" ? raw.error : JSON.stringify(raw.error));
  }
  if (raw && raw.success === true && Object.prototype.hasOwnProperty.call(raw, "data")) {
    return raw.data;
  }
  return raw;
}

function collectPayload() {
  const repeat = Math.max(1, Math.min(20000, Number.parseInt(els.repeat.value, 10) || 1));
  return {
    mode: els.mode.value,
    filename: els.filename.value.trim() || "host-upload-test.txt",
    mime_type: els.mimeType.value.trim() || "text/plain",
    purpose: els.purpose.value,
    content: els.content.value,
    repeat,
  };
}

function collectApsPayload() {
  return {
    path: els.apsPath.value.trim() || "test-aps/hello.txt",
    scope: els.apsScope.value,
    content_type: els.apsContentType.value.trim() || "text/plain; charset=utf-8",
    content: els.apsContent.value,
    repeat: Math.max(1, Math.min(20000, Number.parseInt(els.apsRepeat.value, 10) || 1)),
    expires_in: Math.max(60, Math.min(86400, Number.parseInt(els.apsExpiresIn.value, 10) || 1800)),
  };
}

function collectApsLookupPayload() {
  return {
    path: els.apsPath.value.trim() || "test-aps/hello.txt",
    scope: els.apsScope.value,
    expires_in: Math.max(60, Math.min(86400, Number.parseInt(els.apsExpiresIn.value, 10) || 1800)),
  };
}

function collectApsListPayload() {
  return {
    prefix: els.apsPrefix.value.trim(),
    scope: els.apsScope.value,
    limit: 20,
  };
}

function parseKvValue() {
  const raw = els.kvValue.value.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`KV value 不是合法 JSON: ${error.message}`);
  }
}

function collectKvCommonPayload() {
  return {
    key: els.kvKey.value.trim() || "test-aps/kv/demo",
    scope: els.kvScope.value,
    if_match: els.kvIfMatch.value.trim() || undefined,
  };
}

function collectKvSetPayload() {
  const ttlRaw = Number.parseInt(els.kvTtl.value, 10);
  return {
    ...collectKvCommonPayload(),
    value: parseKvValue(),
    ttl_seconds: Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.min(604800, ttlRaw) : undefined,
  };
}

function collectKvListPayload() {
  const limitRaw = Number.parseInt(els.kvLimit.value, 10);
  return {
    prefix: els.kvPrefix.value.trim(),
    scope: els.kvScope.value,
    limit: Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20,
  };
}

function renderResult(result) {
  lastResult = result;
  const upload = result?.upload || result || {};
  const url = upload.url || upload.download_url || "";
  const key = upload.r2_key || upload.path || "";
  const bytes = upload.bytes ?? upload.size_bytes ?? result?.bytes ?? "";
  const expires = upload.expires_in
    ? `${upload.expires_in} 秒`
    : upload.expires_at || result?.expires_at || "";

  els.resultUrl.textContent = url || "-";
  els.resultKey.textContent = key || "-";
  els.resultBytes.textContent = bytes === "" ? "-" : `${bytes} bytes`;
  els.resultExpiry.textContent = expires || "-";
  els.resultJson.textContent = JSON.stringify(result || {}, null, 2);
  els.downloadBtn.disabled = !url;
  els.openBtn.disabled = !url;
  els.copyResult.disabled = !result;
}

function getApsDownload(result) {
  return result?.download || result?.complete?.download || result || {};
}

function renderApsResult(result) {
  lastApsResult = result;
  const download = getApsDownload(result);
  const complete = result?.complete || {};
  const deleted = result?.deleted || {};
  const url = download.url || download.download_url || "";
  const etag = complete.etag || result?.etag || deleted.etag || "";
  const bytes = result?.bytes ?? complete.size_bytes ?? complete.bytes ?? "";

  els.apsResultPath.textContent = result?.path || result?.prefix || "-";
  els.apsResultUrl.textContent = url || "-";
  els.apsResultEtag.textContent = etag || "-";
  els.apsResultBytes.textContent = bytes === "" ? "-" : `${bytes} bytes`;
  els.apsResultJson.textContent = JSON.stringify(result || {}, null, 2);
  els.apsDownloadBtn.disabled = !url;
  els.apsOpenBtn.disabled = !url;
  els.apsCopyResult.disabled = !result;
}

function renderKvResult(result) {
  lastKvResult = result;
  const kv = result?.kv || result?.set || result?.get || result?.deleted || result?.list || result || {};
  const exists = Object.prototype.hasOwnProperty.call(kv, "exists") ? String(kv.exists) : "-";
  const etag = kv.etag || result?.etag || "";
  const bytes = kv.size_bytes ?? kv.bytes ?? result?.bytes ?? "";

  els.kvResultKey.textContent = result?.key || result?.prefix || "-";
  els.kvResultExists.textContent = exists;
  els.kvResultEtag.textContent = etag || "-";
  els.kvResultBytes.textContent = bytes === "" ? "-" : `${bytes} bytes`;
  els.kvResultJson.textContent = JSON.stringify(result || {}, null, 2);
  els.kvCopyResult.disabled = !result;

  if (etag && result?.operation === "get") {
    els.kvIfMatch.value = etag;
  }
}

async function connectAnna() {
  try {
    if (typeof AnnaAppRuntime === "undefined") {
      throw new Error("AnnaAppRuntime SDK 未加载，当前是独立预览模式");
    }
    anna = await AnnaAppRuntime.connect();
    setConnection(true, "已连接 Anna");
    addLog("ok", "runtime", "Anna runtime 连接成功");
    try {
      await anna.window?.set_title?.({ title: "Host Upload / APS 测试" });
    } catch (error) {
      addLog("warn", "runtime", "设置窗口标题失败", String(error?.message || error));
    }
  } catch (error) {
    anna = createStandaloneAnna();
    setConnection(false, "独立预览");
    addLog("warn", "runtime", "未连接 Anna，启用本地模拟后端", String(error?.message || error));
  }
}

function createStandaloneAnna() {
  const kvStore = new Map();

  function kvId(scope, key) {
    return `${scope}:${key}`;
  }

  function readMockKv(scope, key) {
    const id = kvId(scope, key);
    const item = kvStore.get(id);
    if (!item) return null;
    if (item.expires_at && Date.parse(item.expires_at) <= Date.now()) {
      kvStore.delete(id);
      return null;
    }
    return item;
  }

  return {
    tools: {
      async invoke({ method, args }) {
        addLog("warn", "mock", "这是本地模拟结果，不会真实调用后端 reverse RPC", { method });
        if (method === "aps_files_upload_text") {
          const blob = new Blob([args.content.repeat(args.repeat || 1)], { type: args.content_type || "text/plain" });
          return {
            success: true,
            data: {
              operation: "upload_text",
              path: args.path,
              scope: args.scope,
              bytes: blob.size,
              complete: { etag: "mock-etag", size_bytes: blob.size },
              download: { url: URL.createObjectURL(blob), expires_at: new Date(Date.now() + 1800000).toISOString() },
              backend_logs: ["standalone mock: no files/upload_begin call"],
            },
          };
        }
        if (method === "aps_files_download_url") {
          return {
            success: true,
            data: {
              operation: "download_url",
              path: args.path,
              scope: args.scope,
              download: { url: "", note: "独立预览没有真实 APS 文件 URL" },
              backend_logs: ["standalone mock: no files/download_url call"],
            },
          };
        }
        if (method === "aps_files_list") {
          return {
            success: true,
            data: {
              operation: "list",
              prefix: args.prefix,
              scope: args.scope,
              list: { items: [{ path: `${args.prefix || "test-aps/"}mock.txt`, size_bytes: 12 }] },
              backend_logs: ["standalone mock: no files/list call"],
            },
          };
        }
        if (method === "aps_files_delete") {
          return {
            success: true,
            data: {
              operation: "delete",
              path: args.path,
              scope: args.scope,
              deleted: { deleted: true },
              backend_logs: ["standalone mock: no files/delete call"],
            },
          };
        }
        if (method === "aps_kv_set") {
          const valueText = JSON.stringify(args.value);
          const item = {
            value: args.value,
            etag: `mock-${Date.now()}`,
            size_bytes: new TextEncoder().encode(valueText).length,
            expires_at: args.ttl_seconds ? new Date(Date.now() + args.ttl_seconds * 1000).toISOString() : null,
          };
          kvStore.set(kvId(args.scope, args.key), item);
          return {
            success: true,
            data: {
              operation: "set",
              key: args.key,
              scope: args.scope,
              kv: { etag: item.etag, size_bytes: item.size_bytes, expires_at: item.expires_at },
              backend_logs: ["standalone mock: no storage/set call"],
            },
          };
        }
        if (method === "aps_kv_get") {
          const item = readMockKv(args.scope, args.key);
          return {
            success: true,
            data: {
              operation: "get",
              key: args.key,
              scope: args.scope,
              kv: item
                ? { value: item.value, exists: true, etag: item.etag, size_bytes: item.size_bytes, expires_at: item.expires_at }
                : { value: null, exists: false, etag: null },
              backend_logs: ["standalone mock: no storage/get call"],
            },
          };
        }
        if (method === "aps_kv_list") {
          const prefix = args.prefix || "";
          const items = [];
          for (const [id, item] of kvStore.entries()) {
            const [scope, ...keyParts] = id.split(":");
            const key = keyParts.join(":");
            if (scope === args.scope && key.startsWith(prefix) && readMockKv(scope, key)) {
              items.push({ key, etag: item.etag, size_bytes: item.size_bytes, expires_at: item.expires_at });
            }
            if (items.length >= (args.limit || 20)) break;
          }
          return {
            success: true,
            data: {
              operation: "list",
              prefix,
              scope: args.scope,
              kv: { items },
              backend_logs: ["standalone mock: no storage/list call"],
            },
          };
        }
        if (method === "aps_kv_delete") {
          const existed = kvStore.delete(kvId(args.scope, args.key));
          return {
            success: true,
            data: {
              operation: "delete",
              key: args.key,
              scope: args.scope,
              kv: { deleted: existed },
              backend_logs: ["standalone mock: no storage/delete call"],
            },
          };
        }

        const encoder = new TextEncoder();
        const bytes = encoder.encode(args.content.repeat(args.repeat || 1));
        const blob = new Blob([bytes], { type: args.mime_type || "text/plain" });
        return {
          success: true,
          data: {
            mode: args.mode,
            filename: args.filename,
            bytes: blob.size,
            upload: {
              url: URL.createObjectURL(blob),
              r2_key: "mock/local-object-url",
              mime_type: args.mime_type,
              bytes: blob.size,
              expires_in: 300,
              _meta: { mode: "standalone-mock" },
            },
            backend_logs: ["standalone mock: no host/uploadFile call"],
          },
        };
      },
    },
    window: {
      async set_title() {},
    },
  };
}

async function invokeTool(method, args, sourceLabel) {
  addLog("ok", sourceLabel, "开始调用后端工具", { method, args });
  const raw = await anna.tools.invoke({ tool_id: TOOL_ID, method, args });
  addLog("ok", "tools", "收到 tools.invoke 原始结果", raw);
  const data = unwrapToolResult(raw);
  for (const line of data?.backend_logs || []) {
    addLog("ok", "backend", line);
  }
  return data;
}

async function upload(event) {
  event.preventDefault();
  const payload = collectPayload();
  setHostBusy(true);
  renderResult(null);
  try {
    const data = await invokeTool(TOOL_METHOD_HOST_UPLOAD, payload, "host-upload");
    renderResult(data);
    addLog("ok", "host-upload", "后端 Host Upload 完成");
  } catch (error) {
    addLog("error", "host-upload", "后端 Host Upload 失败", String(error?.message || error));
    renderResult({ error: String(error?.message || error) });
  } finally {
    setHostBusy(false);
  }
}

async function apsUpload(event) {
  event.preventDefault();
  setApsBusy(true, "上传中...");
  renderApsResult(null);
  try {
    const data = await invokeTool("aps_files_upload_text", collectApsPayload(), "aps-files");
    renderApsResult(data);
    addLog("ok", "aps-files", "APS Files 上传完成");
  } catch (error) {
    addLog("error", "aps-files", "APS Files 上传失败", String(error?.message || error));
    renderApsResult({ error: String(error?.message || error) });
  } finally {
    setApsBusy(false);
  }
}

async function apsDownloadUrl() {
  setApsBusy(true, "签 URL...");
  try {
    const data = await invokeTool("aps_files_download_url", collectApsLookupPayload(), "aps-files");
    renderApsResult(data);
    addLog("ok", "aps-files", "APS Files 下载 URL 已生成");
  } catch (error) {
    addLog("error", "aps-files", "生成下载 URL 失败", String(error?.message || error));
    renderApsResult({ error: String(error?.message || error) });
  } finally {
    setApsBusy(false);
  }
}

async function apsList() {
  setApsBusy(true, "列文件...");
  try {
    const data = await invokeTool("aps_files_list", collectApsListPayload(), "aps-files");
    renderApsResult(data);
    addLog("ok", "aps-files", "APS Files 列表读取完成");
  } catch (error) {
    addLog("error", "aps-files", "读取列表失败", String(error?.message || error));
    renderApsResult({ error: String(error?.message || error) });
  } finally {
    setApsBusy(false);
  }
}

async function apsDelete() {
  setApsBusy(true, "删除中...");
  try {
    const data = await invokeTool("aps_files_delete", collectApsLookupPayload(), "aps-files");
    renderApsResult(data);
    addLog("ok", "aps-files", "APS Files 删除完成");
  } catch (error) {
    addLog("error", "aps-files", "删除文件失败", String(error?.message || error));
    renderApsResult({ error: String(error?.message || error) });
  } finally {
    setApsBusy(false);
  }
}

async function kvSet(event) {
  event.preventDefault();
  setKvBusy(true, "写入中...");
  renderKvResult(null);
  try {
    const data = await invokeTool("aps_kv_set", collectKvSetPayload(), "aps-kv");
    renderKvResult(data);
    addLog("ok", "aps-kv", "APS KV 写入完成");
  } catch (error) {
    addLog("error", "aps-kv", "APS KV 写入失败", String(error?.message || error));
    renderKvResult({ error: String(error?.message || error) });
  } finally {
    setKvBusy(false);
  }
}

async function kvGet() {
  setKvBusy(true, "读取中...");
  try {
    const data = await invokeTool("aps_kv_get", collectKvCommonPayload(), "aps-kv");
    renderKvResult(data);
    addLog("ok", "aps-kv", "APS KV 读取完成");
  } catch (error) {
    addLog("error", "aps-kv", "APS KV 读取失败", String(error?.message || error));
    renderKvResult({ error: String(error?.message || error) });
  } finally {
    setKvBusy(false);
  }
}

async function kvList() {
  setKvBusy(true, "列 Key...");
  try {
    const data = await invokeTool("aps_kv_list", collectKvListPayload(), "aps-kv");
    renderKvResult(data);
    addLog("ok", "aps-kv", "APS KV 列表读取完成");
  } catch (error) {
    addLog("error", "aps-kv", "APS KV 列表读取失败", String(error?.message || error));
    renderKvResult({ error: String(error?.message || error) });
  } finally {
    setKvBusy(false);
  }
}

async function kvDelete() {
  setKvBusy(true, "删除中...");
  try {
    const data = await invokeTool("aps_kv_delete", collectKvCommonPayload(), "aps-kv");
    renderKvResult(data);
    addLog("ok", "aps-kv", "APS KV 删除完成");
  } catch (error) {
    addLog("error", "aps-kv", "APS KV 删除失败", String(error?.message || error));
    renderKvResult({ error: String(error?.message || error) });
  } finally {
    setKvBusy(false);
  }
}

function getDownloadUrl() {
  const upload = lastResult?.upload || lastResult || {};
  return upload.url || upload.download_url || "";
}

function getApsDownloadUrl() {
  const download = getApsDownload(lastApsResult);
  return download.url || download.download_url || "";
}

async function downloadUrl(url, filename, source) {
  if (!url) return;
  addLog("ok", source, "开始前端 fetch 下载验证", { url, filename });
  try {
    const response = await fetch(url);
    addLog("ok", source, "fetch 返回", {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    addLog("ok", source, "下载为 Blob 成功", { size: blob.size, type: blob.type });
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename, source);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch (error) {
    addLog("error", source, "fetch 下载失败，尝试直接打开 URL", String(error?.message || error));
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function downloadResult() {
  await downloadUrl(getDownloadUrl(), lastResult?.filename || els.filename.value || "host-upload-download.bin", "download");
}

async function downloadApsResult() {
  await downloadUrl(getApsDownloadUrl(), lastApsResult?.path?.split("/").pop() || "aps-file-download.bin", "aps-download");
}

function triggerDownload(url, filename, source = "download") {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  addLog("ok", source, "已触发浏览器下载", filename);
}

function openUrl() {
  const url = getDownloadUrl();
  if (!url) return;
  addLog("ok", "download", "直接打开下载 URL");
  window.open(url, "_blank", "noopener,noreferrer");
}

function openApsUrl() {
  const url = getApsDownloadUrl();
  if (!url) return;
  addLog("ok", "aps-download", "直接打开 APS 下载 URL");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    addLog("ok", "clipboard", `${label}已复制`);
  } catch (error) {
    addLog("error", "clipboard", `${label}复制失败`, String(error?.message || error));
  }
}

function resetForm() {
  els.mode.value = "inline";
  els.filename.value = "host-upload-test.txt";
  els.mimeType.value = "text/plain";
  els.purpose.value = "user_artifact";
  els.repeat.value = "1";
  els.content.value = "这是一份来自 Host Upload 测试 App 的后端上传文件。";
  addLog("ok", "ui", "Host Upload 表单已重置");
}

function selectTab(tabName) {
  for (const tab of els.tabs) {
    const selected = tab.dataset.tab === tabName;
    tab.classList.toggle("tab--active", selected);
    tab.setAttribute("aria-selected", selected ? "true" : "false");
  }
  for (const panel of els.panels) {
    panel.hidden = panel.dataset.panel !== tabName;
  }
  addLog("ok", "ui", "切换测试标签页", tabName);
}

function bindUi() {
  for (const tab of els.tabs) {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  }

  els.hostForm.addEventListener("submit", upload);
  els.downloadBtn.addEventListener("click", downloadResult);
  els.openBtn.addEventListener("click", openUrl);
  els.resetForm.addEventListener("click", resetForm);
  els.copyResult.addEventListener("click", () => copyText(els.resultJson.textContent, "Host Upload 结果 JSON"));

  els.apsForm.addEventListener("submit", apsUpload);
  els.apsDownloadUrlBtn.addEventListener("click", apsDownloadUrl);
  els.apsListBtn.addEventListener("click", apsList);
  els.apsDeleteBtn.addEventListener("click", apsDelete);
  els.apsDownloadBtn.addEventListener("click", downloadApsResult);
  els.apsOpenBtn.addEventListener("click", openApsUrl);
  els.apsCopyResult.addEventListener("click", () => copyText(els.apsResultJson.textContent, "APS Files 结果 JSON"));

  els.kvForm.addEventListener("submit", kvSet);
  els.kvGetBtn.addEventListener("click", kvGet);
  els.kvListBtn.addEventListener("click", kvList);
  els.kvDeleteBtn.addEventListener("click", kvDelete);
  els.kvCopyResult.addEventListener("click", () => copyText(els.kvResultJson.textContent, "APS KV 结果 JSON"));

  els.clearLogs.addEventListener("click", () => {
    logs = [];
    renderLogs();
  });
  els.copyLogs.addEventListener("click", () => copyText(
    logs.map((l) => `[${l.time}] [${l.level}] [${l.source}] ${l.message} ${l.detail}`).join("\n"),
    "日志",
  ));
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUi();
  addLog("ok", "ui", "页面初始化完成");
  await connectAnna();
});
