import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

const DEV_TOOL_ID = "tool-test-agent-image-upload-12345678";
const TOOL_ID =
  window.__ANNA_TOOL_IDS__?.["agent-image-upload"] || DEV_TOOL_ID;

const $ = (id) => document.getElementById(id);
const logOutput = $("log-output");
const responseOutput = $("response-output");
const uploadStatus = $("upload-status");
const runStatus = $("run-status");

const state = {
  anna: null,
  uploads: [],
  session: null,
  runId: null,
};

function now() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function appendLog(kind, message, data) {
  const suffix = data === undefined
    ? ""
    : `\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`;
  logOutput.textContent += `[${now()}] ${kind}  ${message}${suffix}\n\n`;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function errorInfo(error) {
  return {
    name: error?.name,
    code: error?.code || error?.error?.code,
    message: error?.message || error?.error?.message || String(error),
    data: error?.data || error?.error?.data,
  };
}

function setStatus(element, text, type = "") {
  element.textContent = text;
  element.className = `status ${type}`.trim();
}

function unwrap(reply) {
  if (reply && typeof reply === "object" && reply.data && reply.tool) {
    return reply.data;
  }
  return reply || {};
}

function parsePaths() {
  return $("paths-input").value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function renderUploads() {
  const list = $("upload-list");
  list.innerHTML = "";
  for (const item of state.uploads) {
    const wrapper = document.createElement("div");
    wrapper.className = "upload-item";

    const name = document.createElement("div");
    name.className = "upload-name";
    name.textContent = item.path;

    const meta = document.createElement("div");
    meta.className = "upload-meta";
    meta.textContent = `${item.mime_type} · ${item.mode} · ${formatBytes(item.size_bytes)}`;

    const url = document.createElement("div");
    url.className = "upload-url";
    url.textContent = item.download_url;

    wrapper.append(name, meta, url);
    list.appendChild(wrapper);
  }
  $("run-btn").disabled = state.uploads.length === 0 || !state.anna;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function connect() {
  appendLog("runtime", "connecting / 正在连接");
  state.anna = await AnnaAppRuntime.connect();
  window.anna = state.anna;
  appendLog("runtime", "connected / 已连接", { tool_id: TOOL_ID });
  renderUploads();
}

async function uploadImages() {
  const paths = parsePaths();
  if (!paths.length) throw new Error("请输入至少一个图片路径 / Enter at least one image path.");
  if (paths.length > 6) throw new Error("每次最多 6 张图片 / Maximum 6 images per run.");

  setStatus(uploadStatus, "上传中 / Uploading…");
  appendLog("upload", "invoke host_upload_image_paths", { paths });

  const reply = await state.anna.tools.invoke({
    tool_id: TOOL_ID,
    method: "host_upload_image_paths",
    args: { paths },
  });
  const result = unwrap(reply);
  appendLog("upload", "tool response / 工具返回", result);

  state.uploads = Array.isArray(result.uploads) ? result.uploads : [];
  renderUploads();

  if (result.errors?.length) {
    setStatus(
      uploadStatus,
      `成功 ${state.uploads.length}，失败 ${result.errors.length} / ${state.uploads.length} uploaded, ${result.errors.length} failed`,
      "error",
    );
  } else {
    setStatus(uploadStatus, `已上传 ${state.uploads.length} 张 / ${state.uploads.length} uploaded`, "ok");
  }
  if (!state.uploads.length) throw new Error("没有得到可用图片 URL / No usable image URLs returned.");
}

function readDeltaText(frame) {
  if (typeof frame?.text === "string") return frame.text;
  const delta = frame?.choices?.[0]?.delta;
  return typeof delta?.content === "string" ? delta.content : "";
}

async function runSession() {
  const prompt = $("prompt-input").value.trim();
  if (!prompt) throw new Error("请输入提示词 / Enter a prompt.");
  if (!state.uploads.length) throw new Error("请先上传图片 / Upload images first.");

  const detail = $("detail-select").value;
  const modelHint = $("model-hint-input").value.trim();
  const attachments = state.uploads.map((item) => ({
    type: item.mime_type,
    url: item.download_url,
    filename: item.filename,
    detail,
  }));

  responseOutput.textContent = "";
  $("run-btn").disabled = true;
  $("upload-btn").disabled = true;
  $("cancel-btn").disabled = false;
  setStatus(runStatus, "创建 Session / Creating Session…");

  try {
    state.session = await state.anna.agent.session({
      submode: "auto",
      label: "agent-image-attachments-demo",
    });
    appendLog("session.create", "created / 已创建", {
      app_session_uuid: state.session.app_session_uuid || state.session.appSessionUuid,
      expires_in: state.session.expires_in || state.session.expiresIn,
      granted_tools: state.session.granted_tools,
    });

    const request = {
      content: prompt,
      attachments,
      ...(modelHint
        ? { modelPreferences: { hints: [{ name: modelHint }] } }
        : {}),
    };
    appendLog("session.run", "request / 请求", request);
    setStatus(runStatus, "模型处理中 / Model running…");

    const stream = state.session.run(request);
    for await (const frame of stream) {
      if (frame?.run_id) state.runId = frame.run_id;
      if (stream?.runId) state.runId = stream.runId;
      appendLog("session.frame", frame?.event || "unknown", frame);
      const text = readDeltaText(frame);
      if (text) {
        responseOutput.textContent += text;
        responseOutput.scrollTop = responseOutput.scrollHeight;
      }
      if (frame?.event === "error") {
        throw new Error(frame.message || frame.error || "Agent Session returned an error frame.");
      }
    }

    setStatus(runStatus, "完成 / Completed", "ok");
    appendLog("session.run", "completed / 已完成", { run_id: state.runId });
  } finally {
    $("cancel-btn").disabled = true;
    $("upload-btn").disabled = false;
    $("run-btn").disabled = state.uploads.length === 0;
    if (state.session) {
      try {
        await state.session.delete();
        appendLog("session.delete", "deleted / 已删除");
      } catch (error) {
        appendLog("session.delete", "failed / 删除失败", errorInfo(error));
      }
    }
    state.session = null;
    state.runId = null;
  }
}

$("upload-btn").addEventListener("click", async () => {
  $("upload-btn").disabled = true;
  try {
    await uploadImages();
  } catch (error) {
    const info = errorInfo(error);
    setStatus(uploadStatus, info.message, "error");
    appendLog("upload.error", "failed / 失败", info);
  } finally {
    $("upload-btn").disabled = false;
  }
});

$("reset-uploads-btn").addEventListener("click", () => {
  state.uploads = [];
  renderUploads();
  setStatus(uploadStatus, "尚未上传 / Not uploaded");
  setStatus(runStatus, "等待图片 / Waiting for images");
  appendLog("upload", "cleared from UI / 已从界面清空");
});

$("run-btn").addEventListener("click", async () => {
  try {
    await runSession();
  } catch (error) {
    const info = errorInfo(error);
    setStatus(runStatus, info.message, "error");
    appendLog("session.error", "failed / 失败", info);
  }
});

$("cancel-btn").addEventListener("click", async () => {
  if (!state.session || !state.runId || typeof state.session.cancel !== "function") return;
  try {
    const result = await state.session.cancel(state.runId);
    appendLog("session.cancel", "requested / 已请求", result);
    setStatus(runStatus, "已请求取消 / Cancellation requested");
  } catch (error) {
    appendLog("session.cancel", "failed / 失败", errorInfo(error));
  }
});

$("clear-log-btn").addEventListener("click", () => {
  logOutput.textContent = "";
});

connect().catch((error) => {
  const info = errorInfo(error);
  appendLog("runtime.error", "connect failed / 连接失败", info);
  setStatus(uploadStatus, info.message, "error");
});
