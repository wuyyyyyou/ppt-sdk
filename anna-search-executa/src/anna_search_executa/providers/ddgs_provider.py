from __future__ import annotations

from typing import Any

from anna_search_executa.providers.base import FetchedPage, ImageSearchResult, SearchResult

FETCH_TIMEOUT_SECONDS = 60


class DdgsSearchProvider:
    name = "ddgs"

    def search(
        self,
        *,
        query: str,
        max_results: int,
        region: str,
        safesearch: str,
        timelimit: str | None,
    ) -> list[SearchResult]:
        try:
            from ddgs import DDGS
        except ImportError as exc:
            raise RuntimeError("ddgs package is not installed") from exc

        kwargs: dict[str, Any] = {
            "region": region,
            "safesearch": safesearch,
            "max_results": max_results,
        }
        if timelimit is not None:
            kwargs["timelimit"] = timelimit

        with DDGS() as ddgs:
            raw_results = ddgs.text(query, **kwargs)

        return [self._normalize_result(item) for item in raw_results][:max_results]

    def fetch(self, *, url: str, fmt: str) -> FetchedPage:
        try:
            from ddgs import DDGS
        except ImportError as exc:
            raise RuntimeError("ddgs package is not installed") from exc

        with DDGS(timeout=FETCH_TIMEOUT_SECONDS) as ddgs:
            raw_page = ddgs.extract(url, fmt=fmt)

        content = raw_page.get("content", "")
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        final_url = self._optional_string(raw_page.get("url"))
        if final_url == url:
            final_url = None
        return FetchedPage(url=url, content=str(content), final_url=final_url)

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
        try:
            from ddgs import DDGS
        except ImportError as exc:
            raise RuntimeError("ddgs package is not installed") from exc

        kwargs: dict[str, Any] = {
            "region": region,
            "safesearch": safesearch,
            "max_results": max_results,
        }
        if timelimit is not None:
            kwargs["timelimit"] = timelimit
        if size is not None:
            kwargs["size"] = size
        if color is not None:
            kwargs["color"] = color
        if type_image is not None:
            kwargs["type_image"] = type_image
        if layout is not None:
            kwargs["layout"] = layout

        with DDGS() as ddgs:
            raw_results = ddgs.images(query, **kwargs)

        results = [self._normalize_image_result(item) for item in raw_results]
        return [result for result in results if result.image_url][:max_results]

    def _normalize_result(self, item: dict[str, Any]) -> SearchResult:
        return SearchResult(
            title=str(item.get("title") or ""),
            url=str(item.get("href") or item.get("url") or ""),
            snippet=str(item.get("body") or item.get("snippet") or ""),
            source=self._optional_string(item.get("source")),
        )

    def _optional_string(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _normalize_image_result(self, item: dict[str, Any]) -> ImageSearchResult:
        return ImageSearchResult(
            title=str(item.get("title") or ""),
            image_url=str(item.get("image") or ""),
            thumbnail_url=self._optional_string(item.get("thumbnail")),
            page_url=self._optional_string(item.get("url")),
            width=self._optional_int(item.get("width")),
            height=self._optional_int(item.get("height")),
            source=self._optional_string(item.get("source")),
        )

    def _optional_int(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(str(value).strip())
        except ValueError:
            return None
