import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { parseHostUploadConfirmation } from "../host-upload-confirmation.js";

test("platform host/uploadFile confirmation becomes a HostUploadRef", () => {
  const result = parseHostUploadConfirmation({
    confirmed: {
      r2_key: "exec-uploads/staging/sample.pdf",
      url: "https://uploads.example/platform",
      mime_type: "application/pdf",
      bytes: 12_582_912,
      expires_in: 1_800,
    },
    negotiated: {
      r2_key: "exec-uploads/staging/negotiated.pdf",
    },
    mimeType: "application/pdf",
    fallbackSizeBytes: 7,
    filename: "sample.pdf",
  });

  assert.deepEqual(result, {
    transport: "host_upload",
    r2_key: "exec-uploads/staging/sample.pdf",
    url: "https://uploads.example/platform",
    mime_type: "application/pdf",
    size_bytes: 12_582_912,
    filename: "sample.pdf",
    expires_at: undefined,
    expires_in: 1_800,
    mode: "negotiate+confirm",
  });
});

test("legacy SDK host/uploadFile confirmation remains compatible", () => {
  const result = parseHostUploadConfirmation({
    confirmed: {
      r2_key: "exec-uploads/legacy/sample.pdf",
      download_url: "https://uploads.example/legacy",
      size_bytes: 8_192,
      expires_at: "2026-07-10T12:00:00.000Z",
    },
    negotiated: {
      r2_key: "exec-uploads/legacy/negotiated.pdf",
      expires_at: "2026-07-10T11:00:00.000Z",
    },
    mimeType: "application/pdf",
    fallbackSizeBytes: 7,
    filename: "sample.pdf",
  });

  assert.deepEqual(result, {
    transport: "host_upload",
    r2_key: "exec-uploads/legacy/sample.pdf",
    url: "https://uploads.example/legacy",
    mime_type: "application/pdf",
    size_bytes: 8_192,
    filename: "sample.pdf",
    expires_at: "2026-07-10T12:00:00.000Z",
    expires_in: undefined,
    mode: "negotiate+confirm",
  });
});

test("platform confirmation fields take priority over legacy aliases", () => {
  const result = parseHostUploadConfirmation({
    confirmed: {
      url: "https://uploads.example/platform",
      download_url: "https://uploads.example/legacy",
      bytes: 4_096,
      size_bytes: 2_048,
      expires_in: 1_800,
      expires_at: "2026-07-10T12:00:00.000Z",
    },
    negotiated: { r2_key: "exec-uploads/negotiated/sample.pdf" },
    mimeType: "application/pdf",
    fallbackSizeBytes: 1_024,
    filename: "sample.pdf",
  });

  assert.equal(result.url, "https://uploads.example/platform");
  assert.equal(result.size_bytes, 4_096);
  assert.equal(result.expires_in, 1_800);
});

test("confirmation without either URL field fails accurately", () => {
  assert.throws(
    () => parseHostUploadConfirmation({
      confirmed: { url: "", download_url: "" },
      negotiated: { r2_key: "exec-uploads/negotiated/sample.pdf" },
      mimeType: "application/pdf",
      fallbackSizeBytes: 1_024,
      filename: "sample.pdf",
    }),
    new Error("host/uploadFile confirm did not return a valid URL"),
  );
});

test("confirmation falls back to negotiated key and local byte size", () => {
  const result = parseHostUploadConfirmation({
    confirmed: { url: "https://uploads.example/platform" },
    negotiated: { r2_key: "exec-uploads/negotiated/sample.pdf" },
    mimeType: "application/pdf",
    fallbackSizeBytes: 1_024,
    filename: "sample.pdf",
  });

  assert.equal(result.r2_key, "exec-uploads/negotiated/sample.pdf");
  assert.equal(result.size_bytes, 1_024);
});

test("Executa reverse RPC accepts platform host/uploadFile confirmation", { timeout: 10_000 }, async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-host-upload-home-"));
  const uploadServer = createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Drain the uploaded workspace JSON body.
    }
    response.writeHead(200).end();
  });
  await new Promise<void>((resolve) => uploadServer.listen(0, "127.0.0.1", resolve));
  const address = uploadServer.address();
  assert.ok(address && typeof address === "object");

  const child = spawn(process.execPath, ["example_plugin.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, HOME: homeDir },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map<number, (message: Record<string, unknown>) => void>();
  let nextId = 1;

  lines.on("line", async (line) => {
    let message = JSON.parse(line) as {
      id: number | string;
      method?: string;
      params?: { mode?: string; size_bytes?: number; r2_key?: string };
      __file_transport?: string;
      __trans_file__?: string;
    };
    const transportPath = message.__file_transport ?? message.__trans_file__;
    if (transportPath) {
      message = JSON.parse(await readFile(transportPath, "utf8")) as typeof message;
    }
    if (message.method === "host/uploadFile") {
      const result = message.params?.mode === "negotiate"
        ? {
            put_url: `http://127.0.0.1:${address.port}/upload`,
            r2_key: "exec-uploads/staging/workspace.json",
            headers: {},
          }
        : {
            r2_key: message.params?.r2_key,
            url: "https://uploads.example/platform-workspace",
            bytes: 256,
            expires_in: 1_800,
          };
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
      return;
    }
    if (typeof message.id === "number") {
      pending.get(message.id)?.(message as unknown as Record<string, unknown>);
      pending.delete(message.id);
    }
  });

  const request = (method: string, params?: Record<string, unknown>) => {
    const id = nextId++;
    const response = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  };

  try {
    await request("initialize", { protocolVersion: "2.0" });
    const response = await request("invoke", {
      tool: "app_create_workspace",
      arguments: { title: "Host Upload compatibility" },
    }) as {
      result?: { data?: { workspace_upload?: Record<string, unknown> } };
      error?: { message?: string };
    };

    assert.ok(!response.error, response.error?.message);
    assert.ok(response.result?.data?.workspace_upload, JSON.stringify(response));
    assert.equal(response.result?.data?.workspace_upload?.url, "https://uploads.example/platform-workspace");
    assert.equal(response.result?.data?.workspace_upload?.size_bytes, 256);
    assert.equal(response.result?.data?.workspace_upload?.expires_in, 1_800);
  } finally {
    lines.close();
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => uploadServer.close(() => resolve()));
    await rm(homeDir, { recursive: true, force: true });
  }
});
