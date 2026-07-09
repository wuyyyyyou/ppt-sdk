import type { ExportArtifact } from "./types";

export interface ExportArtifactDownloadEnvironment {
  fetch?: typeof fetch;
  document?: Document;
  url?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  open?: typeof window.open;
  warn?: (...data: unknown[]) => void;
  releaseObjectUrl?: (callback: () => void) => void;
}

function readDownloadEnvironment(input: ExportArtifactDownloadEnvironment = {}) {
  return {
    fetchImpl: input.fetch ?? globalThis.fetch,
    documentImpl: input.document ?? (typeof document !== "undefined" ? document : undefined),
    urlImpl: input.url ?? globalThis.URL,
    openImpl: input.open ?? (typeof window !== "undefined" ? window.open.bind(window) : undefined),
    warnImpl: input.warn ?? console.warn.bind(console),
    releaseObjectUrl: input.releaseObjectUrl ?? ((callback: () => void) => {
      globalThis.setTimeout(callback, 0);
    }),
  };
}

function triggerBlobDownload(documentImpl: Document, href: string, fileName: string | undefined) {
  const link = documentImpl.createElement("a");
  link.href = href;
  link.download = fileName ?? "";
  link.rel = "noopener";
  link.style.display = "none";
  documentImpl.body.appendChild(link);
  link.click();
  link.remove();
}

function openDownloadFallback(artifact: ExportArtifact, openImpl: typeof window.open | undefined) {
  if (!openImpl) return;
  openImpl(artifact.href, "_blank", "noopener,noreferrer");
}

export async function downloadExportArtifact(
  artifact: ExportArtifact,
  environment?: ExportArtifactDownloadEnvironment,
): Promise<void> {
  const {
    fetchImpl,
    documentImpl,
    urlImpl,
    openImpl,
    warnImpl,
    releaseObjectUrl,
  } = readDownloadEnvironment(environment);

  try {
    if (!fetchImpl) {
      throw new Error("fetch is not available.");
    }
    if (!documentImpl?.body) {
      throw new Error("document.body is not available.");
    }
    if (
      !urlImpl ||
      typeof urlImpl.createObjectURL !== "function" ||
      typeof urlImpl.revokeObjectURL !== "function"
    ) {
      throw new Error("URL.createObjectURL is not available.");
    }

    const response = await fetchImpl(artifact.href, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Artifact download fetch failed: HTTP ${response.status}`);
    }

    const objectUrl = urlImpl.createObjectURL(await response.blob());
    try {
      triggerBlobDownload(documentImpl, objectUrl, artifact.fileName);
    } finally {
      releaseObjectUrl(() => urlImpl.revokeObjectURL(objectUrl));
    }
  } catch (error) {
    warnImpl("Failed to download export artifact as a Blob; opening original URL instead.", error);
    openDownloadFallback(artifact, openImpl);
  }
}
