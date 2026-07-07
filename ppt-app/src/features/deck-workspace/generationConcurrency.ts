import type { WorkspaceSettings } from "../../api/types";

export const PAGE_GENERATION_CONCURRENCY_MIN = 1;
export const PAGE_GENERATION_CONCURRENCY_MAX = 10;
export const DEFAULT_PAGE_GENERATION_CONCURRENCY = 5;

export function normalizePageGenerationConcurrency(
  value: unknown,
  fallback = DEFAULT_PAGE_GENERATION_CONCURRENCY,
) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.max(
    PAGE_GENERATION_CONCURRENCY_MIN,
    Math.min(PAGE_GENERATION_CONCURRENCY_MAX, Math.floor(numericValue)),
  );
}

export function readPageGenerationConcurrency(
  setting: WorkspaceSettings | Record<string, unknown> | null | undefined,
) {
  return normalizePageGenerationConcurrency(setting?.page_generation_concurrency);
}

export function pageGenerationConcurrencyToWorkspaceSettings(
  concurrency: number,
): WorkspaceSettings {
  return {
    page_generation_concurrency: normalizePageGenerationConcurrency(concurrency),
  };
}
