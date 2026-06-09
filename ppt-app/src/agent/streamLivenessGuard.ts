export interface StreamLivenessTimer {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(timeoutId: unknown): void;
}

export interface StreamLivenessGuardOptions {
  idleMs: number;
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  timer?: StreamLivenessTimer;
  cancelPollMs?: number;
}

export class StreamIdleTimeoutError extends Error {
  constructor(idleMs: number) {
    super(`Agent stream idle timeout after ${idleMs}ms`);
    this.name = "StreamIdleTimeoutError";
  }
}

export class StreamCancelledError extends Error {
  constructor() {
    super("Agent stream cancelled");
    this.name = "StreamCancelledError";
  }
}

export function isStreamIdleTimeoutError(error: unknown): error is StreamIdleTimeoutError {
  return error instanceof StreamIdleTimeoutError;
}

export function isStreamCancelledError(error: unknown): error is StreamCancelledError {
  return error instanceof StreamCancelledError;
}

const defaultTimer: StreamLivenessTimer = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (timeoutId) => globalThis.clearTimeout(timeoutId as ReturnType<typeof globalThis.setTimeout>),
};

function cancelled(options: StreamLivenessGuardOptions) {
  return options.signal?.aborted === true || options.isCancelled?.() === true;
}

async function nextWithLiveness<T>(
  iterator: AsyncIterator<T>,
  options: StreamLivenessGuardOptions,
): Promise<IteratorResult<T>> {
  const timer = options.timer ?? defaultTimer;
  let idleId: unknown;
  let pollId: unknown;
  let removeAbortListener: (() => void) | undefined;

  const idlePromise = new Promise<never>((_, reject) => {
    idleId = timer.setTimeout(
      () => reject(new StreamIdleTimeoutError(options.idleMs)),
      options.idleMs,
    );
  });

  const cancelPromise = new Promise<never>((_, reject) => {
    const rejectCancelled = () => reject(new StreamCancelledError());
    if (options.signal) {
      options.signal.addEventListener("abort", rejectCancelled, { once: true });
      removeAbortListener = () => options.signal?.removeEventListener("abort", rejectCancelled);
    }
    if (options.isCancelled) {
      const poll = () => {
        if (options.isCancelled?.()) {
          rejectCancelled();
          return;
        }
        pollId = timer.setTimeout(poll, options.cancelPollMs ?? 100);
      };
      pollId = timer.setTimeout(poll, options.cancelPollMs ?? 100);
    }
  });

  try {
    return await Promise.race([iterator.next(), idlePromise, cancelPromise]);
  } finally {
    if (idleId !== undefined) timer.clearTimeout(idleId);
    if (pollId !== undefined) timer.clearTimeout(pollId);
    removeAbortListener?.();
  }
}

export async function* guardStreamLiveness<T>(
  stream: AsyncIterable<T>,
  options: StreamLivenessGuardOptions,
): AsyncIterable<T> {
  const iterator = stream[Symbol.asyncIterator]();

  try {
    for (;;) {
      if (cancelled(options)) {
        throw new StreamCancelledError();
      }

      const result = await nextWithLiveness(iterator, options);

      if (result.done) return;
      yield result.value;
    }
  } catch (error) {
    if (isStreamIdleTimeoutError(error) || isStreamCancelledError(error)) {
      const returned = iterator.return?.();
      void returned?.catch(() => undefined);
    }
    throw error;
  }
}
