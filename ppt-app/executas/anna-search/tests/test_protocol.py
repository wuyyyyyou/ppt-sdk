from __future__ import annotations

import io
import json
import threading
import time
from pathlib import Path
from typing import Any

import anna_search_executa.plugin as plugin_module
from anna_search_executa.plugin import AnnaSearchPlugin, handle_line
from anna_search_executa.providers.base import FetchedImage, FetchedPage, ImageSearchResult, SearchResult


class FakeProvider:
    name = "fake"
    fetch_calls: list[tuple[str, str]]
    image_search_calls: list[dict[str, Any]]

    def __init__(self) -> None:
        self.fetch_calls = []
        self.image_search_calls = []

    def search(
        self,
        *,
        query: str,
        max_results: int,
        region: str,
        safesearch: str,
        timelimit: str | None,
    ) -> list[SearchResult]:
        return [
            SearchResult(
                title="Example",
                url="https://example.com",
                snippet=f"{query} / {region} / {safesearch} / {timelimit}",
            )
        ][:max_results]

    def fetch(self, *, url: str, fmt: str) -> FetchedPage:
        self.fetch_calls.append((url, fmt))
        if "fail" in url:
            raise RuntimeError("fetch failed")
        return FetchedPage(
            url=url,
            final_url=f"{url}/final" if "redirect" in url else None,
            content=f"# {url}\n" + ("x" * 1500),
        )

    def search_images(
        self,
        *,
        query: str,
        max_results: int,
        region: str,
        safesearch: str,
        timelimit: str | None,
        size: str | None,
        color: str | None,
        type_image: str | None,
        layout: str | None,
    ) -> list[ImageSearchResult]:
        self.image_search_calls.append(
            {
                "query": query,
                "max_results": max_results,
                "region": region,
                "safesearch": safesearch,
                "timelimit": timelimit,
                "size": size,
                "color": color,
                "type_image": type_image,
                "layout": layout,
            }
        )
        return [
            ImageSearchResult(
                title="Image",
                image_url="https://example.com/image.jpg",
                thumbnail_url="https://example.com/thumb.jpg",
                page_url="https://example.com/page",
                width=640,
                height=480,
                source="example.com",
            ),
            ImageSearchResult(title="No URL", image_url=""),
        ][:max_results]


class FakeImageFetchProvider:
    name = "fake_image_fetch"
    fetch_calls: list[tuple[str, int, int]]

    def __init__(self) -> None:
        self.fetch_calls = []

    def fetch_image(self, *, url: str, timeout_seconds: int, max_bytes: int) -> FetchedImage:
        self.fetch_calls.append((url, timeout_seconds, max_bytes))
        if "html" in url:
            raise RuntimeError("Content-Type is not image/*: text/html")
        if "large" in url:
            raise RuntimeError("Downloaded bytes exceed max_bytes")
        return FetchedImage(
            url=url,
            content=b"fake-image-bytes",
            content_type="image/jpeg",
            final_url=f"{url}?final=1" if "redirect" in url else None,
        )


def make_plugin(
    provider: FakeProvider | None = None,
    image_fetch_provider: FakeImageFetchProvider | None = None,
) -> AnnaSearchPlugin:
    manifest_path = Path(__file__).resolve().parents[1] / "manifest.json"
    return AnnaSearchPlugin(
        manifest_path=manifest_path,
        provider=provider or FakeProvider(),
        image_fetch_provider=image_fetch_provider or FakeImageFetchProvider(),
        stderr=io.StringIO(),
    )


def load_test_manifest() -> dict[str, Any]:
    manifest_path = Path(__file__).resolve().parents[1] / "manifest.json"
    with manifest_path.open("r", encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    assert isinstance(manifest, dict)
    return manifest


def rpc(
    method: str,
    params: Any | None = None,
    request_id: int = 1,
    provider: FakeProvider | None = None,
    image_fetch_provider: FakeImageFetchProvider | None = None,
) -> dict[str, Any]:
    request: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        request["params"] = params
    response = handle_line(json.dumps(request), make_plugin(provider, image_fetch_provider))
    assert response is not None
    return response


def test_describe_reads_display_name_and_version_from_manifest() -> None:
    manifest = load_test_manifest()
    response = rpc("describe")

    assert response["result"]["version"] == manifest["version"]
    assert response["result"]["display_name"] == manifest["display_name"]
    assert [tool["name"] for tool in response["result"]["tools"]] == [
        "web_search",
        "web_fetch",
        "image_search",
        "image_fetch",
    ]


def test_load_manifest_prefers_embedded_manifest(monkeypatch: Any) -> None:
    embedded_manifest = {"display_name": "embedded", "version": "9.9.9", "tools": []}
    monkeypatch.setattr(plugin_module, "EMBEDDED_MANIFEST", embedded_manifest)

    plugin = make_plugin()

    assert plugin.load_manifest() == embedded_manifest


def test_health_returns_ok() -> None:
    manifest = load_test_manifest()
    response = rpc("health")

    assert response["result"]["status"] == "healthy"
    assert response["result"]["version"] == manifest["version"]
    assert response["result"]["tools_count"] == 4


def test_web_search_missing_query_reports_invalid_params() -> None:
    response = rpc(
        "invoke",
        {"tool": "web_search", "arguments": {"max_results": 5}},
    )

    assert response["error"]["code"] == -32602
    assert "query" in response["error"]["message"]


def test_web_search_max_results_out_of_range_reports_invalid_params() -> None:
    response = rpc(
        "invoke",
        {"tool": "web_search", "arguments": {"query": "anna", "max_results": 21}},
    )

    assert response["error"]["code"] == -32602
    assert "max_results" in response["error"]["message"]


def test_web_search_success_uses_stable_output_shape() -> None:
    response = rpc(
        "invoke",
        {"tool": "web_search", "arguments": {"query": "anna"}},
    )

    data = response["result"]["data"]
    assert response["result"]["success"] is True
    assert response["result"]["tool"] == "web_search"
    assert data["query"] == "anna"
    assert data["provider"] == "fake"
    assert data["count"] == 1
    assert set(data["results"][0]) == {"title", "url", "snippet"}


def test_web_fetch_missing_urls_reports_invalid_params() -> None:
    response = rpc("invoke", {"tool": "web_fetch", "arguments": {}})

    assert response["error"]["code"] == -32602
    assert "urls" in response["error"]["message"]


def test_web_fetch_urls_must_be_array() -> None:
    response = rpc(
        "invoke",
        {"tool": "web_fetch", "arguments": {"urls": "https://example.com"}},
    )

    assert response["error"]["code"] == -32602
    assert "urls" in response["error"]["message"]


def test_web_fetch_url_count_out_of_range_reports_invalid_params() -> None:
    response = rpc(
        "invoke",
        {"tool": "web_fetch", "arguments": {"urls": [f"https://example.com/{i}" for i in range(11)]}},
    )

    assert response["error"]["code"] == -32602
    assert "between 1 and 10" in response["error"]["message"]


def test_web_fetch_rejects_unsafe_urls() -> None:
    for url in [
        "file:///tmp/example",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://192.168.1.10",
        "https://user:pass@example.com",
    ]:
        response = rpc("invoke", {"tool": "web_fetch", "arguments": {"urls": [url]}})

        assert response["error"]["code"] == -32602


def test_web_fetch_writes_files_and_index(tmp_path: Path) -> None:
    response = rpc(
        "invoke",
        {
            "tool": "web_fetch",
            "arguments": {
                "urls": ["https://example.com/redirect"],
                "output_dir": str(tmp_path),
                "max_chars": 1200,
            },
        },
    )

    data = response["result"]["data"]
    result = data["results"][0]
    output_dir = Path(data["output_dir"])
    index_path = Path(data["index_path"])
    file_path = Path(result["file_path"])

    assert response["result"]["success"] is True
    assert response["result"]["tool"] == "web_fetch"
    assert output_dir.parent == tmp_path
    assert output_dir.exists()
    assert index_path.exists()
    assert result["success"] is True
    assert result["relative_path"] == file_path.name
    assert result["final_url"] == "https://example.com/redirect/final"
    assert result["content_length"] > 1200
    assert result["written_chars"] == 1200
    assert result["truncated"] is True
    assert len(file_path.read_text(encoding="utf-8")) == 1200

    index_data = json.loads(index_path.read_text(encoding="utf-8"))
    assert index_data["results"][0]["file_path"] == str(file_path)


def test_web_fetch_failure_item_does_not_fail_whole_call(tmp_path: Path) -> None:
    response = rpc(
        "invoke",
        {
            "tool": "web_fetch",
            "arguments": {
                "urls": ["https://example.com/fail"],
                "output_dir": str(tmp_path),
            },
        },
    )

    result = response["result"]["data"]["results"][0]
    assert response["result"]["success"] is True
    assert result["success"] is False
    assert result["error"]["type"] == "fetch_error"
    assert "fetch failed" in result["error"]["message"]


def test_web_fetch_deduplicates_fetches_but_returns_input_order(tmp_path: Path) -> None:
    provider = FakeProvider()
    response = rpc(
        "invoke",
        {
            "tool": "web_fetch",
            "arguments": {
                "urls": ["https://example.com/a", "https://example.com/a"],
                "output_dir": str(tmp_path),
            },
        },
        provider=provider,
    )

    results = response["result"]["data"]["results"]
    assert provider.fetch_calls == [("https://example.com/a", "text_rich")]
    assert len(results) == 2
    assert results[0]["file_path"] == results[1]["file_path"]


def test_web_fetch_fetches_unique_urls_concurrently(tmp_path: Path) -> None:
    class SlowProvider(FakeProvider):
        def __init__(self) -> None:
            super().__init__()
            self.active_calls = 0
            self.max_active_calls = 0
            self.lock = threading.Lock()

        def fetch(self, *, url: str, fmt: str) -> FetchedPage:
            with self.lock:
                self.active_calls += 1
                self.max_active_calls = max(self.max_active_calls, self.active_calls)
            try:
                time.sleep(0.05)
                return FetchedPage(url=url, content="x" * 1000)
            finally:
                with self.lock:
                    self.active_calls -= 1

    provider = SlowProvider()
    response = rpc(
        "invoke",
        {
            "tool": "web_fetch",
            "arguments": {
                "urls": [f"https://example.com/{i}" for i in range(10)],
                "output_dir": str(tmp_path),
            },
        },
        provider=provider,
    )

    assert response["result"]["data"]["count"] == 10
    assert provider.max_active_calls > 1


def test_image_search_missing_query_reports_invalid_params() -> None:
    response = rpc("invoke", {"tool": "image_search", "arguments": {"max_results": 5}})

    assert response["error"]["code"] == -32602
    assert "query" in response["error"]["message"]


def test_image_search_max_results_out_of_range_reports_invalid_params() -> None:
    response = rpc(
        "invoke",
        {"tool": "image_search", "arguments": {"query": "anna", "max_results": 21}},
    )

    assert response["error"]["code"] == -32602
    assert "max_results" in response["error"]["message"]


def test_image_search_success_uses_stable_output_shape_and_filters(tmp_path: Path) -> None:
    provider = FakeProvider()
    response = rpc(
        "invoke",
        {
            "tool": "image_search",
            "arguments": {
                "query": "anna",
                "size": "Large",
                "color": "Blue",
                "type_image": "photo",
                "layout": "Wide",
            },
        },
        provider=provider,
    )

    data = response["result"]["data"]
    assert response["result"]["success"] is True
    assert response["result"]["tool"] == "image_search"
    assert data["query"] == "anna"
    assert data["provider"] == "fake"
    assert data["count"] == 1
    assert data["results"] == [
        {
            "title": "Image",
            "image_url": "https://example.com/image.jpg",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "page_url": "https://example.com/page",
            "width": 640,
            "height": 480,
            "source": "example.com",
        }
    ]
    assert provider.image_search_calls[0]["size"] == "Large"
    assert provider.image_search_calls[0]["color"] == "Blue"
    assert provider.image_search_calls[0]["type_image"] == "photo"
    assert provider.image_search_calls[0]["layout"] == "Wide"


def test_image_search_rejects_empty_filter_string() -> None:
    response = rpc(
        "invoke",
        {"tool": "image_search", "arguments": {"query": "anna", "size": " "}},
    )

    assert response["error"]["code"] == -32602
    assert "size" in response["error"]["message"]


def test_image_fetch_missing_urls_reports_invalid_params() -> None:
    response = rpc("invoke", {"tool": "image_fetch", "arguments": {}})

    assert response["error"]["code"] == -32602
    assert "urls" in response["error"]["message"]


def test_image_fetch_url_count_out_of_range_reports_invalid_params() -> None:
    response = rpc(
        "invoke",
        {"tool": "image_fetch", "arguments": {"urls": [f"https://example.com/{i}.jpg" for i in range(11)]}},
    )

    assert response["error"]["code"] == -32602
    assert "between 1 and 10" in response["error"]["message"]


def test_image_fetch_rejects_unsafe_urls() -> None:
    response = rpc(
        "invoke",
        {"tool": "image_fetch", "arguments": {"urls": ["http://127.0.0.1/image.jpg"]}},
    )

    assert response["error"]["code"] == -32602


def test_image_fetch_success_writes_files_and_index(tmp_path: Path) -> None:
    image_provider = FakeImageFetchProvider()
    response = rpc(
        "invoke",
        {
            "tool": "image_fetch",
            "arguments": {
                "urls": ["https://example.com/redirect.jpg"],
                "output_dir": str(tmp_path),
            },
        },
        image_fetch_provider=image_provider,
    )

    data = response["result"]["data"]
    result = data["results"][0]
    output_dir = Path(data["output_dir"])
    index_path = Path(data["index_path"])
    file_path = Path(result["file_path"])

    assert response["result"]["success"] is True
    assert response["result"]["tool"] == "image_fetch"
    assert output_dir.parent == tmp_path
    assert output_dir.name.startswith("image-fetch-")
    assert index_path.exists()
    assert result["success"] is True
    assert result["relative_path"] == file_path.name
    assert result["content_type"] == "image/jpeg"
    assert result["bytes"] == len(b"fake-image-bytes")
    assert result["sha256"] == "b0423673071359e7ff62ec7f2766b1bfe8682ee426b8d6672f8aab0619ba7648"
    assert result["final_url"] == "https://example.com/redirect.jpg?final=1"
    assert file_path.suffix == ".jpg"
    assert file_path.read_bytes() == b"fake-image-bytes"

    index_data = json.loads(index_path.read_text(encoding="utf-8"))
    assert index_data["results"][0]["file_path"] == str(file_path)
    assert image_provider.fetch_calls == [("https://example.com/redirect.jpg", 60, 10485760)]


def test_image_fetch_failure_item_does_not_fail_whole_call(tmp_path: Path) -> None:
    response = rpc(
        "invoke",
        {
            "tool": "image_fetch",
            "arguments": {
                "urls": ["https://example.com/html"],
                "output_dir": str(tmp_path),
            },
        },
    )

    result = response["result"]["data"]["results"][0]
    assert response["result"]["success"] is True
    assert result["success"] is False
    assert result["error"]["type"] == "fetch_error"
    assert "Content-Type" in result["error"]["message"]


def test_image_fetch_deduplicates_downloads_but_returns_input_order(tmp_path: Path) -> None:
    image_provider = FakeImageFetchProvider()
    response = rpc(
        "invoke",
        {
            "tool": "image_fetch",
            "arguments": {
                "urls": ["https://example.com/a.jpg", "https://example.com/a.jpg"],
                "output_dir": str(tmp_path),
            },
        },
        image_fetch_provider=image_provider,
    )

    results = response["result"]["data"]["results"]
    assert image_provider.fetch_calls == [("https://example.com/a.jpg", 60, 10485760)]
    assert len(results) == 2
    assert results[0]["file_path"] == results[1]["file_path"]
