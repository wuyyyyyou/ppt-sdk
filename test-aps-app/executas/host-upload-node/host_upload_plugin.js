#!/usr/bin/env node
"use strict";

const readline = require("node:readline");
const { randomUUID } = require("node:crypto");
const manifest = require("./manifest.json");

const TOOL_ID = manifest.name;
const VERSION = manifest.version;

let initialized = false;
let nextReverseId = 1;
const pending = new Map();
const backendLogBuffer = [];

function log(message, details) {
  const line = details === undefined
    ? `[host-upload-test] ${message}`
    : `[host-upload-test] ${message} ${safeJson(details)}`;
  backendLogBuffer.push(line);
  if (backendLogBuffer.length > 120) backendLogBuffer.splice(0, backendLogBuffer.length - 120);
  process.stderr.write(`${new Date().toISOString()} ${line}\n`);
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function send(frame) {
  process.stdout.write(`${JSON.stringify(frame)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function reverseRpc(method, params, timeoutMs = 120_000) {
  const id = `hu-${Date.now()}-${nextReverseId++}`;
  const frame = { jsonrpc: "2.0", id, method, params };
  log("reverse RPC -> host", { id, method, mode: params && params.mode });
  send(frame);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`reverse RPC timeout: ${method} id=${id}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

function handleReverseResponse(message) {
  if (!Object.prototype.hasOwnProperty.call(message, "id")) return false;
  const waiter = pending.get(message.id);
  if (!waiter) return false;
  pending.delete(message.id);
  if (message.error) {
    const error = new Error(message.error.message || "reverse RPC error");
    error.code = message.error.code;
    error.data = message.error;
    log("reverse RPC <- host error", { id: message.id, error: message.error });
    waiter.reject(error);
  } else {
    log("reverse RPC <- host ok", { id: message.id });
    waiter.resolve(message.result);
  }
  return true;
}

function normalizeArgs(args) {
  const mode = args.mode === "negotiate" ? "negotiate" : "inline";
  const filename = String(args.filename || "host-upload-test.txt").trim() || "host-upload-test.txt";
  const mimeType = String(args.mime_type || "text/plain").trim() || "text/plain";
  const purpose = String(args.purpose || "user_artifact").trim() || "user_artifact";
  const content = String(args.content || "Host Upload test payload.");
  const repeatRaw = Number(args.repeat ?? 1);
  const repeat = Number.isFinite(repeatRaw)
    ? Math.max(1, Math.min(20000, Math.trunc(repeatRaw)))
    : 1;
  return { mode, filename, mimeType, purpose, content, repeat };
}

function makePayload({ content, repeat }) {
  const header = [
    "Host Upload 测试文件",
    `生成时间: ${new Date().toISOString()}`,
    `重复次数: ${repeat}`,
    "",
  ].join("\n");
  return Buffer.from(header + content.repeat(repeat), "utf8");
}

async function uploadInline(input, payload) {
  log("inline upload start", {
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    bytes: payload.length,
  });
  const result = await reverseRpc("host/uploadFile", {
    mode: "inline",
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    content_b64: payload.toString("base64"),
  });
  log("inline upload complete", summarizeUploadResult(result));
  return result;
}

async function uploadNegotiate(input, payload) {
  log("negotiate upload start", {
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    bytes: payload.length,
  });
  const negotiated = await reverseRpc("host/uploadFile", {
    mode: "negotiate",
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    size_bytes: payload.length,
  });
  const putUrl = negotiated.put_url || negotiated.presigned_url || negotiated.url;
  const r2Key = negotiated.r2_key;
  if (!putUrl || !r2Key) {
    throw new Error(`negotiate result missing put_url or r2_key: ${safeJson(negotiated)}`);
  }
  log("negotiate returned put url", {
    r2_key: r2Key,
    expires_in: negotiated.expires_in,
    has_headers: !!negotiated.headers,
  });

  const headers = Object.assign({}, negotiated.headers || {});
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = input.mimeType;
  }

  log("PUT -> R2 start", { bytes: payload.length });
  const putResp = await fetch(putUrl, {
    method: "PUT",
    headers,
    body: payload,
  });
  const putText = putResp.ok ? "" : await putResp.text().catch(() => "");
  log("PUT -> R2 complete", {
    status: putResp.status,
    ok: putResp.ok,
    etag: putResp.headers.get("etag"),
    body: putText.slice(0, 400),
  });
  if (!putResp.ok) {
    throw new Error(`R2 PUT failed: HTTP ${putResp.status} ${putText}`);
  }

  const confirmed = await reverseRpc("host/uploadFile", {
    mode: "confirm",
    r2_key: r2Key,
  });
  log("confirm complete", summarizeUploadResult(confirmed));
  return confirmed;
}

function summarizeUploadResult(result) {
  return {
    r2_key: result && result.r2_key,
    bytes: result && (result.bytes || result.size_bytes),
    mime_type: result && result.mime_type,
    expires_in: result && result.expires_in,
    has_url: !!(result && (result.url || result.download_url)),
    mode: result && result._meta && result._meta.mode,
  };
}

async function toolUploadTestFile(args) {
  backendLogBuffer.length = 0;
  const runId = randomUUID();
  const input = normalizeArgs(args || {});
  const payload = makePayload(input);
  log("tool invoke start", {
    run_id: runId,
    initialized,
    mode: input.mode,
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    repeat: input.repeat,
    bytes: payload.length,
  });

  const started = Date.now();
  const upload = input.mode === "negotiate"
    ? await uploadNegotiate(input, payload)
    : await uploadInline(input, payload);
  const durationMs = Date.now() - started;
  log("tool invoke complete", { run_id: runId, duration_ms: durationMs });

  return {
    run_id: runId,
    mode: input.mode,
    filename: input.filename,
    mime_type: input.mimeType,
    purpose: input.purpose,
    bytes: payload.length,
    duration_ms: durationMs,
    upload,
    backend_logs: [...backendLogBuffer],
  };
}

async function handleInitialize(params) {
  initialized = true;
  const offered = params && params.protocolVersion;
  const protocolVersion = offered === "1.1" || offered === "2.0" ? offered : "2.0";
  log("initialize received", {
    protocolVersion: offered,
    capabilities: params && params.capabilities,
    host_capabilities: manifest.host_capabilities,
  });
  return {
    protocolVersion,
    serverInfo: { name: TOOL_ID, version: VERSION },
    client_capabilities: protocolVersion === "2.0" ? { upload: {} } : {},
    capabilities: {},
  };
}

async function handleDescribe() {
  log("describe requested", { host_capabilities: manifest.host_capabilities });
  return manifest;
}

async function handleHealth() {
  log("health requested");
  return {
    status: "ready",
    message: "Host Upload test backend is ready.",
    details: { initialized, pending_reverse_rpcs: pending.size },
  };
}

async function handleInvoke(params) {
  const tool = params && params.tool;
  const args = params && params.arguments && typeof params.arguments === "object"
    ? params.arguments
    : {};
  log("invoke received", {
    tool,
    has_context: !!(params && params.context),
    context_keys: params && params.context ? Object.keys(params.context) : [],
  });
  if (tool !== "upload_test_file") {
    return { success: false, error: `unknown tool: ${tool}` };
  }
  try {
    const data = await toolUploadTestFile(args);
    return { success: true, data };
  } catch (error) {
    log("tool invoke failed", {
      name: error && error.name,
      code: error && error.code,
      message: error && error.message,
      data: error && error.data,
    });
    return {
      success: false,
      error: `${error && error.code ? `${error.code}: ` : ""}${error && error.message ? error.message : String(error)}`,
      data: {
        backend_logs: [...backendLogBuffer],
      },
    };
  }
}

const handlers = {
  initialize: handleInitialize,
  describe: handleDescribe,
  health: handleHealth,
  invoke: handleInvoke,
};

async function handleRequest(message) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  const method = message.method;
  const handler = handlers[method];
  if (!handler) {
    sendError(id, -32601, `method not found: ${method}`);
    return;
  }
  try {
    const result = await handler(message.params || {});
    sendResult(id, result);
  } catch (error) {
    log("request handler crashed", {
      method,
      message: error && error.message,
      stack: error && error.stack,
    });
    sendError(id, -32603, error && error.message ? error.message : String(error));
  }
}

function main() {
  log("process start", {
    tool_id: TOOL_ID,
    node: process.version,
    host_capabilities: manifest.host_capabilities,
  });
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      sendError(null, -32700, `parse error: ${error.message}`);
      return;
    }

    if (!message.method && handleReverseResponse(message)) {
      return;
    }
    if (!message.method) {
      log("unmatched response frame", message);
      return;
    }
    handleRequest(message).catch((error) => {
      log("unhandled async request failure", {
        message: error && error.message,
        stack: error && error.stack,
      });
      sendError(message.id ?? null, -32603, error && error.message ? error.message : String(error));
    });
  });
  rl.on("close", () => {
    log("stdin closed, exiting");
  });
}

main();
