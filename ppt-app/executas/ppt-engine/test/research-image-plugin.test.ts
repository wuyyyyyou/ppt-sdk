import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const content = await readFile(logPath, "utf8").catch(() => "");
    if (content.includes("ppt-engine.research-image-download") && content.includes("ppt-engine.research-image-session-upload")) {
      return content;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Research image storage transfer logs were not written");
}

test("research images use safe HTTPS download staging, Host Upload, and local import", { timeout: 15_000 }, async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-research-image-home-"));
  process.env.HOME = homeDir;
  const { createAppWorkspace } = await import("../src/app-workspace/index.js");
  const created = await createAppWorkspace({ title: "Research images" });
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;

  let uploadedBytes = Buffer.alloc(0);
  const uploadServer = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      uploadedBytes = Buffer.concat(chunks);
      response.writeHead(200);
      response.end();
    });
  });
  await new Promise<void>((resolve) => uploadServer.listen(0, "127.0.0.1", resolve));
  const uploadAddress = uploadServer.address();
  assert.ok(uploadAddress && typeof uploadAddress === "object");
  const putUrl = `http://127.0.0.1:${uploadAddress.port}/signed-put-secret`;

  const child = spawn(process.execPath, ["example_plugin.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, HOME: homeDir },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  let nextId = 1;
  const hostUploadModes: string[] = [];

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
    if (message.method === "host/uploadFile") {
      const mode = String(message.params?.mode ?? "");
      hostUploadModes.push(mode);
      const result = mode === "negotiate"
        ? { put_url: putUrl, r2_key: "research/candidate-1", headers: {} }
        : {
            url: "https://upload.test/signed-read-secret",
            r2_key: "research/candidate-1",
            mime_type: "image/png",
            size_bytes: PNG.byteLength,
            filename: "candidate-1.png",
            expires_at: "2099-01-01T00:00:00.000Z",
          };
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
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

    const rejected = await request("app_prepare_shared_research_image_candidate", {
      workspace_dir: created.workspace_dir,
      operation_id: "research-operation-1",
      candidate_id: "candidate-unsafe",
      source_url: "http://127.0.0.1/private.png",
    });
    assert.match(JSON.stringify(rejected), /must use HTTPS/);

    const stagingDir = path.join(created.workspace_dir, "research/evidence/images/.staging/research-operation-1");
    const stagingPath = path.join(stagingDir, "candidate-1.png");
    await mkdir(stagingDir, { recursive: true });
    await writeFile(stagingPath, PNG);

    const uploaded = await request("app_upload_shared_research_image_candidate", {
      workspace_dir: created.workspace_dir,
      operation_id: "research-operation-1",
      candidate_id: "candidate-1",
      local_file_path: stagingPath,
      mime_type: "image/png",
    });
    assert.equal(
      ((uploaded.result as { data?: { host_upload?: { url?: unknown } } })?.data)?.host_upload?.url,
      "https://upload.test/signed-read-secret",
      JSON.stringify(uploaded),
    );
    assert.deepEqual(hostUploadModes, ["negotiate", "confirm"]);
    assert.deepEqual(uploadedBytes, PNG);

    const imported = await request("app_import_shared_research_image_local", {
      workspace_dir: created.workspace_dir,
      candidate_id: "candidate-1",
      local_file_path: stagingPath,
      mime_type: "image/png",
      size_bytes: PNG.byteLength,
      sha256: createHash("sha256").update(PNG).digest("hex"),
    });
    const data = (imported.result as { data?: { file_path?: string; sha256?: string } })?.data;
    assert.ok(data?.file_path, JSON.stringify(imported));
    assert.deepEqual(await readFile(data.file_path), PNG);
    assert.equal(data.sha256, createHash("sha256").update(PNG).digest("hex"));

    await writeFile(path.join(stagingDir, "unused.png"), PNG);
    const cleaned = await request("app_cleanup_shared_research_image_staging", {
      workspace_dir: created.workspace_dir,
      operation_id: "research-operation-1",
    });
    assert.equal((cleaned.result as { data?: { cleaned?: unknown } })?.data?.cleaned, true, JSON.stringify(cleaned));
    assert.equal(await stat(stagingDir).then(() => true).catch(() => false), false);

    const storageLog = await waitForStorageLog(created.workspace_dir);
    assert.match(storageLog, /"transport":"https_download"/);
    assert.match(storageLog, /"transport":"host_upload"/);
    assert.match(storageLog, /"operation_id":"research-operation-1"/);
    assert.equal(storageLog.includes("signed-put-secret"), false);
    assert.equal(storageLog.includes("signed-read-secret"), false);
  } finally {
    lines.close();
    child.kill("SIGTERM");
    uploadServer.close();
    await rm(homeDir, { recursive: true, force: true });
  }
});
