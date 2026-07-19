import type { ExportDownloadState } from "./types";

export function getExportDownloadExpirationMs(value: string): number {
  const timestamp = value.trim();
  const isIsoDateTime = /^\d{4}-\d{2}-\d{2}T/.test(timestamp);
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  return Date.parse(isIsoDateTime && !hasTimeZone ? `${timestamp}Z` : timestamp);
}

export function hasActiveExportDownloadUrl(
  download: ExportDownloadState,
  now = Date.now(),
): boolean {
  if (download.status !== "ready" || !download.href) return false;
  if (!download.expiresAt) return true;

  const expiresAt = getExportDownloadExpirationMs(download.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
