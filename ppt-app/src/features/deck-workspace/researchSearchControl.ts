import type { WorkspaceSettings } from "../../api/types";

export interface ResearchSearchControlSettings {
  disableWebResearch: boolean;
  disableImageResearch: boolean;
}

export const DEFAULT_RESEARCH_SEARCH_CONTROL_SETTINGS: ResearchSearchControlSettings = {
  disableWebResearch: false,
  disableImageResearch: false,
};

export function readResearchSearchControlSettings(
  setting: WorkspaceSettings | Record<string, unknown> | null | undefined,
): ResearchSearchControlSettings {
  return {
    disableWebResearch: setting?.disable_web_research === true,
    disableImageResearch: setting?.disable_image_research === true,
  };
}

export function researchSearchControlSettingsToWorkspaceSettings(
  settings: ResearchSearchControlSettings,
): WorkspaceSettings {
  return {
    disable_web_research: settings.disableWebResearch === true,
    disable_image_research: settings.disableImageResearch === true,
  };
}
