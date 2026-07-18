const ACTIVE_PAGE_STATUSES = new Set([
  "research_collecting",
  "research_curating",
  "authoring",
  "rendering",
  "visual_review",
  "visual_review_fixing",
  "render_fixing",
]);

const RESUMABLE_PAGE_STATUSES = new Set([
  "interrupted",
  "pending",
  "agent_infrastructure_failed",
]);

const GENUINELY_FAILED_PAGE_STATUSES = new Set([
  "render_failed",
  "agent_failed",
  "needs_user_review",
]);

const RETRYABLE_PAGE_STATUSES = new Set([
  "interrupted",
  "render_failed",
  "agent_failed",
  "needs_user_review",
  "agent_infrastructure_failed",
]);

export function isActivePageGenerationStatus(status: string) {
  return ACTIVE_PAGE_STATUSES.has(status);
}

export function isResumablePageGenerationStatus(status: string) {
  return RESUMABLE_PAGE_STATUSES.has(status);
}

export function isUnfinishedPageGenerationStatus(status: string) {
  return status !== "accepted";
}

export function shouldResumePageGenerationStatus(status: string) {
  return isUnfinishedPageGenerationStatus(status);
}

export function isGenuinelyFailedPageGenerationStatus(status: string) {
  return GENUINELY_FAILED_PAGE_STATUSES.has(status);
}

export function isRetryablePageGenerationStatus(status: string) {
  return RETRYABLE_PAGE_STATUSES.has(status);
}

export const pageStatusPolicy = {
  active: ACTIVE_PAGE_STATUSES,
  resumable: RESUMABLE_PAGE_STATUSES,
  genuinelyFailed: GENUINELY_FAILED_PAGE_STATUSES,
  retryable: RETRYABLE_PAGE_STATUSES,
};
