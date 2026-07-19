import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("export artifact tools publish through APS Files and mint links without Host Upload", { timeout: 15_000 }, async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-aps-plugin-home-"));
  process.env.HOME = homeDir;
  const { createAppWorkspace, recordAppPptxExport } = await import("../src/app-workspace/index.js");
  const created = await createAppWorkspace({ title: "APS plugin" });
  const pptxPath = path.join(created.workspace_dir, "output", "deck.pptx");
  await mkdir(path.dirname(pptxPath), { recursive: true });
  await writeFile(pptxPath, "pptx-through-aps");
  await recordAppPptxExport({ workspace_dir: created.workspace_dir, pptx_path: pptxPath });
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;

  let uploaded = Buffer.alloc(0);
  let uploadedContentDisposition = "";
  const uploadServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    uploaded = Buffer.concat(chunks);
    uploadedContentDisposition = request.headers["content-disposition"] ?? "";
    response.setHeader("ETag", '"put-etag"');
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
        assert.equal(message.params?.scope, "app");
        assert.equal(message.params?.content_type, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        result = {
          put_url: `http://127.0.0.1:${address.port}/put`,
          headers: { "Content-Type": message.params?.content_type },
        };
      } else if (message.method === "files/upload_complete") {
        result = { etag: "aps-etag", size_bytes: uploaded.byteLength };
      } else if (message.method === "files/download_url") {
        result = { get_url: "https://storage.example/current.pptx", expires_at: "soon" };
      }
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
    const missing = await request("invoke", {
      tool: "app_get_export_artifact_download_url",
      arguments: { workspace_dir: created.workspace_dir, artifact_type: "pptx" },
    });
    assert.equal(
      ((missing.result as { data?: { status?: unknown } })?.data)?.status,
      "missing",
    );
    assert.deepEqual(apsMethods, []);

    const published = await request("invoke", {
      tool: "app_publish_export_artifact",
      arguments: { workspace_dir: created.workspace_dir, artifact_type: "pptx" },
    });
    assert.ok(published.result, JSON.stringify(published));
    assert.equal(
      ((published.result as { data?: { status?: unknown } })?.data)?.status,
      "ready",
    );
    assert.equal(uploaded.toString(), "pptx-through-aps");
    assert.equal(
      uploadedContentDisposition,
      "attachment; filename=\"APS plugin.pptx\"; filename*=UTF-8''APS%20plugin.pptx",
    );

    const linked = await request("invoke", {
      tool: "app_get_export_artifact_download_url",
      arguments: { workspace_dir: created.workspace_dir, artifact_type: "pptx" },
    });
    assert.equal(
      ((linked.result as { data?: { download_url?: unknown } })?.data)?.download_url,
      "https://storage.example/current.pptx",
    );
    assert.deepEqual(apsMethods, [
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

test("APS Files client is included in package and SEA assets", async () => {
  const projectDir = fileURLToPath(new URL("..", import.meta.url));
  const packageJson = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8")) as {
    files?: string[];
  };
  const seaScript = await readFile(path.join(projectDir, "scripts", "prepare-sea-bundle.mjs"), "utf8");
  assert.ok(packageJson.files?.includes("aps-files-client.js"));
  assert.match(seaScript, /"aps-files-client\.js"/);
});
