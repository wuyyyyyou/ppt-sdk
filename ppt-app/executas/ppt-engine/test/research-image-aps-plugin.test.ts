import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function waitForStorageLog(workspaceDir: string) {
  const logPath = path.join(workspaceDir, ".log", "storage-transport.jsonl");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const content = await readFile(logPath, "utf8").catch(() => "");
    if (content.includes("ppt-engine.research-image-session") && content.includes("ppt-engine.research-image-import")) {
      return content;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Research APS storage transfer logs were not written");
}

test("research images resolve and import from APS without Host Upload", { timeout: 15_000 }, async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-research-aps-home-"));
  process.env.HOME = homeDir;
  const { createAppWorkspace } = await import("../src/app-workspace/index.js");
  const created = await createAppWorkspace({ title: "Research APS" });
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;

  const imageServer = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "image/png", "Content-Length": PNG.byteLength });
    response.end(PNG);
  });
  await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
  const address = imageServer.address();
  assert.ok(address && typeof address === "object");
  const downloadUrl = `http://127.0.0.1:${address.port}/image.png`;

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
    if (transportPath) message = JSON.parse(await readFile(transportPath, "utf8")) as typeof message;
    if (message.method) {
      if (message.method === "host/uploadFile") hostUploadCalls += 1;
      if (message.method === "files/download_url") {
        apsMethods.push(message.method);
        assert.equal(message.params?.scope, "user");
        child.stdin.write(`${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { get_url: downloadUrl, expires_at: "2026-07-30T12:00:00.000Z" },
        })}\n`);
      }
      return;
    }
    if (typeof message.id === "number") {
      pending.get(message.id)?.(message as unknown as Record<string, unknown>);
      pending.delete(message.id);
    }
  });

  const request = (tool: string, args: Record<string, unknown>) => {
    const id = nextId++;
    const response = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method: "invoke", params: { tool, arguments: args } })}\n`);
    return response;
  };

  try {
    const prepared = await request("app_prepare_shared_research_workspace", {
      workspace_dir: created.workspace_dir,
      reset_progress: true,
    });
    assert.ok(prepared.result, JSON.stringify(prepared));
    const patched = await request("app_patch_shared_research_progress", {
      workspace_dir: created.workspace_dir,
      operations: [{ op: "set_stage", stage: "image_prefetch", state: "running" }],
    });
    assert.equal(
      ((patched.result as { data?: { revision?: unknown } })?.data)?.revision,
      1,
      JSON.stringify(patched),
    );

    const resolved = await request("app_get_shared_research_image_download_urls", {
      workspace_dir: created.workspace_dir,
      operation_id: "research-operation-1",
      artifacts: [{
        candidate_id: "candidate-1",
        aps_path: "web-images/candidate-1.png",
        parent_interaction_id: "image-fetch-interaction-1",
      }],
    });
    assert.equal(
      (((resolved.result as { data?: { artifacts?: Array<{ download_url?: unknown }> } })?.data)?.artifacts)?.[0]?.download_url,
      downloadUrl,
    );

    const imported = await request("app_import_shared_research_image_aps", {
      workspace_dir: created.workspace_dir,
      operation_id: "research-operation-1",
      parent_interaction_id: "image-fetch-interaction-1",
      candidate_id: "candidate-1",
      aps_path: "web-images/candidate-1.png",
      mime_type: "image/png",
      size_bytes: PNG.byteLength,
      sha256: createHash("sha256").update(PNG).digest("hex"),
    });
    const data = (imported.result as { data?: { file_path?: string; sha256?: string } })?.data;
    assert.ok(data?.file_path, JSON.stringify(imported));
    assert.deepEqual(await readFile(data.file_path), PNG);
    assert.equal(data.sha256, createHash("sha256").update(PNG).digest("hex"));
    assert.deepEqual(apsMethods, ["files/download_url", "files/download_url"]);
    assert.equal(hostUploadCalls, 0);
    const storageLog = await waitForStorageLog(created.workspace_dir);
    assert.match(storageLog, /"phase":"download_url"/);
    assert.match(storageLog, /"phase":"download"/);
    assert.match(storageLog, /"phase":"finished"/);
    assert.match(storageLog, /"operation_id":"research-operation-1"/);
    assert.match(storageLog, /"parent_interaction_id":"image-fetch-interaction-1"/);
    assert.equal(storageLog.includes(downloadUrl), false);
  } finally {
    lines.close();
    child.kill("SIGTERM");
    imageServer.close();
    await rm(homeDir, { recursive: true, force: true });
  }
});
