import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_DIR = path.join(__dirname, "dist", "client");
const ENGINE_DIST_INDEX = path.resolve(__dirname, "../../presenton-template-engine/dist/index.js");
const DEFAULT_PORT = 4319;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const TASK_STATE_FILES = [
  "task.json",
  "state.json",
  "current-page.json",
  "requirements.json",
  "outline.json",
  "page-plan.json",
  "page-progress.json",
  "artifacts.json",
  "events.jsonl",
] as const;

interface FileSnapshot {
  path: string;
  exists: boolean;
  kind: "json" | "jsonl" | "markdown" | "text";
  content: unknown;
  error?: string;
}

interface ProjectSnapshot {
  projectDir: string;
  taskStateFiles: Record<string, FileSnapshot>;
  promoteFiles: FileSnapshot[];
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface TaskStateMachineRuntime {
  describeTaskStateMachine: () => Promise<Record<string, unknown>>;
  invokeTaskStateMachine: (request: JsonRpcRequest) => Promise<unknown>;
}

let runtimePromise: Promise<TaskStateMachineRuntime> | null = null;

async function loadTaskStateMachineRuntime(): Promise<TaskStateMachineRuntime> {
  runtimePromise ??= import(ENGINE_DIST_INDEX) as Promise<TaskStateMachineRuntime>;
  return runtimePromise;
}

function getPort(): number {
  const raw = process.env.PORT;
  if (!raw) {
    return DEFAULT_PORT;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendText(response: ServerResponse, statusCode: number, value: string, contentType = "text/plain; charset=utf-8"): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readProjectDirFromQuery(requestUrl: URL): string {
  const projectDir = requestUrl.searchParams.get("project_dir")?.trim();
  if (!projectDir) {
    throw new Error("Missing query parameter: project_dir");
  }
  if (!path.isAbsolute(projectDir)) {
    throw new Error("project_dir must be an absolute path");
  }
  return projectDir;
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

async function readFileSnapshot(filePath: string, kind: FileSnapshot["kind"]): Promise<FileSnapshot> {
  try {
    const raw = await readFile(filePath, "utf8");
    if (kind === "json") {
      return {
        path: filePath,
        exists: true,
        kind,
        content: JSON.parse(raw) as unknown,
      };
    }

    if (kind === "jsonl") {
      const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as unknown;
          } catch {
            return { __parse_error: true, raw: line };
          }
        });
      return { path: filePath, exists: true, kind, content: lines };
    }

    return { path: filePath, exists: true, kind, content: raw };
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return {
      path: filePath,
      exists: code !== "ENOENT" ? false : false,
      kind,
      content: null,
      error: code === "ENOENT" ? undefined : error instanceof Error ? error.message : String(error),
    };
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(currentDir: string): Promise<void> {
    let entries: Array<{
      name: string | Buffer;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }>;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, String(entry.name));
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  await visit(dir);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

async function readProjectSnapshot(projectDir: string): Promise<ProjectSnapshot> {
  const taskStateFiles: Record<string, FileSnapshot> = {};
  for (const fileName of TASK_STATE_FILES) {
    taskStateFiles[fileName] = await readFileSnapshot(
      path.join(projectDir, "task-state", fileName),
      fileName.endsWith(".jsonl") ? "jsonl" : "json",
    );
  }

  const promoteFiles = await Promise.all(
    (await listFilesRecursive(path.join(projectDir, "promote")))
      .filter((filePath) => filePath.endsWith(".md") || filePath.endsWith(".json"))
      .map((filePath) => readFileSnapshot(
        filePath,
        filePath.endsWith(".json") ? "json" : "markdown",
      )),
  );

  return {
    projectDir,
    taskStateFiles,
    promoteFiles,
  };
}

function buildInvokeRequest(body: unknown): JsonRpcRequest {
  if (!isRecord(body)) {
    throw new Error("Request body must be an object");
  }

  const tool = body.tool;
  const argumentsValue = body.arguments;
  if (typeof tool !== "string" || !tool) {
    throw new Error("Missing required field: tool");
  }
  if (!isRecord(argumentsValue)) {
    throw new Error("Missing required field: arguments");
  }

  return {
    jsonrpc: "2.0",
    id: body.id as JsonRpcRequest["id"] ?? randomUUID(),
    method: "invoke",
    params: {
      tool,
      arguments: argumentsValue,
    },
  };
}

async function serveStatic(requestUrl: URL, response: ServerResponse): Promise<void> {
  const rawPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const relativePath = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(CLIENT_DIST_DIR, relativePath);
  const publicRoot = `${CLIENT_DIST_DIR}${path.sep}`;

  if (!filePath.startsWith(publicRoot)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    let fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      filePath = path.join(CLIENT_DIST_DIR, "index.html");
      fileStat = await stat(filePath);
    }
    if (!fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
    const content = await readFile(filePath);
    const contentType = filePath.endsWith(".html")
      ? "text/html; charset=utf-8"
      : filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : filePath.endsWith(".svg")
            ? "image/svg+xml"
          : "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
    });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function handleApi(request: IncomingMessage, response: ServerResponse, requestUrl: URL): Promise<void> {
  if (request.method === "GET" && requestUrl.pathname === "/api/manifest") {
    const runtime = await loadTaskStateMachineRuntime();
    sendJson(response, 200, await runtime.describeTaskStateMachine());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/snapshot") {
    sendJson(response, 200, await readProjectSnapshot(readProjectDirFromQuery(requestUrl)));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/invoke") {
    const body = await readRequestJson(request);
    const rpcRequest = buildInvokeRequest(body);
    const runtime = await loadTaskStateMachineRuntime();
    const result = await runtime.invokeTaskStateMachine(rpcRequest);
    const args = rpcRequest.params?.arguments;
    const projectDir = isRecord(args) && typeof args.project_dir === "string"
      ? args.project_dir
      : undefined;
    const snapshot = projectDir && path.isAbsolute(projectDir)
      ? await readProjectSnapshot(projectDir)
      : null;
    sendJson(response, 200, { rpcRequest, rpcResponse: result, snapshot });
    return;
  }

  sendJson(response, 404, { error: "API route not found" });
}

const server = createServer((request, response) => {
  void (async () => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    try {
      if (requestUrl.pathname.startsWith("/api/")) {
        await handleApi(request, response, requestUrl);
        return;
      }
      await serveStatic(requestUrl, response);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
});

const port = getPort();
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`State machine debugger API/static server: http://127.0.0.1:${port}\n`);
});
