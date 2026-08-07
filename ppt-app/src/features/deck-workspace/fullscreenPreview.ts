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

export async function startFullscreenPresentation(
  element: HTMLElement | null,
  enterPresentMode: () => void,
): Promise<void> {
  enterPresentMode();
  await openFullscreenPreview(element, () => undefined);
}
