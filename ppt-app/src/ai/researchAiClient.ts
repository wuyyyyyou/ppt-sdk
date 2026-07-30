import type { WorkspaceOutline } from "../api/types";
import type { ResearchWebFetchPage, ResearchWebSearchResult } from "../api/researchWebClient";
import type { Locale } from "../i18n/messages";
import type { AnnaLlmCompleteInput, AnnaRuntime } from "../runtime/annaRuntime";
import { beginPerformanceSpan } from "../performance/performanceRecorder";
import type { AiOperationLogContext } from "./interactionLog";
import { buildStructuredJsonRepairPrompt, parseStructuredJson } from "./structuredJson";

export interface ResearchNeedDecision {
  needs_search: boolean;
  queries: string[];
  rationale?: string;
}

export interface ResearchDecisionContext {
  brief: string;
  refinementRequest?: string;
  outline: WorkspaceOutline;
  styleGuide: string;
  webSummary: string;
  imageCatalog: unknown;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface ResearchSearchResultForSelection extends ResearchWebSearchResult {
  result_id: string;
}

export interface ResearchAiClient {
  decideWebResearch(input: ResearchDecisionContext): Promise<ResearchNeedDecision>;
  selectWebFetchResults(input: ResearchDecisionContext & {
    results: ResearchSearchResultForSelection[];
  }): Promise<string[]>;
  summarizeWebResearch(input: ResearchDecisionContext & {
    searchResults: ResearchSearchResultForSelection[];
    fetchedPages: ResearchWebFetchPage[];
    gaps: string[];
  }): Promise<string>;
  decideImageResearch(input: ResearchDecisionContext): Promise<ResearchNeedDecision>;
}

interface CompletionResult {
  text?: string;
  output_text?: string;
  content?: unknown;
  message?: { content?: unknown };
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractContentText).join("");
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const record = content as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") return record.text;
  }
  return "";
}

function extractCompletionText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const result = value as CompletionResult;
  return result.output_text || result.text || extractContentText(result.content) || extractContentText(result.message?.content);
}

async function complete(
  runtime: AnnaRuntime,
  request: AnnaLlmCompleteInput,
  logContext?: AiOperationLogContext,
): Promise<string> {
  const handle = logContext?.logger
    ? await logContext.logger.startInteraction(logContext, { request })
    : null;
  const performanceSpan = beginPerformanceSpan({
    operationName: "ai.interaction",
    workspaceId: logContext?.workspace_dir.split(/[\\/]/).filter(Boolean).at(-1),
    attributes: { layer: "anna-research-llm" },
  });
  try {
    const result = typeof runtime.call === "function"
      ? await runtime.call("llm", "complete", request, { timeoutMs: 600_000 })
      : await runtime.llm.complete(request);
    const text = extractCompletionText(result);
    if (handle) {
      await logContext?.logger?.finishInteraction(handle, {
        status: "succeeded",
        response: result,
        output: text,
      });
    }
    performanceSpan?.finish("ok");
    return text;
  } catch (error) {
    performanceSpan?.finish("error");
    if (handle) await logContext?.logger?.finishInteraction(handle, { status: "failed", error });
    throw error;
  }
}

async function completeJson<T>(
  runtime: AnnaRuntime,
  prompt: string,
  expectedShape: string,
  logContext?: AiOperationLogContext,
): Promise<T> {
  let request: AnnaLlmCompleteInput = {
    messages: [{ role: "user", content: { type: "text", text: prompt } }],
  };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const rawText = await complete(runtime, request, logContext);
    try {
      return parseStructuredJson<T>(rawText);
    } catch (error) {
      if (attempt === 2) throw error;
      request = {
        messages: [
          ...request.messages,
          { role: "assistant", content: { type: "text", text: rawText } },
          {
            role: "user",
            content: {
              type: "text",
              text: buildStructuredJsonRepairPrompt(
                rawText,
                expectedShape,
                error instanceof Error ? error.message : String(error),
              ),
            },
          },
        ],
      };
    }
  }
  throw new Error("Research LLM returned invalid JSON.");
}

function normalizeDecision(value: unknown): ResearchNeedDecision {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawQueries = Array.isArray(record.queries)
    ? record.queries.filter((item): item is string => typeof item === "string")
        .map((item) => item.trim()).filter(Boolean)
    : [];
  const seenQueries = new Set<string>();
  const queries = rawQueries.filter((query) => {
    const key = query.toLocaleLowerCase();
    if (seenQueries.has(key)) return false;
    seenQueries.add(key);
    return true;
  }).slice(0, 6);
  return {
    needs_search: record.needs_search === true,
    queries,
    ...(typeof record.rationale === "string" && record.rationale.trim()
      ? { rationale: record.rationale.trim() }
      : {}),
  };
}

function commonContext(input: ResearchDecisionContext, options: { includeImageCatalog?: boolean } = {}) {
  return [
    `Output locale: ${input.locale}`,
    `User brief:\n${input.brief || "(empty)"}`,
    `Current refinement request:\n${input.refinementRequest?.trim() || "(none; initial deck generation)"}`,
    `Confirmed Outline:\n${JSON.stringify(input.outline, null, 2)}`,
    `Workspace Style Guide:\n${input.styleGuide}`,
    `Complete existing web-summary.md:\n${input.webSummary || "(empty)"}`,
    options.includeImageCatalog
      ? `Reusable local image assets from image-catalog.json:\n${JSON.stringify(input.imageCatalog, null, 2)}`
      : "",
  ].filter(Boolean).join("\n\n");
}

export function createResearchAiClient(runtime: AnnaRuntime): ResearchAiClient {
  return {
    async decideWebResearch(input) {
      const result = await completeJson<unknown>(runtime, [
        "You decide whether this PPT generation or refinement needs NEW web research.",
        "Use the complete user intent, outline, style guide, and existing research below.",
        "Existing research may be reused. Request new research only when it would materially improve factual grounding, current information, public data, named examples, or unresolved conflicts.",
        "If new research is needed, return up to 6 focused web search queries. Use the source language most likely to produce the best evidence; do not force English or duplicate queries bilingually.",
        "Return exactly one JSON object. needs_search must be boolean. queries must be an array of strings.",
        '{"needs_search":true,"queries":["query"],"rationale":"short reason"}',
        commonContext(input),
      ].join("\n\n"), '{"needs_search":true,"queries":["query"],"rationale":"short reason"}', input.logContext);
      return normalizeDecision(result);
    },

    async selectWebFetchResults(input) {
      const result = await completeJson<unknown>(runtime, [
        "Select which web search results should be fetched for this PPT.",
        "Return result IDs only. Select at most 10. Search snippets may already be useful, so an empty selection is valid.",
        "Do not return, copy, or rewrite URLs.",
        '{"fetch_result_ids":["web-q1-r1"]}',
        commonContext(input),
        `Search results:\n${JSON.stringify(input.results, null, 2)}`,
      ].join("\n\n"), '{"fetch_result_ids":["web-q1-r1"]}', input.logContext);
      const record = result && typeof result === "object" && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {};
      return Array.isArray(record.fetch_result_ids)
        ? record.fetch_result_ids.filter((item): item is string => typeof item === "string")
            .map((item) => item.trim()).filter(Boolean).slice(0, 10)
        : [];
    },

    async summarizeWebResearch(input) {
      const markdown = (await complete(runtime, {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              "Create the NEW web research summary batch for this PPT.",
              "Return Markdown only, without a top-level batch heading, status line, URLs, source IDs, result IDs, or a sources list.",
              "Use both useful search snippets and successfully fetched page content. Be concise, preserve important qualifiers, and do not invent missing facts.",
              "Read the complete existing summary to avoid pointless repetition. If newer material conflicts with old material, clearly state the updated conclusion in this new batch.",
              "Include a `### 信息缺口` or `### Information gaps` section when material limitations affect what the PPT may assert.",
              commonContext(input),
              `Current search results:\n${JSON.stringify(input.searchResults, null, 2)}`,
              `Successfully fetched pages:\n${JSON.stringify(input.fetchedPages, null, 2)}`,
              `Collection gaps:\n${JSON.stringify(input.gaps, null, 2)}`,
            ].join("\n\n"),
          },
        }],
      }, input.logContext)).trim();
      if (!markdown) throw new Error("Web research summarization returned empty Markdown.");
      return markdown;
    },

    async decideImageResearch(input) {
      const result = await completeJson<unknown>(runtime, [
        "You decide whether this PPT generation or refinement needs NEW external image research.",
        "Use the complete user intent, outline, style guide, latest web summary, and existing image catalog below.",
        "Existing usable local images may be reused. Request new images only when they would materially improve the visual result.",
        "If needed, return up to 6 image search queries. Every query must be English, preferably 1-4 words, at most 6 words and 60 characters. Use keywords, not sentences or questions.",
        "Return exactly one JSON object. needs_search must be boolean. queries must be an array of strings.",
        '{"needs_search":true,"queries":["short english query"],"rationale":"short reason"}',
        commonContext(input, { includeImageCatalog: true }),
      ].join("\n\n"), '{"needs_search":true,"queries":["short english query"],"rationale":"short reason"}', input.logContext);
      return normalizeDecision(result);
    },
  };
}
