import { createAnnaAiClient } from "./annaAiClient";
import { createMockAiClient } from "./mockAiClient";
import type { AiClient } from "./types";
import { connectAnnaRuntime } from "../runtime/annaRuntime";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export type { AiClient } from "./types";

export async function createAiClient(): Promise<AiClient> {
  if (detectRuntimeMode() === "anna") {
    return createAnnaAiClient(await connectAnnaRuntime());
  }

  return createMockAiClient();
}
