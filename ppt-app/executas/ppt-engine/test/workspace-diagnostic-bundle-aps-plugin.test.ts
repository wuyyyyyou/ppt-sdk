import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("Workspace Diagnostic Bundle uses APS Files without Host Upload and regenerates on every call", { timeout: 20_000 }, async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-diagnostic-plugin-home-"));
  process.env.HOME = homeDir;
  const { createAppWorkspace } = await import("../src/app-workspace/index.js");
  const created = await createAppWorkspace({ title: "Diagnostic plugin" });
  await mkdir(path.join(created.workspace_dir, ".log"), { recursive: true });
  await writeFile(path.join(created.workspace_dir, ".log", "agent.jsonl"), "plugin-diagnostic\n");
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;

  const uploadedBodies: Buffer[] = [];
  const uploadedDispositions: string[] = [];
  const uploadServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    uploadedBodies.push(Buffer.concat(chunks));
    uploadedDispositions.push(request.headers["content-disposition"] ?? "");
    response.setHeader("ETag", `"diagnostic-etag-${uploadedBodies.length}"`);
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
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  let nextId = 1;
  let hostUploadCalls = 0;
  const apsMethods: string[] = [];
  const uploadPaths: unknown[] = [];

  lines.on("line", async (line) => {
    let message = JSON.parse(line) as {
      id: number | string;
      method?: string;
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
      __file_transport?: string;
      __trans_file__?: string;
    };
    const transportPath = message.__file_transport ?? message.__trans_file__;
    if (transportPath) {
      message = JSON.parse(await readFile(transportPath, "utf8")) as typeof message;
    }
    if (message.method) {
      if (message.method === "host/uploadFile") hostUploadCalls += 1;
      if (message.method.startsWith("files/")) apsMethods.push(message.method);
      let result: Record<string, unknown> = {};
      if (message.method === "files/upload_begin") {
        uploadPaths.push(message.params?.path);
        assert.equal(message.params?.scope, "app");
        assert.equal(message.params?.content_type, "application/zip");
        result = {
          put_url: `http://127.0.0.1:${address.port}/put`,
          headers: { "Content-Type": "application/zip" },
        };
      } else if (message.method === "files/upload_complete") {
        result = { etag: `aps-etag-${uploadedBodies.length}`, size_bytes: uploadedBodies.at(-1)?.byteLength };
      } else if (message.method === "files/download_url") {
        result = {
          get_url: `https://storage.example/diagnostic-${uploadedBodies.length}.zip`,
          expires_at: "2026-07-19T12:00:00Z",
        };
      }
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
      return;
    }
    if (typeof message.id === "number") {
      pending.get(message.id)?.(message as unknown as Record<string, unknown>);
      pending.delete(message.id);
    }
  });

  const request = () => {
    const id = nextId++;
    const response = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "invoke",
      params: {
        tool: "app_prepare_workspace_diagnostic_bundle",
        arguments: { workspace_dir: created.workspace_dir },
      },
    })}\n`);
    return response;
  };

  try {
    const first = await request();
    const second = await request();
    assert.equal(
      ((first.result as { data?: { download_url?: unknown } })?.data)?.download_url,
      "https://storage.example/diagnostic-1.zip",
    );
    assert.equal(
      ((second.result as { data?: { download_url?: unknown } })?.data)?.download_url,
      "https://storage.example/diagnostic-2.zip",
    );
    assert.equal(uploadedBodies.length, 2);
    assert.ok(uploadedBodies.every((body) => body.subarray(0, 2).toString("ascii") === "PK"));
    assert.deepEqual(uploadPaths, [
      `workspaces/${created.workspace_id}/diagnostics/current-workspace.zip`,
      `workspaces/${created.workspace_id}/diagnostics/current-workspace.zip`,
    ]);
    assert.deepEqual(uploadedDispositions, [
      `attachment; filename="${created.workspace_id}-workspace-diagnostics.zip"; filename*=UTF-8''${created.workspace_id}-workspace-diagnostics.zip`,
      `attachment; filename="${created.workspace_id}-workspace-diagnostics.zip"; filename*=UTF-8''${created.workspace_id}-workspace-diagnostics.zip`,
    ]);
    assert.deepEqual(apsMethods, [
      "files/upload_begin",
      "files/upload_complete",
      "files/download_url",
      "files/upload_begin",
      "files/upload_complete",
      "files/download_url",
    ]);
    assert.equal(hostUploadCalls, 0);
  } finally {
    lines.close();
    child.kill("SIGTERM");
    uploadServer.close();
    await rm(homeDir, { recursive: true, force: true });
  }
});
