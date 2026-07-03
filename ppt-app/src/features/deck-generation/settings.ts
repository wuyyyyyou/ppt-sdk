import type { WorkspaceResult } from "../../api/types";
import { readPageGenerationConcurrency } from "../deck-workspace/generationConcurrency";
import { readResearchSearchControlSettings } from "../deck-workspace/researchSearchControl";
import { readPageReviewSettings } from "../deck-workspace/reviewSettings";
import { ATTEMPT_LIMITS } from "./types";

export function readWorkspaceSetting(workspace: WorkspaceResult): Record<string, unknown> {
  return workspace.setting && typeof workspace.setting === "object" && !Array.isArray(workspace.setting)
    ? (workspace.setting as Record<string, unknown>)
    : {};
}

export function getAttemptLimits(input: { workspace: WorkspaceResult }) {
  const settings = readPageReviewSettings(readWorkspaceSetting(input.workspace));
  return {
    ...ATTEMPT_LIMITS,
    contentReview: settings.contentReviewFailureLimit,
    visualReview: settings.visualReviewFailureLimit,
  };
}

export function getReviewSettings(input: { workspace: WorkspaceResult }) {
  return readPageReviewSettings(readWorkspaceSetting(input.workspace));
}

export function getPageGenerationConcurrency(input: { workspace: WorkspaceResult }) {
  return readPageGenerationConcurrency(readWorkspaceSetting(input.workspace));
}

export function getResearchSearchControlSettings(input: { workspace: WorkspaceResult }) {
  return readResearchSearchControlSettings(readWorkspaceSetting(input.workspace));
}
