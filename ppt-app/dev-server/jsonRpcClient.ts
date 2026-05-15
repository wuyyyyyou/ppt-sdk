import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { LocalToolDefinition } from "./toolRegistry";
import type { ToolInvokeRequest, ToolInvokeResponse } from "./httpTypes";

interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | null;
  error: {
    code?: number;
    message: string;
    data?: unknown;
  };
}

interface JsonRpcFileTransportPointer {
  jsonrpc: "2.0";
  id: number | null;
  __file_transport?: string;
  __trans_file__?: string;
}

type JsonRpcResponse =
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse
  | JsonRpcFileTransportPointer;

const MAX_STDERR_BYTES = 256 * 1024;

function buildJsonRpcRequest(request: ToolInvokeRequest) {
  return {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "invoke",
    params: {
      tool: request.method,
      arguments: request.args
    }
  };
}

function appendChunk(existing: string, chunk: Buffer): string {
  const next = existing + chunk.toString("utf8");

  if (Buffer.byteLength(next, "utf8") <= MAX_STDERR_BYTES) {
    return next;
  }

  return next.slice(next.length - MAX_STDERR_BYTES);
}

function parseJsonLine(line: string): JsonRpcResponse | null {
  try {
    const parsed = JSON.parse(line) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as { jsonrpc?: unknown }).jsonrpc === "2.0"
    ) {
      return parsed as JsonRpcResponse;
    }
  } catch {
    return null;
  }

  return null;
}

function parseLastJsonRpcResponse(stdout: string): JsonRpcResponse | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const response = parseJsonLine(lines[index]);
    if (response) {
      return response;
    }
  }

  return null;
}

function getTransportPath(response: JsonRpcResponse): string | null {
  if ("__file_transport" in response && typeof response.__file_transport === "string") {
    return response.__file_transport;
  }

  if ("__trans_file__" in response && typeof response.__trans_file__ === "string") {
    return response.__trans_file__;
  }

  return null;
}

async function resolveFileTransportResponse(
  response: JsonRpcResponse
): Promise<JsonRpcResponse> {
  const transportPath = getTransportPath(response);

  if (!transportPath) {
    return response;
  }

  const contents = await readFile(transportPath, "utf8");
  const parsed = parseJsonLine(contents.trim());

  if (!parsed) {
    throw new Error(`Invalid JSON-RPC response in file transport: ${transportPath}`);
  }

  return parsed;
}

function toToolInvokeResponse(
  request: ToolInvokeRequest,
  response: JsonRpcResponse,
  stderr: string
): ToolInvokeResponse {
  if ("error" in response) {
    return {
      ok: false,
      tool_id: request.tool_id,
      method: request.method,
      error: response.error,
      stderr
    };
  }

  if ("result" in response) {
    return {
      ok: true,
      tool_id: request.tool_id,
      method: request.method,
      result: response.result,
      stderr
    };
  }

  return {
    ok: false,
    tool_id: request.tool_id,
    method: request.method,
    error: {
      code: -32000,
      message: "JSON-RPC file transport pointer did not resolve to a response."
    },
    stderr
  };
}

export async function invokeJsonRpcTool(
  tool: LocalToolDefinition,
  request: ToolInvokeRequest
): Promise<ToolInvokeResponse> {
  return new Promise<ToolInvokeResponse>((resolve) => {
    const child = spawn(tool.command, tool.args, {
      cwd: tool.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, tool.timeoutMs);

    function settle(response: ToolInvokeResponse) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(response);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendChunk(stderr, chunk);
    });

    child.on("error", (error) => {
      settle({
        ok: false,
        tool_id: request.tool_id,
        method: request.method,
        error: {
          code: -32000,
          message: error.message
        },
        stderr
      });
    });

    child.on("close", async (exitCode, signal) => {
      if (settled) {
        return;
      }

      if (timedOut) {
        settle({
          ok: false,
          tool_id: request.tool_id,
          method: request.method,
          error: {
            code: -32000,
            message: `Local tool timed out after ${tool.timeoutMs}ms.`
          },
          stderr
        });
        return;
      }

      try {
        const parsedResponse = parseLastJsonRpcResponse(stdout);

        if (!parsedResponse) {
          settle({
            ok: false,
            tool_id: request.tool_id,
            method: request.method,
            error: {
              code: -32000,
              message:
                exitCode === 0
                  ? "Local tool did not return a JSON-RPC response."
                  : `Local tool exited without a JSON-RPC response. exitCode=${exitCode} signal=${signal ?? "none"}`
            },
            stderr
          });
          return;
        }

        const resolvedResponse = await resolveFileTransportResponse(parsedResponse);
        settle(toToolInvokeResponse(request, resolvedResponse, stderr));
      } catch (error) {
        settle({
          ok: false,
          tool_id: request.tool_id,
          method: request.method,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : "Failed to parse JSON-RPC response."
          },
          stderr
        });
      }
    });

    const jsonRpcRequest = buildJsonRpcRequest(request);
    child.stdin.end(`${JSON.stringify(jsonRpcRequest)}\n`);
  });
}
