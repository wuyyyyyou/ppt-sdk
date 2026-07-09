import type { HostUploadRef } from "../api/types";
import type { AnnaRuntime } from "./annaRuntime";

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

export function createAppHostUploadClient(runtime: AnnaRuntime): AppHostUploadClient {
  return {
    async uploadFile(file, input) {
      const upload = assertUploadRuntime(runtime);
      const filename = (input.filename || file.name || "upload").trim();
      if (!filename) {
        throw new Error("Upload filename must not be empty.");
      }
      const mimeType = readUploadMimeType(file, filename, input.mimeType);
      const negotiated = await upload.negotiate({
        filename,
        mime_type: mimeType,
        size_bytes: file.size,
        purpose: input.purpose,
        metadata: input.metadata,
      });
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
      const confirmed = await upload.confirm({ r2_key: negotiated.r2_key });
      if (typeof confirmed.download_url !== "string" || confirmed.download_url.length === 0) {
        throw new Error("Host upload confirm did not return download_url.");
      }
      return {
        transport: "host_upload",
        r2_key: confirmed.r2_key || negotiated.r2_key,
        url: confirmed.download_url,
        mime_type: mimeType,
        size_bytes: typeof confirmed.size_bytes === "number" ? confirmed.size_bytes : file.size,
        filename,
        expires_at: confirmed.expires_at ?? negotiated.expires_at,
        expires_in: confirmed.expires_in,
        mode: "negotiate+confirm",
      };
    },
  };
}

export function hostUploadUrl(ref: HostUploadRef | null | undefined): string {
  return ref?.url ?? "";
}
