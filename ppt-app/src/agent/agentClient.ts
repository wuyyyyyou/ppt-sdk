import type { AnnaAgentSession, AnnaRuntime } from "../runtime/annaRuntime";
import {
  buildStructuredJsonRepairPrompt,
  parseStructuredJson,
} from "../ai/structuredJson";

const AGENT_RUN_TIMEOUT_MS = 600_000;
const MAX_AGENT_SESSION_RETRIES = 1;
const DEFAULT_AGENT_SESSION_EXPIRES_IN_SECONDS = 600;
const AGENT_SESSION_RENEW_MARGIN_MS = 60_000;

export interface AgentRunSummary {
  status: "ready_for_render" | "blocked";
  changed_files: string[];
  summary: string;
  needs_render: boolean;
  notes: string[];
  raw_text?: string;
  parsed_json?: boolean;
  session_retries?: number;
}

export interface AgentSelfReviewResult {
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
}

export interface AgentClient {
  runAuthoringPrompt(prompt: string, options?: AgentRunOptions): Promise<AgentRunSummary>;
  runSelfReviewPrompt(prompt: string, options?: AgentRunOptions): Promise<AgentSelfReviewResult>;
  close(): Promise<void>;
}

export type AgentStreamEvent =
  | { type: "content"; text: string }
  | { type: "activity"; message: string; tool?: string; path?: string; size?: number }
  | { type: "error"; message: string; code?: string; expired?: boolean }
  | { type: "complete"; usage?: unknown };

export interface AgentRunOptions {
  onStreamEvent?: (event: AgentStreamEvent) => void;
}

interface CollectedAgentRun {
  text: string;
  events: AgentStreamEvent[];
}

class AgentRunStreamError extends Error {
  constructor(
    message: string,
    public readonly expired = false,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AgentRunStreamError";
  }
}

export class AgentInfrastructureError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly activeSessionLimit = false
  ) {
    super(message);
    this.name = "AgentInfrastructureError";
  }
}

export function isAgentInfrastructureError(error: unknown): error is AgentInfrastructureError {
  return error instanceof AgentInfrastructureError;
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

function fallbackRunSummary(text: string, sessionRetries: number): AgentRunSummary {
  return {
    status: "ready_for_render",
    changed_files: [],
    summary: text.trim().slice(0, 500),
    needs_render: true,
    notes: [],
    raw_text: text,
    parsed_json: false,
    session_retries: sessionRetries,
  };
}

function normalizeSelfReview(value: unknown): AgentSelfReviewResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<AgentSelfReviewResult>)
    : {};

  return {
    pass: record.pass === true,
    score: typeof record.score === "number" ? record.score : 0,
    issues: Array.isArray(record.issues)
      ? record.issues
          .filter((item): item is AgentSelfReviewResult["issues"][number] =>
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
    events.push({
      type: "error",
      code: readString(frame.code) || undefined,
      message,
      expired: /expired|APP_NOT_GRANTED|invalid app_session_token/i.test(message),
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
  options: AgentRunOptions | undefined
): Promise<CollectedAgentRun> {
  let output = "";
  const events: AgentStreamEvent[] = [];

  const stream = session.run({ content });
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
        throw new AgentRunStreamError(event.message, event.expired, event.code);
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

function toAgentInfrastructureError(error: unknown, fallbackMessage: string) {
  if (error instanceof AgentInfrastructureError) return error;
  const rawMessage = toErrorMessage(error) || fallbackMessage;
  const activeSessionLimit = isActiveSessionLimitMessage(rawMessage);
  const message = activeSessionLimit
    ? `${rawMessage} 请先 delete/revoke 旧 Agent session，或等待服务端释放后重试。`
    : rawMessage;
  return new AgentInfrastructureError(
    message,
    error instanceof AgentRunStreamError ? error.code : undefined,
    activeSessionLimit
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
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Agent run timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function createAgentClient(runtime: AnnaRuntime): Promise<AgentClient> {
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
    options: AgentRunOptions | undefined
  ): Promise<CollectedAgentRun & { sessionRetries: number }> {
    let sessionRetries = 0;

    for (;;) {
      let sessionMeta: Awaited<ReturnType<typeof createSession>> | null = null;
      try {
        sessionMeta = await createSession();
        if (shouldRenewBeforeRun(sessionMeta)) {
          options?.onStreamEvent?.({
            type: "activity",
            message: "Agent session near expiry; creating a new session",
          });
          await deleteSession(sessionMeta.session);
          sessionMeta = await createSession();
        }
        const collected = await withTimeout(
          collectRunText(sessionMeta.session, prompt, options),
          AGENT_RUN_TIMEOUT_MS
        );
        return { ...collected, sessionRetries };
      } catch (error) {
        if (
          error instanceof AgentRunStreamError &&
          error.expired &&
          sessionRetries < MAX_AGENT_SESSION_RETRIES
        ) {
          sessionRetries += 1;
          options?.onStreamEvent?.({
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
        };
      } catch {
        return fallbackRunSummary(collected.text, collected.sessionRetries);
      }
    },

    async runSelfReviewPrompt(prompt, options) {
      const collected = await collectWithSessionRetry(prompt, options);
      try {
        return normalizeSelfReview(parseJsonObject(collected.text, "self-review"));
      } catch (error) {
        const repairPrompt = buildStructuredJsonRepairPrompt(
          collected.text,
          '{"pass":true,"score":8,"issues":[],"revision_request":"","confidence":"medium"}',
          error instanceof Error ? error.message : String(error)
        );
        const repaired = await collectWithSessionRetry(repairPrompt, options);
        return normalizeSelfReview(parseJsonObject(repaired.text, "self-review"));
      }
    },

    async close() {
      // Sessions are run-scoped and deleted after each run.
    },
  };
}
