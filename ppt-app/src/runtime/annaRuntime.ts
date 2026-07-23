export interface AnnaToolInvokeInput {
  tool_id: string;
  method: string;
  args: object;
  timeoutMs?: number;
}

export interface AnnaLlmCompleteInput {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: {
      type: "text";
      text: string;
    };
  }>;
}

export interface AnnaAgentRunFrame {
  event: string;
  text?: string;
  granted_tools?: string[];
  inherit_host_tools?: boolean;
  warnings?: Array<{
    code?: string;
    message?: string;
  }>;
  [key: string]: unknown;
}

export interface AnnaAgentSession {
  appSessionUuid?: string;
  expires_in?: number;
  expiresIn?: number;
  granted_tools?: string[];
  inherit_host_tools?: boolean;
  run(input: { content: string }): AsyncIterable<AnnaAgentRunFrame>;
  history?(): Promise<unknown>;
  cancel?(runId: string): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface AnnaUploadNegotiateInput {
  filename: string;
  mime_type: string;
  size_bytes: number;
  purpose?: "user_artifact" | "image_reference" | "image_input";
  metadata?: Record<string, unknown>;
}

export interface AnnaUploadNegotiateResult {
  put_url: string;
  headers?: Record<string, string>;
  r2_key: string;
  expires_at?: string;
}

export interface AnnaUploadConfirmResult {
  download_url: string;
  r2_key: string;
  size_bytes?: number;
  expires_at?: string;
  expires_in?: number;
}

export interface AnnaRuntime {
  call?<T = unknown>(
    ns: string,
    method: string,
    args?: object,
    options?: { timeoutMs?: number }
  ): Promise<T>;
  tools: {
    invoke(
      input: AnnaToolInvokeInput,
      options?: { timeoutMs?: number }
    ): Promise<unknown>;
  };
  llm: {
    complete(input: AnnaLlmCompleteInput): Promise<unknown>;
  };
  agent: {
    session(input: { submode: "auto" }): Promise<AnnaAgentSession>;
  };
  upload?: {
    negotiate(input: AnnaUploadNegotiateInput): Promise<AnnaUploadNegotiateResult>;
    confirm(input: { r2_key: string }): Promise<AnnaUploadConfirmResult>;
  };
}

declare global {
  interface Window {
    AnnaAppRuntime?: {
      connect(): Promise<AnnaRuntime>;
    };
    __ANNA_TOOL_IDS__?: Record<string, string>;
  }
}

interface AnnaRuntimeModule {
  AnnaAppRuntime?: {
    connect(): Promise<AnnaRuntime>;
  };
  default?: {
    connect(): Promise<AnnaRuntime>;
  };
}

const ANNA_RUNTIME_SDK_URLS = [
  "/static/anna-apps/_sdk/latest/index.js",
  "/static/anna-apps/_sdk/0.2.0/index.js"
];

async function loadAnnaRuntimeSdk(): Promise<AnnaRuntimeModule | null> {
  for (const sdkUrl of ANNA_RUNTIME_SDK_URLS) {
    try {
      return await import(/* @vite-ignore */ sdkUrl);
    } catch {
      // Try the next SDK path; production staging currently serves `latest`.
    }
  }
  return null;
}

export async function connectAnnaRuntime(): Promise<AnnaRuntime> {
  if (!window.AnnaAppRuntime) {
    const runtimeModule = await loadAnnaRuntimeSdk();
    window.AnnaAppRuntime =
      runtimeModule?.AnnaAppRuntime ?? runtimeModule?.default ?? window.AnnaAppRuntime;
  }

  if (!window.AnnaAppRuntime) {
    throw new Error("AnnaAppRuntime is not available in this environment.");
  }

  return window.AnnaAppRuntime.connect();
}
