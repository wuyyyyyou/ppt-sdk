let screenshotRenderQueue: Promise<unknown> = Promise.resolve();

export async function withScreenshotRenderQueue<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const run = screenshotRenderQueue.catch(() => undefined).then(operation);
  screenshotRenderQueue = run.catch(() => undefined);
  return run;
}
