from __future__ import annotations

import sys
import types

from anna_search_executa.providers.ddgs_provider import DdgsSearchProvider


class FakeDDGS:
    calls: list[tuple[str, dict[str, object]]] = []
    extract_calls: list[tuple[str, str]] = []
    image_calls: list[tuple[str, dict[str, object]]] = []
    init_calls: list[dict[str, object]] = []

    def __init__(self, **kwargs: object) -> None:
        self.init_calls.append(kwargs)

    def __enter__(self) -> "FakeDDGS":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def text(self, query: str, **kwargs: object) -> list[dict[str, object]]:
        self.calls.append((query, kwargs))
        return [
            {
                "title": "Anna",
                "href": "https://example.com/anna",
                "body": "Anna search result",
                "source": "example.com",
            }
        ]

    def extract(self, url: str, fmt: str = "text_markdown") -> dict[str, object]:
        self.extract_calls.append((url, fmt))
        return {"url": f"{url}/final", "content": "Fetched content"}

    def images(self, query: str, **kwargs: object) -> list[dict[str, object]]:
        self.image_calls.append((query, kwargs))
        return [
            {
                "title": "Image",
                "image": "https://example.com/image.jpg",
                "thumbnail": "https://example.com/thumb.jpg",
                "url": "https://example.com/page",
                "width": "640",
                "height": "480",
                "source": "example.com",
            },
            {
                "title": "No image",
                "image": "",
                "width": "unknown",
            },
        ]


def test_ddgs_provider_calls_text_with_query_argument(monkeypatch) -> None:
    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = FakeDDGS
    FakeDDGS.calls = []
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)

    provider = DdgsSearchProvider()
    results = provider.search(
        query="Anna Executa",
        max_results=5,
        region="us-en",
        safesearch="moderate",
        timelimit="w",
    )

    assert FakeDDGS.calls == [
        (
            "Anna Executa",
            {
                "region": "us-en",
                "safesearch": "moderate",
                "max_results": 5,
                "timelimit": "w",
            },
        )
    ]
    assert results[0].title == "Anna"
    assert results[0].url == "https://example.com/anna"
    assert results[0].snippet == "Anna search result"
    assert results[0].source == "example.com"


def test_ddgs_provider_calls_extract_with_url_and_format(monkeypatch) -> None:
    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = FakeDDGS
    FakeDDGS.extract_calls = []
    FakeDDGS.init_calls = []
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)

    provider = DdgsSearchProvider()
    page = provider.fetch(url="https://example.com/page", fmt="text_plain")

    assert FakeDDGS.extract_calls == [("https://example.com/page", "text_plain")]
    assert FakeDDGS.init_calls == [{"timeout": 60}]
    assert page.url == "https://example.com/page"
    assert page.final_url == "https://example.com/page/final"
    assert page.content == "Fetched content"


def test_ddgs_provider_calls_images_and_normalizes_results(monkeypatch) -> None:
    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = FakeDDGS
    FakeDDGS.image_calls = []
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)

    provider = DdgsSearchProvider()
    results = provider.search_images(
        query="Anna Executa",
        max_results=5,
        region="us-en",
        safesearch="moderate",
        timelimit="m",
        size="Large",
        color="Blue",
        type_image="photo",
        layout="Wide",
    )

    assert FakeDDGS.image_calls == [
        (
            "Anna Executa",
            {
                "region": "us-en",
                "safesearch": "moderate",
                "max_results": 5,
                "timelimit": "m",
                "size": "Large",
                "color": "Blue",
                "type_image": "photo",
                "layout": "Wide",
            },
        )
    ]
    assert len(results) == 1
    assert results[0].title == "Image"
    assert results[0].image_url == "https://example.com/image.jpg"
    assert results[0].thumbnail_url == "https://example.com/thumb.jpg"
    assert results[0].page_url == "https://example.com/page"
    assert results[0].width == 640
    assert results[0].height == 480
    assert results[0].source == "example.com"
