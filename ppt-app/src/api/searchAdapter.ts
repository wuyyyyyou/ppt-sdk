import type { AnnaRuntime } from "../runtime/annaRuntime";
import type {
  ImageFetchResult,
  ImageSearchResult,
  SearchResultItem,
  WebFetchResult,
  WebSearchResult,
} from "./types";

export type SearchInvoker = (
  method: "web_search" | "web_fetch" | "image_search" | "image_fetch",
  args: Record<string, unknown>,
) => Promise<unknown>;

const SEARCH_TOOL_TIMEOUT_MS = 600_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapToolData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) return value.data;
  if ("result" in value && isRecord(value.result)) return unwrapToolData(value.result);
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNumber(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeSearchItems(value: unknown): SearchResultItem[] {
  return readRecordArray(value)
    .map((item) => ({
      title: readString(item, "title"),
      url: readString(item, "url"),
      snippet: readString(item, "snippet"),
      ...(readString(item, "source") ? { source: readString(item, "source") } : {}),
    }))
    .filter((item) => item.url.length > 0);
}

export function normalizeWebSearchResult(value: unknown, query = ""): WebSearchResult {
  const data = unwrapToolData(value);
  const record = isRecord(data) ? data : {};
  const results = normalizeSearchItems(record.results);
  return {
    query: readString(record, "query") || query,
    provider: readString(record, "provider"),
    results,
    count: readNumber(record, "count", results.length),
  };
}

export function normalizeWebFetchResult(value: unknown, fallback: {
  output_dir?: string;
  format?: "text_markdown" | "text_plain" | "text_rich";
  max_chars?: number;
} = {}): WebFetchResult {
  const data = unwrapToolData(value);
  const record = isRecord(data) ? data : {};
  const results = readRecordArray(record.results);
  return {
    output_dir: readString(record, "output_dir") || fallback.output_dir || "",
    index_path: readString(record, "index_path"),
    format: readString(record, "format") || fallback.format || "text_markdown",
    max_chars: readNumber(record, "max_chars", fallback.max_chars ?? 0),
    results,
    count: readNumber(record, "count", results.length),
  };
}

export function normalizeImageSearchResult(value: unknown, query = ""): ImageSearchResult {
  const data = unwrapToolData(value);
  const record = isRecord(data) ? data : {};
  const results = readRecordArray(record.results)
    .map((item) => ({
      title: readString(item, "title"),
      image_url: readString(item, "image_url"),
      ...(readString(item, "thumbnail_url") ? { thumbnail_url: readString(item, "thumbnail_url") } : {}),
      ...(readString(item, "page_url") ? { page_url: readString(item, "page_url") } : {}),
      ...(typeof item.width === "number" ? { width: item.width } : {}),
      ...(typeof item.height === "number" ? { height: item.height } : {}),
      ...(readString(item, "source") ? { source: readString(item, "source") } : {}),
    }))
    .filter((item) => item.image_url.length > 0);
  return {
    query: readString(record, "query") || query,
    provider: readString(record, "provider"),
    results,
    count: readNumber(record, "count", results.length),
  };
}

export function normalizeImageFetchResult(value: unknown, fallback: {
  output_dir?: string;
  max_bytes?: number;
} = {}): ImageFetchResult {
  const data = unwrapToolData(value);
  const record = isRecord(data) ? data : {};
  const results = readRecordArray(record.results);
  return {
    output_dir: readString(record, "output_dir") || fallback.output_dir || "",
    index_path: readString(record, "index_path"),
    max_bytes: readNumber(record, "max_bytes", fallback.max_bytes ?? 0),
    results,
    count: readNumber(record, "count", results.length),
  };
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

export function createSearchAdapter(input: {
  runtime: AnnaRuntime;
  toolId: string;
}) {
  const invoke: SearchInvoker = async (method, args) =>
    input.runtime.tools.invoke(
      {
        tool_id: input.toolId,
        method,
        args,
        timeoutMs: SEARCH_TOOL_TIMEOUT_MS,
      },
      { timeoutMs: SEARCH_TOOL_TIMEOUT_MS },
    );

  return {
    webSearch(args: {
      query: string;
      max_results?: number;
      safesearch?: "off" | "moderate" | "strict";
      timelimit?: "d" | "w" | "m" | "y";
    }) {
      const payload = omitUndefined({
        query: args.query,
        max_results: args.max_results,
        safesearch: args.safesearch,
        timelimit: args.timelimit,
      });
      return invoke("web_search", payload).then((result) =>
        normalizeWebSearchResult(result, args.query),
      );
    },
    webFetch(args: {
      urls: string[];
      output_dir?: string;
      format?: "text_markdown" | "text_plain" | "text_rich";
      max_chars?: number;
    }) {
      const payload = omitUndefined({
        urls: args.urls,
        output_dir: args.output_dir,
        format: args.format,
        max_chars: args.max_chars,
      });
      return invoke("web_fetch", payload).then((result) =>
        normalizeWebFetchResult(result, args),
      );
    },
    imageSearch(args: {
      query: string;
      max_results?: number;
      safesearch?: "off" | "moderate" | "strict";
      timelimit?: "d" | "w" | "m" | "y";
      size?: string;
      color?: string;
      type_image?: string;
      layout?: string;
    }) {
      const payload = omitUndefined({
        query: args.query,
        max_results: args.max_results,
        safesearch: args.safesearch,
        timelimit: args.timelimit,
        size: args.size,
        color: args.color,
        type_image: args.type_image,
        layout: args.layout,
      });
      return invoke("image_search", payload).then((result) =>
        normalizeImageSearchResult(result, args.query),
      );
    },
    imageFetch(args: {
      urls: string[];
      output_dir?: string;
      max_bytes?: number;
    }) {
      const payload = omitUndefined({
        urls: args.urls,
        output_dir: args.output_dir,
        max_bytes: args.max_bytes,
      });
      return invoke("image_fetch", payload).then((result) =>
        normalizeImageFetchResult(result, args),
      );
    },
  };
}
