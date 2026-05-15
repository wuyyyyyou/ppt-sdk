import type { LocalToolDefinition } from "./toolRegistry";

export interface ToolInvokeRequest {
  tool_id: string;
  method: string;
  args: Record<string, unknown>;
}

export interface ToolInvokeResponse {
  ok: boolean;
  tool_id: string;
  method: string;
  result?: unknown;
  error?: {
    code?: number;
    message: string;
  };
  stderr?: string;
}

export async function invokeJsonRpcTool(
  _tool: LocalToolDefinition,
  request: ToolInvokeRequest
): Promise<ToolInvokeResponse> {
  return {
    ok: false,
    tool_id: request.tool_id,
    method: request.method,
    error: {
      code: -32000,
      message: "JSON-RPC stdio bridge is not implemented yet."
    }
  };
}
