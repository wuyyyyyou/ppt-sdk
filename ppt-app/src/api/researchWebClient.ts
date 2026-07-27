import type { AnnaRuntime } from "../runtime/annaRuntime";

export interface ResearchWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  site: string;
  published_at?: string | null;
  score?: number | null;
}

export interface ResearchWebSearchResponse {
  results: ResearchWebSearchResult[];
  provider_tier?: string;
  quota_consumed?: number;
}

export interface ResearchWebFetchPage {
  url: string;
  final_url?: string;
  title?: string;
  ok: boolean;
  content?: string;
  truncated?: boolean;
  error?: string | null;
}

export interface ResearchWebFetchResponse {
  pages: ResearchWebFetchPage[];
  quota_consumed?: number;
}

export interface ResearchImageSearchResult {
  image_url: string;
  thumbnail_url?: string | null;
  source_url: string;
  title?: string | null;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  license_hint?: string | null;
}

export interface ResearchImageSearchResponse {
  results: ResearchImageSearchResult[];
  quota_consumed?: number;
  cached?: boolean;
}

export interface ResearchImageFetchResponse {
  path: string;
  get_url: string;
  mime_type: string;
  bytes_size: number;
  sha256: string;
  source_url: string;
  final_url: string;
  quota_consumed?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) return unwrap(value.data);
  if (isRecord(value.result)) return unwrap(value.result);
  return value;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSearchResponse(value: unknown): ResearchWebSearchResponse {
  const record = isRecord(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {};
  const results = Array.isArray(record.results)
    ? record.results.filter(isRecord).map((item) => ({
        title: readString(item.title),
        url: readString(item.url),
        snippet: readString(item.snippet),
        site: readString(item.site),
        ...(item.published_at === null || typeof item.published_at === "string"
          ? { published_at: item.published_at as string | null }
          : {}),
        ...(readFiniteNumber(item.score) !== undefined ? { score: readFiniteNumber(item.score) } : {}),
      })).filter((item) => item.url.trim().length > 0)
    : [];
  return {
    results,
    ...(readString(record.provider_tier) ? { provider_tier: readString(record.provider_tier) } : {}),
    ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
  };
}

function normalizeFetchResponse(value: unknown): ResearchWebFetchResponse {
  const record = isRecord(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {};
  const pages = Array.isArray(record.pages)
    ? record.pages.filter(isRecord).map((page) => ({
        url: readString(page.url),
        ...(readString(page.final_url) ? { final_url: readString(page.final_url) } : {}),
        ...(readString(page.title) ? { title: readString(page.title) } : {}),
        ok: page.ok === true,
        ...(readString(page.content) ? { content: readString(page.content) } : {}),
        ...(typeof page.truncated === "boolean" ? { truncated: page.truncated } : {}),
        ...(page.error === null || typeof page.error === "string" ? { error: page.error as string | null } : {}),
      }))
    : [];
  return {
    pages,
    ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
  };
}

function normalizeImageSearchResponse(value: unknown): ResearchImageSearchResponse {
  const record = isRecord(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {};
  const results = Array.isArray(record.results)
    ? record.results.filter(isRecord).map((item) => ({
        image_url: readString(item.image_url),
        ...(readNullableString(item.thumbnail_url) !== undefined ? { thumbnail_url: readNullableString(item.thumbnail_url) } : {}),
        source_url: readString(item.source_url),
        ...(readNullableString(item.title) !== undefined ? { title: readNullableString(item.title) } : {}),
        ...(item.width === null || readFiniteNumber(item.width) !== undefined ? { width: item.width as number | null } : {}),
        ...(item.height === null || readFiniteNumber(item.height) !== undefined ? { height: item.height as number | null } : {}),
        ...(readNullableString(item.mime_type) !== undefined ? { mime_type: readNullableString(item.mime_type) } : {}),
        ...(readNullableString(item.license_hint) !== undefined ? { license_hint: readNullableString(item.license_hint) } : {}),
      })).filter((item) => item.image_url.trim().length > 0)
    : [];
  return {
    results,
    ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
    ...(typeof record.cached === "boolean" ? { cached: record.cached } : {}),
  };
}

function normalizeImageFetchResponse(value: unknown): ResearchImageFetchResponse {
  const record = isRecord(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {};
  const path = readString(record.path);
  const getUrl = readString(record.get_url);
  if (!path || !getUrl) throw new Error("anna.web.image_fetch returned no APS artifact reference");
  return {
    path,
    get_url: getUrl,
    mime_type: readString(record.mime_type),
    bytes_size: readFiniteNumber(record.bytes_size) ?? 0,
    sha256: readString(record.sha256),
    source_url: readString(record.source_url),
    final_url: readString(record.final_url),
    ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
  };
}

export interface ResearchWebClient {
  search(input: { query: string; max_results?: number }): Promise<ResearchWebSearchResponse>;
  fetch(input: { urls: string[]; max_chars?: number }): Promise<ResearchWebFetchResponse>;
  imageSearch(input: { query: string; max_results?: number; min_width?: number; min_height?: number; aspect?: "any" | "wide" | "tall" | "square" }): Promise<ResearchImageSearchResponse>;
  imageFetch(input: { url: string; max_bytes?: number; purpose?: string }): Promise<ResearchImageFetchResponse>;
}

export function createResearchWebClient(runtime: AnnaRuntime): ResearchWebClient {
  if (!runtime.web) throw new Error("Anna Runtime does not expose the official web namespace.");
  const web = runtime.web;
  return {
    async search(input) {
      return normalizeSearchResponse(await web.search({
        query: input.query,
        max_results: input.max_results,
        search_depth: "basic",
        topic: "general",
      }));
    },
    async fetch(input) {
      return normalizeFetchResponse(await web.fetch({
        urls: input.urls,
        format: "markdown",
        max_chars: input.max_chars ?? 8000,
        timeout_ms: 30000,
      }, { timeoutMs: 90000 }));
    },
    async imageSearch(input) {
      return normalizeImageSearchResponse(await web.image_search({
        query: input.query,
        max_results: input.max_results ?? 6,
        min_width: input.min_width ?? 800,
        min_height: input.min_height ?? 600,
        aspect: input.aspect ?? "any",
      }));
    },
    async imageFetch(input) {
      return normalizeImageFetchResponse(await web.image_fetch({
        url: input.url,
        max_bytes: input.max_bytes ?? 20 * 1024 * 1024,
        purpose: input.purpose ?? "ppt-research",
      }, { timeoutMs: 90000 }));
    },
  };
}
