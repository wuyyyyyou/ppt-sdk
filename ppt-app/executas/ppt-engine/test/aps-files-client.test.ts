import assert from "node:assert/strict";
import test from "node:test";

import { ApsFilesClient, ApsFilesError } from "../aps-files-client.js";

test("APS Files client sends tool-scoped upload frames and routes responses", async () => {
  const frames: Array<Record<string, unknown>> = [];
  const client = new ApsFilesClient({
    writeFrame(message: Record<string, unknown>) {
      frames.push(message);
    },
  });
  client.enable();

  const pending = client.uploadBegin({
    path: "workspaces/demo/exports/current.pptx",
    sizeBytes: 12,
    contentType: "application/pptx",
    scope: "tool",
  });
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.method, "files/upload_begin");
  assert.deepEqual(frames[0]?.params, {
    path: "workspaces/demo/exports/current.pptx",
    scope: "tool",
    size_bytes: 12,
    content_type: "application/pptx",
  });
  assert.equal(client.dispatchResponse({
    jsonrpc: "2.0",
    id: frames[0]?.id,
    result: { put_url: "https://storage.example/put", headers: {} },
  }), true);
  assert.deepEqual(await pending, { put_url: "https://storage.example/put", headers: {} });
});

test("APS Files client sends reverse RPC without requiring a local initialize flag", async () => {
  const frames: Array<Record<string, unknown>> = [];
  const client = new ApsFilesClient({ writeFrame: (message: Record<string, unknown>) => frames.push(message) });

  const pending = client.uploadBegin({
    path: "workspaces/demo/exports/current.pdf",
    sizeBytes: 3,
    contentType: "application/pdf",
  });
  assert.equal(frames[0]?.method, "files/upload_begin");
  assert.equal((frames[0]?.params as Record<string, unknown>)?.scope, "tool");
  client.dispatchResponse({
    jsonrpc: "2.0",
    id: frames[0]?.id,
    result: { put_url: "https://storage.example/put", headers: {} },
  });
  await pending;
});

test("APS Files client normalizes get_url and preserves storage errors", async () => {
  const frames: Array<Record<string, unknown>> = [];
  const client = new ApsFilesClient({ writeFrame: (message: Record<string, unknown>) => frames.push(message) });
  client.enable();

  const link = client.downloadUrl({ path: "exports/current.pdf", expiresIn: 600, scope: "tool" });
  assert.deepEqual(frames[0]?.params, {
    path: "exports/current.pdf",
    scope: "tool",
    expires_in: 600,
    ttl_seconds: 600,
  });
  client.dispatchResponse({
    jsonrpc: "2.0",
    id: frames[0]?.id,
    result: { get_url: "https://storage.example/get", expires_at: "soon" },
  });
  assert.deepEqual(await link, {
    get_url: "https://storage.example/get",
    url: "https://storage.example/get",
    expires_at: "soon",
  });

  const failed = client.uploadComplete({ path: "exports/current.pdf", scope: "tool" });
  client.dispatchResponse({
    jsonrpc: "2.0",
    id: frames[1]?.id,
    error: { code: -32024, message: "quota exceeded", data: { limit: 1 } },
  });
  await assert.rejects(failed, (error: unknown) => {
    assert.ok(error instanceof ApsFilesError);
    assert.equal(error.code, -32024);
    assert.deepEqual(error.data, { limit: 1 });
    return true;
  });
});
