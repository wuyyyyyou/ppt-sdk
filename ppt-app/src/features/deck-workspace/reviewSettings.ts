import type { WorkspaceSettings } from "../../api/types";

export const REVIEW_FAILURE_LIMIT_MIN = 1;
export const REVIEW_FAILURE_LIMIT_MAX = 5;
export const DEFAULT_CONTENT_REVIEW_ENABLED = false;
export const DEFAULT_CONTENT_REVIEW_FAILURE_LIMIT = 5;
export const DEFAULT_VISUAL_REVIEW_ENABLED = false;
export const DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT = 2;

export interface PageReviewSettings {
  contentReviewEnabled: boolean;
  contentReviewFailureLimit: number;
  visualReviewEnabled: boolean;
  visualReviewFailureLimit: number;
}

export const DEFAULT_PAGE_REVIEW_SETTINGS: PageReviewSettings = {
  contentReviewEnabled: DEFAULT_CONTENT_REVIEW_ENABLED,
  contentReviewFailureLimit: DEFAULT_CONTENT_REVIEW_FAILURE_LIMIT,
  visualReviewEnabled: DEFAULT_VISUAL_REVIEW_ENABLED,
  visualReviewFailureLimit: DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT,
};

export function normalizeReviewFailureLimit(
  value: unknown,
  fallback = DEFAULT_CONTENT_REVIEW_FAILURE_LIMIT,
) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.max(
    REVIEW_FAILURE_LIMIT_MIN,
    Math.min(REVIEW_FAILURE_LIMIT_MAX, Math.floor(numericValue)),
  );
}

export function readPageReviewSettings(
  setting: WorkspaceSettings | Record<string, unknown> | null | undefined,
): PageReviewSettings {
  return {
    contentReviewEnabled: false,
    contentReviewFailureLimit: normalizeReviewFailureLimit(
      setting?.content_review_failure_limit,
      DEFAULT_CONTENT_REVIEW_FAILURE_LIMIT,
    ),
    visualReviewEnabled:
      setting?.visual_review_enabled === true,
    visualReviewFailureLimit: normalizeReviewFailureLimit(
      setting?.visual_review_failure_limit,
      DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT,
    ),
  };
}

export function pageReviewSettingsToWorkspaceSettings(
  reviewSettings: PageReviewSettings,
): WorkspaceSettings {
  return {
    content_review_enabled: reviewSettings.contentReviewEnabled,
    content_review_failure_limit: normalizeReviewFailureLimit(
      reviewSettings.contentReviewFailureLimit,
      DEFAULT_CONTENT_REVIEW_FAILURE_LIMIT,
    ),
    visual_review_enabled: reviewSettings.visualReviewEnabled,
    visual_review_failure_limit: normalizeReviewFailureLimit(
      reviewSettings.visualReviewFailureLimit,
      DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT,
    ),
  };
}

export function isStrictReviewModeEnabled(reviewSettings: PageReviewSettings) {
  return reviewSettings.visualReviewEnabled;
}
