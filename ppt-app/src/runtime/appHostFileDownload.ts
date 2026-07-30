import type { AnnaFilesDownloadInput, AnnaRuntime } from "./annaRuntime";

export type HostFileDownloadOutcome = "downloaded" | "unsupported";

export interface AppHostFileDownloadClient {
  /**
   * Asks the Host to save an APS Files object. Returns "unsupported" when this
   * Host build has no `files.download`, which is the caller's cue to fall back
   * to a presigned URL rather than to report a failure.
   */
  download(input: AnnaFilesDownloadInput): Promise<HostFileDownloadOutcome>;
}

const UNSUPPORTED_JSON_RPC_CODES = new Set([
  -32601, // method not found
  -32000, // generic "not implemented" from the dispatcher stub
]);

const UNSUPPORTED_MESSAGE = /(not[ _-]?implemented|unknown method|method not found|unsupported method|no such method|not granted|is not a function)/i;

function errorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : null;
}

/**
 * A Host that predates `files.download` reports a missing method, and one that
 * never granted the namespace reports a refused method; both mean "use the old
 * route". Anything else — a bad path, an expired session — is a real failure and
 * must surface, because silently minting a presigned URL would hide it.
 */
export function isUnsupportedHostDownload(error: unknown): boolean {
  const code = errorCode(error);
  if (code !== null && UNSUPPORTED_JSON_RPC_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return UNSUPPORTED_MESSAGE.test(message);
}

export function createAppHostFileDownloadClient(
  runtime: AnnaRuntime,
): AppHostFileDownloadClient {
  return {
    async download(input) {
      const files = runtime.files;
      if (!files || typeof files.download !== "function") return "unsupported";
      try {
        await files.download({
          path: input.path,
          ...(input.scope ? { scope: input.scope } : {}),
          ...(input.filename ? { filename: input.filename } : {}),
          ...(input.ttl_seconds ? { ttl_seconds: input.ttl_seconds } : {}),
        });
        return "downloaded";
      } catch (error) {
        if (isUnsupportedHostDownload(error)) return "unsupported";
        throw error;
      }
    },
  };
}
