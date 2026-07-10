import type { WorkspaceSettings } from "../../api/types";

export function readOutlineReviewPreference(
  setting: WorkspaceSettings | Record<string, unknown> | null | undefined,
): boolean {
  return setting?.review_outline_first === true;
}

export function outlineReviewPreferenceToWorkspaceSettings(
  reviewOutlineFirst: boolean,
): WorkspaceSettings {
  return {
    review_outline_first: reviewOutlineFirst === true,
  };
}
