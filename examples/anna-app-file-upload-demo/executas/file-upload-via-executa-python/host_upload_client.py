"""Self-contained Executa v2 Host Upload reverse-RPC client for this demo.

The demo intentionally keeps this small protocol client local so a clean
checkout can run without a sibling SDK repository or a network install.
"""

from __future__ import annotations

import asyncio
import base64
import threading
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Optional

PROTOCOL_VERSION_V2 = "2.0"
METHOD_HOST_UPLOAD_FILE = "host/uploadFile"

UPLOAD_ERR_NOT_GRANTED = -32201
UPLOAD_ERR_TOO_LARGE = -32204
UPLOAD_ERR_TIMEOUT = -32208


class UploadError(Exception):
    """JSON-RPC error returned by the host for ``host/uploadFile``."""

    def __init__(self, code: int, message: str, data: Optional[dict] = None):
        super().__init__(f"[{code}] {message}")
        self.code = code
        self.message = message
        self.data = data or {}


@dataclass
class _Pending:
    future: "asyncio.Future[dict]"


class HostUploadClient:
    """Minimal thread-safe reverse-RPC client used by the Host Upload demo."""

    DEFAULT_TIMEOUT = 120.0
    MAX_INLINE_BYTES = 8 * 1024 * 1024

    def __init__(self, *, write_frame: Callable[[dict], None]) -> None:
        self._write_frame = write_frame
        self._pending: dict[str, _Pending] = {}
        self._lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._disabled_reason: Optional[str] = None

    def disable(self, reason: str) -> None:
        self._disabled_reason = reason

    def dispatch_response(self, message: dict) -> bool:
        if not isinstance(message, dict) or "method" in message:
            return False
        request_id = message.get("id")
        if request_id is None:
            return False
        with self._lock:
            pending = self._pending.pop(request_id, None)
        if pending is None:
            return False
        loop = self._loop
        if loop is None or pending.future.done():
            return True

        def resolve() -> None:
            if pending.future.done():
                return
            error = message.get("error")
            if error:
                pending.future.set_exception(
                    UploadError(
                        code=int(error.get("code", -32603)),
                        message=str(error.get("message", "unknown error")),
                        data=error.get("data"),
                    )
                )
            else:
                pending.future.set_result(message.get("result") or {})

        try:
            loop.call_soon_threadsafe(resolve)
        except RuntimeError:
            resolve()
        return True

    async def upload_inline(
        self,
        *,
        filename: str,
        mime_type: str,
        content: bytes,
        purpose: Optional[str] = None,
        metadata: Optional[dict] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> dict:
        if len(content) > self.MAX_INLINE_BYTES:
            raise UploadError(
                UPLOAD_ERR_TOO_LARGE,
                f"inline payload {len(content)} bytes exceeds SDK cap "
                f"{self.MAX_INLINE_BYTES}; use negotiate instead",
            )
        params: dict[str, Any] = {
            "mode": "inline",
            "filename": filename,
            "mime_type": mime_type,
            "content_b64": base64.b64encode(content).decode("ascii"),
        }
        if purpose is not None:
            params["purpose"] = purpose
        if metadata is not None:
            params["metadata"] = metadata
        return await self._call(params, timeout)

    async def negotiate(
        self,
        *,
        filename: str,
        mime_type: str,
        size_bytes: int,
        purpose: Optional[str] = None,
        metadata: Optional[dict] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> dict:
        params: dict[str, Any] = {
            "mode": "negotiate",
            "filename": filename,
            "mime_type": mime_type,
            "size_bytes": int(size_bytes),
        }
        if purpose is not None:
            params["purpose"] = purpose
        if metadata is not None:
            params["metadata"] = metadata
        return await self._call(params, timeout)

    async def confirm(
        self,
        *,
        r2_key: str,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> dict:
        return await self._call({"mode": "confirm", "r2_key": r2_key}, timeout)

    async def _call(self, params: dict, timeout: float) -> dict:
        if self._disabled_reason:
            raise UploadError(UPLOAD_ERR_NOT_GRANTED, self._disabled_reason)
        loop = asyncio.get_running_loop()
        self._loop = loop
        request_id = uuid.uuid4().hex
        future: asyncio.Future[dict] = loop.create_future()
        with self._lock:
            self._pending[request_id] = _Pending(future=future)
        message = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": METHOD_HOST_UPLOAD_FILE,
            "params": params,
        }
        try:
            self._write_frame(message)
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError as error:
            with self._lock:
                self._pending.pop(request_id, None)
            raise UploadError(
                UPLOAD_ERR_TIMEOUT,
                f"{METHOD_HOST_UPLOAD_FILE} timed out after {timeout}s",
            ) from error
        except Exception:
            with self._lock:
                self._pending.pop(request_id, None)
            raise


def make_response_router(client: HostUploadClient) -> Callable[[dict], bool]:
    """Return a dispatcher for reverse-RPC response frames."""

    def route(message: dict) -> bool:
        return client.dispatch_response(message)

    return route
