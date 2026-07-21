import type { HostUploadRef } from "../api/types";
import type { AnnaRuntime } from "./annaRuntime";

export interface StorageTransferLogEvent {
  workspace_dir: string;
  entry: Record<string, unknown>;
}

export type HostUploadPurpose = "user_artifact" | "image_reference" | "image_input";

export interface AppHostUploadClient {
  uploadFile(
    file: File,
    input: {
      purpose: HostUploadPurpose;
      filename?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<HostUploadRef>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".pdf": "application/pdf",
};

function inferMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const extension = dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
  return MIME_BY_EXTENSION[extension] ?? "";
}

function readUploadMimeType(file: File, filename: string, explicitMimeType?: string): string {
  const mimeType = (explicitMimeType || file.type || inferMimeType(filename)).trim();
  if (!mimeType) {
    throw new Error(`Cannot determine MIME type for ${filename}.`);
  }
  return mimeType;
}

function assertUploadRuntime(runtime: AnnaRuntime): NonNullable<AnnaRuntime["upload"]> {
  if (
    !runtime.upload ||
    typeof runtime.upload.negotiate !== "function" ||
    typeof runtime.upload.confirm !== "function"
  ) {
    throw new Error("Anna runtime upload.negotiate/upload.confirm is not available.");
  }
  return runtime.upload;
}

function randomTransferId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `transfer-${uuid ?? Math.random().toString(36).slice(2, 12)}`;
}

function redactStorageResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStorageResponse);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/(authorization|token|signature|signed[_-]?url|put[_-]?url|download[_-]?url)/i.test(key) || key.toLowerCase() === "url") {
      return [key, "[REDACTED]"];
    }
    return [key, redactStorageResponse(child)];
  }));
}

function errorRecord(error: unknown): Record<string, unknown> {
  const redactMessage = (message: string) => message.replace(/https?:\/\/\S+/gi, "[REDACTED_URL]");
  const record = error && typeof error === "object" && !Array.isArray(error)
    ? error as Record<string, unknown>
    : {};
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactMessage(error.message),
      ...(record.code !== undefined ? { code: record.code } : {}),
      ...(record.data !== undefined ? { data: redactStorageResponse(record.data) } : {}),
    };
  }
  return {
    message: redactMessage(String(error)),
    ...(record.code !== undefined ? { code: record.code } : {}),
    ...(record.data !== undefined ? { data: redactStorageResponse(record.data) } : {}),
  };
}

export function createAppHostUploadClient(
  runtime: AnnaRuntime,
  options: { appendWorkspaceLog?: (event: StorageTransferLogEvent) => Promise<unknown> } = {},
): AppHostUploadClient {
  return {
    async uploadFile(file, input) {
      const upload = assertUploadRuntime(runtime);
      const transferId = randomTransferId();
      const workspaceDir = typeof input.metadata?.workspace_dir === "string"
        ? input.metadata.workspace_dir
        : "";
      const source = typeof input.metadata?.source === "string"
        ? input.metadata.source
        : "app_host_upload";
      const operationId = typeof input.metadata?.operation_id === "string"
        ? input.metadata.operation_id
        : undefined;
      const interactionId = typeof input.metadata?.interaction_id === "string"
        ? input.metadata.interaction_id
        : undefined;
      let currentPhase = "started";
      const log = (phase: string, status: string, extra: Record<string, unknown> = {}) => {
        if (!workspaceDir || !options.appendWorkspaceLog) return;
        void options.appendWorkspaceLog({
          workspace_dir: workspaceDir,
          entry: {
            event: status === "failed" ? "storage.transfer.failed" : `storage.transfer.${phase}`,
            schema_version: 1,
            transfer_id: transferId,
            operation_id: operationId,
            interaction_id: interactionId,
            source,
            transport: "host_upload",
            phase,
            status,
            filename: input.filename || file.name || "upload",
            mime_type: input.mimeType || file.type || undefined,
            size_bytes: file.size,
            ...extra,
          },
        }).catch(() => undefined);
      };
      const filename = (input.filename || file.name || "upload").trim();
      if (!filename) {
        throw new Error("Upload filename must not be empty.");
      }
      const mimeType = readUploadMimeType(file, filename, input.mimeType);
      log("started", "started", { purpose: input.purpose });
      try {
        currentPhase = "negotiate";
        const negotiated = await upload.negotiate({
          filename,
          mime_type: mimeType,
          size_bytes: file.size,
          purpose: input.purpose,
          metadata: input.metadata,
        });
        log("negotiate", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(negotiated) });
        currentPhase = "put";
        const headers = negotiated.headers ?? {};
        const putResponse = await fetch(negotiated.put_url, {
          method: "PUT",
          headers,
          body: file,
        });
        if (!putResponse.ok) {
          const message = await putResponse.text().catch(() => "");
          throw new Error(message || `Host upload PUT failed: HTTP ${putResponse.status}`);
        }
        log("put", "succeeded", { http_status: putResponse.status });
        currentPhase = "confirm";
        const confirmed = await upload.confirm({ r2_key: negotiated.r2_key });
        log("confirm", "succeeded", { r2_key: negotiated.r2_key, response: redactStorageResponse(confirmed) });
        if (typeof confirmed.download_url !== "string" || confirmed.download_url.length === 0) {
          throw new Error("Host upload confirm did not return download_url.");
        }
        const result = {
          transport: "host_upload" as const,
          r2_key: confirmed.r2_key || negotiated.r2_key,
          url: confirmed.download_url,
          mime_type: mimeType,
          size_bytes: typeof confirmed.size_bytes === "number" ? confirmed.size_bytes : file.size,
          filename,
          expires_at: confirmed.expires_at ?? negotiated.expires_at,
          expires_in: confirmed.expires_in,
          mode: "negotiate+confirm" as const,
        };
        log("finished", "succeeded", { r2_key: result.r2_key, expires_at: result.expires_at });
        return result;
      } catch (error) {
        log(currentPhase, "failed", { error: errorRecord(error) });
        throw error;
      }
    },
  };
}

export function hostUploadUrl(ref: HostUploadRef | null | undefined): string {
  return ref?.url ?? "";
}
