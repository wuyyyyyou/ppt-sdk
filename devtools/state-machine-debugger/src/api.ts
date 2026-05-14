import type { InvokeResponse, ProjectSnapshot, RpcEnvelope } from "./types";

export async function fetchManifest(): Promise<Record<string, unknown>> {
  const response = await fetch("/api/manifest");
  return readJsonResponse(response);
}

export async function invokeTool(tool: string, args: Record<string, unknown>): Promise<InvokeResponse> {
  const response = await fetch("/api/invoke", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });
  return readJsonResponse(response);
}

export async function fetchSnapshot(projectDir: string): Promise<ProjectSnapshot> {
  const response = await fetch(`/api/snapshot?project_dir=${encodeURIComponent(projectDir)}`);
  return readJsonResponse(response);
}

export function getRpcData<T = unknown>(response: RpcEnvelope | null): T | null {
  return (response?.result?.data as T | undefined) ?? null;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `HTTP ${response.status}`);
  }
  return data as T;
}
