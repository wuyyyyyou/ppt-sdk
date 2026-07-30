#!/usr/bin/env python3
"""file_upload_via_executa_plugin.py — Executa that demonstrates the
**host/uploadFile** reverse-RPC (inline / negotiate / confirm) end to end.

See https://anna.partners/developers/reference/executa-host-upload

Why this demo sources bytes *locally* instead of from the iframe
---------------------------------------------------------------------
``host/uploadFile`` persists a binary blob that the **Executa already
holds** — an image it generated, a screenshot, an intermediate PDF — to
short-lived host storage (~30 min TTL) without the plugin holding any R2
credentials. The bytes flow **plugin → R2 directly** (negotiate mode), so
they never traverse the JSON-RPC stdio channel.

An earlier version of this demo base64-encoded the file in the browser and
shipped it through ``anna.tools.invoke`` into the Executa. That makes the
bytes cross stdio **twice** (in via the invoke request, and — for inline
mode — back out via the reverse-RPC request), which caps the practical
file size at the stdio line limit and defeats the whole point of
``negotiate``. A browser-picked ``File`` can only reach a subprocess over
that stdio channel, so to demonstrate large-file ``host/uploadFile`` the
bytes must originate **inside the Executa**.

This Executa therefore exposes two tools:

- ``make_sample``      — write a scratch file of N bytes to the local
                         filesystem and return its absolute path. Lets the
                         UI conjure preset-size payloads that cross the
                         8 MiB inline cap and the per-file upload quota,
                         without committing large binaries to the repo.
- ``host_upload_path`` — read a **local file path** and persist it via
                         ``host/uploadFile``: ``inline`` (base64 round-trip)
                         for ≤ 8 MiB, otherwise ``negotiate`` (presigned R2
                         PUT, bytes stream straight to R2) + ``confirm``.
                         Returns a short-lived download URL.

Run it::

    anna-app dev               # signed-in account; mints app_session_token

``host/uploadFile`` needs a real account (so the host can mint an
``upload_token``) but — unlike the APS ``files/*`` flow — does **not**
require ``--storage aps``. The host enforces the user's ``upload_grant``:
by default 16 files / 20 MiB per file / 80 MiB total per invoke. A payload
above the per-file cap is rejected with ``UPLOAD_TOO_LARGE`` (-32204)
*before* any R2 round-trip — the demo surfaces that verbatim.
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import os
import random
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from host_upload_client import (
    PROTOCOL_VERSION_V2,
    HostUploadClient,
    UploadError,
    bind_invoke,
    make_response_router,
)

# host/uploadFile inline-mode payload cap (mirrors SDK MAX_INLINE_BYTES).
# Files at or below this go through `inline`; larger ones use `negotiate`.
_INLINE_CAP_BYTES = 8 * 1024 * 1024

# Scratch dir for `make_sample`-generated payloads. Reused across calls;
# a deterministic per-size filename means repeated clicks overwrite rather
# than accumulate.
_SAMPLE_DIR = Path(tempfile.gettempdir()) / "anna-host-upload-demo"
_TRACE_DIR = Path(tempfile.gettempdir()) / "anna-host-upload-demo-traces"
_TRACE_LOCK = threading.Lock()
_DIAGNOSTIC_PAGE_DEFAULT_BYTES = 24 * 1024
_DIAGNOSTIC_PAGE_MAX_BYTES = 32 * 1024
_TRACE_CONTEXT: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
    "host_upload_trace_context", default=None
)
_RPC_TRACE_CONTEXTS: dict[str, dict] = {}

# ─── Manifest ─────────────────────────────────────────────────────────

MANIFEST = {
    "display_name": "Host Upload via Executa",
    "version": "0.2.5",
    "description": (
        "Demonstrates the host/uploadFile reverse-RPC (inline / negotiate / "
        "confirm) by reading a local file and persisting it to short-lived "
        "host storage. Bytes go plugin → R2 directly, never through stdio."
    ),
    "author": "Anna Developer",
    # `host.upload` — required for the transient host/uploadFile flow. Without
    #                it the host refuses with UPLOAD_NOT_GRANTED (-32201); the
    #                user must also have `upload_grant` enabled on their
    #                UserExecuta.custom_config.
    "host_capabilities": ["host.upload"],
    "tools": [
        {
            "name": "make_sample",
            "description": (
                "Write a scratch file of `size_bytes` bytes to the local "
                "filesystem and return its absolute path. Use it to produce "
                "preset-size payloads for host_upload_path without shipping "
                "large binaries."
            ),
            # Executa protocol uses `parameters: [{name, type, required, ...}]`
            # (see docs/protocol-spec.md), NOT MCP-style `input_schema`. The
            # host's ToolDefinition.from_dict only reads `parameters`.
            "parameters": [
                {
                    "name": "size_bytes",
                    "type": "integer",
                    "description": "Number of bytes to write, e.g. 12582912 for 12 MiB.",
                    "required": True,
                },
                {
                    "name": "filename",
                    "type": "string",
                    "description": "Optional logical name; defaults to sample-<size>.bin.",
                    "required": False,
                    "default": "",
                },
            ],
        },
        {
            "name": "host_upload_path",
            "description": (
                "Read a LOCAL file path and persist it TRANSIENTLY via "
                "host/uploadFile (~30 min TTL). Picks inline (≤8 MiB) or "
                "negotiate+confirm automatically and returns a short-lived "
                "download URL. Use for invoke-scoped artefacts, not durable "
                "storage."
            ),
            "parameters": [
                {
                    "name": "path",
                    "type": "string",
                    "description": "Absolute path to a local file the Executa can read.",
                    "required": True,
                },
                {
                    "name": "filename",
                    "type": "string",
                    "description": "Logical filename for the object; defaults to the path's basename.",
                    "required": False,
                    "default": "",
                },
                {
                    "name": "mime_type",
                    "type": "string",
                    "description": "MIME type, e.g. 'image/png'. Defaults to application/octet-stream.",
                    "required": False,
                    "default": "application/octet-stream",
                },
                {
                    "name": "purpose",
                    "type": "string",
                    "description": "Upload purpose allowlist value.",
                    "required": False,
                    "default": "user_artifact",
                    "enum": ["image_input", "image_reference", "user_artifact"],
                },
                {
                    "name": "mode",
                    "type": "string",
                    "description": "Upload mode: auto, inline, or negotiate.",
                    "required": False,
                    "default": "auto",
                    "enum": ["auto", "inline", "negotiate"],
                },
                {
                    "name": "run_id",
                    "type": "string",
                    "description": "Diagnostic run correlation id.",
                    "required": False,
                    "default": "",
                },
                {
                    "name": "call_id",
                    "type": "string",
                    "description": "Diagnostic call correlation id.",
                    "required": False,
                    "default": "",
                },
                {
                    "name": "delay_before_confirm_ms",
                    "type": "integer",
                    "description": "Fixed delay after PUT and before confirm, used to amplify interleaving.",
                    "required": False,
                    "default": 0,
                },
                {
                    "name": "jitter_ms",
                    "type": "integer",
                    "description": "Random additional delay before confirm.",
                    "required": False,
                    "default": 0,
                },
            ],
        },
        {
            "name": "get_diagnostic_log",
            "description": "Return structured Executa-side Host Upload trace events for one diagnostic run.",
            "parameters": [
                {
                    "name": "run_id",
                    "type": "string",
                    "description": "Diagnostic run id returned by the browser stress test.",
                    "required": True,
                },
                {
                    "name": "cursor",
                    "type": "integer",
                    "description": "Zero-based event cursor; defaults to the first event.",
                    "required": False,
                    "default": 0,
                },
                {
                    "name": "max_bytes",
                    "type": "integer",
                    "description": "Maximum serialized event bytes per page; capped at 32 KiB.",
                    "required": False,
                    "default": _DIAGNOSTIC_PAGE_DEFAULT_BYTES,
                },
            ],
        },
    ],
    "runtime": {"type": "uv", "min_version": "0.1.0"},
}

# ─── Reverse-RPC client ───────────────────────────────────────────────

_stdout_lock = threading.Lock()


def _write_frame(msg: dict) -> None:
    context = _TRACE_CONTEXT.get()
    if context and msg.get("method") == "host/uploadFile":
        reverse_rpc_id = str(msg.get("id", ""))
        with _TRACE_LOCK:
            _RPC_TRACE_CONTEXTS[reverse_rpc_id] = context
        _trace_event(
            **context,
            phase="reverse-rpc",
            status="sent",
            reverse_rpc_id=reverse_rpc_id,
            reverse_rpc_mode=(msg.get("params") or {}).get("mode"),
            wire_invoke_id=((msg.get("params") or {}).get("context") or {}).get(
                "invoke_id"
            ),
            r2_key=(msg.get("params") or {}).get("r2_key"),
        )
    payload = json.dumps(msg, ensure_ascii=False)
    with _stdout_lock:
        sys.stdout.write(payload + "\n")
        sys.stdout.flush()


_host_upload = HostUploadClient(write_frame=_write_frame)
_route_response = make_response_router(_host_upload)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _safe_trace_id(value: str, fallback: str) -> str:
    cleaned = "".join(ch for ch in (value or "") if ch.isalnum() or ch in "-_")
    return cleaned[:120] or fallback


def _trace_path(run_id: str) -> Path:
    return _TRACE_DIR / f"{_safe_trace_id(run_id, 'unscoped')}.jsonl"


def _trace_event(
    *,
    run_id: str,
    call_id: str,
    invoke_id: Any,
    phase: str,
    status: str,
    **extra: Any,
) -> dict:
    event = {
        "timestamp": _utc_now(),
        "monotonic_ns": time.monotonic_ns(),
        "event": f"executa.upload.{phase}",
        "run_id": run_id,
        "call_id": call_id,
        "invoke_id": invoke_id,
        "thread": threading.current_thread().name,
        "phase": phase,
        "status": status,
        **extra,
    }
    _TRACE_DIR.mkdir(parents=True, exist_ok=True)
    line = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    with _TRACE_LOCK:
        with open(_trace_path(run_id), "a", encoding="utf-8") as trace_file:
            trace_file.write(line + "\n")
    print(f"[host-upload-trace] {line}", file=sys.stderr)
    return event


def _redact_storage_value(value: Any) -> Any:
    if isinstance(value, list):
        return [_redact_storage_value(child) for child in value]
    if not isinstance(value, dict):
        return value
    redacted = {}
    for key, child in value.items():
        normalized = str(key).lower().replace("-", "_")
        if normalized in {"url", "put_url", "download_url", "authorization", "token", "signature"} or "signed_url" in normalized:
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = _redact_storage_value(child)
    return redacted


def _error_record(error: BaseException) -> dict:
    record = {
        "name": type(error).__name__,
        "message": str(error),
    }
    if isinstance(error, UploadError):
        record["code"] = error.code
        record["data"] = _redact_storage_value(error.data)
    return record


def _trace_reverse_rpc_response(message: dict) -> None:
    reverse_rpc_id = str(message.get("id", ""))
    with _TRACE_LOCK:
        context = _RPC_TRACE_CONTEXTS.pop(reverse_rpc_id, None)
    if not context:
        return
    error = message.get("error")
    result = message.get("result") or {}
    _trace_event(
        **context,
        phase="reverse-rpc",
        status="failed" if error else "succeeded",
        reverse_rpc_id=reverse_rpc_id,
        r2_key=result.get("r2_key") if isinstance(result, dict) else None,
        error=_redact_storage_value(error),
    )


async def _get_diagnostic_log(
    run_id: str,
    cursor: int = 0,
    max_bytes: int = _DIAGNOSTIC_PAGE_DEFAULT_BYTES,
) -> dict:
    safe_run_id = _safe_trace_id(run_id, "")
    if not safe_run_id:
        raise ValueError("run_id must not be empty")
    try:
        page_cursor = int(cursor)
        requested_max_bytes = int(max_bytes)
    except (TypeError, ValueError) as error:
        raise ValueError("cursor and max_bytes must be integers") from error
    if page_cursor < 0:
        raise ValueError("cursor must be >= 0")
    if requested_max_bytes <= 0:
        raise ValueError("max_bytes must be > 0")
    page_max_bytes = min(requested_max_bytes, _DIAGNOSTIC_PAGE_MAX_BYTES)
    trace_path = _trace_path(safe_run_id)
    if not trace_path.is_file():
        return {
            "ok": True,
            "run_id": safe_run_id,
            "cursor": page_cursor,
            "next_cursor": page_cursor,
            "done": True,
            "total_events": 0,
            "page_bytes": 0,
            "max_bytes": page_max_bytes,
            "events": [],
        }
    all_events = []
    with open(trace_path, "r", encoding="utf-8") as trace_file:
        for line in trace_file:
            line = line.strip()
            if line:
                all_events.append(json.loads(line))
    total_events = len(all_events)
    if page_cursor > total_events:
        raise ValueError(
            f"cursor {page_cursor} exceeds diagnostic event count {total_events}"
        )

    events = []
    page_bytes = 0
    next_cursor = page_cursor
    for event in all_events[page_cursor:]:
        event_bytes = len(
            json.dumps(event, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        )
        if event_bytes > _DIAGNOSTIC_PAGE_MAX_BYTES:
            raise ValueError(
                "one diagnostic event exceeds the 32 KiB safe response budget"
            )
        separator_bytes = 1 if events else 0
        if events and page_bytes + separator_bytes + event_bytes > page_max_bytes:
            break
        events.append(event)
        page_bytes += separator_bytes + event_bytes
        next_cursor += 1

    return {
        "ok": True,
        "run_id": safe_run_id,
        "cursor": page_cursor,
        "next_cursor": next_cursor,
        "done": next_cursor >= total_events,
        "total_events": total_events,
        "page_bytes": page_bytes,
        "max_bytes": page_max_bytes,
        "events": events,
    }


# ─── Tool implementations ─────────────────────────────────────────────


async def _make_sample(size_bytes: int, filename: str) -> dict:
    try:
        size = int(size_bytes)
    except (TypeError, ValueError) as e:
        raise ValueError(f"size_bytes must be an integer: {e}") from e
    if size < 0:
        raise ValueError("size_bytes must be >= 0")

    _SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    # Never let a caller-supplied name escape the scratch dir.
    safe = os.path.basename((filename or "").strip()) or f"sample-{size}.bin"
    path = _SAMPLE_DIR / safe

    # Stream zero-bytes in 1 MiB chunks so a large sample never balloons
    # memory. Content is irrelevant for the upload demo.
    chunk = b"\0" * (1024 * 1024)
    written = 0
    with open(path, "wb") as f:
        while written < size:
            n = min(len(chunk), size - written)
            f.write(chunk[:n])
            written += n

    return {"ok": True, "path": str(path), "filename": safe, "size_bytes": size}


async def _host_upload_path(
    path: str,
    filename: str,
    mime_type: str,
    purpose: str,
    mode: str = "auto",
    run_id: str = "",
    call_id: str = "",
    delay_before_confirm_ms: int = 0,
    jitter_ms: int = 0,
    invoke_id: Any = None,
) -> dict:
    """Persist a local file via host/uploadFile.

    Picks the cheapest mode automatically: ``inline`` (one round-trip) for
    payloads up to 8 MiB, otherwise ``negotiate`` (presigned PUT, bytes
    stream straight to R2) + ``confirm``. Both return a short-lived
    download URL — store the ``r2_key``, not the URL, since URLs TTL out
    (~30 min).
    """
    p = Path(path).expanduser()
    if not p.is_file():
        raise ValueError(f"local file not found: {path}")

    size = p.stat().st_size
    name = (filename or "").strip() or p.name
    mime = mime_type or "application/octet-stream"
    purpose = purpose or "user_artifact"
    selected_mode = (mode or "auto").strip().lower()
    if selected_mode not in {"auto", "inline", "negotiate"}:
        raise ValueError("mode must be auto, inline, or negotiate")
    delay_ms = max(0, int(delay_before_confirm_ms or 0))
    random_jitter_ms = max(0, int(jitter_ms or 0))
    trace_run_id = _safe_trace_id(run_id, f"manual-{uuid.uuid4().hex[:12]}")
    trace_call_id = _safe_trace_id(call_id, f"call-{uuid.uuid4().hex[:12]}")
    trace_context = {
        "run_id": trace_run_id,
        "call_id": trace_call_id,
        "invoke_id": invoke_id,
    }
    trace_token = _TRACE_CONTEXT.set(trace_context)
    current_phase = "started"

    _trace_event(
        run_id=trace_run_id,
        call_id=trace_call_id,
        invoke_id=invoke_id,
        phase="started",
        status="started",
        filename=name,
        size_bytes=size,
        requested_mode=selected_mode,
    )

    try:
        use_inline = selected_mode == "inline" or (
            selected_mode == "auto" and size <= _INLINE_CAP_BYTES
        )
        if use_inline:
            current_phase = "inline"
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="inline",
                status="started",
            )
            res = await _host_upload.upload_inline(
                filename=name,
                mime_type=mime,
                content=p.read_bytes(),
                purpose=purpose,
            )
            actual_mode = "inline"
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="inline",
                status="succeeded",
                r2_key=res.get("r2_key"),
            )
        else:
            current_phase = "negotiate"
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="negotiate",
                status="started",
            )
            info = await _host_upload.negotiate(
                filename=name,
                mime_type=mime,
                size_bytes=size,
                purpose=purpose,
                metadata={
                    "diagnostic_run_id": trace_run_id,
                    "diagnostic_call_id": trace_call_id,
                    "parent_invoke_id": str(invoke_id),
                },
            )
            negotiated_key = info["r2_key"]
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="negotiate",
                status="succeeded",
                r2_key=negotiated_key,
            )
            headers = dict(info.get("headers") or {})
            headers["Content-Length"] = str(size)
            current_phase = "put"
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="put",
                status="started",
                r2_key=negotiated_key,
            )
            with open(p, "rb") as f:
                req = urllib.request.Request(
                    info["put_url"], data=f, method="PUT", headers=headers
                )
                with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310 - presigned URL
                    put_status = resp.status
            if put_status not in (200, 201):
                raise RuntimeError(f"host upload PUT failed: HTTP {put_status}")
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="put",
                status="succeeded",
                r2_key=negotiated_key,
                http_status=put_status,
            )
            applied_delay_ms = delay_ms + (
                random.randint(0, random_jitter_ms) if random_jitter_ms else 0
            )
            if applied_delay_ms:
                current_phase = "before-confirm-delay"
                _trace_event(
                    run_id=trace_run_id,
                    call_id=trace_call_id,
                    invoke_id=invoke_id,
                    phase="before-confirm-delay",
                    status="started",
                    r2_key=negotiated_key,
                    delay_ms=applied_delay_ms,
                )
                await asyncio.sleep(applied_delay_ms / 1000)
            current_phase = "confirm"
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="confirm",
                status="started",
                r2_key=negotiated_key,
            )
            res = await _host_upload.confirm(r2_key=negotiated_key)
            _trace_event(
                run_id=trace_run_id,
                call_id=trace_call_id,
                invoke_id=invoke_id,
                phase="confirm",
                status="succeeded",
                r2_key=negotiated_key,
                confirmed_r2_key=res.get("r2_key"),
            )
            actual_mode = "negotiate+confirm"

        _trace_event(
            run_id=trace_run_id,
            call_id=trace_call_id,
            invoke_id=invoke_id,
            phase="finished",
            status="succeeded",
            r2_key=res.get("r2_key"),
            mode=actual_mode,
        )
    except Exception as error:
        _trace_event(
            run_id=trace_run_id,
            call_id=trace_call_id,
            invoke_id=invoke_id,
            phase="failed",
            status="failed",
            failed_phase=current_phase,
            error=_error_record(error),
        )
        _TRACE_CONTEXT.reset(trace_token)
        raise

    result = {
        "ok": True,
        "mode": actual_mode,
        "run_id": trace_run_id,
        "call_id": trace_call_id,
        "filename": name,
        "size_bytes": res.get("size_bytes", size),
        "mime_type": mime,
        "download_url": res.get("download_url"),
        "r2_key": res.get("r2_key"),
        "expires_at": res.get("expires_at"),
        # Keep the exact host/uploadFile inline/confirm result visible in the
        # demo's existing raw-response panel while diagnosing platform
        # response-shape differences.
        "host_upload_raw_result": res,
    }
    _TRACE_CONTEXT.reset(trace_token)
    return result


# ─── JSON-RPC dispatch ────────────────────────────────────────────────


def _ok(req_id: Any, result: dict) -> None:
    _write_frame({"jsonrpc": "2.0", "id": req_id, "result": result})


def _err(req_id: Any, code: int, message: str, data: dict | None = None) -> None:
    err: dict = {"code": code, "message": message}
    if data:
        err["data"] = data
    _write_frame({"jsonrpc": "2.0", "id": req_id, "error": err})


_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
_loop_thread.start()


def _handle_invoke(req_id: Any, params: dict) -> None:
    tool = params.get("tool")
    args = params.get("arguments") or {}
    if tool not in {"make_sample", "host_upload_path", "get_diagnostic_log"}:
        _err(req_id, -32601, f"Unknown tool: {tool}")
        return

    # contextvars do not cross the run_coroutine_threadsafe thread hop, so
    # bind inside the coroutine that runs on the Executa event loop.
    async def _run_bound() -> dict:
        with bind_invoke(params) as invoke_id:
            if tool == "make_sample":
                return await _make_sample(
                    args.get("size_bytes", 0), str(args.get("filename", ""))
                )
            if tool == "host_upload_path":
                return await _host_upload_path(
                    str(args.get("path", "")),
                    str(args.get("filename", "")),
                    str(args.get("mime_type", "application/octet-stream")),
                    str(args.get("purpose", "user_artifact")),
                    str(args.get("mode", "auto")),
                    str(args.get("run_id", "")),
                    str(args.get("call_id", "")),
                    args.get("delay_before_confirm_ms", 0),
                    args.get("jitter_ms", 0),
                    invoke_id,
                )
            return await _get_diagnostic_log(
                str(args.get("run_id", "")),
                args.get("cursor", 0),
                args.get("max_bytes", _DIAGNOSTIC_PAGE_DEFAULT_BYTES),
            )

    fut = asyncio.run_coroutine_threadsafe(_run_bound(), _loop)
    try:
        data = fut.result(timeout=300.0)
    except UploadError as e:
        # host/uploadFile surfaces UPLOAD_* codes (e.g. UPLOAD_TOO_LARGE
        # -32204 when size_bytes exceeds the per-file grant). Pass the
        # reason through verbatim so the LLM/UI sees it.
        _err(req_id, e.code, e.message, e.data)
        return
    except ValueError as e:
        _err(req_id, -32602, str(e))
        return
    except Exception as e:  # noqa: BLE001
        _err(req_id, -32603, f"Tool execution failed: {e}")
        return
    # InvokeResult.from_dict on the host expects {success, data}; never
    # return the bare tool dict (it would be read as success=False).
    _ok(req_id, {"success": True, "tool": tool, "data": data})


def _handle_initialize(req_id: Any, params: dict) -> None:
    proto = (params or {}).get("protocolVersion") or PROTOCOL_VERSION_V2
    is_v2 = proto == PROTOCOL_VERSION_V2
    if not is_v2:
        # host/uploadFile is v2-only; disable so calls fail fast with a clear
        # reason instead of hanging on a never-answered reverse-RPC.
        _host_upload.disable(
            f"host did not negotiate v2 (offered protocolVersion={proto!r}); "
            "host/uploadFile requires Executa protocol 2.0"
        )
    _ok(
        req_id,
        {
            "protocolVersion": proto if proto in ("1.1", "2.0") else "2.0",
            "serverInfo": {"name": MANIFEST["display_name"], "version": MANIFEST["version"]},
            # Advertise the transient host/uploadFile capability. The host
            # gates uploads on this negotiation + the manifest's `host.upload`.
            "client_capabilities": {"upload": {}} if is_v2 else {},
        },
    )


def _handle_message(line: str) -> None:
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        return
    # Reverse-RPC replies from the host resolve our pending upload futures.
    if "method" not in msg:
        _trace_reverse_rpc_response(msg)
        if not _route_response(msg):
            print(f"⚠️  unmatched response id={msg.get('id')!r}", file=sys.stderr)
        return

    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        _handle_initialize(req_id, params)
    elif method == "describe":
        # `result` MUST be the bare manifest — matrix's ToolManifest.from_dict
        # reads result["name"] directly.
        _ok(req_id, MANIFEST)
    elif method == "health":
        _ok(req_id, {"status": "healthy", "version": MANIFEST["version"]})
    elif method == "invoke":
        _handle_invoke(req_id, params)
    elif method == "shutdown":
        _ok(req_id, {"ok": True})
    elif req_id is not None:
        _err(req_id, -32601, f"Method not found: {method}")


def main() -> None:
    print("🔌 host-upload-via-executa plugin started", file=sys.stderr)
    pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="invoke")
    try:
        for raw in sys.stdin:
            line = raw.strip()
            if not line:
                continue
            pool.submit(_handle_message, line)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        _loop.call_soon_threadsafe(_loop.stop)


if __name__ == "__main__":
    main()
