export async function openFullscreenPreview(
  element: HTMLElement | null,
  fallback: () => void,
): Promise<void> {
  if (!element?.requestFullscreen) {
    fallback();
    return;
  }

  try {
    await element.requestFullscreen();
  } catch {
    fallback();
  }
}
