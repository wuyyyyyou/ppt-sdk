import type { RenderDeckHtmlResult } from "../../../api/types";

interface RenderedSlideImageProps {
  slide: RenderDeckHtmlResult["slides"][number];
  loading?: "eager" | "lazy";
}

export function RenderedSlideImage({
  slide,
  loading = "lazy"
}: RenderedSlideImageProps) {
  if (!slide.screenshot_url) {
    return null;
  }

  return (
    <img
      src={slide.screenshot_url}
      alt={slide.title}
      loading={loading}
      decoding="async"
    />
  );
}
