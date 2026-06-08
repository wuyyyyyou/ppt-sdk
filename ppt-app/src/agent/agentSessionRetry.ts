export const DEFAULT_AGENT_SESSION_CACHE_MISS_MAX_RETRIES = 100;
export const DEFAULT_AGENT_SESSION_CACHE_MISS_TOTAL_WAIT_MS = 15 * 60 * 1000;
export const DEFAULT_AGENT_SESSION_CACHE_MISS_FIXED_RETRIES = 10;
export const DEFAULT_AGENT_SESSION_CACHE_MISS_FIXED_DELAY_MS = 1000;
export const DEFAULT_AGENT_SESSION_CACHE_MISS_MAX_DELAY_MS = 60 * 1000;
export const DEFAULT_AGENT_SESSION_CACHE_MISS_JITTER_RATIO = 0.2;

export interface AgentSessionCacheMissRetryConfig {
  maxRetries: number;
  maxTotalWaitMs: number;
  fixedRetries: number;
  fixedDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface AgentSessionCacheMissRetryState {
  retries: number;
  totalWaitMs: number;
}

export interface AgentSessionCacheMissRetryDecision {
  retry: true;
  retryNumber: number;
  delayMs: number;
  totalWaitMs: number;
}

export type AgentSessionCacheMissRetryResult =
  | AgentSessionCacheMissRetryDecision
  | {
      retry: false;
      retries: number;
      totalWaitMs: number;
      reason: "max_retries" | "max_total_wait";
    };

export function createAgentSessionCacheMissRetryConfig(
  input: Partial<AgentSessionCacheMissRetryConfig> = {},
): AgentSessionCacheMissRetryConfig {
  return {
    maxRetries:
      input.maxRetries ?? DEFAULT_AGENT_SESSION_CACHE_MISS_MAX_RETRIES,
    maxTotalWaitMs:
      input.maxTotalWaitMs ?? DEFAULT_AGENT_SESSION_CACHE_MISS_TOTAL_WAIT_MS,
    fixedRetries:
      input.fixedRetries ?? DEFAULT_AGENT_SESSION_CACHE_MISS_FIXED_RETRIES,
    fixedDelayMs:
      input.fixedDelayMs ?? DEFAULT_AGENT_SESSION_CACHE_MISS_FIXED_DELAY_MS,
    maxDelayMs: input.maxDelayMs ?? DEFAULT_AGENT_SESSION_CACHE_MISS_MAX_DELAY_MS,
    jitterRatio:
      input.jitterRatio ?? DEFAULT_AGENT_SESSION_CACHE_MISS_JITTER_RATIO,
  };
}

export function isAgentSessionCacheMissMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no cached") &&
    normalized.includes("app_session") &&
    normalized.includes("token")
  );
}

export function calculateAgentSessionCacheMissDelayMs(input: {
  retryNumber: number;
  config?: Partial<AgentSessionCacheMissRetryConfig>;
  random?: () => number;
}): number {
  const config = createAgentSessionCacheMissRetryConfig(input.config);
  if (input.retryNumber <= config.fixedRetries) {
    return config.fixedDelayMs;
  }

  const exponentialStep = input.retryNumber - config.fixedRetries;
  const baseDelay = Math.min(
    config.fixedDelayMs * 2 ** exponentialStep,
    config.maxDelayMs,
  );
  const random = input.random ?? Math.random;
  const jitterOffset = (random() * 2 - 1) * config.jitterRatio;
  const jitteredDelay = Math.round(baseDelay * (1 + jitterOffset));
  return Math.max(0, Math.min(jitteredDelay, config.maxDelayMs));
}

export function nextAgentSessionCacheMissRetry(input: {
  state: AgentSessionCacheMissRetryState;
  config?: Partial<AgentSessionCacheMissRetryConfig>;
  random?: () => number;
}): AgentSessionCacheMissRetryResult {
  const config = createAgentSessionCacheMissRetryConfig(input.config);
  if (input.state.retries >= config.maxRetries) {
    return {
      retry: false,
      retries: input.state.retries,
      totalWaitMs: input.state.totalWaitMs,
      reason: "max_retries",
    };
  }

  const retryNumber = input.state.retries + 1;
  const delayMs = calculateAgentSessionCacheMissDelayMs({
    retryNumber,
    config,
    random: input.random,
  });
  const totalWaitMs = input.state.totalWaitMs + delayMs;
  if (totalWaitMs > config.maxTotalWaitMs) {
    return {
      retry: false,
      retries: input.state.retries,
      totalWaitMs: input.state.totalWaitMs,
      reason: "max_total_wait",
    };
  }

  input.state.retries = retryNumber;
  input.state.totalWaitMs = totalWaitMs;
  return {
    retry: true,
    retryNumber,
    delayMs,
    totalWaitMs,
  };
}

export function shouldReportAgentSessionCacheMissRetry(retryNumber: number) {
  return retryNumber === 1 || retryNumber % 10 === 0;
}
