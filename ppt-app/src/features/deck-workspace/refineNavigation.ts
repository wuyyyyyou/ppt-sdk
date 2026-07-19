export function resolveRefineSlideIndex(value: unknown, currentSlide: number, slideCount: number) {
  const requested = typeof value === "number" && Number.isInteger(value) ? value : currentSlide;
  if (slideCount <= 0) return 0;
  return Math.min(Math.max(requested, 0), slideCount - 1);
}
