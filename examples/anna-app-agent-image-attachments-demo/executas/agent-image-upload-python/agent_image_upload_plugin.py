#!/usr/bin/env python3
"""PROTOTYPE: upload local images for native Agent Session attachments."""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import sys
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from host_upload_client import (
    PROTOCOL_VERSION_V2,
    HostUploadClient,
    UploadError,
    make_response_router,
)

VERSION = "0.1.0"
MAX_IMAGES = 6
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
}

MANIFEST = {
    "display_name": "Agent Image Upload",
    "version": VERSION,
    "description": (
        "Reads up to six local image paths and persists them through "
        "host/uploadFile for native Agent Session attachments."
    ),
    "author": "Anna Developer",
    "host_capabilities": ["host.upload"],
    "tools": [
        {
            "name": "host_upload_image_paths",
            "description": (
                "Upload one to six absolute LOCAL image paths through "
                "host/uploadFile with purpose=image_input. Returns short-lived "
                "HTTPS URLs suitable for agent.session.run attachments."
            ),
            "parameters": [
                {
                    "name": "paths",
                    "type": "array",
                    "description": "One to six absolute local image paths.",
                    "required": True,
                }
            ],
        }
    ],
    "runtime": {"type": "uv", "min_version": "0.1.0"},
}

_stdout_lock = threading.Lock()


def _write_frame(message: dict) -> None:
    payload = json.dumps(message, ensure_ascii=False)
    with _stdout_lock:
        sys.stdout.write(payload + "\n")
        sys.stdout.flush()


_host_upload = HostUploadClient(write_frame=_write_frame)
_route_response = make_response_router(_host_upload)


def _guess_image_mime(path: Path) -> str:
    if path.suffix.lower() == ".svg":
        return "image/svg+xml"
    mime, _ = mimetypes.guess_type(path.name)
    return mime or "application/octet-stream"


async def _upload_one(path_value: str) -> dict:
    path = Path(path_value).expanduser()
    if not path.is_absolute():
        raise ValueError(f"path must be absolute: {path_value}")
    if not path.is_file():
        raise ValueError(f"local file not found: {path_value}")

    mime_type = _guess_image_mime(path)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(
            f"unsupported image MIME {mime_type!r}: {path_value}; "
            f"allowed={sorted(ALLOWED_MIME_TYPES)}"
        )

    size = path.stat().st_size
    filename = os.path.basename(path.name)
    # Always use the presigned upload flow. Executa reverse-RPC frames are
    # newline-delimited JSON; putting base64 image bytes into an inline frame
    # exceeds the current local Runtime's stdout reader limit for normal-sized
    # images. Here stdout carries only control metadata, while the file bytes
    # stream directly to R2.
    negotiation = await _host_upload.negotiate(
        filename=filename,
        mime_type=mime_type,
        size_bytes=size,
        purpose="image_input",
    )
    headers = dict(negotiation.get("headers") or {})
    headers["Content-Length"] = str(size)
    with path.open("rb") as file_handle:
        request = urllib.request.Request(
            negotiation["put_url"],
            data=file_handle,
            method="PUT",
            headers=headers,
        )
        with urllib.request.urlopen(request, timeout=300) as put_response:  # noqa: S310
            if put_response.status not in (200, 201):
                raise RuntimeError(f"host upload PUT failed: HTTP {put_response.status}")
    response = await _host_upload.confirm(r2_key=negotiation["r2_key"])
    mode = "negotiate+put+confirm"

    download_url = response.get("download_url") or response.get("url")
    if not download_url:
        raise RuntimeError(
            "host/uploadFile returned no download_url/url; "
            f"keys={sorted(response.keys())}"
        )
    return {
        "path": str(path),
        "filename": filename,
        "mime_type": mime_type,
        "size_bytes": response.get("size_bytes") or response.get("bytes") or size,
        "mode": mode,
        "download_url": download_url,
        "r2_key": response.get("r2_key"),
        "expires_at": response.get("expires_at"),
    }


async def _upload_paths(paths: Any) -> dict:
    if not isinstance(paths, list):
        raise ValueError("paths must be an array")
    normalized = [str(path).strip() for path in paths if str(path).strip()]
    if not normalized:
        raise ValueError("paths must contain at least one path")
    if len(normalized) > MAX_IMAGES:
        raise ValueError(f"at most {MAX_IMAGES} images are allowed per run")

    uploads: list[dict] = []
    errors: list[dict] = []
    for path in normalized:
        try:
            uploads.append(await _upload_one(path))
        except Exception as error:  # noqa: BLE001 - per-file result is intentional
            errors.append({"path": path, "error": str(error)})
    return {"ok": bool(uploads), "uploads": uploads, "errors": errors}


def _ok(request_id: Any, result: dict) -> None:
    _write_frame({"jsonrpc": "2.0", "id": request_id, "result": result})


def _error(request_id: Any, code: int, message: str, data: dict | None = None) -> None:
    error: dict = {"code": code, "message": message}
    if data:
        error["data"] = data
    _write_frame({"jsonrpc": "2.0", "id": request_id, "error": error})


_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
_loop_thread.start()


def _handle_invoke(request_id: Any, params: dict) -> None:
    tool = params.get("tool")
    arguments = params.get("arguments") or {}
    if tool != "host_upload_image_paths":
        _error(request_id, -32601, f"Unknown tool: {tool}")
        return

    future = asyncio.run_coroutine_threadsafe(
        _upload_paths(arguments.get("paths")), _loop
    )
    try:
        data = future.result(timeout=600.0)
    except UploadError as error:
        _error(request_id, error.code, error.message, error.data)
        return
    except ValueError as error:
        _error(request_id, -32602, str(error))
        return
    except Exception as error:  # noqa: BLE001
        _error(request_id, -32603, f"Tool execution failed: {error}")
        return
    _ok(request_id, {"success": True, "tool": tool, "data": data})


def _handle_initialize(request_id: Any, params: dict) -> None:
    protocol = (params or {}).get("protocolVersion") or PROTOCOL_VERSION_V2
    is_v2 = protocol == PROTOCOL_VERSION_V2
    if not is_v2:
        _host_upload.disable(
            f"host did not negotiate protocol v2: {protocol!r}"
        )
    _ok(
        request_id,
        {
            "protocolVersion": protocol if protocol in ("1.1", "2.0") else "2.0",
            "serverInfo": {"name": MANIFEST["display_name"], "version": VERSION},
            "client_capabilities": {"upload": {}} if is_v2 else {},
        },
    )


def _handle_message(line: str) -> None:
    try:
        message = json.loads(line)
    except json.JSONDecodeError:
        return

    if "method" not in message:
        if not _route_response(message):
            print(f"unmatched response id={message.get('id')!r}", file=sys.stderr)
        return

    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}
    if method == "initialize":
        _handle_initialize(request_id, params)
    elif method == "describe":
        _ok(request_id, MANIFEST)
    elif method == "health":
        _ok(request_id, {"status": "healthy", "version": VERSION})
    elif method == "invoke":
        _handle_invoke(request_id, params)
    elif method == "shutdown":
        _ok(request_id, {"ok": True})
    elif request_id is not None:
        _error(request_id, -32601, f"Method not found: {method}")


def main() -> None:
    print("agent-image-upload prototype started", file=sys.stderr)
    pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="invoke")
    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if line:
                pool.submit(_handle_message, line)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        _loop.call_soon_threadsafe(_loop.stop)


if __name__ == "__main__":
    main()
