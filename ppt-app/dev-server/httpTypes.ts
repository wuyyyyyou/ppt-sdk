export interface ToolInvokeRequest {
  tool_id: string;
  method: string;
  args: Record<string, unknown>;
}

export interface ToolInvokeResponse {
  ok: boolean;
  tool_id?: string;
  method?: string;
  result?: unknown;
  error?: {
    code?: number;
    message: string;
    data?: unknown;
  };
  stderr?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readNonEmptyString(
  body: Record<string, unknown>,
  fieldName: string
): string {
  const value = body[fieldName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`"${fieldName}" must be a non-empty string.`);
  }

  return value;
}

export function parseToolInvokeRequest(body: unknown): ToolInvokeRequest {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const args = body.args;

  if (args !== undefined && !isPlainObject(args)) {
    throw new Error('"args" must be a JSON object when provided.');
  }

  return {
    tool_id: readNonEmptyString(body, "tool_id"),
    method: readNonEmptyString(body, "method"),
    args: args ?? {}
  };
}
