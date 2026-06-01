const TOOL_ID = "tool-lightvoss-test-aps-8kvasxsg";
const TOOL_METHOD = "upload_test_file";

const els = {
  form: document.querySelector("#upload-form"),
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
  connDot: document.querySelector("#conn-dot"),
  connLabel: document.querySelector("#conn-label"),
  resultUrl: document.querySelector("#result-url"),
  resultKey: document.querySelector("#result-key"),
  resultBytes: document.querySelector("#result-bytes"),
  resultExpiry: document.querySelector("#result-expiry"),
  resultJson: document.querySelector("#result-json"),
  copyResult: document.querySelector("#copy-result"),
  logs: document.querySelector("#logs"),
  clearLogs: document.querySelector("#clear-logs"),
  copyLogs: document.querySelector("#copy-logs"),
};

let anna = null;
let lastResult = null;
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
  if (logs.length > 300) logs = logs.slice(-300);
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

function setBusy(busy) {
  els.uploadBtn.disabled = busy;
  els.uploadBtn.textContent = busy ? "上传中..." : "调用后端上传";
}

function unwrapToolResult(raw) {
  if (raw && raw.success === false) {
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

async function connectAnna() {
  try {
    if (typeof AnnaAppRuntime === "undefined") {
      throw new Error("AnnaAppRuntime SDK 未加载，当前是独立预览模式");
    }
    anna = await AnnaAppRuntime.connect();
    setConnection(true, "已连接 Anna");
    addLog("ok", "runtime", "Anna runtime 连接成功");
    try {
      await anna.window?.set_title?.({ title: "Host Upload 测试" });
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
  return {
    tools: {
      async invoke({ args }) {
        addLog("warn", "mock", "这是本地模拟结果，不会真实调用 Host Upload");
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

async function upload(event) {
  event.preventDefault();
  const payload = collectPayload();
  setBusy(true);
  renderResult(null);
  addLog("ok", "ui", "开始调用后端上传", payload);
  try {
    const raw = await anna.tools.invoke({
      tool_id: TOOL_ID,
      method: TOOL_METHOD,
      args: payload,
    });
    addLog("ok", "tools", "收到 tools.invoke 原始结果", raw);
    const data = unwrapToolResult(raw);
    renderResult(data);
    for (const line of data?.backend_logs || []) {
      addLog("ok", "backend", line);
    }
    addLog("ok", "ui", "后端上传完成");
  } catch (error) {
    addLog("error", "ui", "后端上传失败", String(error?.message || error));
    renderResult({ error: String(error?.message || error) });
  } finally {
    setBusy(false);
  }
}

function getDownloadUrl() {
  const upload = lastResult?.upload || lastResult || {};
  return upload.url || upload.download_url || "";
}

async function downloadResult() {
  const url = getDownloadUrl();
  if (!url) return;
  const filename = lastResult?.filename || els.filename.value || "host-upload-download.bin";
  addLog("ok", "download", "开始前端 fetch 下载验证", { url, filename });
  try {
    const response = await fetch(url);
    addLog("ok", "download", "fetch 返回", {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    addLog("ok", "download", "下载为 Blob 成功", { size: blob.size, type: blob.type });
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch (error) {
    addLog("error", "download", "fetch 下载失败，尝试直接打开 URL", String(error?.message || error));
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  addLog("ok", "download", "已触发浏览器下载", filename);
}

function openUrl() {
  const url = getDownloadUrl();
  if (!url) return;
  addLog("ok", "download", "直接打开下载 URL");
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
  addLog("ok", "ui", "表单已重置");
}

function bindUi() {
  els.form.addEventListener("submit", upload);
  els.downloadBtn.addEventListener("click", downloadResult);
  els.openBtn.addEventListener("click", openUrl);
  els.resetForm.addEventListener("click", resetForm);
  els.clearLogs.addEventListener("click", () => {
    logs = [];
    renderLogs();
  });
  els.copyLogs.addEventListener("click", () => copyText(
    logs.map((l) => `[${l.time}] [${l.level}] [${l.source}] ${l.message} ${l.detail}`).join("\n"),
    "日志",
  ));
  els.copyResult.addEventListener("click", () => copyText(els.resultJson.textContent, "结果 JSON"));
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUi();
  addLog("ok", "ui", "页面初始化完成");
  await connectAnna();
});
