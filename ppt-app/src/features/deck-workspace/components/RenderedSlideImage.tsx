import type { RenderDeckHtmlResult } from "../../../api/types";

interface RenderedSlideImageProps {
  slide: RenderDeckHtmlResult["slides"][number];
  loading?: "eager" | "lazy";
}

export function RenderedSlideImage({
  slide,
  loading = "lazy"
}: RenderedSlideImageProps) {
  const screenshotUrl = slide.screenshot_upload?.url;
  if (!screenshotUrl) {
    return null;
  }

  return (
    <img
      src={screenshotUrl}
      alt={slide.title}
      loading={loading}
      decoding="async"
    />
  );
}
