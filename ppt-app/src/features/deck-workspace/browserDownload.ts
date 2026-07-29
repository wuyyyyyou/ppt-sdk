export const DOWNLOAD_SINK_ID = "ppt-export-download-sink";
export const DOWNLOAD_SINK_LIFETIME_MS = 120_000;

export interface DownloadSinkHost {
  getElementById(id: string): { remove(): void } | null;
  createElement(tag: "iframe"): {
    id: string;
    hidden: boolean;
    setAttribute(name: string, value: string): void;
    src: string;
    remove(): void;
    style: { display: string };
  };
  body: { appendChild(node: unknown): void } | null;
}

/**
 * The export mirror is stored with `Content-Disposition: attachment`, so simply
 * loading its signed URL is enough to make the browser save the file. Loading it
 * into an offscreen frame rather than the app's own document means an expired
 * URL renders its error body somewhere invisible instead of navigating the app
 * away, and no popup is left behind when the host blocks the download outright
 * (see ADR-0025: the Anna Host iframe has no `allow-downloads`).
 */
export function startBrowserDownload(
  href: string,
  host: DownloadSinkHost | null | undefined,
  scheduleCleanup: (task: () => void, delayMs: number) => void = setTimeout,
): boolean {
  if (!href || !host?.body) return false;

  host.getElementById(DOWNLOAD_SINK_ID)?.remove();
  const sink = host.createElement("iframe");
  sink.id = DOWNLOAD_SINK_ID;
  sink.hidden = true;
  sink.style.display = "none";
  sink.setAttribute("aria-hidden", "true");
  sink.setAttribute("tabindex", "-1");
  host.body.appendChild(sink);
  sink.src = href;
  // Removing the frame too early cancels the transfer, so it lingers until the
  // browser has had time to take the bytes over.
  scheduleCleanup(() => sink.remove(), DOWNLOAD_SINK_LIFETIME_MS);
  return true;
}
