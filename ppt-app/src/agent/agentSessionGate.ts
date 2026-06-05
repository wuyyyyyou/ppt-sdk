import type { AnnaAgentSession } from "../runtime/annaRuntime";

export interface AgentSessionMeta {
  session: AnnaAgentSession;
  createdAtMs: number;
  expiresInSeconds: number;
}

export interface AgentSessionGateTimings {
  createCooldownMs: number;
  runWatchdogMs: number;
  deleteRetryDelaysMs: number[];
  maxSessionRetries: number;
  maxSameUuidGuardRetries: number;
}

export interface AgentSessionGateClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RunManagedAgentSessionInput<T> {
  createSession(): Promise<AgentSessionMeta>;
  deleteSession(session: AnnaAgentSession): Promise<void>;
  runSession(sessionMeta: AgentSessionMeta): Promise<T>;
  isRecoverableRunError(error: unknown): boolean;
  onActivity?: (message: string) => void;
  timings?: Partial<AgentSessionGateTimings>;
  clock?: AgentSessionGateClock;
}

export interface RunManagedAgentSessionResult<T> {
  result: T;
  sessionRetries: number;
}

export class AgentSessionGateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AgentSessionGateError";
  }
}

export class AgentSessionWatchdogError extends AgentSessionGateError {
  constructor(timeoutMs: number) {
    super(
      `Agent session run exceeded local watchdog after ${timeoutMs}ms.`,
      "session_watchdog_timeout",
    );
    this.name = "AgentSessionWatchdogError";
  }
}

export function isAgentSessionGateError(error: unknown): error is AgentSessionGateError {
  return error instanceof AgentSessionGateError;
}

export const DEFAULT_AGENT_SESSION_GATE_TIMINGS: AgentSessionGateTimings = {
  createCooldownMs: 70_000,
  runWatchdogMs: 8.5 * 60 * 1000,
  deleteRetryDelaysMs: [1_000, 3_000, 8_000],
  maxSessionRetries: 3,
  maxSameUuidGuardRetries: 3,
};

let createGateTail: Promise<void> = Promise.resolve();
let lastCreateStartedAtMs: number | null = null;
let lastCreatedSessionUuid = "";

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function resolveTimings(
  value: Partial<AgentSessionGateTimings> | undefined,
): AgentSessionGateTimings {
  return {
    ...DEFAULT_AGENT_SESSION_GATE_TIMINGS,
    ...value,
    deleteRetryDelaysMs:
      value?.deleteRetryDelaysMs ?? DEFAULT_AGENT_SESSION_GATE_TIMINGS.deleteRetryDelaysMs,
  };
}

function resolveClock(clock: AgentSessionGateClock | undefined): AgentSessionGateClock {
  return clock ?? {
    now: () => Date.now(),
    sleep: defaultSleep,
  };
}

function sessionUuid(session: AnnaAgentSession): string {
  return typeof session.appSessionUuid === "string" ? session.appSessionUuid : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isIdempotentDeleteError(error: unknown): boolean {
  return /not found|already deleted|unknown session|SESSION_NOT_FOUND/i.test(
    errorMessage(error),
  );
}

function describeDelay(ms: number): string {
  return ms >= 1000 ? `${Math.ceil(ms / 1000)}s` : `${ms}ms`;
}

async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const previous = createGateTail;
  let release: () => void = () => undefined;
  createGateTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

async function waitForCreateCooldown(
  input: Pick<RunManagedAgentSessionInput<unknown>, "onActivity">,
  timings: AgentSessionGateTimings,
  clock: AgentSessionGateClock,
) {
  if (lastCreateStartedAtMs === null) return;

  const elapsedMs = clock.now() - lastCreateStartedAtMs;
  const waitMs = timings.createCooldownMs - elapsedMs;
  if (waitMs <= 0) return;

  input.onActivity?.(`Waiting ${describeDelay(waitMs)} before creating a new Agent session`);
  await clock.sleep(waitMs);
}

async function createSessionWithGate<T>(
  input: RunManagedAgentSessionInput<T>,
  timings: AgentSessionGateTimings,
  clock: AgentSessionGateClock,
  avoidSessionUuid: string,
): Promise<AgentSessionMeta> {
  let sameUuidAttempts = 0;

  for (;;) {
    const sessionMeta = await runExclusive(async () => {
      await waitForCreateCooldown(input, timings, clock);
      lastCreateStartedAtMs = clock.now();
      return input.createSession();
    });
    const uuid = sessionUuid(sessionMeta.session);

    if (uuid) {
      lastCreatedSessionUuid = uuid;
    }

    if (!uuid || uuid !== avoidSessionUuid) {
      return sessionMeta;
    }

    input.onActivity?.(
      `Agent session uuid was reused; deleting it and waiting before retrying`,
    );
    await deleteSessionWithRetry(input, timings, clock, sessionMeta.session);
    sameUuidAttempts += 1;
    if (sameUuidAttempts > timings.maxSameUuidGuardRetries) {
      throw new AgentSessionGateError(
        `Agent session uuid ${uuid} was reused after ${timings.maxSameUuidGuardRetries} retries.`,
        "session_uuid_reused",
      );
    }
  }
}

async function deleteSessionWithRetry<T>(
  input: RunManagedAgentSessionInput<T>,
  timings: AgentSessionGateTimings,
  clock: AgentSessionGateClock,
  session: AnnaAgentSession,
) {
  for (let attempt = 0; attempt <= timings.deleteRetryDelaysMs.length; attempt += 1) {
    try {
      await input.deleteSession(session);
      return;
    } catch (error) {
      if (isIdempotentDeleteError(error)) {
        return;
      }
      const retryDelay = timings.deleteRetryDelaysMs[attempt];
      if (retryDelay === undefined) {
        throw new AgentSessionGateError(
          `Agent session delete failed after retries: ${errorMessage(error)}`,
          "session_delete_failed",
          error,
        );
      }
      input.onActivity?.(
        `Agent session delete failed; retrying in ${describeDelay(retryDelay)}`,
      );
      await clock.sleep(retryDelay);
    }
  }
}

async function runWithWatchdog<T>(
  input: RunManagedAgentSessionInput<T>,
  timings: AgentSessionGateTimings,
  sessionMeta: AgentSessionMeta,
): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const runPromise = input.runSession(sessionMeta);
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new AgentSessionWatchdogError(timings.runWatchdogMs));
    }, timings.runWatchdogMs);
  });

  try {
    return await Promise.race([runPromise, timeoutPromise]);
  } catch (error) {
    runPromise.catch(() => undefined);
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function isRetryableSessionRunError<T>(
  input: RunManagedAgentSessionInput<T>,
  error: unknown,
) {
  return error instanceof AgentSessionWatchdogError || input.isRecoverableRunError(error);
}

export async function runManagedAgentSession<T>(
  input: RunManagedAgentSessionInput<T>,
): Promise<RunManagedAgentSessionResult<T>> {
  const timings = resolveTimings(input.timings);
  const clock = resolveClock(input.clock);
  let sessionRetries = 0;
  let avoidSessionUuid = "";

  for (;;) {
    const sessionMeta = await createSessionWithGate(input, timings, clock, avoidSessionUuid);
    let cleanupAttempted = false;
    try {
      const result = await runWithWatchdog(input, timings, sessionMeta);
      cleanupAttempted = true;
      await deleteSessionWithRetry(input, timings, clock, sessionMeta.session);
      return { result, sessionRetries };
    } catch (error) {
      if (cleanupAttempted) {
        throw error;
      }
      const retryable = isRetryableSessionRunError(input, error);
      avoidSessionUuid = sessionUuid(sessionMeta.session) || lastCreatedSessionUuid;
      cleanupAttempted = true;
      await deleteSessionWithRetry(input, timings, clock, sessionMeta.session);

      if (retryable && sessionRetries < timings.maxSessionRetries) {
        sessionRetries += 1;
        input.onActivity?.(
          `Agent session failed; waiting before retrying with a new session`,
        );
        continue;
      }

      throw error;
    }
  }
}

export function resetAgentSessionGateForTests() {
  createGateTail = Promise.resolve();
  lastCreateStartedAtMs = null;
  lastCreatedSessionUuid = "";
}
