export interface AnnaToolInvokeInput {
  tool_id: string;
  method: string;
  args: object;
}

export interface AnnaRuntime {
  tools: {
    invoke(input: AnnaToolInvokeInput): Promise<unknown>;
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
