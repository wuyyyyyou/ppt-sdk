let screenshotRenderQueue: Promise<unknown> = Promise.resolve();

export interface ScreenshotRenderQueueOptions {
  timeoutMs?: number;
  onTimeout?: () => Promise<void>;
  label?: string;
}

async function runWithTimeout<T>(
  operation: () => Promise<T>,
  options: ScreenshotRenderQueueOptions,
): Promise<T> {
  const timeoutMs = options.timeoutMs;
  if (timeoutMs === undefined) return operation();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(async () => {
      if (settled) return;
      settled = true;
      try {
        await options.onTimeout?.();
      } catch {
        // The timeout error remains the primary failure; cleanup is best effort.
      }
      reject(new Error(
        `${options.label ?? "Screenshot render operation"} timed out after ${timeoutMs}ms`,
      ));
    }, timeoutMs);

    Promise.resolve().then(operation).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function withScreenshotRenderQueue<T>(
  operation: () => Promise<T>,
  options: ScreenshotRenderQueueOptions = {},
): Promise<T> {
  const run = screenshotRenderQueue
    .catch(() => undefined)
    .then(() => runWithTimeout(operation, options));
  screenshotRenderQueue = run.catch(() => undefined);
  return run;
}
