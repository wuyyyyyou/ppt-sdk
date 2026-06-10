import type { AnnaAgentSession, AnnaRuntime } from "../runtime/annaRuntime";
import {
  buildStructuredJsonRepairPrompt,
  parseStructuredJson,
} from "../ai/structuredJson";
import type { AiOperationLogContext } from "../ai/interactionLog";
import {
  isAgentSessionCacheMissMessage,
  nextAgentSessionCacheMissRetry,
  shouldReportAgentSessionCacheMissRetry,
  type AgentSessionCacheMissRetryConfig,
  type AgentSessionCacheMissRetryState,
} from "./agentSessionRetry";
import {
  guardStreamLiveness,
  isStreamCancelledError,
  isStreamIdleTimeoutError,
} from "./streamLivenessGuard";

const AGENT_RUN_TIMEOUT_MS = 600_000;
const AGENT_STREAM_IDLE_TIMEOUT_MS = 180_000;
const MAX_AGENT_SESSION_RETRIES = 1;
const MAX_AGENT_STREAM_IDLE_RETRIES = 1;
const DEFAULT_AGENT_SESSION_EXPIRES_IN_SECONDS = 600;
const AGENT_SESSION_RENEW_MARGIN_MS = 60_000;
const AGENT_SESSION_CACHE_MISS_EXHAUSTED_MESSAGE =
  "Agent session failed after retrying. Please retry this page.";

export interface AgentRunSummary {
  status: "ready_for_render" | "blocked";
  changed_files: string[];
  summary: string;
  needs_render: boolean;
  notes: string[];
  raw_text?: string;
  parsed_json?: boolean;
  session_retries?: number;
  session_cache_miss_retries?: number;
}

export interface AgentPageVisualReviewResult {
  pass: boolean;
  score: number;
  issues: Array<{
    severity?: string;
    area?: string;
    problem: string;
    fix_hint?: string;
  }>;
  revision_request: string;
  confidence: "low" | "medium" | "high";
  session_cache_miss_retries?: number;
}

export interface AgentPageContentReviewResult {
  pass: boolean;
  score: number;
  issues: Array<{
    type: "language" | "outline_alignment" | "grounding" | "placeholder_quality";
    severity?: string;
    evidence: string;
    reason: string;
    fix_hint?: string;
  }>;
  rewrite_request: string;
  confidence: "low" | "medium" | "high";
}

export interface AgentClient {
  runAuthoringPrompt(prompt: string, options?: AgentRunOptions): Promise<AgentRunSummary>;
  runPageVisualReviewPrompt(prompt: string, options?: AgentRunOptions): Promise<AgentPageVisualReviewResult>;
  runPageContentReviewPrompt(prompt: string, options?: AgentRunOptions): Promise<AgentPageContentReviewResult>;
  close(): Promise<void>;
}

export type AgentStreamEvent =
  | { type: "content"; text: string }
  | { type: "activity"; message: string; tool?: string; path?: string; size?: number }
  | { type: "error"; message: string; code?: string; expired?: boolean; sessionCacheMiss?: boolean }
  | { type: "complete"; usage?: unknown };

export interface AgentRunOptions {
  onStreamEvent?: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  logContext?: AiOperationLogContext;
}

export interface AgentClientOptions {
  cacheMissRetryConfig?: Partial<AgentSessionCacheMissRetryConfig>;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
  streamIdleTimeoutMs?: number;
}

interface CollectedAgentRun {
  text: string;
  events: AgentStreamEvent[];
}

class AgentRunStreamError extends Error {
  constructor(
    message: string,
    public readonly expired = false,
    public readonly code?: string,
    public readonly sessionCacheMiss = false,
  ) {
    super(message);
    this.name = "AgentRunStreamError";
  }
}

export class AgentInfrastructureError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly activeSessionLimit = false,
    public readonly sessionCacheMiss = false,
    public readonly sessionCacheMissRetries = 0,
    public readonly rawMessage?: string,
  ) {
    super(message);
    this.name = "AgentInfrastructureError";
  }
}

export function isAgentInfrastructureError(error: unknown): error is AgentInfrastructureError {
  return error instanceof AgentInfrastructureError;
}

export class AgentRunCancelledError extends Error {
  constructor() {
    super("Agent run cancelled");
    this.name = "AgentRunCancelledError";
  }
}

export function isAgentRunCancelledError(error: unknown): error is AgentRunCancelledError {
  return error instanceof AgentRunCancelledError;
}

function parseJsonObject<T>(text: string, label: string): T {
  try {
    return parseStructuredJson<T>(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse Agent ${label} JSON: ${message}`);
  }
}

function normalizeRunSummary(value: unknown): AgentRunSummary {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<AgentRunSummary>)
    : {};
  const status = record.status === "blocked" ? "blocked" : "ready_for_render";

  return {
    status,
    changed_files: Array.isArray(record.changed_files)
      ? record.changed_files.filter((item): item is string => typeof item === "string")
      : [],
    summary: typeof record.summary === "string" ? record.summary : "",
    needs_render:
      typeof record.needs_render === "boolean" ? record.needs_render : status !== "blocked",
    notes: Array.isArray(record.notes)
      ? record.notes.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function fallbackRunSummary(
  text: string,
  sessionRetries: number,
  sessionCacheMissRetries: number,
): AgentRunSummary {
  return {
    status: "ready_for_render",
    changed_files: [],
    summary: text.trim().slice(0, 500),
    needs_render: true,
    notes: [],
    raw_text: text,
    parsed_json: false,
    session_retries: sessionRetries,
    session_cache_miss_retries: sessionCacheMissRetries,
  };
}

function normalizePageVisualReview(value: unknown): AgentPageVisualReviewResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<AgentPageVisualReviewResult>)
    : {};

  return {
    pass: record.pass === true,
    score: typeof record.score === "number" ? record.score : 0,
    issues: Array.isArray(record.issues)
      ? record.issues
          .filter((item): item is AgentPageVisualReviewResult["issues"][number] =>
            Boolean(item) &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            typeof (item as { problem?: unknown }).problem === "string"
          )
      : [],
    revision_request:
      typeof record.revision_request === "string" ? record.revision_request : "",
    confidence:
      record.confidence === "high" || record.confidence === "low"
        ? record.confidence
        : "medium",
  };
}

function normalizePageContentReview(value: unknown): AgentPageContentReviewResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<AgentPageContentReviewResult>)
    : {};

  return {
    pass: record.pass === true,
    score: typeof record.score === "number" ? record.score : 0,
    issues: Array.isArray(record.issues)
      ? record.issues
          .filter((item): item is AgentPageContentReviewResult["issues"][number] => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return false;
            const issue = item as { type?: unknown; evidence?: unknown; reason?: unknown };
            return (
              (issue.type === "language" ||
                issue.type === "outline_alignment" ||
                issue.type === "grounding" ||
                issue.type === "placeholder_quality") &&
              typeof issue.evidence === "string" &&
              typeof issue.reason === "string"
            );
          })
      : [],
    rewrite_request:
      typeof record.rewrite_request === "string" ? record.rewrite_request : "",
    confidence:
      record.confidence === "high" || record.confidence === "low"
        ? record.confidence
        : "medium",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractFrameText(frame: unknown): string {
  if (!isRecord(frame)) return "";
  const record = frame;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (typeof record.delta === "string") return record.delta;

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const fromChoices = choices
    .map((choice) => {
      if (!isRecord(choice)) return "";
      const delta = isRecord(choice.delta) ? choice.delta : {};
      const message = isRecord(choice.message) ? choice.message : {};
      return [
        readString(delta.content),
        readString(delta.text),
        readString(message.content),
      ].join("");
    })
    .join("");
  if (fromChoices) return fromChoices;

  const payload = record.payload;
  if (isRecord(payload)) {
    return extractFrameText(payload);
  }

  return "";
}

function parseToolOutputPath(output: unknown): { path?: string; size?: number } {
  const raw = typeof output === "string" ? output : "";
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const data = isRecord(parsed.data) ? parsed.data : {};
    return {
      path: readString(data.path) || undefined,
      size: typeof data.size === "number" ? data.size : undefined,
    };
  } catch {
    return {};
  }
}

function getPathFromInput(input: unknown): string | undefined {
  return isRecord(input) ? readString(input.path) || undefined : undefined;
}

function extractFrameEvents(frame: unknown): AgentStreamEvent[] {
  if (!isRecord(frame)) return [];
  const events: AgentStreamEvent[] = [];

  if (frame.event === "error") {
    const message = readString(frame.message) || "Agent stream error.";
    const sessionCacheMiss = isAgentSessionCacheMissMessage(message);
    events.push({
      type: "error",
      code: readString(frame.code) || undefined,
      message,
      expired: /expired|APP_NOT_GRANTED|invalid app_session_token/i.test(message),
      sessionCacheMiss,
    });
    return events;
  }

  const text = extractFrameText(frame);
  if (text && !(frame.event === "raw" && text === "[DONE]")) {
    events.push({ type: "content", text });
  }

  const choices = Array.isArray(frame.choices) ? frame.choices : [];
  for (const choice of choices) {
    if (!isRecord(choice)) continue;
    const delta = isRecord(choice.delta) ? choice.delta : {};

    if (isRecord(delta.tool_start)) {
      const toolStart = delta.tool_start;
      const toolName = readString(toolStart.name) || "tool";
      const filePath = getPathFromInput(toolStart.input);
      events.push({
        type: "activity",
        tool: toolName,
        path: filePath,
        message: filePath ? `${toolName} ${filePath}` : `${toolName} started`,
      });
    }

    if (isRecord(delta.tool_end)) {
      const toolEnd = delta.tool_end;
      const toolName = readString(toolEnd.name) || "tool";
      const parsedOutput = parseToolOutputPath(toolEnd.output);
      events.push({
        type: "activity",
        tool: toolName,
        path: parsedOutput.path,
        size: parsedOutput.size,
        message: parsedOutput.path
          ? `${toolName} ${parsedOutput.path}`
          : `${toolName} completed`,
      });
    }

    if (isRecord(delta.task_complete)) {
      events.push({
        type: "complete",
        usage: delta.task_complete.token_usage,
      });
    }
  }

  return events;
}

async function collectRunText(
  session: AnnaAgentSession,
  content: string,
  options: AgentRunOptions | undefined,
  clientOptions: AgentClientOptions,
): Promise<CollectedAgentRun> {
  let output = "";
  const events: AgentStreamEvent[] = [];

  const stream = guardStreamLiveness(session.run({ content }), {
    idleMs: clientOptions.streamIdleTimeoutMs ?? AGENT_STREAM_IDLE_TIMEOUT_MS,
    signal: options?.signal,
    isCancelled: options?.isCancelled,
  });
  for await (const frame of stream) {
    if (frame.event === "complete") {
      break;
    }

    const frameEvents = extractFrameEvents(frame);
    for (const event of frameEvents) {
      events.push(event);
      options?.onStreamEvent?.(event);
      if (event.type === "content") {
        output += event.text;
      } else if (event.type === "error") {
        throw new AgentRunStreamError(
          event.message,
          event.expired,
          event.code,
          event.sessionCacheMiss === true,
        );
      }
    }
  }

  return { text: output, events };
}

function isActiveSessionLimitMessage(message: string) {
  return /active session|活跃 session|session 上限|HTTP 429|session\.mint failed/i.test(message);
}

function isInfrastructureMessage(message: string) {
  return /APP_NOT_GRANTED|invalid app_session_token|session\.mint|agent\.session|transport|HTTP 401|HTTP 429/i.test(message);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toAgentInfrastructureError(
  error: unknown,
  fallbackMessage: string,
  options: {
    sessionCacheMiss?: boolean;
    sessionCacheMissRetries?: number;
    rawMessage?: string;
  } = {},
) {
  if (error instanceof AgentInfrastructureError) return error;
  const rawMessage = toErrorMessage(error) || fallbackMessage;
  const activeSessionLimit = isActiveSessionLimitMessage(rawMessage);
  const message = options.sessionCacheMiss
    ? AGENT_SESSION_CACHE_MISS_EXHAUSTED_MESSAGE
    : activeSessionLimit
    ? `${rawMessage} 请先 delete/revoke 旧 Agent session，或等待服务端释放后重试。`
    : rawMessage;
  return new AgentInfrastructureError(
    message,
    error instanceof AgentRunStreamError
      ? error.code
      : isStreamIdleTimeoutError(error)
        ? "idle_timeout"
        : undefined,
    activeSessionLimit,
    options.sessionCacheMiss === true,
    options.sessionCacheMissRetries ?? 0,
    options.rawMessage,
  );
}

function readSessionExpiresInSeconds(session: AnnaAgentSession): number {
  const value = typeof session.expires_in === "number"
    ? session.expires_in
    : typeof session.expiresIn === "number"
      ? session.expiresIn
      : DEFAULT_AGENT_SESSION_EXPIRES_IN_SECONDS;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AGENT_SESSION_EXPIRES_IN_SECONDS;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Agent run timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function formatCacheMissRetryMessage(retryNumber: number, delayMs: number) {
  const delaySeconds = Math.max(1, Math.round(delayMs / 1000));
  return `Agent session cache miss; retry ${retryNumber} after ${delaySeconds}s`;
}

function formatIdleRetryMessage() {
  return "Agent unresponsive; rebuilding session and retrying";
}

function readCompletionUsage(events: AgentStreamEvent[]): unknown {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "complete") {
      return event.usage;
    }
  }
  return undefined;
}

async function readSessionHistory(session: AnnaAgentSession | null): Promise<unknown> {
  if (typeof session?.history !== "function") return undefined;
  try {
    return await session.history();
  } catch {
    return undefined;
  }
}

export async function createAgentClient(
  runtime: AnnaRuntime,
  clientOptions: AgentClientOptions = {},
): Promise<AgentClient> {
  const wait = clientOptions.wait ?? defaultWait;
  async function createSession() {
    try {
      const session = await runtime.agent.session({ submode: "auto" });
      return {
        session,
        createdAtMs: Date.now(),
        expiresInSeconds: readSessionExpiresInSeconds(session),
      };
    } catch (error) {
      throw toAgentInfrastructureError(error, "Failed to create Agent session.");
    }
  }

  async function deleteSession(session: AnnaAgentSession | null) {
    await session?.delete().catch(() => undefined);
  }

  function shouldRenewBeforeRun(sessionMeta: { createdAtMs: number; expiresInSeconds: number }) {
    const expiresAtMs = sessionMeta.createdAtMs + sessionMeta.expiresInSeconds * 1000;
    return expiresAtMs - Date.now() <= AGENT_SESSION_RENEW_MARGIN_MS;
  }

  async function collectWithSessionRetry(
    prompt: string,
    runOptions: AgentRunOptions | undefined
  ): Promise<
    CollectedAgentRun & {
      sessionRetries: number;
      sessionCacheMissRetries: number;
    }
  > {
    let sessionRetries = 0;
    let streamIdleRetries = 0;
    const cacheMissRetryState: AgentSessionCacheMissRetryState = {
      retries: 0,
      totalWaitMs: 0,
    };

    for (;;) {
      let sessionMeta: Awaited<ReturnType<typeof createSession>> | null = null;
      const interactionHandle = runOptions?.logContext?.logger
        ? await runOptions.logContext.logger.startInteraction(runOptions.logContext, {
            prompt,
            extra: {
              session_retries: sessionRetries,
              session_cache_miss_retries: cacheMissRetryState.retries,
              stream_idle_retries: streamIdleRetries,
            },
          })
        : null;
      try {
        sessionMeta = await createSession();
        if (shouldRenewBeforeRun(sessionMeta)) {
          runOptions?.onStreamEvent?.({
            type: "activity",
            message: "Agent session near expiry; creating a new session",
          });
          await deleteSession(sessionMeta.session);
          sessionMeta = await createSession();
        }
        const collected = await withTimeout(
          collectRunText(sessionMeta.session, prompt, runOptions, clientOptions),
          AGENT_RUN_TIMEOUT_MS
        );
        if (interactionHandle) {
          await runOptions?.logContext?.logger?.finishInteraction(interactionHandle, {
            status: "succeeded",
            output: collected.text,
            usage: readCompletionUsage(collected.events),
            session_history: await readSessionHistory(sessionMeta.session),
            extra: {
              events: collected.events,
              session_retries: sessionRetries,
              session_cache_miss_retries: cacheMissRetryState.retries,
              stream_idle_retries: streamIdleRetries,
            },
          });
        }
        if (cacheMissRetryState.retries > 0) {
          runOptions?.onStreamEvent?.({
            type: "activity",
            message: `Agent session recovered after ${cacheMissRetryState.retries} retries`,
          });
        }
        return {
          ...collected,
          sessionRetries,
          sessionCacheMissRetries: cacheMissRetryState.retries,
        };
      } catch (error) {
        if (interactionHandle) {
          await runOptions?.logContext?.logger?.finishInteraction(interactionHandle, {
            status: isStreamCancelledError(error) ? "cancelled" : "failed",
            error,
            session_history: await readSessionHistory(sessionMeta?.session ?? null),
            extra: {
              session_retries: sessionRetries,
              session_cache_miss_retries: cacheMissRetryState.retries,
              stream_idle_retries: streamIdleRetries,
            },
          });
        }
        if (isStreamCancelledError(error)) {
          throw new AgentRunCancelledError();
        }
        if (isStreamIdleTimeoutError(error)) {
          if (streamIdleRetries < MAX_AGENT_STREAM_IDLE_RETRIES) {
            streamIdleRetries += 1;
            runOptions?.onStreamEvent?.({
              type: "activity",
              message: formatIdleRetryMessage(),
            });
            continue;
          }
          throw toAgentInfrastructureError(error, "Agent stream idle timeout.", {
            rawMessage: error.message,
          });
        }
        if (error instanceof AgentRunStreamError && error.sessionCacheMiss) {
          const decision = nextAgentSessionCacheMissRetry({
            state: cacheMissRetryState,
            config: clientOptions.cacheMissRetryConfig,
            random: clientOptions.random,
          });
          if (decision.retry) {
            if (shouldReportAgentSessionCacheMissRetry(decision.retryNumber)) {
              runOptions?.onStreamEvent?.({
                type: "activity",
                message: formatCacheMissRetryMessage(
                  decision.retryNumber,
                  decision.delayMs,
                ),
              });
            }
            await wait(decision.delayMs);
            continue;
          }

          runOptions?.onStreamEvent?.({
            type: "activity",
            message: `Agent session cache miss retries exhausted after ${cacheMissRetryState.retries} retries`,
          });
          throw toAgentInfrastructureError(error, "Agent session failed.", {
            sessionCacheMiss: true,
            sessionCacheMissRetries: cacheMissRetryState.retries,
            rawMessage: error.message,
          });
        }
        if (
          error instanceof AgentRunStreamError &&
          error.expired &&
          sessionRetries < MAX_AGENT_SESSION_RETRIES
        ) {
          sessionRetries += 1;
          runOptions?.onStreamEvent?.({
            type: "activity",
            message: "Agent session expired; creating a new session",
          });
          continue;
        }
        if (
          error instanceof AgentRunStreamError &&
          (error.expired || error.code === "http" || isInfrastructureMessage(error.message))
        ) {
          throw toAgentInfrastructureError(error, "Agent session failed.");
        }
        if (error instanceof AgentInfrastructureError) {
          throw error;
        }
        throw error;
      } finally {
        await deleteSession(sessionMeta?.session ?? null);
      }
    }
  }

  return {
    async runAuthoringPrompt(prompt, options) {
      const collected = await collectWithSessionRetry(prompt, options);
      try {
        return {
          ...normalizeRunSummary(parseJsonObject(collected.text, "authoring summary")),
          raw_text: collected.text,
          parsed_json: true,
          session_retries: collected.sessionRetries,
          session_cache_miss_retries: collected.sessionCacheMissRetries,
        };
      } catch {
        return fallbackRunSummary(
          collected.text,
          collected.sessionRetries,
          collected.sessionCacheMissRetries,
        );
      }
    },

    async runPageVisualReviewPrompt(prompt, options) {
      const collected = await collectWithSessionRetry(prompt, options);
      try {
        return {
          ...normalizePageVisualReview(parseJsonObject(collected.text, "page visual review")),
          session_cache_miss_retries: collected.sessionCacheMissRetries,
        };
      } catch (error) {
        const repairPrompt = buildStructuredJsonRepairPrompt(
          collected.text,
          '{"pass":true,"score":8,"issues":[],"revision_request":"","confidence":"medium"}',
          error instanceof Error ? error.message : String(error)
        );
        const repaired = await collectWithSessionRetry(repairPrompt, options);
        return {
          ...normalizePageVisualReview(parseJsonObject(repaired.text, "page visual review")),
          session_cache_miss_retries:
            collected.sessionCacheMissRetries + repaired.sessionCacheMissRetries,
        };
      }
    },

    async runPageContentReviewPrompt(prompt, options) {
      const collected = await collectWithSessionRetry(prompt, options);
      try {
        return normalizePageContentReview(parseJsonObject(collected.text, "page content review"));
      } catch (error) {
        const repairPrompt = buildStructuredJsonRepairPrompt(
          collected.text,
          '{"pass":true,"score":8,"issues":[],"rewrite_request":"","confidence":"medium"}',
          error instanceof Error ? error.message : String(error)
        );
        const repaired = await collectWithSessionRetry(repairPrompt, options);
        return normalizePageContentReview(parseJsonObject(repaired.text, "page content review"));
      }
    },

    async close() {
      // Sessions are run-scoped and deleted after each run.
    },
  };
}
