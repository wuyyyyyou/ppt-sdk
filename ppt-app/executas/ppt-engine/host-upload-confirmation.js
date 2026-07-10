export function parseHostUploadConfirmation({
  confirmed,
  negotiated,
  mimeType,
  fallbackSizeBytes,
  filename,
}) {
  const url = typeof confirmed.url === "string" && confirmed.url.length > 0
    ? confirmed.url
    : confirmed.download_url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("host/uploadFile confirm did not return a valid URL");
  }

  return {
    transport: "host_upload",
    r2_key: typeof confirmed.r2_key === "string" && confirmed.r2_key.length > 0
      ? confirmed.r2_key
      : negotiated.r2_key,
    url,
    mime_type: mimeType,
    size_bytes: typeof confirmed.bytes === "number"
      ? confirmed.bytes
      : typeof confirmed.size_bytes === "number"
        ? confirmed.size_bytes
        : fallbackSizeBytes,
    filename,
    expires_at: typeof confirmed.expires_at === "string"
      ? confirmed.expires_at
      : typeof negotiated.expires_at === "string"
        ? negotiated.expires_at
        : undefined,
    expires_in: typeof confirmed.expires_in === "number" ? confirmed.expires_in : undefined,
    mode: "negotiate+confirm",
  };
}
