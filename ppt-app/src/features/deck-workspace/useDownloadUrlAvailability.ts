import { useEffect, useState } from "react";
import { getDownloadExpirationMs, hasActiveDownloadUrl } from "./downloadUrl";
import type { DownloadLinkState } from "./types";

export function useDownloadUrlAvailability(download: DownloadLinkState) {
  const [clock, setClock] = useState(() => Date.now());
  const expiresAt = download.expiresAt
    ? getDownloadExpirationMs(download.expiresAt)
    : Number.NaN;

  useEffect(() => {
    setClock(Date.now());
  }, [download.href]);

  useEffect(() => {
    if (!Number.isFinite(expiresAt)) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return;
    const timeout = globalThis.setTimeout(
      () => setClock(Date.now()),
      remaining + 25,
    );
    return () => globalThis.clearTimeout(timeout);
  }, [expiresAt]);

  const active = hasActiveDownloadUrl(download, clock);
  return {
    active,
    expired: download.status === "ready" && Boolean(download.href) && !active,
  };
}
