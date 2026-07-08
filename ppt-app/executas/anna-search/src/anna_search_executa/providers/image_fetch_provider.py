from __future__ import annotations

import urllib.error
import urllib.request
from typing import Any

from anna_search_executa.providers.base import FetchedImage

IMAGE_FETCH_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)
IMAGE_FETCH_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
READ_CHUNK_SIZE = 64 * 1024


class UrlImageFetchProvider:
    name = "url_image_fetch"

    def fetch_image(self, *, url: str, timeout_seconds: int, max_bytes: int) -> FetchedImage:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": IMAGE_FETCH_USER_AGENT,
                "Accept": IMAGE_FETCH_ACCEPT,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                content_type = parse_content_type(response.headers.get("Content-Type"))
                if not content_type or not content_type.startswith("image/"):
                    raise RuntimeError(f"Content-Type is not image/*: {content_type or 'missing'}")

                content_length = parse_content_length(response.headers.get("Content-Length"))
                if content_length is not None and content_length > max_bytes:
                    raise RuntimeError(f"Content-Length exceeds max_bytes: {content_length} > {max_bytes}")

                content = read_limited(response, max_bytes=max_bytes)
                final_url = response.geturl()
        except urllib.error.URLError as exc:
            raise RuntimeError(str(exc.reason)) from exc

        return FetchedImage(
            url=url,
            content=content,
            content_type=content_type,
            final_url=final_url if final_url != url else None,
        )


def parse_content_type(value: str | None) -> str | None:
    if value is None:
        return None
    return value.split(";", 1)[0].strip().lower() or None


def parse_content_length(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def read_limited(response: Any, *, max_bytes: int) -> bytes:
    chunks = []
    total = 0
    while True:
        chunk = response.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise RuntimeError(f"Downloaded bytes exceed max_bytes: {total} > {max_bytes}")
        chunks.append(chunk)
    return b"".join(chunks)
