from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    snippet: str
    source: str | None = None

    def to_dict(self) -> dict[str, str]:
        data = {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
        }
        if self.source:
            data["source"] = self.source
        return data


@dataclass(frozen=True)
class FetchedPage:
    url: str
    content: str
    final_url: str | None = None


@dataclass(frozen=True)
class ImageSearchResult:
    title: str
    image_url: str
    thumbnail_url: str | None = None
    page_url: str | None = None
    width: int | None = None
    height: int | None = None
    source: str | None = None

    def to_dict(self) -> dict[str, str | int]:
        data: dict[str, str | int] = {
            "title": self.title,
            "image_url": self.image_url,
        }
        if self.thumbnail_url:
            data["thumbnail_url"] = self.thumbnail_url
        if self.page_url:
            data["page_url"] = self.page_url
        if self.width is not None:
            data["width"] = self.width
        if self.height is not None:
            data["height"] = self.height
        if self.source:
            data["source"] = self.source
        return data


@dataclass(frozen=True)
class FetchedImage:
    url: str
    content: bytes
    content_type: str
    final_url: str | None = None


class SearchProvider(Protocol):
    name: str

    def search(
        self,
        *,
        query: str,
        max_results: int,
        region: str,
        safesearch: str,
        timelimit: str | None,
    ) -> list[SearchResult]:
        """Run a web search and return normalized results."""


class PageFetchProvider(Protocol):
    name: str

    def fetch(self, *, url: str, fmt: str) -> FetchedPage:
        """Fetch a web page and return extracted content."""


class ImageSearchProvider(Protocol):
    name: str

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
        """Run an image search and return normalized image metadata."""


class ImageFetchProvider(Protocol):
    name: str

    def fetch_image(self, *, url: str, timeout_seconds: int, max_bytes: int) -> FetchedImage:
        """Download an image URL and return image bytes plus metadata."""
