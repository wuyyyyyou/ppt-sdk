from __future__ import annotations

from anna_search_executa.providers.image_fetch_provider import UrlImageFetchProvider


class FakeHeaders:
    def __init__(self, values: dict[str, str]) -> None:
        self.values = values

    def get(self, key: str) -> str | None:
        return self.values.get(key)


class FakeResponse:
    def __init__(
        self,
        *,
        headers: dict[str, str],
        chunks: list[bytes],
        final_url: str = "https://cdn.example.com/image.jpg",
    ) -> None:
        self.headers = FakeHeaders(headers)
        self.chunks = chunks
        self.final_url = final_url

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def read(self, size: int) -> bytes:
        if not self.chunks:
            return b""
        return self.chunks.pop(0)

    def geturl(self) -> str:
        return self.final_url


def test_url_image_fetch_provider_downloads_image(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int) -> FakeResponse:
        assert timeout == 60
        assert request.headers["User-agent"].startswith("Mozilla/5.0")
        return FakeResponse(
            headers={"Content-Type": "image/jpeg; charset=binary", "Content-Length": "8"},
            chunks=[b"fake", b"data"],
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    provider = UrlImageFetchProvider()
    image = provider.fetch_image(url="https://example.com/image.jpg", timeout_seconds=60, max_bytes=1024)

    assert image.url == "https://example.com/image.jpg"
    assert image.final_url == "https://cdn.example.com/image.jpg"
    assert image.content_type == "image/jpeg"
    assert image.content == b"fakedata"


def test_url_image_fetch_provider_rejects_non_image_content_type(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int) -> FakeResponse:
        return FakeResponse(headers={"Content-Type": "text/html"}, chunks=[b"<html>"])

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    provider = UrlImageFetchProvider()
    try:
        provider.fetch_image(url="https://example.com/image.jpg", timeout_seconds=60, max_bytes=1024)
    except RuntimeError as exc:
        assert "Content-Type is not image/*" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


def test_url_image_fetch_provider_rejects_content_length_over_limit(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int) -> FakeResponse:
        return FakeResponse(headers={"Content-Type": "image/png", "Content-Length": "2048"}, chunks=[])

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    provider = UrlImageFetchProvider()
    try:
        provider.fetch_image(url="https://example.com/image.png", timeout_seconds=60, max_bytes=1024)
    except RuntimeError as exc:
        assert "Content-Length exceeds max_bytes" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


def test_url_image_fetch_provider_rejects_stream_over_limit(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int) -> FakeResponse:
        return FakeResponse(headers={"Content-Type": "image/png"}, chunks=[b"a" * 600, b"b" * 600])

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    provider = UrlImageFetchProvider()
    try:
        provider.fetch_image(url="https://example.com/image.png", timeout_seconds=60, max_bytes=1024)
    except RuntimeError as exc:
        assert "Downloaded bytes exceed max_bytes" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")
