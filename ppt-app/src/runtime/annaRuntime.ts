export interface AnnaToolInvokeInput {
  tool_id: string;
  method: string;
  args: object;
}

export interface AnnaLlmCompleteInput {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: {
      type: "text";
      text: string;
    };
  }>;
  maxTokens?: number;
}

export interface AnnaAgentRunFrame {
  event: string;
  text?: string;
  [key: string]: unknown;
}

export interface AnnaAgentSession {
  appSessionUuid?: string;
  run(input: { content: string }): AsyncIterable<AnnaAgentRunFrame>;
  history?(): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface AnnaRuntime {
  call?<T = unknown>(
    ns: string,
    method: string,
    args?: object,
    options?: { timeoutMs?: number }
  ): Promise<T>;
  tools: {
    invoke(input: AnnaToolInvokeInput): Promise<unknown>;
  };
  llm: {
    complete(input: AnnaLlmCompleteInput): Promise<unknown>;
  };
  agent: {
    session(input: { submode: "auto" }): Promise<AnnaAgentSession>;
  };
}

declare global {
  interface Window {
    AnnaAppRuntime?: {
      connect(): Promise<AnnaRuntime>;
    };
  }
}

export async function connectAnnaRuntime(): Promise<AnnaRuntime> {
  if (!window.AnnaAppRuntime) {
    throw new Error("AnnaAppRuntime is not available in this environment.");
  }

  return window.AnnaAppRuntime.connect();
}
