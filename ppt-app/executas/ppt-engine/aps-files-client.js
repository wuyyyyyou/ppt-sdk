import { randomUUID } from "node:crypto";

export const APS_FILES_ERROR_NOT_GRANTED = -32021;
export const APS_FILES_ERROR_TIMEOUT = -32030;

export class ApsFilesError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = "ApsFilesError";
    this.code = code;
    this.data = data ?? {};
  }
}

export class ApsFilesClient {
  constructor({ writeFrame }) {
    this.writeFrame = writeFrame;
    this.pending = new Map();
    this.disabledReason = null;
  }

  enable() {
    this.disabledReason = null;
  }

  disable(reason) {
    this.disabledReason = reason || "APS Files is not available.";
  }

  dispatchResponse(message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || "method" in message) {
      return false;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return false;
    }
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) {
      pending.reject(new ApsFilesError(
        Number.isInteger(message.error.code) ? message.error.code : -32603,
        typeof message.error.message === "string" ? message.error.message : "APS Files reverse RPC failed",
        message.error.data,
      ));
    } else {
      pending.resolve(message.result ?? {});
    }
    return true;
  }

  uploadBegin({ path, sizeBytes, contentType, metadata, scope = "app" }) {
    return this.call("files/upload_begin", {
      path,
      scope,
      size_bytes: sizeBytes,
      content_type: contentType,
      metadata,
    }, 60_000);
  }

  uploadComplete({ path, etag, sizeBytes, contentType, scope = "app" }) {
    return this.call("files/upload_complete", {
      path,
      scope,
      etag,
      size_bytes: sizeBytes,
      content_type: contentType,
    }, 60_000);
  }

  async downloadUrl({ path, expiresIn, scope = "app" }) {
    const result = await this.call("files/download_url", {
      path,
      scope,
      expires_in: expiresIn,
      ttl_seconds: expiresIn,
    }, 30_000);
    if (result && typeof result === "object" && result.url == null && typeof result.get_url === "string") {
      return { ...result, url: result.get_url };
    }
    return result;
  }

  call(method, params, timeoutMs) {
    if (this.disabledReason) {
      return Promise.reject(new ApsFilesError(APS_FILES_ERROR_NOT_GRANTED, this.disabledReason));
    }
    const id = `aps-files-${randomUUID()}`;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined),
      ),
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new ApsFilesError(
            APS_FILES_ERROR_TIMEOUT,
            `${method} timed out after ${timeoutMs}ms`,
          ));
        }
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      Promise.resolve(this.writeFrame(message)).catch((error) => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}
