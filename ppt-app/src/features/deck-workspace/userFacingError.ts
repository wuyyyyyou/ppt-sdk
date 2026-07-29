import type { Messages } from "../../i18n/messages";

/**
 * A raw backend failure split into what a user is shown and what stays behind a
 * diagnostics disclosure. The UI renders `summary`; `detail` keeps the original
 * text so nothing is lost for troubleshooting.
 */
export interface UserFacingError {
  summary: string;
  detail: string;
}

export type UserFacingErrorKind =
  | "timeout"
  | "transport"
  | "notFound"
  | "network"
  | "unknown";

const MAX_DETAIL_LENGTH = 800;

export function extractErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  if (error === null || error === undefined) return "";
  try {
    return JSON.stringify(error).trim();
  } catch {
    return String(error).trim();
  }
}

export function classifyUserFacingError(detail: string): UserFacingErrorKind {
  const value = detail.toLowerCase();
  if (!value) return "unknown";
  if (/timed out|timeout|etimedout|deadline exceeded/.test(value)) return "timeout";
  if (/r2_key|does not belong to this invoke|host upload|artifact transport/.test(value)) {
    return "transport";
  }
  if (/enoent|no such file|not found|does not exist/.test(value)) return "notFound";
  if (/fetch failed|econnrefused|econnreset|network error|socket hang up|offline/.test(value)) {
    return "network";
  }
  return "unknown";
}

/**
 * True for payloads that must never reach the user interface verbatim, such as
 * a full JSON-RPC envelope or a stringified stack trace.
 */
export function isOpaqueErrorDetail(detail: string): boolean {
  const value = detail.trim();
  if (!value) return true;
  if (/^[[{]/.test(value) && /"(jsonrpc|error|code|result|id)"\s*:/.test(value)) return true;
  if (/\n\s+at\s/.test(value)) return true;
  return value.length > 240;
}

export function summarizeUserFacingError(
  t: Messages,
  error: unknown,
  fallbackSummary?: string,
): UserFacingError {
  const detail = extractErrorDetail(error).slice(0, MAX_DETAIL_LENGTH);
  const kind = classifyUserFacingError(detail);
  const generic = fallbackSummary ?? t.errors.summaryUnknown;

  const summary = kind === "unknown"
    ? (isOpaqueErrorDetail(detail) ? generic : detail)
    : t.errors[summaryKeyOf(kind)];

  return { summary, detail };
}

function summaryKeyOf(kind: Exclude<UserFacingErrorKind, "unknown">) {
  switch (kind) {
    case "timeout":
      return "summaryTimeout" as const;
    case "transport":
      return "summaryTransport" as const;
    case "notFound":
      return "summaryNotFound" as const;
    case "network":
      return "summaryNetwork" as const;
  }
}
