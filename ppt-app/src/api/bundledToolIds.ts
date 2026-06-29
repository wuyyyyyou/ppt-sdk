import {
  ANNA_SEARCH_TOOL,
  PPT_ENGINE_TOOL,
  PPT_GENER_TOOL,
} from "./toolManifests.generated";

export interface PptBundledToolIds {
  pptEngine: string;
  pptGener: string;
  annaSearch: string;
}

function readBundledToolId(handle: string): string {
  const toolIds = typeof window !== "undefined" ? window.__ANNA_TOOL_IDS__ : undefined;
  const toolId = toolIds?.[handle];
  if (typeof toolId !== "string" || toolId.length === 0) {
    throw new Error(`Missing Anna bundled tool id for "${handle}".`);
  }
  return toolId;
}

export function resolvePptBundledToolIds(): PptBundledToolIds {
  return {
    pptEngine: readBundledToolId(PPT_ENGINE_TOOL.handle),
    pptGener: readBundledToolId(PPT_GENER_TOOL.handle),
    annaSearch: readBundledToolId(ANNA_SEARCH_TOOL.handle),
  };
}
