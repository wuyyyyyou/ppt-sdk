import base64
import asyncio
import binascii
import mimetypes
import os
import uuid
from pathlib import Path
from typing import List, Optional
from urllib.parse import unquote, unquote_to_bytes, urlparse


def is_http_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def is_data_image_uri(value: str) -> bool:
    return value.startswith("data:image/")


def _guess_extension_from_media_type(media_type: str) -> str:
    normalized = media_type.lower()

    if normalized == "image/jpeg":
        return ".jpg"
    if normalized == "image/svg+xml":
        return ".svg"

    guessed = mimetypes.guess_extension(normalized)
    if guessed == ".jpe":
        return ".jpg"
    return guessed or ".img"


def write_data_image_to_file(data_uri: str, save_directory: str) -> Optional[str]:
    if not is_data_image_uri(data_uri):
        return None

    try:
        header, payload = data_uri.split(",", 1)
    except ValueError:
        return None

    metadata = header[5:]
    parts = [part for part in metadata.split(";") if part]
    media_type = parts[0] if parts else "image/png"
    is_base64 = any(part.lower() == "base64" for part in parts[1:])

    try:
        raw_bytes = (
            base64.b64decode(payload, validate=False)
            if is_base64
            else unquote_to_bytes(payload)
        )
    except (ValueError, binascii.Error):
        return None

    os.makedirs(save_directory, exist_ok=True)

    if media_type.lower() == "image/svg+xml":
        try:
            import cairosvg

            save_path = os.path.join(save_directory, f"{uuid.uuid4()}.png")
            cairosvg.svg2png(bytestring=raw_bytes, write_to=save_path)
            return save_path
        except Exception:
            pass

    extension = _guess_extension_from_media_type(media_type)
    save_path = os.path.join(save_directory, f"{uuid.uuid4()}{extension}")

    try:
        with open(save_path, "wb") as file:
            file.write(raw_bytes)
    except OSError:
        return None

    return save_path


def resolve_image_path_to_filesystem(path_or_url: str) -> Optional[str]:
    if not path_or_url:
        return None
    if path_or_url.startswith("data:"):
        return None

    path = path_or_url

    if path_or_url.startswith("file://"):
        try:
            parsed = urlparse(path_or_url)
            path = unquote(parsed.path)
        except Exception:
            return None
    elif is_http_url(path_or_url):
        try:
            parsed = urlparse(path_or_url)
            candidate = unquote(parsed.path)
        except Exception:
            return None

        # Browser may have resolved an absolute local path into the URL path segment.
        if candidate.startswith(("/Users/", "/home/", "/var/", "/tmp/")):
            return candidate if os.path.isfile(candidate) else None
        return None

    if os.path.isabs(path):
        return path if os.path.isfile(path) else None

    candidate = Path(path).expanduser()
    return str(candidate.resolve()) if candidate.is_file() else None


async def download_file(
    url: str,
    save_directory: str,
    headers: Optional[dict] = None,
) -> Optional[str]:
    try:
        import aiohttp
    except Exception:
        return None

    try:
        os.makedirs(save_directory, exist_ok=True)

        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path)

        if not filename or "." not in filename:
            async with aiohttp.ClientSession(trust_env=True) as session:
                async with session.head(url, headers=headers) as response:
                    if response.status == 200:
                        content_disposition = response.headers.get(
                            "Content-Disposition",
                            "",
                        )
                        if "filename=" in content_disposition:
                            filename = content_disposition.split("filename=")[1].strip(
                                "\"'"
                            )
                        else:
                            content_type = response.headers.get("Content-Type", "")
                            if content_type:
                                extension = mimetypes.guess_extension(
                                    content_type.split(";")[0]
                                )
                                if extension:
                                    filename = f"{uuid.uuid4()}{extension}"

        filename = filename or str(uuid.uuid4())
        save_path = os.path.join(save_directory, filename)

        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    with open(save_path, "wb") as file:
                        async for chunk in response.content.iter_chunked(8192):
                            file.write(chunk)
                    return save_path
    except Exception:
        return None

    return None


async def download_files(
    urls: List[str],
    save_directory: str,
    headers: Optional[dict] = None,
) -> List[Optional[str]]:
    coroutines = [download_file(url, save_directory, headers) for url in urls]
    results = await asyncio.gather(*coroutines, return_exceptions=True)
    final_results: List[Optional[str]] = []
    for result in results:
        if isinstance(result, Exception):
            final_results.append(None)
        else:
            final_results.append(result)
    return final_results
