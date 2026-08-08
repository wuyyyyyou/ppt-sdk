export interface AnnaToolInvokeInput {
  tool_id: string;
  method: string;
  args: object;
  timeoutMs?: number;
}

export interface AnnaToolInvokeAsyncInput extends AnnaToolInvokeInput {
  clientTag?: string;
}

export type AnnaToolJobState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export interface AnnaToolJobProgress {
  seq: number;
  phase?: string;
  percent?: number;
  message?: string;
  data?: unknown;
}

export interface AnnaToolJobSnapshot<T = unknown> {
  jobId: string;
  clientTag?: string;
  state: AnnaToolJobState;
  result?: T;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
  progress?: AnnaToolJobProgress[];
  lastSeq?: number;
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

export interface AnnaAgentImageAttachment {
  type: string;
  url: string;
  filename?: string;
  detail: "auto";
}

export interface AnnaAgentSession {
  appSessionUuid?: string;
  expires_in?: number;
  expiresIn?: number;
  granted_tools?: string[];
  inherit_host_tools?: boolean;
  run(input: {
    content: string;
    attachments?: AnnaAgentImageAttachment[];
  }): AsyncIterable<AnnaAgentRunFrame>;
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

export interface AnnaFilesDownloadInput {
  path: string;
  scope?: string | null;
  /** Save-as name; the Host bakes it into the attachment disposition. */
  filename?: string | null;
  ttl_seconds?: number;
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
    invokeAsyncAwait?<T = unknown>(
      input: AnnaToolInvokeAsyncInput,
      options?: {
        timeoutMs?: number;
        onProgress?: (progress: AnnaToolJobProgress) => void;
        signal?: AbortSignal;
      },
    ): Promise<T>;
    listJobs?(input?: {
      tool_id?: string;
      state?: AnnaToolJobState | AnnaToolJobState[];
      clientTag?: string;
      limit?: number;
    }): Promise<{ jobs: Array<AnnaToolJobSnapshot>; truncated?: boolean }>;
    getJob?<T = unknown>(input: {
      jobId: string;
      sinceSeq?: number;
      limit?: number;
    }): Promise<AnnaToolJobSnapshot<T>>;
    cancelJob?(input: { jobId: string; reason?: string }): Promise<{
      jobId: string;
      state: AnnaToolJobState;
      cancelled: boolean;
    }>;
  };
  llm: {
    complete(input: AnnaLlmCompleteInput): Promise<unknown>;
  };
  web?: {
    search(input: {
      query: string;
      max_results?: number;
      search_depth?: "basic" | "advanced";
      topic?: "general" | "news";
      time_range?: "day" | "week" | "month" | "year";
      region?: string;
      include_domains?: string[];
      exclude_domains?: string[];
    }): Promise<unknown>;
    fetch(
      input: {
        urls: string[];
        format?: "markdown" | "text";
        max_chars?: number;
        timeout_ms?: number;
      },
      options?: { timeoutMs?: number },
    ): Promise<unknown>;
    image_search(input: {
      query: string;
      max_results?: number;
      min_width?: number;
      min_height?: number;
      aspect?: "any" | "wide" | "tall" | "square";
    }): Promise<unknown>;
    image_fetch(
      input: {
        url: string;
        max_bytes?: number;
        purpose?: string;
      },
      options?: { timeoutMs?: number },
    ): Promise<unknown>;
  };
  agent: {
    session(input: { submode: "auto" }): Promise<AnnaAgentSession>;
  };
  upload?: {
    negotiate(input: AnnaUploadNegotiateInput): Promise<AnnaUploadNegotiateResult>;
    confirm(input: { r2_key: string }): Promise<AnnaUploadConfirmResult>;
  };
  // The SDK builds `files` as a proxy, so every method is present as a function
  // whether or not the Host implements it. Availability has to come from the
  // call itself, not from a typeof check.
  files?: {
    download(input: AnnaFilesDownloadInput): Promise<unknown>;
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
