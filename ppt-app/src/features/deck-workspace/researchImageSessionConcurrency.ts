import type { WorkspaceSettings } from "../../api/types";

export const RESEARCH_IMAGE_SESSION_CONCURRENCY_MIN = 1;
export const RESEARCH_IMAGE_SESSION_CONCURRENCY_MAX = 10;
export const DEFAULT_RESEARCH_IMAGE_SESSION_CONCURRENCY = 5;

export function normalizeResearchImageSessionConcurrency(
  value: unknown,
  fallback = DEFAULT_RESEARCH_IMAGE_SESSION_CONCURRENCY,
) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(
    RESEARCH_IMAGE_SESSION_CONCURRENCY_MIN,
    Math.min(RESEARCH_IMAGE_SESSION_CONCURRENCY_MAX, Math.floor(numericValue)),
  );
}

export function readResearchImageSessionConcurrency(
  setting: WorkspaceSettings | Record<string, unknown> | null | undefined,
) {
  return normalizeResearchImageSessionConcurrency(setting?.research_image_session_concurrency);
}
