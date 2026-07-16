# Use Host Upload as PPT App transport only

PPT App uses Host Upload only as the transport for browser-selected files and `ppt-engine` generated artifacts; the local Workspace remains the authoritative store for deck inputs, generated pages, previews, and export artifacts. Host Upload references are short-lived transport objects, so app-facing APIs use structured `*_upload` `HostUploadRef` values and do not preserve legacy `*_url` string fields as a parallel contract.

We intentionally require `negotiate + PUT + confirm` for both frontend browser uploads and backend artifact uploads, even though Host Upload has an inline mode, because this keeps file bytes out of JSON-RPC/stdout and avoids runtime exits from oversized RPC payloads. If Host Upload is unavailable, tools fail with explicit diagnostics instead of falling back to JSON-RPC base64 payloads, `__file_transport`, or local loopback HTTP.

Small, bounded control-plane results may return inline through JSON-RPC. In particular, `CreateWorkspaceResult` is a versioned creation receipt rather than a Workspace artifact or full Workspace snapshot, so `app_create_workspace` returns it inline and does not use Host Upload. Full Workspace snapshots and results whose size grows with Workspace content continue to use Host Upload.

`app_stdio.js` may remain temporarily as a compatibility wrapper while app-facing file transport is removed, but it must transparently pass Executa v2 reverse-RPC traffic; the target state is for `ppt-engine` to run without the wrapper once Anna App no longer depends on `__file_transport`.
