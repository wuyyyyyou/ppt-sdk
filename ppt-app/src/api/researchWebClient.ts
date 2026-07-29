import type { AnnaRuntime } from "../runtime/annaRuntime";
import type { AppendWorkspaceLogInput } from "./types";
import { beginPerformanceSpan } from "../performance/performanceRecorder";

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

export interface ResearchWebNormalizationWarning {
  code: string;
  path: string;
  count?: number;
  fallback?: string;
}

export interface ResearchWebCallContext {
  workspace_dir: string;
  operation_id: string;
  interaction_id?: string;
}

export interface ResearchWebClientOptions {
  appendWorkspaceLog(input: AppendWorkspaceLogInput): Promise<unknown>;
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

interface NormalizedResult<T> {
  value: T;
  warnings: ResearchWebNormalizationWarning[];
}

function normalizedRecord(value: unknown, warnings: ResearchWebNormalizationWarning[]) {
  const unwrapped = unwrap(value);
  if (isRecord(unwrapped)) return unwrapped;
  warnings.push({ code: "invalid_response_object", path: "$", fallback: "normalized_to_empty_object" });
  return {};
}

function recordArray(
  value: unknown,
  path: string,
  warnings: ResearchWebNormalizationWarning[],
) {
  if (!Array.isArray(value)) {
    warnings.push({ code: "missing_or_invalid_array", path, fallback: "normalized_to_empty_array" });
    return [];
  }
  const records = value.filter(isRecord);
  if (records.length !== value.length) {
    warnings.push({ code: "invalid_items_dropped", path, count: value.length - records.length });
  }
  return records;
}

function normalizeSearchResponse(value: unknown): NormalizedResult<ResearchWebSearchResponse> {
  const warnings: ResearchWebNormalizationWarning[] = [];
  const record = normalizedRecord(value, warnings);
  const records = recordArray(record.results, "$.results", warnings);
  const results = records.map((item) => ({
        title: readString(item.title),
        url: readString(item.url),
        snippet: readString(item.snippet),
        site: readString(item.site),
        ...(item.published_at === null || typeof item.published_at === "string"
          ? { published_at: item.published_at as string | null }
          : {}),
        ...(readFiniteNumber(item.score) !== undefined ? { score: readFiniteNumber(item.score) } : {}),
      }));
  const usableResults = results.filter((item) => item.url.trim().length > 0);
  if (usableResults.length !== results.length) {
    warnings.push({ code: "items_missing_required_url_dropped", path: "$.results", count: results.length - usableResults.length });
  }
  return {
    value: {
      results: usableResults,
      ...(readString(record.provider_tier) ? { provider_tier: readString(record.provider_tier) } : {}),
      ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
    },
    warnings,
  };
}

function normalizeFetchResponse(value: unknown): NormalizedResult<ResearchWebFetchResponse> {
  const warnings: ResearchWebNormalizationWarning[] = [];
  const record = normalizedRecord(value, warnings);
  const pages = recordArray(record.pages, "$.pages", warnings).map((page) => ({
        url: readString(page.url),
        ...(readString(page.final_url) ? { final_url: readString(page.final_url) } : {}),
        ...(readString(page.title) ? { title: readString(page.title) } : {}),
        ok: page.ok === true,
        ...(readString(page.content) ? { content: readString(page.content) } : {}),
        ...(typeof page.truncated === "boolean" ? { truncated: page.truncated } : {}),
        ...(page.error === null || typeof page.error === "string" ? { error: page.error as string | null } : {}),
      }));
  return {
    value: {
      pages,
      ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
    },
    warnings,
  };
}

function normalizeImageSearchResponse(value: unknown): NormalizedResult<ResearchImageSearchResponse> {
  const warnings: ResearchWebNormalizationWarning[] = [];
  const record = normalizedRecord(value, warnings);
  const records = recordArray(record.results, "$.results", warnings);
  const results = records.map((item) => ({
        image_url: readString(item.image_url),
        ...(readNullableString(item.thumbnail_url) !== undefined ? { thumbnail_url: readNullableString(item.thumbnail_url) } : {}),
        source_url: readString(item.source_url),
        ...(readNullableString(item.title) !== undefined ? { title: readNullableString(item.title) } : {}),
        ...(item.width === null || readFiniteNumber(item.width) !== undefined ? { width: item.width as number | null } : {}),
        ...(item.height === null || readFiniteNumber(item.height) !== undefined ? { height: item.height as number | null } : {}),
        ...(readNullableString(item.mime_type) !== undefined ? { mime_type: readNullableString(item.mime_type) } : {}),
        ...(readNullableString(item.license_hint) !== undefined ? { license_hint: readNullableString(item.license_hint) } : {}),
      }));
  const usableResults = results.filter((item) => item.image_url.trim().length > 0);
  if (usableResults.length !== results.length) {
    warnings.push({ code: "items_missing_required_url_dropped", path: "$.results", count: results.length - usableResults.length });
  }
  return {
    value: {
      results: usableResults,
      ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
      ...(typeof record.cached === "boolean" ? { cached: record.cached } : {}),
    },
    warnings,
  };
}

function normalizeImageFetchResponse(value: unknown): NormalizedResult<ResearchImageFetchResponse> {
  const warnings: ResearchWebNormalizationWarning[] = [];
  const record = normalizedRecord(value, warnings);
  const path = readString(record.path);
  const getUrl = readString(record.get_url);
  if (!path || !getUrl) throw new Error("anna.web.image_fetch returned no APS artifact reference");
  return {
    value: {
      path,
      get_url: getUrl,
      mime_type: readString(record.mime_type),
      bytes_size: readFiniteNumber(record.bytes_size) ?? 0,
      sha256: readString(record.sha256),
      source_url: readString(record.source_url),
      final_url: readString(record.final_url),
      ...(readFiniteNumber(record.quota_consumed) !== undefined ? { quota_consumed: readFiniteNumber(record.quota_consumed) } : {}),
    },
    warnings,
  };
}

export interface ResearchWebClient {
  search(input: { query: string; max_results?: number }, context: ResearchWebCallContext): Promise<ResearchWebSearchResponse>;
  fetch(input: { urls: string[]; max_chars?: number }, context: ResearchWebCallContext): Promise<ResearchWebFetchResponse>;
  imageSearch(input: { query: string; max_results?: number; min_width?: number; min_height?: number; aspect?: "any" | "wide" | "tall" | "square" }, context: ResearchWebCallContext): Promise<ResearchImageSearchResponse>;
  imageFetch(input: { url: string; max_bytes?: number; purpose?: string }, context: ResearchWebCallContext): Promise<ResearchImageFetchResponse>;
}

type ResearchWebMethod = "search" | "fetch" | "image_search" | "image_fetch";

function randomDiagnosticPart() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 14);
}

export function createResearchWebOperationId() {
  return `research-web-${Date.now().toString(36)}-${randomDiagnosticPart()}`;
}

function createInteractionId(method: ResearchWebMethod) {
  return `research-web-${method}-interaction-${Date.now().toString(36)}-${randomDiagnosticPart()}`;
}

function diagnosticSnapshot(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return String(value);
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (depth >= 20) return "[MaxDepth]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => diagnosticSnapshot(item, seen, depth + 1));
    if (value instanceof Date) return value.toISOString();
    const snapshot: Record<string, unknown> = {};
    const keys = new Set(Object.keys(value));
    if (value instanceof Error) {
      keys.add("name");
      keys.add("message");
      keys.add("stack");
      keys.add("cause");
      keys.add("code");
      keys.add("status");
      keys.add("statusCode");
      keys.add("data");
      keys.add("response");
      keys.add("errors");
    }
    for (const key of keys) {
      try {
        snapshot[key] = diagnosticSnapshot((value as Record<string, unknown>)[key], seen, depth + 1);
      } catch (error) {
        snapshot[key] = `[Unserializable: ${error instanceof Error ? error.message : String(error)}]`;
      }
    }
    return snapshot;
  } finally {
    seen.delete(value);
  }
}

function shortHash(value: unknown) {
  const text = JSON.stringify(diagnosticSnapshot(value)) ?? "undefined";
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function collectSerializationWarnings(
  value: unknown,
  path: string,
  warnings: Array<{ code: string; path: string }>,
) {
  if (value === "[Circular]") warnings.push({ code: "circular_reference_replaced", path });
  else if (value === "[MaxDepth]") warnings.push({ code: "max_depth_replaced", path });
  else if (typeof value === "string" && value.startsWith("[Unserializable: ")) {
    warnings.push({ code: "unserializable_value_replaced", path });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectSerializationWarnings(item, `${path}[${index}]`, warnings));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectSerializationWarnings(child, `${path}.${key}`, warnings);
    }
  }
}

function snapshotForLog(value: unknown, path: string) {
  const snapshot = diagnosticSnapshot(value);
  const warnings: Array<{ code: string; path: string }> = [];
  collectSerializationWarnings(snapshot, path, warnings);
  return { snapshot, warnings };
}

function serializationWarningFields(warnings: Array<{ code: string; path: string }>) {
  return warnings.length > 0 ? { serialization_warnings: warnings } : {};
}

function responseSummary(method: ResearchWebMethod, response: unknown, input: unknown) {
  if (method === "search") {
    const value = response as ResearchWebSearchResponse;
    return { result_count: value.results.length, provider_tier: value.provider_tier, quota_consumed: value.quota_consumed };
  }
  if (method === "fetch") {
    const value = response as ResearchWebFetchResponse;
    const pages = value.pages;
    return {
      requested_url_count: isRecord(input) && Array.isArray(input.urls) ? input.urls.length : 0,
      page_count: pages.length,
      succeeded_page_count: pages.filter((page) => page.ok).length,
      failed_page_count: pages.filter((page) => !page.ok).length,
      truncated_page_count: pages.filter((page) => page.truncated === true).length,
      quota_consumed: value.quota_consumed,
    };
  }
  if (method === "image_search") {
    const value = response as ResearchImageSearchResponse;
    return { result_count: value.results.length, cached: value.cached, quota_consumed: value.quota_consumed };
  }
  const value = response as ResearchImageFetchResponse;
  return { path: value.path, mime_type: value.mime_type, bytes_size: value.bytes_size, sha256: value.sha256, quota_consumed: value.quota_consumed };
}

export function createResearchWebClient(runtime: AnnaRuntime, options: ResearchWebClientOptions): ResearchWebClient {
  if (!runtime.web) throw new Error("Anna Runtime does not expose the official web namespace.");
  const web = runtime.web;

  async function appendLog(
    context: ResearchWebCallContext,
    entry: Record<string, unknown>,
    payloadKeys: string[],
  ) {
    try {
      await options.appendWorkspaceLog({
        workspace_dir: context.workspace_dir,
        channel: "research-web-interactions",
        entry,
        payload_keys: payloadKeys,
      });
    } catch (error) {
      console.warn("[research-web-log] Failed to append interaction log", {
        operation_id: context.operation_id,
        interaction_id: context.interaction_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function invoke<T>(input: {
    method: ResearchWebMethod;
    callerInput: unknown;
    runtimeRequest: unknown;
    runtimeOptions?: unknown;
    context: ResearchWebCallContext;
    call: () => Promise<unknown>;
    normalize: (value: unknown) => NormalizedResult<T>;
  }): Promise<T> {
    const interactionId = input.context.interaction_id ?? createInteractionId(input.method);
    input.context.interaction_id = interactionId;
    const startedAt = new Date().toISOString();
    const base = {
      schema_version: 1,
      operation_id: input.context.operation_id,
      interaction_id: interactionId,
      method: input.method,
      provider: "anna",
      runtime_mode: "anna",
    };
    const callerInputSnapshot = snapshotForLog(input.callerInput, "$.input");
    const runtimeRequestSnapshot = snapshotForLog(input.runtimeRequest, "$.runtime_request");
    const runtimeOptionsSnapshot = snapshotForLog(input.runtimeOptions, "$.runtime_options");
    await appendLog(input.context, {
      event: "research.web.interaction.started",
      ...base,
      status: "started",
      started_at: startedAt,
      input: callerInputSnapshot.snapshot,
      runtime_request: runtimeRequestSnapshot.snapshot,
      runtime_options: runtimeOptionsSnapshot.snapshot,
      ...serializationWarningFields([
        ...callerInputSnapshot.warnings,
        ...runtimeRequestSnapshot.warnings,
        ...runtimeOptionsSnapshot.warnings,
      ]),
    }, ["input", "runtime_request", "runtime_options"]);

    let rawResponse: unknown;
    const performanceSpan = beginPerformanceSpan({
      operationName: input.method === "image_search" ? "image.search" : input.method === "image_fetch" ? "image.fetch" : `web.${input.method}`,
      workspaceId: input.context.workspace_dir.split(/[\\/]/).filter(Boolean).at(-1),
      attributes: { layer: "anna-web" },
    });
    try {
      rawResponse = await input.call();
      performanceSpan?.finish("ok");
    } catch (error) {
      performanceSpan?.finish("error");
      const endedAt = new Date().toISOString();
      const errorSnapshot = snapshotForLog(error, "$.error");
      await appendLog(input.context, {
        event: "research.web.interaction.finished",
        ...base,
        status: "failed",
        failure_phase: "invoke",
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)),
        error: errorSnapshot.snapshot,
        ...serializationWarningFields(errorSnapshot.warnings),
      }, ["error"]);
      throw error;
    }

    let normalized: NormalizedResult<T>;
    try {
      normalized = input.normalize(rawResponse);
    } catch (error) {
      const endedAt = new Date().toISOString();
      const rawResponseSnapshot = snapshotForLog(rawResponse, "$.raw_response");
      const errorSnapshot = snapshotForLog(error, "$.error");
      await appendLog(input.context, {
        event: "research.web.interaction.finished",
        ...base,
        status: "failed",
        failure_phase: "normalize",
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)),
        raw_response: rawResponseSnapshot.snapshot,
        raw_response_hash: shortHash(rawResponse),
        error: errorSnapshot.snapshot,
        ...serializationWarningFields([...rawResponseSnapshot.warnings, ...errorSnapshot.warnings]),
      }, ["raw_response", "error"]);
      throw error;
    }

    const endedAt = new Date().toISOString();
    const rawResponseSnapshot = snapshotForLog(rawResponse, "$.raw_response");
    const normalizedResponseSnapshot = snapshotForLog(normalized.value, "$.normalized_response");
    await appendLog(input.context, {
      event: "research.web.interaction.finished",
      ...base,
      status: "succeeded",
      started_at: startedAt,
      ended_at: endedAt,
      duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)),
      raw_response: rawResponseSnapshot.snapshot,
      normalized_response: normalizedResponseSnapshot.snapshot,
      raw_response_hash: shortHash(rawResponse),
      normalized_response_hash: shortHash(normalized.value),
      normalization_warnings: normalized.warnings,
      summary: responseSummary(input.method, normalized.value, input.callerInput),
      ...serializationWarningFields([...rawResponseSnapshot.warnings, ...normalizedResponseSnapshot.warnings]),
    }, ["raw_response", "normalized_response"]);
    return normalized.value;
  }

  return {
    async search(input, context) {
      const runtimeRequest = {
        query: input.query,
        max_results: input.max_results,
        search_depth: "basic",
        topic: "general",
      } as const;
      return invoke({ method: "search", callerInput: input, runtimeRequest, context, call: () => web.search(runtimeRequest), normalize: normalizeSearchResponse });
    },
    async fetch(input, context) {
      const runtimeRequest = {
        urls: input.urls,
        format: "markdown",
        max_chars: input.max_chars ?? 8000,
        timeout_ms: 30000,
      } as const;
      const runtimeOptions = { timeoutMs: 90000 };
      return invoke({ method: "fetch", callerInput: input, runtimeRequest, runtimeOptions, context, call: () => web.fetch(runtimeRequest, runtimeOptions), normalize: normalizeFetchResponse });
    },
    async imageSearch(input, context) {
      const runtimeRequest = {
        query: input.query,
        max_results: input.max_results ?? 6,
        min_width: input.min_width ?? 800,
        min_height: input.min_height ?? 600,
        aspect: input.aspect ?? "any",
      } as const;
      return invoke({ method: "image_search", callerInput: input, runtimeRequest, context, call: () => web.image_search(runtimeRequest), normalize: normalizeImageSearchResponse });
    },
    async imageFetch(input, context) {
      const runtimeRequest = {
        url: input.url,
        max_bytes: input.max_bytes ?? 20 * 1024 * 1024,
        purpose: input.purpose ?? "ppt-research",
      };
      const runtimeOptions = { timeoutMs: 90000 };
      return invoke({ method: "image_fetch", callerInput: input, runtimeRequest, runtimeOptions, context, call: () => web.image_fetch(runtimeRequest, runtimeOptions), normalize: normalizeImageFetchResponse });
    },
  };
}
