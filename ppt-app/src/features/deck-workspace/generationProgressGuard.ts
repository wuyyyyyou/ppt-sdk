export function createOperationScopedProgressHandler<T>(
  signal: AbortSignal,
  ownsOperation: (signal: AbortSignal) => boolean,
  onProgress: (progress: T) => void,
) {
  return (progress: T) => {
    if (!ownsOperation(signal)) return;
    onProgress(progress);
  };
}
