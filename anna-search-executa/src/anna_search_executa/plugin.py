from __future__ import annotations

import json
import mimetypes
import os
import sys
import tempfile
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from ipaddress import ip_address
from pathlib import Path
from typing import Any, TextIO
from urllib.parse import urlparse

from anna_search_executa.providers import (
    DdgsSearchProvider,
    ImageFetchProvider,
    ImageSearchProvider,
    PageFetchProvider,
    SearchProvider,
    UrlImageFetchProvider,
)
from anna_search_executa.rpc import (
    INTERNAL_ERROR,
    INVALID_REQUEST,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    InvalidParams,
    JsonRpcError,
    make_error,
    make_result,
    require_object,
)

try:
    from anna_search_executa._embedded_manifest import EMBEDDED_MANIFEST
except Exception:  # pragma: no cover - generated only for binary builds
    EMBEDDED_MANIFEST = None

MAX_RESULTS_MIN = 1
MAX_RESULTS_MAX = 20
DEFAULT_MAX_RESULTS = 5
DEFAULT_REGION = "us-en"
DEFAULT_SAFESEARCH = "moderate"
ALLOWED_SAFESEARCH = {"off", "moderate", "strict"}
ALLOWED_TIMELIMIT = {"d", "w", "m", "y"}
FETCH_URLS_MIN = 1
FETCH_URLS_MAX = 10
DEFAULT_FETCH_FORMAT = "text_rich"
ALLOWED_FETCH_FORMATS = {"text_markdown", "text_plain", "text_rich"}
DEFAULT_MAX_CHARS = 12000
MAX_CHARS_MIN = 1000
MAX_CHARS_MAX = 50000
FETCH_FILE_EXTENSIONS = {"text_markdown": ".md", "text_plain": ".txt", "text_rich": ".txt"}
BLOCKED_HOSTS = {"localhost", "localhost.localdomain"}
FETCH_CONCURRENCY_MAX = 10
IMAGE_FETCH_TIMEOUT_SECONDS = 60
DEFAULT_MAX_BYTES = 10 * 1024 * 1024
MAX_BYTES_MIN = 1 * 1024 * 1024
MAX_BYTES_MAX = 50 * 1024 * 1024
IMAGE_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}
IMAGE_SEARCH_FILTER_KEYS = {"size", "color", "type_image", "layout"}


class AnnaSearchPlugin:
    def __init__(
        self,
        *,
        manifest_path: Path | None = None,
        provider: SearchProvider | None = None,
        fetch_provider: PageFetchProvider | None = None,
        image_search_provider: ImageSearchProvider | None = None,
        image_fetch_provider: ImageFetchProvider | None = None,
        stderr: TextIO | None = None,
    ) -> None:
        default_provider = provider or DdgsSearchProvider()
        self.manifest_path = manifest_path or find_manifest_path()
        self.provider = default_provider
        self.fetch_provider = fetch_provider or default_provider
        self.image_search_provider = image_search_provider or default_provider
        self.image_fetch_provider = image_fetch_provider or UrlImageFetchProvider()
        self.stderr = stderr or sys.stderr

    def handle_request(self, request: dict[str, Any]) -> dict[str, Any] | None:
        request_id = request.get("id")
        try:
            self._validate_request(request)
            method = request["method"]
            if method == "describe":
                return make_result(request_id, self.load_manifest())
            if method == "health":
                return make_result(request_id, self.health())
            if method == "invoke":
                return make_result(request_id, self.invoke(request.get("params", {})))
            raise JsonRpcError(METHOD_NOT_FOUND, "Method not found")
        except JsonRpcError as exc:
            return make_error(request_id, exc.code, exc.message, exc.data)
        except Exception as exc:
            self._log_exception(exc)
            return make_error(request_id, INTERNAL_ERROR, "Internal error")

    def load_manifest(self) -> dict[str, Any]:
        if EMBEDDED_MANIFEST is not None:
            return EMBEDDED_MANIFEST

        with self.manifest_path.open("r", encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)
        if not isinstance(manifest, dict):
            raise RuntimeError("manifest.json must contain an object")
        return manifest

    def health(self) -> dict[str, Any]:
        manifest = self.load_manifest()
        tools = manifest.get("tools", [])
        tools_count = len(tools) if isinstance(tools, list) else 0
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": manifest.get("version"),
            "tools_count": tools_count,
        }

    def invoke(self, params: Any) -> dict[str, Any]:
        params_obj = require_object(params, "params")
        tool = params_obj.get("tool")
        if not isinstance(tool, str) or not tool:
            raise InvalidParams("params.tool is required")
        arguments = require_object(params_obj.get("arguments"), "params.arguments")

        if tool == "web_search":
            search_args = validate_web_search_arguments(arguments)
            data = run_web_search(provider=self.provider, **search_args)
            return {"success": True, "data": data, "tool": tool}
        if tool == "web_fetch":
            fetch_args = validate_web_fetch_arguments(arguments)
            data = run_web_fetch(provider=self.fetch_provider, **fetch_args)
            return {"success": True, "data": data, "tool": tool}
        if tool == "image_search":
            image_search_args = validate_image_search_arguments(arguments)
            data = run_image_search(provider=self.image_search_provider, **image_search_args)
            return {"success": True, "data": data, "tool": tool}
        if tool == "image_fetch":
            image_fetch_args = validate_image_fetch_arguments(arguments)
            data = run_image_fetch(provider=self.image_fetch_provider, **image_fetch_args)
            return {"success": True, "data": data, "tool": tool}

        raise JsonRpcError(METHOD_NOT_FOUND, "Tool not found")

    def _validate_request(self, request: dict[str, Any]) -> None:
        if request.get("jsonrpc") != "2.0":
            raise JsonRpcError(INVALID_REQUEST, "Invalid request")
        if not isinstance(request.get("method"), str):
            raise JsonRpcError(INVALID_REQUEST, "Invalid request")

    def _log_exception(self, exc: Exception) -> None:
        print(f"anna-search-executa internal error: {exc}", file=self.stderr)
        traceback.print_exc(file=self.stderr)


def find_manifest_path() -> Path:
    env_path = os.environ.get("ANNA_SEARCH_MANIFEST_PATH")
    if env_path:
        return Path(env_path)

    cwd_manifest = Path.cwd() / "manifest.json"
    if cwd_manifest.exists():
        return cwd_manifest

    for parent in Path(__file__).resolve().parents:
        candidate = parent / "manifest.json"
        if candidate.exists():
            return candidate

    return cwd_manifest


def validate_web_search_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {"query", "max_results", "region", "safesearch", "timelimit"}
    extra_keys = sorted(set(arguments) - allowed_keys)
    if extra_keys:
        raise InvalidParams("Unknown argument", {"fields": extra_keys})

    query = arguments.get("query")
    if not isinstance(query, str) or not query.strip():
        raise InvalidParams("query is required")

    max_results = arguments.get("max_results", DEFAULT_MAX_RESULTS)
    if isinstance(max_results, bool) or not isinstance(max_results, int):
        raise InvalidParams("max_results must be an integer")
    if max_results < MAX_RESULTS_MIN or max_results > MAX_RESULTS_MAX:
        raise InvalidParams("max_results must be between 1 and 20")

    region = arguments.get("region", DEFAULT_REGION)
    if not isinstance(region, str) or not region.strip():
        raise InvalidParams("region must be a non-empty string")

    safesearch = arguments.get("safesearch", DEFAULT_SAFESEARCH)
    if safesearch not in ALLOWED_SAFESEARCH:
        raise InvalidParams("safesearch must be one of: off, moderate, strict")

    timelimit = arguments.get("timelimit")
    if timelimit is not None and timelimit not in ALLOWED_TIMELIMIT:
        raise InvalidParams("timelimit must be one of: d, w, m, y")

    return {
        "query": query.strip(),
        "max_results": max_results,
        "region": region.strip(),
        "safesearch": safesearch,
        "timelimit": timelimit,
    }


def validate_web_fetch_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {"urls", "output_dir", "format", "max_chars"}
    extra_keys = sorted(set(arguments) - allowed_keys)
    if extra_keys:
        raise InvalidParams("Unknown argument", {"fields": extra_keys})

    urls = arguments.get("urls")
    if not isinstance(urls, list):
        raise InvalidParams("urls must be an array")
    if len(urls) < FETCH_URLS_MIN or len(urls) > FETCH_URLS_MAX:
        raise InvalidParams("urls must contain between 1 and 10 items")

    normalized_urls = []
    for index, url in enumerate(urls):
        if not isinstance(url, str) or not url.strip():
            raise InvalidParams("urls items must be non-empty strings", {"index": index})
        normalized_url = url.strip()
        validate_fetch_url(normalized_url, index=index)
        normalized_urls.append(normalized_url)

    output_dir = arguments.get("output_dir")
    if output_dir is not None and (not isinstance(output_dir, str) or not output_dir.strip()):
        raise InvalidParams("output_dir must be a non-empty string")

    fmt = arguments.get("format", DEFAULT_FETCH_FORMAT)
    if fmt not in ALLOWED_FETCH_FORMATS:
        raise InvalidParams("format must be one of: text_markdown, text_plain, text_rich")

    max_chars = arguments.get("max_chars", DEFAULT_MAX_CHARS)
    if isinstance(max_chars, bool) or not isinstance(max_chars, int):
        raise InvalidParams("max_chars must be an integer")
    if max_chars < MAX_CHARS_MIN or max_chars > MAX_CHARS_MAX:
        raise InvalidParams("max_chars must be between 1000 and 50000")

    return {
        "urls": normalized_urls,
        "output_dir": output_dir.strip() if isinstance(output_dir, str) else None,
        "fmt": fmt,
        "max_chars": max_chars,
    }


def validate_image_search_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {"query", "max_results", "region", "safesearch", "timelimit"} | IMAGE_SEARCH_FILTER_KEYS
    extra_keys = sorted(set(arguments) - allowed_keys)
    if extra_keys:
        raise InvalidParams("Unknown argument", {"fields": extra_keys})

    search_args = validate_web_search_arguments(
        {key: arguments[key] for key in arguments if key not in IMAGE_SEARCH_FILTER_KEYS}
    )
    for key in IMAGE_SEARCH_FILTER_KEYS:
        value = arguments.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise InvalidParams(f"{key} must be a non-empty string")
        search_args[key] = value.strip() if isinstance(value, str) else None
    return search_args


def validate_image_fetch_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {"urls", "output_dir", "max_bytes"}
    extra_keys = sorted(set(arguments) - allowed_keys)
    if extra_keys:
        raise InvalidParams("Unknown argument", {"fields": extra_keys})

    urls = arguments.get("urls")
    if not isinstance(urls, list):
        raise InvalidParams("urls must be an array")
    if len(urls) < FETCH_URLS_MIN or len(urls) > FETCH_URLS_MAX:
        raise InvalidParams("urls must contain between 1 and 10 items")

    normalized_urls = []
    for index, url in enumerate(urls):
        if not isinstance(url, str) or not url.strip():
            raise InvalidParams("urls items must be non-empty strings", {"index": index})
        normalized_url = url.strip()
        validate_fetch_url(normalized_url, index=index)
        normalized_urls.append(normalized_url)

    output_dir = arguments.get("output_dir")
    if output_dir is not None and (not isinstance(output_dir, str) or not output_dir.strip()):
        raise InvalidParams("output_dir must be a non-empty string")

    max_bytes = arguments.get("max_bytes", DEFAULT_MAX_BYTES)
    if isinstance(max_bytes, bool) or not isinstance(max_bytes, int):
        raise InvalidParams("max_bytes must be an integer")
    if max_bytes < MAX_BYTES_MIN or max_bytes > MAX_BYTES_MAX:
        raise InvalidParams("max_bytes must be between 1048576 and 52428800")

    return {
        "urls": normalized_urls,
        "output_dir": output_dir.strip() if isinstance(output_dir, str) else None,
        "max_bytes": max_bytes,
    }


def validate_fetch_url(url: str, *, index: int) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise InvalidParams("url scheme must be http or https", {"index": index})
    if not parsed.netloc or not parsed.hostname:
        raise InvalidParams("url must include a host", {"index": index})
    if parsed.username or parsed.password:
        raise InvalidParams("url must not include credentials", {"index": index})

    host = parsed.hostname.rstrip(".").lower()
    if host in BLOCKED_HOSTS:
        raise InvalidParams("url host is not allowed", {"index": index})

    try:
        parsed_ip = ip_address(host)
    except ValueError:
        return

    if (
        parsed_ip.is_loopback
        or parsed_ip.is_private
        or parsed_ip.is_link_local
        or parsed_ip.is_unspecified
    ):
        raise InvalidParams("url host is not allowed", {"index": index})


def run_web_search(
    *,
    provider: SearchProvider,
    query: str,
    max_results: int,
    region: str,
    safesearch: str,
    timelimit: str | None,
) -> dict[str, Any]:
    results = provider.search(
        query=query,
        max_results=max_results,
        region=region,
        safesearch=safesearch,
        timelimit=timelimit,
    )
    serialized_results = [result.to_dict() for result in results]
    return {
        "query": query,
        "provider": provider.name,
        "results": serialized_results,
        "count": len(serialized_results),
    }


def run_web_fetch(
    *,
    provider: PageFetchProvider,
    urls: list[str],
    output_dir: str | None,
    fmt: str,
    max_chars: int,
) -> dict[str, Any]:
    invocation_dir = create_fetch_output_dir(output_dir)
    fetched_by_url: dict[str, dict[str, Any]] = {}
    unique_urls = list(dict.fromkeys(urls))

    max_workers = min(FETCH_CONCURRENCY_MAX, len(unique_urls))
    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="anna-web-fetch") as executor:
        futures = {
            executor.submit(
                fetch_url_to_file,
                provider=provider,
                url=url,
                output_dir=invocation_dir,
                unique_index=unique_index,
                fmt=fmt,
                max_chars=max_chars,
            ): url
            for unique_index, url in enumerate(unique_urls, start=1)
        }
        for future in as_completed(futures):
            fetched_by_url[futures[future]] = future.result()

    results = [dict(fetched_by_url[url]) for url in urls]
    data = {
        "output_dir": str(invocation_dir),
        "index_path": str(invocation_dir / "index.json"),
        "format": fmt,
        "max_chars": max_chars,
        "results": results,
        "count": len(results),
    }
    write_fetch_index(invocation_dir, data)
    return data


def run_image_search(
    *,
    provider: ImageSearchProvider,
    query: str,
    max_results: int,
    region: str,
    safesearch: str,
    timelimit: str | None,
    size: str | None,
    color: str | None,
    type_image: str | None,
    layout: str | None,
) -> dict[str, Any]:
    results = provider.search_images(
        query=query,
        max_results=max_results,
        region=region,
        safesearch=safesearch,
        timelimit=timelimit,
        size=size,
        color=color,
        type_image=type_image,
        layout=layout,
    )
    serialized_results = [result.to_dict() for result in results if result.image_url]
    return {
        "query": query,
        "provider": provider.name,
        "results": serialized_results,
        "count": len(serialized_results),
    }


def run_image_fetch(
    *,
    provider: ImageFetchProvider,
    urls: list[str],
    output_dir: str | None,
    max_bytes: int,
) -> dict[str, Any]:
    invocation_dir = create_fetch_output_dir(output_dir, prefix="image-fetch")
    fetched_by_url: dict[str, dict[str, Any]] = {}
    unique_urls = list(dict.fromkeys(urls))

    max_workers = min(FETCH_CONCURRENCY_MAX, len(unique_urls))
    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="anna-image-fetch") as executor:
        futures = {
            executor.submit(
                fetch_image_to_file,
                provider=provider,
                url=url,
                output_dir=invocation_dir,
                unique_index=unique_index,
                max_bytes=max_bytes,
            ): url
            for unique_index, url in enumerate(unique_urls, start=1)
        }
        for future in as_completed(futures):
            fetched_by_url[futures[future]] = future.result()

    results = [dict(fetched_by_url[url]) for url in urls]
    data = {
        "output_dir": str(invocation_dir),
        "index_path": str(invocation_dir / "index.json"),
        "max_bytes": max_bytes,
        "results": results,
        "count": len(results),
    }
    write_fetch_index(invocation_dir, data)
    return data


def create_fetch_output_dir(output_dir: str | None, *, prefix: str = "web-fetch") -> Path:
    base_dir = Path(output_dir).expanduser() if output_dir else Path(tempfile.gettempdir()) / "anna-search-executa"
    if base_dir.exists() and not base_dir.is_dir():
        raise InvalidParams("output_dir must be a directory")
    base_dir.mkdir(parents=True, exist_ok=True)
    invocation_name = f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
    invocation_dir = base_dir / invocation_name
    invocation_dir.mkdir()
    return invocation_dir.resolve()


def fetch_url_to_file(
    *,
    provider: PageFetchProvider,
    url: str,
    output_dir: Path,
    unique_index: int,
    fmt: str,
    max_chars: int,
) -> dict[str, Any]:
    try:
        page = provider.fetch(url=url, fmt=fmt)
        content_length = len(page.content)
        content = page.content[:max_chars]
        truncated = content_length > max_chars
        relative_path = make_fetch_filename(url, unique_index, fmt)
        file_path = output_dir / relative_path
        file_path.write_text(content, encoding="utf-8")

        result: dict[str, Any] = {
            "url": url,
            "success": True,
            "format": fmt,
            "file_path": str(file_path),
            "relative_path": relative_path,
            "content_length": content_length,
            "written_chars": len(content),
            "truncated": truncated,
        }
        if page.final_url:
            result["final_url"] = page.final_url
        return result
    except Exception as exc:  # noqa: BLE001
        return {
            "url": url,
            "success": False,
            "error": {
                "type": "fetch_error",
                "message": str(exc),
            },
        }


def make_fetch_filename(url: str, index: int, fmt: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or "page"
    safe_host = "".join(char if char.isalnum() else "-" for char in host.lower()).strip("-")
    safe_host = safe_host or "page"
    extension = FETCH_FILE_EXTENSIONS[fmt]
    return f"{index:03d}-{safe_host[:60]}{extension}"


def fetch_image_to_file(
    *,
    provider: ImageFetchProvider,
    url: str,
    output_dir: Path,
    unique_index: int,
    max_bytes: int,
) -> dict[str, Any]:
    try:
        image = provider.fetch_image(
            url=url,
            timeout_seconds=IMAGE_FETCH_TIMEOUT_SECONDS,
            max_bytes=max_bytes,
        )
        extension = extension_for_content_type(image.content_type)
        relative_path = make_image_filename(url, unique_index, extension)
        file_path = output_dir / relative_path
        file_path.write_bytes(image.content)

        result: dict[str, Any] = {
            "url": url,
            "success": True,
            "file_path": str(file_path),
            "relative_path": relative_path,
            "content_type": image.content_type,
            "bytes": len(image.content),
            "sha256": sha256(image.content).hexdigest(),
        }
        if image.final_url:
            result["final_url"] = image.final_url
        return result
    except Exception as exc:  # noqa: BLE001
        return {
            "url": url,
            "success": False,
            "error": {
                "type": "fetch_error",
                "message": str(exc),
            },
        }


def extension_for_content_type(content_type: str) -> str:
    if content_type in IMAGE_CONTENT_TYPE_EXTENSIONS:
        return IMAGE_CONTENT_TYPE_EXTENSIONS[content_type]
    return mimetypes.guess_extension(content_type) or ".img"


def make_image_filename(url: str, index: int, extension: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or "image"
    safe_host = "".join(char if char.isalnum() else "-" for char in host.lower()).strip("-")
    safe_host = safe_host or "image"
    return f"{index:03d}-{safe_host[:60]}{extension}"


def write_fetch_index(output_dir: Path, data: dict[str, Any]) -> None:
    index_path = output_dir / "index.json"
    index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def handle_line(line: str, plugin: AnnaSearchPlugin) -> dict[str, Any] | None:
    if not line.strip():
        return None

    try:
        request = json.loads(line)
    except json.JSONDecodeError:
        return make_error(None, PARSE_ERROR, "Parse error")

    if not isinstance(request, dict):
        return make_error(None, INVALID_REQUEST, "Invalid request")

    return plugin.handle_request(request)


def serve(stdin: TextIO = sys.stdin, stdout: TextIO = sys.stdout, stderr: TextIO = sys.stderr) -> None:
    plugin = AnnaSearchPlugin(stderr=stderr)
    for line in stdin:
        response = handle_line(line, plugin)
        if response is None:
            continue
        stdout.write(json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n")
        stdout.flush()


def main() -> None:
    serve()
